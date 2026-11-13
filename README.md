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
