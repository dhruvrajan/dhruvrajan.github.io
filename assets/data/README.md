# Encrypted lyrics cache

The Lyrics page loads `/assets/data/lyrics.enc.json`.

## Envelope (`v: 1`)
- `kdf`: `PBKDF2-SHA256`
- `iterations`: e.g. `310000`
- `salt`: base64 (16 bytes)
- `iv`: base64 (12 bytes)
- `ciphertext`: base64 of AES-256-GCM ciphertext with the 16-byte auth tag appended (WebCrypto layout)

Decrypt with the site passphrase (never committed). Wrong passphrase fails AES-GCM auth.

`lyrics.enc.example.json` is a tiny dummy fixture for local UI checks (passphrase `test-passphrase`). Production uses `lyrics.enc.json`.
