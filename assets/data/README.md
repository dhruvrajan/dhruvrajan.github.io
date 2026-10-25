# Encrypted lyrics cache

The Lyrics page loads **`/assets/data/lyrics.enc.json`** in the browser and decrypts it with a passphrase (WebCrypto PBKDF2-SHA256 + AES-256-GCM).

## Format

Envelope (`lyrics.enc.json`):

```json
{
  "v": 1,
  "kdf": "PBKDF2-SHA256",
  "iterations": 310000,
  "salt": "<base64 16 bytes>",
  "iv": "<base64 12 bytes>",
  "ciphertext": "<base64 of AES-256-GCM ciphertext with 16-byte tag appended>"
}
```

Decrypted UTF-8 JSON:

```json
{
  "version": 1,
  "generated_at": "...",
  "songs": [
    {
      "title": "...",
      "artist": "...",
      "lyrics": "...",
      "source": "web|docs|...",
      "lyrics_copyright": "...",
      "track_id": "..."
    }
  ]
}
```

## Test fixture

The committed `lyrics.enc.json` is a **tiny dummy fixture** for local/UI testing. Replace it with the real encrypted file when ready. The matching example copy is `lyrics.enc.example.json`.

Dummy passphrase for the committed test fixture is documented in the PR only (not hardcoded in page JS).

Do **not** commit real API keys or production passphrases.
