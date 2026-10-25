# Encrypted lyrics cache

The Lyrics page loads `/assets/data/lyrics.enc.json` (production encrypted repertoire).

## Envelope (`v: 1`)
- `kdf`: `PBKDF2-SHA256`
- `iterations`: e.g. `310000`
- `salt`: base64 (16 bytes)
- `iv`: base64 (12 bytes)
- `ciphertext`: base64 of AES-256-GCM ciphertext with the 16-byte auth tag appended (WebCrypto layout)

Browser decrypt matches Node WebCrypto: PBKDF2-SHA256 → AES-256-GCM. Wrong passphrase fails AES-GCM auth (clear UI error).

`lyrics.enc.example.json` is a tiny dummy fixture for local UI checks only (not the production default). Do **not** commit real passphrases or API keys.
