# Dhruv Rajan — static Angular music site

Purely static Angular (standalone, no SSR) replica of the Jekyll site on `gh-pages`.

**Do not merge this branch into `gh-pages`.** That branch remains the Jekyll site for `dhruvrajan.github.io`. This branch is intended for static hosting (e.g. Cloudflare Pages on `dhruvrajan.com`).

## Develop

```bash
npm install
npm start
```

## Production build

```bash
npm run build
```

Static output: `dist/dhruv-music/browser/`

Includes `public/_redirects` (`/* /index.html 200`) for SPA deep links on Cloudflare Pages.

## Lyrics

Encrypted lyrics/chords under `public/assets/data/` use the same client-side WebCrypto PBKDF2-SHA256 + AES-GCM unlock as the Jekyll site. Passphrases and API keys are never committed.
