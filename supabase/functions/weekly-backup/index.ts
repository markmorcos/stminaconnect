/**
 * weekly-backup — off-Supabase backup of the public schema tables to
 * Backblaze B2. Triggered every Sunday at 02:00 Europe/Berlin by
 * pg_cron (see migration 031_pg_cron_weekly_backup.sql) and on-demand
 * via a service-role POST to the function URL.
 *
 * What it does:
 *   1. Connects to the database via DATABASE_URL (Supabase pre-populates
 *      this secret automatically).
 *   2. Enumerates all user tables in the `public` schema and pulls each
 *      one as `json_agg(t)` — one round-trip per table, all rows in
 *      memory. Acceptable at our scale (parish-sized; typical < 5MB
 *      uncompressed, < 1MB gzipped).
 *   3. Wraps the per-table arrays in `{ generated_at, version, tables }`
 *      and gzips the result.
 *   4. Uploads to the configured B2 bucket using B2's native API
 *      (cleaner than S3 v4 signing for a single PUT). The object key
 *      is `weekly-backup/<YYYY-MM-DD>-<unix>.json.gz`.
 *   5. Returns a JSON summary with the table count, byte count, and
 *      object name.
 *
 * Trade-off vs `pg_dump`: this is a *logical JSON snapshot*, not a
 * pg_dump. It captures data but not schema (CREATE TABLE / ALTER
 * TABLE statements aren't reproduced). Restore path: replay the
 * migrations to recreate the schema, then iterate the JSON arrays
 * back into the tables. For schema-aware backups, use the GitHub
 * Actions cron pattern documented in `docs/runbook.md` — that
 * runner has the `pg_dump` binary and can produce a true plain-text
 * dump alongside this snapshot.
 *
 * Required Edge Function secrets (set via `supabase secrets set`):
 *   BACKBLAZE_KEY_ID         — B2 application key id
 *   BACKBLAZE_APP_KEY        — B2 application key secret
 *   BACKBLAZE_BUCKET_ID      — target bucket id (NOT name)
 *   BACKBLAZE_BUCKET_NAME    — target bucket name (used in the URL)
 *
 * `DATABASE_URL` is provided by Supabase to all Edge Functions.
 */

// @ts-ignore — module specifier resolved by Deno, not by Node type-checker.
import { Client } from 'https://deno.land/x/postgres@v0.19.3/mod.ts';
// @ts-ignore — module specifier resolved by Deno, not by Node type-checker.
import { gzip } from 'https://deno.land/x/compress@v0.4.5/mod.ts';

// Deno globals — Edge Runtime resolves these at runtime; suppressed for
// the Node TS check that Jest uses.
// @ts-ignore
declare const Deno: { env: { get(name: string): string | undefined } };

interface BackupResult {
  outcome: 'success' | 'error';
  generated_at: string;
  object_name?: string;
  table_count?: number;
  uncompressed_bytes?: number;
  compressed_bytes?: number;
  error?: string;
}

function readEnvOrThrow(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing env var: ${name}`);
  return v;
}

/**
 * Lists every base table in the `public` schema. Excludes views,
 * materialized views, and the audit-log partitions (if any) so the
 * snapshot is a deterministic set of user tables.
 */
async function listPublicTables(client: Client): Promise<string[]> {
  const { rows } = await client.queryObject<{ tablename: string }>(
    `select tablename from pg_tables
      where schemaname = 'public'
      order by tablename`,
  );
  return rows.map((r) => r.tablename);
}

async function snapshotTable(client: Client, table: string): Promise<unknown[]> {
  // `json_agg` returns null for empty tables; coalesce to empty array.
  // The identifier is whitelisted from `pg_tables` above so plain
  // string interpolation here is safe (no user-controlled input).
  const { rows } = await client.queryObject<{ data: unknown[] | null }>(
    `select coalesce(json_agg(t), '[]'::json) as data from public."${table}" t`,
  );
  return rows[0]?.data ?? [];
}

interface B2Auth {
  apiUrl: string;
  authorizationToken: string;
}

async function b2Authorize(keyId: string, appKey: string): Promise<B2Auth> {
  const credentials = btoa(`${keyId}:${appKey}`);
  const resp = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account', {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`B2 authorize failed: ${resp.status} ${body}`);
  }
  const json = (await resp.json()) as {
    apiInfo: { storageApi: { apiUrl: string } };
    authorizationToken: string;
  };
  return {
    apiUrl: json.apiInfo.storageApi.apiUrl,
    authorizationToken: json.authorizationToken,
  };
}

interface B2UploadUrl {
  uploadUrl: string;
  authorizationToken: string;
}

async function b2GetUploadUrl(auth: B2Auth, bucketId: string): Promise<B2UploadUrl> {
  const resp = await fetch(`${auth.apiUrl}/b2api/v3/b2_get_upload_url`, {
    method: 'POST',
    headers: {
      Authorization: auth.authorizationToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ bucketId }),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`B2 get_upload_url failed: ${resp.status} ${body}`);
  }
  return (await resp.json()) as B2UploadUrl;
}

async function sha1Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function b2Upload(upload: B2UploadUrl, fileName: string, bytes: Uint8Array): Promise<void> {
  const sha1 = await sha1Hex(bytes);
  const resp = await fetch(upload.uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: upload.authorizationToken,
      'X-Bz-File-Name': encodeURIComponent(fileName),
      'Content-Type': 'application/gzip',
      'X-Bz-Content-Sha1': sha1,
      'Content-Length': String(bytes.byteLength),
    },
    body: bytes,
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`B2 upload failed: ${resp.status} ${body}`);
  }
}

async function runBackup(): Promise<BackupResult> {
  const generatedAt = new Date().toISOString();
  const databaseUrl = readEnvOrThrow('DATABASE_URL');
  const b2KeyId = readEnvOrThrow('BACKBLAZE_KEY_ID');
  const b2AppKey = readEnvOrThrow('BACKBLAZE_APP_KEY');
  const b2BucketId = readEnvOrThrow('BACKBLAZE_BUCKET_ID');

  const client = new Client(databaseUrl);
  await client.connect();
  let snapshot: Record<string, unknown[]>;
  let tableCount = 0;
  try {
    const tables = await listPublicTables(client);
    snapshot = {};
    for (const t of tables) {
      snapshot[t] = await snapshotTable(client, t);
    }
    tableCount = tables.length;
  } finally {
    await client.end();
  }

  const payload = {
    generated_at: generatedAt,
    version: 1,
    tables: snapshot,
  };
  const json = JSON.stringify(payload);
  const uncompressedBytes = new TextEncoder().encode(json);
  const compressedBytes = gzip(uncompressedBytes);

  const auth = await b2Authorize(b2KeyId, b2AppKey);
  const upload = await b2GetUploadUrl(auth, b2BucketId);
  const datePrefix = generatedAt.slice(0, 10); // YYYY-MM-DD
  const objectName = `weekly-backup/${datePrefix}-${Date.now()}.json.gz`;
  await b2Upload(upload, objectName, compressedBytes);

  return {
    outcome: 'success',
    generated_at: generatedAt,
    object_name: objectName,
    table_count: tableCount,
    uncompressed_bytes: uncompressedBytes.byteLength,
    compressed_bytes: compressedBytes.byteLength,
  };
}

// @ts-ignore — Deno.serve is the Edge Runtime entry point.
Deno.serve(async () => {
  try {
    const result = await runBackup();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const result: BackupResult = {
      outcome: 'error',
      generated_at: new Date().toISOString(),
      error: message,
    };
    return new Response(JSON.stringify(result), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
