/**
 * Deno tests for the Google service-account JWT signer.
 *
 * Run with:
 *   cd supabase/functions/sync-calendar-events && deno test --allow-net
 *
 * (--allow-net is needed because Deno's standard `assert` import is fetched
 * over HTTPS the first time; not because the tests touch the network.)
 *
 * We generate an ephemeral RSA-2048 keypair, export the private key as
 * PKCS8 PEM, hand it to `signServiceAccountJwt`, and assert the result
 * is a well-formed 3-segment JWT with the expected header + claim.
 */

import { assertEquals, assertMatch, assert } from 'https://deno.land/std@0.220.0/assert/mod.ts';

import { signServiceAccountJwt, type ServiceAccountKey } from './jwt.ts';

function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64UrlToString(seg: string): string {
  // Replace URL-safe chars and pad back to multiple of 4 before atob.
  const b64 = seg.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return atob(padded);
}

async function generateTestKey(): Promise<ServiceAccountKey> {
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
  const b64 = bytesToBase64(new Uint8Array(pkcs8));
  // Wrap to 64-char lines like a real PEM file.
  const lines = b64.match(/.{1,64}/g) ?? [b64];
  const pem = `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
  return {
    client_email: 'calendar-sync@example.iam.gserviceaccount.com',
    private_key: pem,
  };
}

Deno.test('signServiceAccountJwt produces a 3-segment compact JWT', async () => {
  const key = await generateTestKey();
  const jwt = await signServiceAccountJwt(key, 1_700_000_000);
  const parts = jwt.split('.');
  assertEquals(parts.length, 3, 'JWT must have header.payload.signature');
  for (const p of parts) {
    assertMatch(p, /^[A-Za-z0-9_-]+$/, 'each segment must be base64url');
    assert(p.length > 0, 'no segment may be empty');
  }
});

Deno.test('JWT header is RS256/JWT', async () => {
  const key = await generateTestKey();
  const jwt = await signServiceAccountJwt(key, 1_700_000_000);
  const header = JSON.parse(base64UrlToString(jwt.split('.')[0]));
  assertEquals(header.alg, 'RS256');
  assertEquals(header.typ, 'JWT');
});

Deno.test('JWT claim sets iss, scope, aud, iat, exp correctly', async () => {
  const now = 1_700_000_000;
  const key = await generateTestKey();
  const jwt = await signServiceAccountJwt(key, now);
  const claim = JSON.parse(base64UrlToString(jwt.split('.')[1]));
  assertEquals(claim.iss, key.client_email);
  assertEquals(claim.scope, 'https://www.googleapis.com/auth/calendar.readonly');
  assertEquals(claim.aud, 'https://oauth2.googleapis.com/token');
  assertEquals(claim.iat, now);
  assertEquals(claim.exp, now + 3600);
});

Deno.test('signature is verifiable with the matching public key', async () => {
  // Generate a key, sign a JWT, then verify the signature roundtrip
  // using the corresponding public key. This proves the header.payload
  // bytes are exactly what was signed (no encoding drift).
  const pair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey);
  const b64 = bytesToBase64(new Uint8Array(pkcs8));
  const lines = b64.match(/.{1,64}/g) ?? [b64];
  const pem = `-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----\n`;
  const key: ServiceAccountKey = { client_email: 'verify@example.iam', private_key: pem };

  const jwt = await signServiceAccountJwt(key, 1_700_000_000);
  const [h, p, s] = jwt.split('.');
  const signingInput = new TextEncoder().encode(`${h}.${p}`);
  const sigBytes = Uint8Array.from(base64UrlToString(s), (c) => c.charCodeAt(0));

  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    pair.publicKey,
    sigBytes,
    signingInput,
  );
  assertEquals(ok, true);
});
