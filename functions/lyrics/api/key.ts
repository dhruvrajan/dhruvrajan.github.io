/**
 * GET /lyrics/api/key — returns the lyrics passphrase only after a valid
 * Cloudflare Access JWT whose email is on the allowlist.
 * Never logs the passphrase. Never hardcodes it.
 */
import {
  accessCertsUrl,
  emailAllowed,
  identityEmail,
  importRsaPublicKeyJwk,
  parseAllowedEmails,
  verifyAccessJwt,
  type AccessJwtHeader,
} from '../../../shared/access-auth';

interface Env {
  LYRICS_PASSPHRASE?: string;
  CF_ACCESS_TEAM_DOMAIN?: string;
  CF_ACCESS_AUD?: string;
  LYRICS_ALLOWED_EMAILS?: string;
}

interface AccessJwk extends JsonWebKey {
  kid?: string;
}

interface AccessCertsResponse {
  keys?: AccessJwk[];
}

const NO_STORE = 'no-store, private';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': NO_STORE,
    },
  });
}

function unauthorized(): Response {
  return jsonResponse({ error: 'unauthorized' }, 401);
}

async function jwksGetKey(
  teamDomain: string,
  header: AccessJwtHeader,
): Promise<CryptoKey> {
  const res = await fetch(accessCertsUrl(teamDomain), {
    // Cache Access JWKS briefly at the edge (public certs only).
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  if (!res.ok) {
    throw new Error('Could not load Access certs');
  }
  const data = (await res.json()) as AccessCertsResponse;
  const keys = Array.isArray(data.keys) ? data.keys : [];
  const jwk =
    (header.kid && keys.find((k) => k && k.kid === header.kid)) || keys[0];
  if (!jwk) {
    throw new Error('No Access signing key');
  }
  return importRsaPublicKeyJwk(jwk);
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const env = context.env;
  const passphrase = env.LYRICS_PASSPHRASE;
  const team = env.CF_ACCESS_TEAM_DOMAIN;
  const aud = env.CF_ACCESS_AUD;
  const allowedCsv = env.LYRICS_ALLOWED_EMAILS;

  if (!passphrase || !team || !aud || !allowedCsv) {
    return unauthorized();
  }

  const assertion = context.request.headers.get('Cf-Access-Jwt-Assertion');
  if (!assertion) {
    return unauthorized();
  }

  try {
    const claims = await verifyAccessJwt(assertion, {
      audience: aud,
      getKey: (header) => jwksGetKey(team, header),
    });
    const email = identityEmail(claims);
    const allowed = parseAllowedEmails(allowedCsv);
    if (!emailAllowed(email, allowed)) {
      return unauthorized();
    }
    return jsonResponse({ passphrase }, 200);
  } catch {
    return unauthorized();
  }
};
