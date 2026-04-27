/**
 * Dev-only inspector for the local SQLite mirror.
 *
 *   - Lists every table, with its row count and column info.
 *   - Renders `sync_meta` inline (last_pull_at, schema_version, ...).
 *   - Lets you tap a table to peek at the first 50 rows.
 *   - Read-only SQL REPL (SELECT / PRAGMA only) at the bottom.
 *
 * Mounted under `/dev/db`. Not intended for end users; the route is
 * gated by `SHOW_DEV_TOOLS` in the home / about screens.
 */
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';

import { Button, Card, Input, Modal, Sheet, Spinner, Stack, Text, useTokens } from '@/design';
import { getDatabase, wipeLocalDatabase } from '@/services/db/database';
import { getSyncEngine, useSyncState } from '@/services/sync/SyncEngine';
import { useNotificationsStore } from '@/state/notificationsStore';

interface ColumnInfo {
  name: string;
  type: string;
  notnull: number;
  pk: number;
}

interface TableInfo {
  name: string;
  columns: ColumnInfo[];
  rowCount: number;
}

interface MetaEntry {
  key: string;
  value: string | null;
}

const SYSTEM_TABLE_PREFIXES = ['sqlite_', 'android_'];

function isSystemTable(name: string): boolean {
  return SYSTEM_TABLE_PREFIXES.some((p) => name.startsWith(p));
}

