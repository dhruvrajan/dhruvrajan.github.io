---
layout: default
title: Lyrics
description: Personal lyrics browser powered by the Genius API.
narrow: true
---

<h1 class="page-title">Lyrics</h1>
<p class="page-lead">Personal Genius search for set planning. Your access token stays in this browser only — it is never sent to this site’s server.</p>

<section id="token-gate" class="lyrics-panel" hidden>
  <h2 class="group-heading">Genius access token</h2>
  <p>Create an API client at <a href="https://genius.com/api-clients" rel="noopener noreferrer">genius.com/api-clients</a>, click <strong>Generate Access Token</strong>, and paste the client access token below.</p>
  <form id="token-form" class="token-form" autocomplete="off">
    <label for="token-input">Client access token</label>
    <input id="token-input" name="token" type="password" spellcheck="false" autocomplete="off" required placeholder="Paste token">
    <button type="submit" class="btn">Save token</button>
  </form>
  <p class="token-actions">
    <button type="button" class="linkish" id="cancel-token" hidden>Cancel</button>
  </p>
  <p id="token-status" class="item-meta" aria-live="polite"></p>
</section>

<section id="lyrics-browser" hidden>
  <div class="lyrics-toolbar">
    <form id="search-form" class="search-form" role="search">
      <label for="search-input" class="visually-hidden">Search songs</label>
      <input id="search-input" type="search" placeholder="Search song or artist" enterkeyhint="search" required>
      <button type="submit" class="btn">Search</button>
    </form>
    <p class="token-actions">
      <button type="button" class="linkish" id="change-token">Change token</button>
      ·
      <button type="button" class="linkish" id="clear-token">Clear token</button>
    </p>
  </div>

  <p id="search-status" class="lyrics-status" hidden aria-live="polite"></p>

  <div class="lyrics-columns">
    <div class="lyrics-main">
      <div id="search-results"></div>
      <div id="song-detail" class="song-detail" hidden></div>
    </div>
    <aside class="lyrics-aside" aria-label="Saved">
      <h2 class="subheading">Recent searches</h2>
      <ul id="recent-list" class="plain-list aside-list"></ul>
      <h2 class="subheading">Favorites</h2>
      <ul id="favorites-list" class="plain-list aside-list"></ul>
    </aside>
  </div>
</section>

<script src="{{ '/assets/js/lyrics.js' | relative_url }}" defer></script>
