---
layout: default
title: Lyrics
description: Personal lyrics browser unlocked from a local encrypted cache.
narrow: true
---

<h1 class="page-title">Lyrics</h1>
<p class="page-lead">Unlock a local encrypted lyrics cache, then search and browse by artist. The passphrase never leaves this browser.</p>

<section id="unlock-gate" class="lyrics-panel">
  <h2 class="group-heading">Unlock lyrics</h2>
  <p class="item-meta">Loads salt and an encrypted index from <code>/assets/data/lyrics/</code>, derives a key with PBKDF2-SHA256, and decrypts songs on demand with AES-256-GCM in this browser.</p>
  <form id="unlock-form" class="token-form" autocomplete="off">
    <label for="passphrase-input">Passphrase</label>
    <input id="passphrase-input" name="passphrase" type="password" spellcheck="false" autocomplete="current-password" required placeholder="Enter passphrase">
    <button type="submit" class="btn">Unlock</button>
    <label class="remember-row" for="remember-check">
      <input id="remember-check" type="checkbox">
      Remember on this device
    </label>
  </form>
  <p id="unlock-status" class="lyrics-status" hidden aria-live="polite"></p>
</section>

<section id="lyrics-browser" hidden>
  <div class="lyrics-toolbar">
    <form id="search-form" class="search-form" role="search">
      <label for="search-input" class="visually-hidden">Filter songs</label>
      <input id="search-input" type="search" placeholder="Filter by title or artist" enterkeyhint="search" autocomplete="off">
      <button type="submit" class="btn">Filter</button>
    </form>
    <p class="token-actions">
      <button type="button" class="linkish" id="large-text-btn" aria-pressed="false">Large text</button>
      ·
      <button type="button" class="linkish" id="print-lyrics-btn">Print</button>
      ·
      <button type="button" class="linkish" id="lock-btn">Lock</button>
      ·
      <button type="button" class="linkish" id="forget-btn">Forget on this device</button>
    </p>
  </div>

  <p id="search-status" class="lyrics-status" hidden aria-live="polite"></p>

  <div id="search-results"></div>

  <section class="repertoire" aria-labelledby="browse-heading">
    <h2 id="browse-heading" class="group-heading">Browse by artist</h2>
    <p class="item-meta">Click a song to open its lyrics. Deep links use <code>#song=…</code>.</p>
    <div id="artist-browse"></div>
  </section>

  <div id="song-detail" class="song-detail" hidden></div>
</section>

<script>
  document.body.setAttribute(
    "data-lyrics-base",
    "{{ '/assets/data/lyrics/' | relative_url }}"
  );
</script>
<script src="{{ '/assets/js/lyrics.js' | relative_url }}" defer></script>
