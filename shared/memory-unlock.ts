/**
 * Memory-only unlock helper (mirrors the lyrics page contract for tests).
 * Derives a non-extractable AES-GCM key and never touches Web Storage.
 */

export async function deriveNonExtractableKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  const saltBuf = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuf, iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt'],
  );
}

export const LEGACY_SENSITIVE_STORAGE_KEYS = [
  'lyrics_cache_key_v2',
  'lyrics_cache_remember_v2',
  'lyrics_cache_key',
  'lyrics_cache_remember',
  'lyrics_passphrase',
  'lyrics_key',
] as const;

/** Keys that must never be written to localStorage/sessionStorage. */
export const FORBIDDEN_STORAGE_KEY_PATTERNS = [
  /passphrase/i,
  /lyrics_cache_key/i,
  /lyrics_cache_remember/i,
  /lyrics_key/i,
  /cryptoKey/i,
  /aes.?key/i,
];

export function isForbiddenStorageKey(key: string): boolean {
  const name = String(key);
  if ((LEGACY_SENSITIVE_STORAGE_KEYS as readonly string[]).includes(name)) {
    return true;
  }
  return FORBIDDEN_STORAGE_KEY_PATTERNS.some((re) => re.test(name));
}
