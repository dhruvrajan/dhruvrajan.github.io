import {
  audienceMatches,
  emailAllowed,
  identityEmail,
  parseAllowedEmails,
  verifyAccessJwt,
} from '../../../../shared/access-auth';

function b64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64UrlJson(obj: unknown): string {
  return b64Url(new TextEncoder().encode(JSON.stringify(obj)));
}

async function generateRs256Pair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  );
}

async function signJwt(
  privateKey: CryptoKey,
  header: Record<string, unknown>,
  claims: Record<string, unknown>,
): Promise<string> {
  const h = b64UrlJson(header);
  const p = b64UrlJson(claims);
  const data = new TextEncoder().encode(`${h}.${p}`);
  const sig = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, data));
  return `${h}.${p}.${b64Url(sig)}`;
}

describe('access-auth', () => {
  it('parses allowlist emails case-insensitively', () => {
    const set = parseAllowedEmails(' Alice@Example.com , bob@test.org,, ');
    expect(emailAllowed('alice@example.com', set)).toBe(true);
    expect(emailAllowed('BOB@test.org', set)).toBe(true);
    expect(emailAllowed('other@test.org', set)).toBe(false);
    expect(emailAllowed(null, set)).toBe(false);
  });

  it('checks JWT aud claim as string or array', () => {
    expect(audienceMatches('aud-1', 'aud-1')).toBe(true);
    expect(audienceMatches(['x', 'aud-1'], 'aud-1')).toBe(true);
    expect(audienceMatches('other', 'aud-1')).toBe(false);
    expect(audienceMatches(undefined, 'aud-1')).toBe(false);
  });

  it('verifies a locally signed Access-style JWT and allowlist', async () => {
    const pair = await generateRs256Pair();
    const now = Math.floor(Date.now() / 1000);
    const token = await signJwt(
      pair.privateKey,
      { alg: 'RS256', kid: 'test-kid', typ: 'JWT' },
      {
        aud: 'lyrics-aud',
        exp: now + 3600,
        email: 'friend@example.com',
      },
    );

    const claims = await verifyAccessJwt(token, {
      audience: 'lyrics-aud',
      nowSec: now,
      getKey: async () => pair.publicKey,
    });
    expect(identityEmail(claims)).toBe('friend@example.com');
    expect(emailAllowed(identityEmail(claims), parseAllowedEmails('friend@example.com'))).toBe(
      true,
    );
  });

  it('rejects wrong audience, expired tokens, and non-allowlisted email', async () => {
    const pair = await generateRs256Pair();
    const now = Math.floor(Date.now() / 1000);

    const badAud = await signJwt(
      pair.privateKey,
      { alg: 'RS256', kid: 'k' },
      { aud: 'nope', exp: now + 60, email: 'a@b.co' },
    );
    await expect(
      verifyAccessJwt(badAud, {
        audience: 'lyrics-aud',
        nowSec: now,
        getKey: async () => pair.publicKey,
      }),
    ).rejects.toThrow(/audience/i);

    const expired = await signJwt(
      pair.privateKey,
      { alg: 'RS256', kid: 'k' },
      { aud: 'lyrics-aud', exp: now - 10, email: 'a@b.co' },
    );
    await expect(
      verifyAccessJwt(expired, {
        audience: 'lyrics-aud',
        nowSec: now,
        getKey: async () => pair.publicKey,
      }),
    ).rejects.toThrow(/expired/i);

    const okToken = await signJwt(
      pair.privateKey,
      { alg: 'RS256', kid: 'k' },
      { aud: 'lyrics-aud', exp: now + 60, email: 'outsider@example.com' },
    );
    const claims = await verifyAccessJwt(okToken, {
      audience: 'lyrics-aud',
      nowSec: now,
      getKey: async () => pair.publicKey,
    });
    expect(emailAllowed(identityEmail(claims), parseAllowedEmails('friend@example.com'))).toBe(
      false,
    );
  });
});
