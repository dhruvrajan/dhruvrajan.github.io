/**
 * Cloudflare Access JWT checks for the lyrics key endpoint.
 * Pure helpers — no env secrets, no logging of secrets.
 */

export interface AccessJwtHeader {
  alg?: string;
  kid?: string;
  typ?: string;
}

export interface AccessJwtClaims {
  aud?: string | string[];
  exp?: number;
  email?: string;
  common_name?: string;
  [key: string]: unknown;
}

export interface VerifyAccessJwtOptions {
  audience: string;
  /** Resolve the RS256 public key for the JWT header (typically from Access JWKS). */
  getKey: (header: AccessJwtHeader) => Promise<CryptoKey>;
  /** Epoch seconds; defaults to Date.now()/1000. */
  nowSec?: number;
}

function b64UrlToBytes(input: string): Uint8Array {
  const pad = '='.repeat((4 - (input.length % 4)) % 4);
  const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function utf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

export function parseAllowedEmails(csv: string | null | undefined): Set<string> {
  const set = new Set<string>();
  for (const part of String(csv || '').split(',')) {
    const email = part.trim().toLowerCase();
    if (email) set.add(email);
  }
  return set;
}

export function emailAllowed(
  email: string | null | undefined,
  allowed: Set<string>,
): boolean {
  if (!email) return false;
  return allowed.has(String(email).trim().toLowerCase());
}

export function audienceMatches(
  aud: string | string[] | undefined,
  expected: string,
): boolean {
  if (!expected) return false;
  if (typeof aud === 'string') return aud === expected;
  if (Array.isArray(aud)) return aud.includes(expected);
  return false;
}

export function decodeJwtPart<T>(part: string): T {
  const json = new TextDecoder().decode(b64UrlToBytes(part));
  return JSON.parse(json) as T;
}

/**
 * Verify a Cloudflare Access assertion JWT (RS256): signature, aud, exp.
 * Does not check the email allowlist — call emailAllowed separately.
 */
export async function verifyAccessJwt(
  token: string,
  options: VerifyAccessJwtOptions,
): Promise<AccessJwtClaims> {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];
  const header = decodeJwtPart<AccessJwtHeader>(headerB64);
  if (header.alg !== 'RS256') {
    throw new Error('Unsupported JWT alg');
  }
  const key = await options.getKey(header);
  const ok = await crypto.subtle.verify(
    { name: 'RSASSA-PKCS1-v1_5' },
    key,
    b64UrlToBytes(sigB64) as BufferSource,
    utf8(`${headerB64}.${payloadB64}`) as BufferSource,
  );
  if (!ok) {
    throw new Error('Invalid JWT signature');
  }

  const claims = decodeJwtPart<AccessJwtClaims>(payloadB64);
  if (!audienceMatches(claims.aud, options.audience)) {
    throw new Error('Invalid JWT audience');
  }
  const now = options.nowSec ?? Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== 'number' || claims.exp <= now) {
    throw new Error('JWT expired');
  }
  return claims;
}

/** Prefer the email claim; some IdPs put identity in common_name. */
export function identityEmail(claims: AccessJwtClaims): string | null {
  const email = claims.email || claims.common_name;
  if (!email) return null;
  const s = String(email).trim();
  return s || null;
}

export async function importRsaPublicKeyJwk(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
}

export function accessCertsUrl(teamDomain: string): string {
  const host = String(teamDomain || '')
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '');
  return `https://${host}/cdn-cgi/access/certs`;
}
