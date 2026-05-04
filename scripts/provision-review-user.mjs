#!/usr/bin/env node
/**
 * provision-review-user.mjs
 *
 * One-time provisioning of the Play Console / App Store reviewer
 * account that the `review-login` Edge Function issues magic links for.
 * Idempotent: re-running with the same email is a no-op once the user
 * and matching `servants` row already exist.
 *
 * Usage (from a shell with the project's service-role key in env):
 *
 *   SUPABASE_URL=https://<ref>.supabase.co \
 *   SUPABASE_SERVICE_ROLE_KEY=<service role> \
 *     node scripts/provision-review-user.mjs \
 *       --email playreview-<8 hex>@stminaconnect.app \
 *       [--display-name "Play Review"] \
 *       [--role servant]
 *
 * The `--email` value MUST match the `REVIEW_BYPASS_EMAIL` Supabase
 * Edge Function secret in the same project. Generate a fresh local-part
 * with:  printf 'playreview-%s@stminaconnect.app\n' $(openssl rand -hex 4)
 *
 * Why a script and not a SQL seed: auth users are created via
 * `auth.admin.createUser` with a service-role key — they cannot be
 * inserted directly into `auth.users` from a migration. Keeping the
 * provisioning step out of migrations also avoids coupling deploy
 * pipelines to a specific reviewer email.
 */

/* eslint-disable no-console -- ops script: stdout/stderr is the UX */
import { createClient } from '@supabase/supabase-js';
import process from 'node:process';

function arg(name, fallback) {
  const flag = `--${name}`;
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return fallback;
  const value = process.argv[idx + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}`);
  }
  return value;
}

const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment first.');
  process.exit(1);
}

const email = arg('email');
if (!email) {
  console.error('Pass --email <reviewer email> (must match REVIEW_BYPASS_EMAIL secret).');
  process.exit(1);
}
const displayName = arg('display-name', 'App Review');
const role = arg('role', 'servant');
if (role !== 'servant' && role !== 'admin') {
  console.error(`Invalid --role "${role}" (must be "servant" or "admin").`);
  process.exit(1);
}

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findExistingUser(targetEmail) {
  // listUsers paginates; the reviewer user should be early, but iterate to be safe.
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find(
      (u) => (u.email ?? '').toLowerCase() === targetEmail.toLowerCase(),
    );
    if (match) return match;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureAuthUser(targetEmail) {
  const existing = await findExistingUser(targetEmail);
  if (existing) {
    console.log(`auth user already exists: ${existing.id}`);
    return existing;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: targetEmail,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) throw error;
  if (!data.user) throw new Error('createUser returned no user');
  console.log(`created auth user: ${data.user.id}`);
  return data.user;
}

async function ensureServantRow(userId, targetEmail) {
  const { data: existing, error: selectError } = await admin
    .from('servants')
    .select('id, email, role')
    .eq('id', userId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) {
    console.log(`servants row already exists for ${existing.email} (role=${existing.role})`);
    return existing;
  }
  const { data, error } = await admin
    .from('servants')
    .insert({
      id: userId,
      email: targetEmail,
      display_name: displayName,
      role,
    })
    .select('*')
    .single();
  if (error) throw error;
  console.log(`inserted servants row: id=${data.id} role=${data.role}`);
  return data;
}

try {
  const user = await ensureAuthUser(email);
  await ensureServantRow(user.id, email);
  console.log('done.');
} catch (e) {
  console.error('provisioning failed:', e);
  process.exit(1);
}
