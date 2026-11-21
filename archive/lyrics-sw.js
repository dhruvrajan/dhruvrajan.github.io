/* Minimal offline shell for the Lyrics page.
 * Caches site chrome + encrypted lyrics blobs only — never plaintext lyrics. */
/* eslint-disable no-restricted-globals */
(function () {
  "use strict";

  var CACHE = "lyrics-shell-v1";
  var SHELL = [
    "/",
    "/pages/lyrics.html",
    "/assets/css/site.css",
    "/assets/css/lyrics-browse.css",
    "/assets/js/lyrics-setup.js",
    "/assets/js/lyrics-notes.js",
    "/assets/js/lyrics.js",
    "/assets/js/lyrics-browse.js",
    "/assets/js/songbook-pdf.js",
    "/assets/data/lyrics/salt.json",
    "/assets/data/lyrics/index.enc.json",
  ];

  function isEncSong(url) {
    try {
      var u = new URL(url, self.location.origin);
      if (u.origin !== self.location.origin) return false;
      return /\/assets\/data\/(lyrics|chords)\/(songs\/[^/]+|index)\.enc\.json$/i.test(u.pathname);
    } catch (e) {
      return false;
    }
  }

  function isShellAsset(url) {
    try {
      var u = new URL(url, self.location.origin);
      if (u.origin !== self.location.origin) return false;
      var p = u.pathname;
      if (SHELL.indexOf(p) !== -1) return true;
      if (p === "/lyrics-sw.js") return true;
      if (p.indexOf("/assets/css/") === 0) return true;
      if (p.indexOf("/assets/js/") === 0) return true;
      if (p === "/assets/data/lyrics/salt.json") return true;
      if (p === "/assets/data/lyrics/index.enc.json") return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  self.addEventListener("install", function (event) {
    event.waitUntil(
      caches
        .open(CACHE)
        .then(function (cache) {
          return cache.addAll(SHELL);
        })
        .then(function () {
          return self.skipWaiting();
        })
        .catch(function () {
          return self.skipWaiting();
        })
    );
  });

  self.addEventListener("activate", function (event) {
    event.waitUntil(
      caches
        .keys()
        .then(function (keys) {
          return Promise.all(
            keys.map(function (key) {
              if (key !== CACHE) return caches.delete(key);
              return null;
            })
          );
        })
        .then(function () {
          return self.clients.claim();
        })
    );
  });

  self.addEventListener("fetch", function (event) {
    var req = event.request;
    if (req.method !== "GET") return;

    var url = req.url;
    if (!isShellAsset(url) && !isEncSong(url)) return;

    event.respondWith(
      caches.open(CACHE).then(function (cache) {
        return cache.match(req).then(function (cached) {
          var network = fetch(req)
            .then(function (res) {
              if (res && res.ok) {
                cache.put(req, res.clone());
              }
              return res;
            })
            .catch(function () {
              return cached || Response.error();
            });
          return cached || network;
        });
      })
    );
  });
})();