async function listTables(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name ASC`,
  );
  return rows.map((r) => r.name).filter((n) => !isSystemTable(n));
}

async function inspectTable(db: SQLiteDatabase, name: string): Promise<TableInfo> {
  const columns = await db.getAllAsync<ColumnInfo>(`PRAGMA table_info(${name})`);
  const countRows = await db.getAllAsync<{ n: number }>(`SELECT count(*) AS n FROM ${name}`);
  return { name, columns, rowCount: countRows[0]?.n ?? 0 };
}

async function readMeta(db: SQLiteDatabase): Promise<MetaEntry[]> {
  try {
    return await db.getAllAsync<MetaEntry>(`SELECT key, value FROM sync_meta ORDER BY key ASC`);
  } catch {
    return [];
  }
}

const READONLY_PREFIX = /^\s*(select|pragma|with)\b/i;

interface ReplResult {
  ok: boolean;
  rows?: Record<string, unknown>[];
  error?: string;
}

async function runReadonly(db: SQLiteDatabase, sql: string): Promise<ReplResult> {
  if (!READONLY_PREFIX.test(sql)) {
    return { ok: false, error: 'Only SELECT, PRAGMA, or WITH … SELECT statements are allowed.' };
  }
  try {
    const rows = await db.getAllAsync<Record<string, unknown>>(sql);
    return { ok: true, rows };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function DbInspectorScreen() {
  const { colors, spacing } = useTokens();
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [meta, setMeta] = useState<MetaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TableInfo | null>(null);
  const [selectedRows, setSelectedRows] = useState<Record<string, unknown>[]>([]);
  const [sql, setSql] = useState('SELECT * FROM persons LIMIT 5');
  const [replResult, setReplResult] = useState<ReplResult | null>(null);
  const [running, setRunning] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wiping, setWiping] = useState(false);

  const refresh = useCallback(async () => {
    const db = await getDatabase();
    const names = await listTables(db);
    const infos = await Promise.all(names.map((n) => inspectTable(db, n)));
    const m = await readMeta(db);
    setTables(infos);
    setMeta(m);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const onPickTable = async (info: TableInfo) => {
    const db = await getDatabase();
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM ${info.name} LIMIT 50`,
    );
    setSelected(info);
    setSelectedRows(rows);
  };

  const onRunSql = async () => {
    setRunning(true);
    try {
      const db = await getDatabase();
      const result = await runReadonly(db, sql);
      setReplResult(result);
    } finally {
      setRunning(false);
    }
  };

  const onWipe = async () => {
    setWiping(true);
    try {
      await wipeLocalDatabase();
      // Drop in-memory mirrors that read from the (now-gone) DB.
      useSyncState.setState({
        status: 'idle',
        queueLength: 0,
        lastPullAt: null,
        lastError: null,
        hasCompletedFirstPull: false,
        conflictedPersonName: null,
      });
      useNotificationsStore.getState().reset();
      // Reopen the (empty) DB and refresh the inspector.
      await refresh();
      setSelected(null);
      setSelectedRows([]);
      setReplResult(null);
      setConfirmWipe(false);
      // Kick a fresh pull so the next render sees data again.
      void getSyncEngine().runOnce();
    } finally {
      setWiping(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Spinner />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Card padding="lg">
          <Stack gap="sm">
            <Text variant="label" color={colors.textMuted}>
              sync_meta
            </Text>
            {meta.length === 0 ? (
              <Text variant="body" color={colors.textMuted}>
                (empty)
              </Text>
            ) : (
              meta.map((m) => (
                <View key={m.key} style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Text variant="bodySm" style={{ flexShrink: 0, fontFamily: 'monospace' }}>
                    {m.key}
                  </Text>
                  <Text
                    variant="bodySm"
                    color={colors.textMuted}
                    style={{ flex: 1, fontFamily: 'monospace' }}
                  >
                    {m.value ?? '(null)'}
                  </Text>
                </View>
              ))
            )}
            <Button variant="ghost" onPress={() => void refresh()}>
              Refresh
            </Button>
          </Stack>
        </Card>

        <Card padding="lg">
          <Stack gap="md">
            <Text variant="label" color={colors.textMuted}>
              Tables
            </Text>
            {tables.map((t) => (
              <View
                key={t.name}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingVertical: spacing.xs,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <View style={{ flex: 1 }}>
                  <Text variant="bodyLg" style={{ fontFamily: 'monospace' }}>
                    {t.name}
                  </Text>
                  <Text variant="caption" color={colors.textMuted}>
                    {t.columns.length} cols · {t.rowCount} rows
                  </Text>
                </View>
                <Button variant="secondary" size="sm" onPress={() => void onPickTable(t)}>
                  Peek
                </Button>
              </View>
            ))}
          </Stack>
        </Card>

        <Card padding="lg">
          <Stack gap="md">
            <Text variant="label" color={colors.textMuted}>
              Read-only SQL
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              SELECT / PRAGMA / WITH only. No mutations.
            </Text>
            <Input
              value={sql}
              onChangeText={setSql}
              multiline
              numberOfLines={4}
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="SQL query"
            />
            <Button onPress={() => void onRunSql()} loading={running} disabled={running}>
              Run
            </Button>
            {replResult ? <ReplResultView result={replResult} /> : null}
          </Stack>
        </Card>

        <Card padding="lg">
          <Stack gap="md">
            <Text variant="label" color={colors.textMuted}>
              Danger zone
            </Text>
            <Text variant="caption" color={colors.textMuted}>
              Wipes the local SQLite mirror, sync watermark, queued ops, and the in-memory
              notifications cache. Auth session is preserved; the next sync re-pulls from Supabase.
            </Text>
            <Button variant="destructive" onPress={() => setConfirmWipe(true)}>
              Wipe local DB
            </Button>
          </Stack>
        </Card>
      </ScrollView>

      <Sheet visible={selected !== null} onDismiss={() => setSelected(null)}>
        {selected ? (
          <ScrollView
            style={{ maxHeight: 600 }}
            contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
          >
            <Text variant="headingMd" style={{ fontFamily: 'monospace' }}>
              {selected.name}
            </Text>

            <Stack gap="xs">
              <Text variant="label" color={colors.textMuted}>
                Columns
              </Text>
              {selected.columns.map((c) => (
                <Text key={c.name} variant="bodySm" style={{ fontFamily: 'monospace' }}>
                  {c.name}: {c.type}
                  {c.notnull ? ' NOT NULL' : ''}
                  {c.pk ? ' PK' : ''}
                </Text>
              ))}
            </Stack>

            <Stack gap="xs">
              <Text variant="label" color={colors.textMuted}>
                Rows ({selectedRows.length} of {selected.rowCount})
              </Text>
              {selectedRows.length === 0 ? (
                <Text variant="body" color={colors.textMuted}>
                  (empty)
                </Text>
              ) : (
                selectedRows.map((row, i) => (
                  <View
                    key={i}
                    style={{
                      paddingVertical: spacing.xs,
                      borderBottomWidth: 1,
                      borderBottomColor: colors.border,
                    }}
                  >
                    {Object.entries(row).map(([k, v]) => (
                      <Text key={k} variant="caption" style={{ fontFamily: 'monospace' }}>
                        {k}: {formatValue(v)}
                      </Text>
                    ))}
                  </View>
                ))
              )}
            </Stack>
          </ScrollView>
        ) : null}
      </Sheet>

      <Modal
        visible={confirmWipe}
        onDismiss={() => (wiping ? undefined : setConfirmWipe(false))}
        dismissable={!wiping}
      >
        <Stack gap="md">
          <Text variant="headingMd">Wipe local DB?</Text>
          <Text variant="body" color={colors.textMuted}>
            All locally cached persons, events, attendance, notifications, and the sync watermark
            will be deleted from this device. Pending queued ops will be lost. Server data is
            untouched.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' }}>
            <Button variant="ghost" onPress={() => setConfirmWipe(false)} disabled={wiping}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onPress={() => void onWipe()}
              loading={wiping}
              disabled={wiping}
            >
              Wipe
            </Button>
          </View>
        </Stack>
      </Modal>
    </View>
  );
}

function ReplResultView({ result }: { result: ReplResult }) {
  const { colors, spacing } = useTokens();
  if (!result.ok) {
    return (
      <Text variant="bodySm" color={colors.error} style={{ fontFamily: 'monospace' }}>
        {result.error}
      </Text>
    );
  }
  const rows = result.rows ?? [];
  if (rows.length === 0) {
    return (
      <Text variant="bodySm" color={colors.textMuted}>
        (no rows)
      </Text>
    );
  }
  return (
    <Stack gap="xs">
      <Text variant="caption" color={colors.textMuted}>
        {rows.length} row(s)
      </Text>
      {rows.slice(0, 50).map((row, i) => (
        <View
          key={i}
          style={{
            paddingVertical: spacing.xs,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          {Object.entries(row).map(([k, v]) => (
            <Text key={k} variant="caption" style={{ fontFamily: 'monospace' }}>
              {k}: {formatValue(v)}
            </Text>
          ))}
        </View>
      ))}
    </Stack>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '(null)';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}
