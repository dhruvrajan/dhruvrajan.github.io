# dhruvrajan.github.io

This `gh-pages` branch serves **static redirects** to the live site at
[https://dhruvrajan.com/](https://dhruvrajan.com/).

The previous Jekyll site is preserved under [`archive/`](./archive/) (reachable,
but disallowed for crawlers via `robots.txt`). The Angular app and Cloudflare
Pages deploy live on the `angular` branch.

Do not add a `CNAME` here — `dhruvrajan.com` DNS points at Cloudflare.

## Path mapping

| Old (github.io) | New (dhruvrajan.com) |
| --- | --- |
| `/` | `/` |
| `/pages/events.html` | `/events` |
| `/pages/setlists.html` | `/setlists` |
| `/pages/songs_by_artist.html` | `/songs` |
| `/pages/lyrics.html` | `/lyrics` |
| any other public path | same path (via `404.html`) |
| `/archive/...` | served from archive (no redirect; `noindex`) |

Query strings and URL hashes are preserved on redirects.
