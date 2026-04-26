/**
 * Google service-account JWT signing using Web Crypto.
 *
 * Deno (Supabase Edge Runtime) ships no Google SDK. Instead of pulling
 * in `googleapis`, we sign a 3-segment RS256 JWT ourselves and exchange
 * it for an OAuth2 access token at `oauth2.googleapis.com/token`.
 *
 * Spec: https://datatracker.ietf.org/doc/html/rfc7519
 *       https://developers.google.com/identity/protocols/oauth2/service-account#jwt-auth
 */

export interface ServiceAccountKey {
  client_email: string;
  private_key: string; // PEM-encoded PKCS8 RSA private key
  token_uri?: string;
}

const TOKEN_URI = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/calendar.readonly';

const enc = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  // Standard base64 then strip / map to URL-safe alphabet without padding.
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlEncodeJson(obj: unknown): string {
  return base64UrlEncode(enc.encode(JSON.stringify(obj)));
}

function pemToPkcs8Bytes(pem: string): Uint8Array {
  // Service account JSON stores the key as a PEM string with literal
  // "\n" sequences when serialized; we accept either real or escaped
  // newlines so callers don't have to pre-process.
  const normalized = pem.replace(/\\n/g, '\n');
  const body = normalized
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8Bytes(pem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

/**
 * Build a signed Google service-account JWT valid for 1 hour.
 * Returns the 3-segment compact JWT string.
 */
export async function signServiceAccountJwt(
  key: ServiceAccountKey,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: key.client_email,
    scope: SCOPE,
    aud: key.token_uri ?? TOKEN_URI,
    exp: nowSeconds + 3600,
    iat: nowSeconds,
  };

  const headerSeg = base64UrlEncodeJson(header);
  const claimSeg = base64UrlEncodeJson(claim);
  const signingInput = `${headerSeg}.${claimSeg}`;

  const cryptoKey = await importPrivateKey(key.private_key);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, enc.encode(signingInput));

  return `${signingInput}.${base64UrlEncode(new Uint8Array(sig))}`;
}

/**
 * Exchange a signed service-account JWT for an OAuth2 access token.
 * Throws on non-200 from Google.
 */
export async function fetchAccessToken(jwt: string, key: ServiceAccountKey): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt,
  });
  const resp = await fetch(key.token_uri ?? TOKEN_URI, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`google token exchange failed: ${resp.status} ${text}`);
  }
  const json = (await resp.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error('google token exchange returned no access_token');
  }
  return json.access_token;
}

/** Convenience: sign + exchange. */
export async function getAccessToken(key: ServiceAccountKey): Promise<string> {
  const jwt = await signServiceAccountJwt(key);
  return await fetchAccessToken(jwt, key);
}
