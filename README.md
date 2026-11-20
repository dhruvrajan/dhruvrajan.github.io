# Dhruv Rajan — static Angular music site

Standalone Angular (no SSR / no `NgModule`) music site for static hosting
(Cloudflare Pages on `dhruvrajan.com`).

**Do not merge this branch into `gh-pages`.** That branch remains a separate
GitHub Pages deployment. This `angular` branch is the Cloudflare Pages app.

## Develop

```bash
npm ci
npm start
```

## Production build

```bash
npm run build
```

Static output: `dist/dhruv-music/browser/`

Includes `public/_redirects` (`/* /index.html 200`) for SPA deep links on Cloudflare Pages.
Deploy workflow: `.github/workflows/deploy-cloudflare-pages.yml`.

## Architecture

- `src/app/core/` — models, root services (`CatalogService`, `RepertoireService`, `DocumentMetaService`), pure format helpers
- `src/app/data/` — static catalog constants
- `src/app/pages/` — lazy-loaded route components (OnPush + signals / modern control flow)
- `src/styles/` — design tokens and organized CSS partials (standard CSS, not Tailwind)

## Lyrics

Encrypted lyrics/chords under `public/assets/data/` unlock client-side
(WebCrypto PBKDF2-SHA256 + AES-GCM). Passphrases and API keys are never committed.

`/lyrics` (and `/assets/data/lyrics|chords/**`) are intended to sit behind
Cloudflare Access. Allowlisted users get an automatic unlock from the Pages
Function `GET /lyrics/api/key` (see `functions/lyrics/api/key.ts`). The
passphrase and derived AES key stay in JS memory only for the page lifetime —
never in `localStorage` / `sessionStorage` / Cache Storage.

### Cloudflare Pages env (production)

| Name | Notes |
|------|--------|
| `LYRICS_PASSPHRASE` | Secret — lyrics unlock passphrase |
| `CF_ACCESS_TEAM_DOMAIN` | e.g. `myteam.cloudflareaccess.com` |
| `CF_ACCESS_AUD` | Access application AUD tag |
| `LYRICS_ALLOWED_EMAILS` | Comma-separated allowlist |

Nav links to Lyrics use full page loads (`href="/lyrics"`) so Access can run.

Lyrics browse uses real paths (Back/Forward and deep links):

| Path | View |
|------|------|
| `/lyrics` | All songs (filters as query params: `q`, `sort`, `instrument`, …) |
| `/lyrics/artists` | Artist list |
| `/lyrics/artists/:artist` | Songs for one artist |
| `/lyrics/song/:slug` | Song lyrics/chords |

Legacy `#song=…` hashes redirect to `/lyrics/song/…`.
