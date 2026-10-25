---
layout: default
title: Lyrics
description: Personal lyrics browser unlocked from a local encrypted cache.
narrow: true
---

<link rel="stylesheet" href="{{ '/assets/css/lyrics-browse.css' | relative_url }}">

<h1 class="page-title">Lyrics</h1>

<section id="unlock-gate" class="lyrics-panel lyrics-unlock">
  <form id="unlock-form" class="token-form lyrics-unlock__form" autocomplete="off">
    <label for="passphrase-input" class="visually-hidden">Password</label>
    <input id="passphrase-input" name="passphrase" type="password" spellcheck="false" autocomplete="current-password" required placeholder="Password">
    <button type="submit" class="btn lyrics-unlock__submit">Unlock</button>
    <label class="remember-row" for="remember-check">
      <input id="remember-check" type="checkbox">
      Remember on this device
    </label>
  </form>
  <p id="unlock-status" class="lyrics-status" hidden aria-live="polite"></p>
</section>

<section id="lyrics-browser" hidden>
  <div class="lyrics-toolbar">
    <form id="search-form" class="search-form lyrics-legacy-search" role="search">
      <label for="search-input" class="visually-hidden">Filter songs</label>
      <input id="search-input" type="search" placeholder="Filter by title or artist" enterkeyhint="search" autocomplete="off">
      <button type="submit" class="btn">Filter</button>
    </form>
    <div class="lyrics-toolbar__actions" role="group" aria-label="Lyrics tools">
      <div class="text-size-control" role="group" aria-label="Text size">
        <span class="text-size-control__label">Text</span>
        <button type="button" class="toolbar-btn" id="text-size-sm" aria-pressed="false">A</button>
        <button type="button" class="toolbar-btn toolbar-btn--text-md" id="text-size-md" aria-pressed="true">A</button>
        <button type="button" class="toolbar-btn toolbar-btn--text-lg" id="text-size-lg" aria-pressed="false">A</button>
      </div>
      <button type="button" class="btn btn--secondary" id="print-lyrics-btn">Print song</button>
      <button type="button" class="btn" id="download-songbook-btn">Download songbook PDF</button>
      <label class="songbook-orientation" for="songbook-orientation">
        <span class="visually-hidden">Page orientation</span>
        <select id="songbook-orientation" data-songbook-orientation>
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
      </label>
      <button type="button" class="btn btn--secondary" id="lock-btn">Lock</button>
      <button type="button" class="btn btn--ghost" id="forget-btn">Forget on this device</button>
    </div>
  </div>

  <p id="search-status" class="lyrics-status" hidden aria-live="polite"></p>
  <p id="songbook-progress" class="lyrics-status" hidden aria-live="polite"></p>

  <div id="lyrics-browse-root"></div>

  <div id="search-results"></div>

  <section class="repertoire" aria-labelledby="browse-heading">
    <h2 id="browse-heading" class="group-heading">Browse by artist</h2>
    <p class="item-meta">Tap a song to open its lyrics. Deep links use <code>#song=…</code>.</p>
    <div id="artist-browse"></div>
  </section>

  <div id="song-detail" class="song-detail" hidden></div>
</section>

<script type="application/json" id="songs-meta-json">
[
{% for s in site.data.songs %}
  {
    "title": {{ s.title | jsonify }},
    "artist": {{ s.artist | jsonify }}{% if s.instrument %},
    "instrument": {{ s.instrument | jsonify }}{% endif %}{% if s.instruments %},
    "instruments": [
      {% for inst in s.instruments %}
      {
        "name": {{ inst.name | jsonify }}{% if inst.tuning %},
        "tuning": {{ inst.tuning | jsonify }}{% endif %}{% if inst.capo != nil %},
        "capo": {{ inst.capo }}{% endif %}{% if inst.unverified %},
        "unverified": true{% endif %}
      }{% unless forloop.last %},{% endunless %}
      {% endfor %}
    ]{% endif %}{% if s.tuning %},
    "tuning": {{ s.tuning | jsonify }}{% endif %}{% if s.capo != nil %},
    "capo": {{ s.capo }}{% endif %}{% if s.tuning_unverified %},
    "tuning_unverified": true{% endif %}
  }{% unless forloop.last %},{% endunless %}
{% endfor %}
]
</script>
<script>
  document.body.setAttribute(
    "data-lyrics-base",
    "{{ '/assets/data/lyrics/' | relative_url }}"
  );
  document.body.setAttribute(
    "data-lyrics-sw",
    "{{ '/lyrics-sw.js' | relative_url }}"
  );
</script>
<script src="{{ '/assets/js/vendor/jspdf.umd.min.js' | relative_url }}?v={{ site.time | date: '%s' }}" defer></script>
<script src="{{ '/assets/js/lyrics-setup.js' | relative_url }}?v={{ site.time | date: '%s' }}" defer></script>
<script src="{{ '/assets/js/lyrics-notes.js' | relative_url }}?v={{ site.time | date: '%s' }}" defer></script>
<script src="{{ '/assets/js/songbook-pdf.js' | relative_url }}?v={{ site.time | date: '%s' }}" defer></script>
<script src="{{ '/assets/js/lyrics-browse.js' | relative_url }}?v={{ site.time | date: '%s' }}" defer></script>
<script src="{{ '/assets/js/lyrics.js' | relative_url }}?v={{ site.time | date: '%s' }}" defer></script>
