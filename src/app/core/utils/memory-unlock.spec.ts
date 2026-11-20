import {
  deriveNonExtractableKey,
  isForbiddenStorageKey,
  LEGACY_SENSITIVE_STORAGE_KEYS,
} from '../../../../shared/memory-unlock';

describe('memory-unlock storage contract', () => {
  it('marks legacy sensitive key names as forbidden', () => {
    for (const key of LEGACY_SENSITIVE_STORAGE_KEYS) {
      expect(isForbiddenStorageKey(key)).toBe(true);
    }
    expect(isForbiddenStorageKey('lyrics_song_content_view_v1')).toBe(false);
    expect(isForbiddenStorageKey('lyrics_text_size_v1')).toBe(false);
  });

  it('derives a non-extractable key without writing passphrase or key material', async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    const passphrase = 'test-only-fixture-passphrase';
    const salt = new Uint8Array(16).fill(3);
    const key = await deriveNonExtractableKey(passphrase, salt, 10_000);

    expect(key.extractable).toBe(false);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toBeTruthy();

    const sensitiveWrites = setItemSpy.mock.calls.filter((call: unknown[]) => {
      const keyName = String(call[0]);
      const val = String(call[1]);
      return (
        isForbiddenStorageKey(keyName) ||
        val.includes(passphrase) ||
        /lyrics_cache_key/i.test(keyName)
      );
    });
    expect(sensitiveWrites).toEqual([]);
    setItemSpy.mockRestore();
  });
});
