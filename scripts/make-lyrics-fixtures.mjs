#!/usr/bin/env node
/**
 * Throwaway fixture generator for local Lyrics page testing.
 * Writes under /tmp (or --out). Do not commit the output.
 */
import { webcrypto } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const crypto = webcrypto;
const PASSPHRASE = process.env.LYRICS_FIXTURE_PASS || "test-pass-throwaway";
const OUT = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "/tmp/lyrics-fixtures";

function b64(bytes) {
  return Buffer.from(bytes).toString("base64");
}

function titleSlug(title) {
  return String(title || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function deriveKey(passphrase, salt, iterations) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

async function encryptJson(key, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(obj));
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain)
  );
  return { iv: b64(iv), ciphertext: b64(cipher) };
}

const songs = [
  {
    title: "Pink Moon",
    artist: "Nick Drake",
    // flat shape → Guitar
    tuning: "Standard",
    capo: 0,
    lyrics: "I saw it written and I saw it say\nPink moon is on its way\n\nAnd none of you stand so tall\nPink moon gonna get ye all",
  },
  {
    title: "Blacksmith",
    artist: "Trad.",
    instruments: [
      { name: "Guitar", tuning: "DADGAD", capo: 2, unverified: true },
      { name: "Octave mandolin", tuning: "GDAD", capo: 0 },
    ],
    lyrics: "Oh a blacksmith courted me\nNine months and better\nHe fairly won my heart\nWrote me a letter",
  },
  {
    title: "Both Sides Now",
    artist: "Joni Mitchell",
    instruments: [{ name: "Guitar", tuning: "Open D", capo: 0 }],
    lyrics: "Rows and floes of angel hair\nAnd ice cream castles in the air\nAnd feather canyons everywhere\nI've looked at clouds that way",
  },
  {
    title: "Geordie",
    artist: "Anais Mitchell & Jefferson Hamer",
    instruments: [
      { name: "Guitar", tuning: "DADGAD", capo: 0 },
      { name: "Octave mandolin", tuning: "GDAD", capo: 0 },
    ],
    lyrics: "As I walked out over London bridge\nOne misty morning early\nI overheard a fair pretty maid\nWas lamenting for her Geordie",
  },
  {
    title: "Father and Son",
    artist: "Cat Stevens",
    instruments: [{ name: "Guitar", tuning: "Standard", capo: 0 }],
    lyrics: "It's not time to make a change\nJust relax, take it easy\nYou're still young, that's your fault\nThere's so much you have to know",
  },
  {
    title: "Carey",
    artist: "Joni Mitchell",
    instruments: [{ name: "Guitar", tuning: "Open E", capo: 4 }],
    lyrics: "The wind is in from Africa\nLast night I couldn't sleep\nOh, you know it sure is hard to leave here Carey\nBut it's really not my home",
  },
  {
    title: "Creggan White Hare",
    artist: "Doiri Farell",
    instruments: [{ name: "Octave mandolin", tuning: "GDAD", capo: 0 }],
    lyrics: "As I went a-hunting for game\nDown by the Creggan one day\nI met a white hare\nAnd I asked him to stay",
  },
  {
    title: "Crossing Muddy Waters",
    artist: "John Hiatt / I'm With Her",
    instruments: [{ name: "Banjo", tuning: "Open G", capo: 0, unverified: true }],
    lyrics: "My dog got crazy when I left my family\nOut on the road with a banjo on my knee",
  },
];

const iterations = 100000;
const salt = crypto.getRandomValues(new Uint8Array(16));
const key = await deriveKey(PASSPHRASE, salt, iterations);

const index = [];
await mkdir(path.join(OUT, "songs"), { recursive: true });

for (const song of songs) {
  const slug = titleSlug(song.title);
  index.push({
    slug,
    title: song.title,
    artist: song.artist,
    source: "docs",
  });
  const envelope = await encryptJson(key, {
    title: song.title,
    artist: song.artist,
    source: "docs",
    lyrics: song.lyrics,
    lyrics_copyright: "",
  });
  await writeFile(
    path.join(OUT, "songs", slug + ".enc.json"),
    JSON.stringify(envelope) + "\n"
  );
}

await writeFile(
  path.join(OUT, "salt.json"),
  JSON.stringify(
    {
      v: 2,
      kdf: "PBKDF2-SHA256",
      iterations,
      salt: b64(salt),
    },
    null,
    1
  ) + "\n"
);

await writeFile(
  path.join(OUT, "index.enc.json"),
  JSON.stringify(await encryptJson(key, index)) + "\n"
);

await writeFile(
  path.join(OUT, "meta.json"),
  JSON.stringify(
    songs.map((s) => {
      const row = { title: s.title, artist: s.artist };
      if (s.instruments) row.instruments = s.instruments;
      if (s.tuning != null) row.tuning = s.tuning;
      if (s.capo != null) row.capo = s.capo;
      if (s.tuning_unverified) row.tuning_unverified = true;
      return row;
    }),
    null,
    2
  ) + "\n"
);

await writeFile(
  path.join(OUT, "PASS.txt"),
  PASSPHRASE + "\n"
);

console.log("Wrote fixtures to", OUT);
console.log("Passphrase:", PASSPHRASE);
