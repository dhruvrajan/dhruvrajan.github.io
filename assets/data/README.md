# Encrypted lyrics cache (v2)

The Lyrics page loads `/assets/data/lyrics/salt.json` plus encrypted index and per-song files under `/assets/data/lyrics/`.

## Salt (`salt.json`)
- `v`: `2`
- `kdf`: `PBKDF2-SHA256`
- `iterations`: e.g. `310000`
- `salt`: base64 (16 bytes)

The browser derives one AES-256-GCM key from the passphrase (UTF-8) with PBKDF2-SHA256 using that salt and iteration count.

## Encrypted blobs (`index.enc.json`, `songs/<slug>.enc.json`)
- `iv`: base64 (12 bytes)
- `ciphertext`: base64 of AES-256-GCM ciphertext with the 16-byte auth tag appended (WebCrypto layout)

Plaintext is UTF-8 JSON. The index decrypts to an array of `{slug, title, artist, source}`. Each song decrypts to title/artist/source/lyrics fields (lyrics may be null).

Wrong passphrase fails AES-GCM auth when decrypting the index (clear UI error). Do **not** commit real passphrases or API keys.
