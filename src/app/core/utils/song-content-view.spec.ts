import {
  extractChordsText,
  normalizeSongContentView,
  resolveSongBodyContent,
  shouldShowContentToggle,
} from './song-content-view';

describe('song-content-view', () => {
  it('defaults unknown views to lyrics', () => {
    expect(normalizeSongContentView(null)).toBe('lyrics');
    expect(normalizeSongContentView('')).toBe('lyrics');
    expect(normalizeSongContentView('both')).toBe('lyrics');
    expect(normalizeSongContentView('chords')).toBe('chords');
  });

  it('shows the toggle only when a chord sheet exists', () => {
    expect(shouldShowContentToggle(false)).toBe(false);
    expect(shouldShowContentToggle(true)).toBe(true);
  });

  it('resolves lyrics vs chords body content in the same slot', () => {
    const lyrics = 'Hello darkness';
    const chords = 'Am          G\nHello darkness';

    expect(resolveSongBodyContent('lyrics', lyrics, chords)).toEqual({
      kind: 'lyrics',
      text: lyrics,
      monospace: false,
    });

    expect(resolveSongBodyContent('chords', lyrics, chords)).toEqual({
      kind: 'chords',
      text: chords,
      monospace: true,
    });

    // Requested chords but none available → fall back to lyrics.
    expect(resolveSongBodyContent('chords', lyrics, '   ')).toEqual({
      kind: 'lyrics',
      text: lyrics,
      monospace: false,
    });
  });

  it('extracts chords_text from a decrypted sheet payload', () => {
    expect(extractChordsText(null)).toBeNull();
    expect(extractChordsText({})).toBeNull();
    expect(extractChordsText({ chords_text: '   ' })).toBeNull();
    expect(extractChordsText({ chords_text: 'C  G\nline' })).toBe('C  G\nline');
  });
});

describe('song-content-view crypto fixture', () => {
  async function encryptJson(
    passphrase: string,
    saltBytes: Uint8Array,
    iterations: number,
    payload: unknown,
  ): Promise<{ iv: string; ciphertext: string }> {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    const saltBuf = saltBytes.buffer.slice(
      saltBytes.byteOffset,
      saltBytes.byteOffset + saltBytes.byteLength,
    ) as ArrayBuffer;
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBuf, iterations, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt'],
    );
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipherBuf = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      enc.encode(JSON.stringify(payload)),
    );
    const b64 = (bytes: ArrayBuffer | Uint8Array) => {
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      let s = '';
      for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]!);
      return btoa(s);
    };
    return { iv: b64(iv), ciphertext: b64(cipherBuf) };
  }

  async function decryptJson(
    passphrase: string,
    saltBytes: Uint8Array,
    iterations: number,
    envelope: { iv: string; ciphertext: string },
  ): Promise<unknown> {
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey'],
    );
    const saltBuf = saltBytes.buffer.slice(
      saltBytes.byteOffset,
      saltBytes.byteOffset + saltBytes.byteLength,
    ) as ArrayBuffer;
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: saltBuf, iterations, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt'],
    );
    const fromB64 = (s: string) => {
      const bin = atob(s);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    };
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromB64(envelope.iv) },
      key,
      fromB64(envelope.ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(plain));
  }

  it('decrypts a local fixture chord sheet and resolves the chords view', async () => {
    const passphrase = 'test-only-fixture-passphrase';
    const salt = new Uint8Array(16).fill(7);
    const iterations = 10000; // low for unit speed; production uses salt.json
    const fixtureSheet = {
      title: 'Fixture Song',
      artist: 'Test Artist',
      chords_text: 'G        D\nDummy line one\nEm       C\nDummy line two\n',
    };

    const envelope = await encryptJson(passphrase, salt, iterations, fixtureSheet);
    const decrypted = await decryptJson(passphrase, salt, iterations, envelope);
    const chords = extractChordsText(decrypted);

    expect(chords).toContain('Dummy line one');
    expect(resolveSongBodyContent('chords', 'plain lyrics', chords)).toEqual({
      kind: 'chords',
      text: fixtureSheet.chords_text,
      monospace: true,
    });
    expect(resolveSongBodyContent('lyrics', 'plain lyrics', chords).kind).toBe('lyrics');
  });
});
