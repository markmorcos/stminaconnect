/**
 * Logger — thin level-aware wrapper around `console` that doubles as
 * a server-side error capture in production builds.
 *
 *   - dev (`__DEV__ === true`): every level prints to console with a
 *     `[level] message` prefix; nothing leaves the device.
 *   - prod build: only `warn` + `error` print; `error` calls also
 *     INSERT a row into `public.logs` (see `030_logs.sql`) so admins
 *     can read recent failures from the About / Diagnostics screen.
 *
 * Server-side capture is fire-and-forget — a failed insert can't be
 * surfaced anywhere safe, so we swallow the error rather than logging
 * about logging.
 *
 * Call sites should prefer the named methods (`logger.warn`,
 * `logger.error`) over `console.*` so dev/prod behaviour is consistent.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';

import { supabase } from '@/services/api/supabase';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

function appVersion(): string | undefined {
  const v = Constants.expoConfig?.version;
  return typeof v === 'string' ? v : undefined;
}

function platformName(): 'ios' | 'android' | 'web' | undefined {
  if (Platform.OS === 'ios' || Platform.OS === 'android' || Platform.OS === 'web') {
    return Platform.OS;
  }
  return undefined;
}

function shouldPrint(level: LogLevel): boolean {
  if (__DEV__) return true;
  return level === 'warn' || level === 'error';
}

function print(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldPrint(level)) return;
  const prefix = `[${level}]`;
  if (context !== undefined) {
    if (level === 'error') console.error(prefix, message, context);
    else if (level === 'warn') console.warn(prefix, message, context);
    else console.log(prefix, message, context);
    return;
  }
  if (level === 'error') console.error(prefix, message);
  else if (level === 'warn') console.warn(prefix, message);
  else console.log(prefix, message);
}

async function persist(level: LogLevel, message: string, context?: LogContext): Promise<void> {
  if (__DEV__) return;
  if (level !== 'error') return;
  const payload = {
    level,
    message,
    context: context ?? null,
    app_version: appVersion() ?? null,
    platform: platformName() ?? null,
  };
  // Best-effort. Errors here are intentionally swallowed: we can't
  // surface a logging failure anywhere safe, and the device-side
  // console output already happened.
  await supabase
    .from('logs')
    .insert(payload)
    .then(
      () => undefined,
      () => undefined,
    );
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    print('debug', message, context);
  },
  info(message: string, context?: LogContext): void {
    print('info', message, context);
  },
  warn(message: string, context?: LogContext): void {
    print('warn', message, context);
  },
  error(message: string, context?: LogContext): void {
    print('error', message, context);
    void persist('error', message, context);
  },
};
