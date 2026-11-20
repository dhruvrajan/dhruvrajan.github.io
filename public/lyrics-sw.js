/* Minimal offline shell for the Lyrics page.
 * Caches SPA chrome + lyrics scripts + encrypted lyrics/chords blobs only —
 * never plaintext lyrics, never /lyrics/api/* (passphrase endpoint), never
 * Access login HTML in place of a JSON blob. */
/* eslint-disable no-restricted-globals */
(function () {
  "use strict";

  var CACHE = "lyrics-shell-v5";
  var SHELL = [
    "/",
    "/lyrics",
    "/assets/css/site.css",
    "/assets/css/lyrics-browse.css",
    "/assets/js/lyrics-setup.js",
    "/assets/js/lyrics-notes.js",
    "/assets/js/lyrics-chords.js",
    "/assets/js/lyrics.js",
    "/assets/js/lyrics-browse.js",
    "/assets/js/songbook-pdf.js",
    "/assets/data/lyrics/salt.json",
    "/assets/data/lyrics/index.enc.json",
  ];

  function isLyricsApi(pathname) {
    return pathname === "/lyrics/api" || pathname.indexOf("/lyrics/api/") === 0;
  }

  function isEncSong(url) {
    try {
      var u = new URL(url, self.location.origin);
      if (u.origin !== self.location.origin) return false;
      return /\/assets\/data\/(lyrics|chords)\/(songs\/[^/]+|index)\.enc\.json$/i.test(
        u.pathname
      );
    } catch (e) {
      return false;
    }
  }

  function isSaltOrIndex(pathname) {
    return (
      pathname === "/assets/data/lyrics/salt.json" ||
      pathname === "/assets/data/lyrics/index.enc.json" ||
      pathname === "/assets/data/chords/index.enc.json"
    );
  }

  function isDataJsonPath(pathname) {
    return isEncSong(self.location.origin + pathname) || isSaltOrIndex(pathname);
  }

  function isAngularBuildAsset(pathname) {
    return /^\/(?:main|polyfills|styles|chunk|index)-[^/]+\.(?:js|css)$/i.test(
      pathname
    );
  }

  function isShellAsset(url) {
    try {
      var u = new URL(url, self.location.origin);
      if (u.origin !== self.location.origin) return false;
      var p = u.pathname;
      if (isLyricsApi(p)) return false;
      if (SHELL.indexOf(p) !== -1) return true;
      if (p === "/lyrics-sw.js") return true;
      if (p.indexOf("/assets/css/") === 0) return true;
      if (p.indexOf("/assets/js/") === 0) return true;
      if (isSaltOrIndex(p)) return true;
      if (isAngularBuildAsset(p)) return true;
      return false;
    } catch (e) {
      return false;
    }
  }

  function isNetworkFirst(req, pathname) {
    if (req.mode === "navigate") return true;
    if (pathname === "/" || pathname === "/index.html") return true;
    var accept = req.headers.get("accept") || "";
    if (accept.indexOf("text/html") !== -1) return true;
    if (isAngularBuildAsset(pathname)) return true;
    return false;
  }

  function isCacheableJsonResponse(res) {
    if (!res || res.status !== 200 || !res.ok) return false;
    var ct = (res.headers.get("content-type") || "").toLowerCase();
    return ct.indexOf("application/json") !== -1 || ct.indexOf("+json") !== -1;
  }

  function isCacheableShellResponse(res) {
    return !!(res && res.ok && res.status === 200);
  }

  function networkFirst(req, cache) {
    return fetch(req)
      .then(function (res) {
        if (isCacheableShellResponse(res)) {
          cache.put(req, res.clone());
        }
        return res;
      })
      .catch(function () {
        return cache.match(req).then(function (cached) {
          if (cached) return cached;
          if (req.mode === "navigate") {
            return cache.match("/").then(function (fallback) {
              return fallback || Response.error();
            });
          }
          return Response.error();
        });
      });
  }

  function cacheFirst(req, cache, jsonOnly) {
    return cache.match(req).then(function (cached) {
      var network = fetch(req)
        .then(function (res) {
          var ok = jsonOnly ? isCacheableJsonResponse(res) : isCacheableShellResponse(res);
          if (ok) {
            cache.put(req, res.clone());
          }
          return res;
        })
        .catch(function () {
          return cached || Response.error();
        });
      // If a non-JSON sneaked into cache earlier, ignore it for data paths.
      if (cached && jsonOnly) {
        var ct = (cached.headers.get("content-type") || "").toLowerCase();
        if (ct.indexOf("application/json") === -1 && ct.indexOf("+json") === -1) {
          return network;
        }
      }
      return cached || network;
    });
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

    var pathname;
    try {
      pathname = new URL(req.url, self.location.origin).pathname;
    } catch (e) {
      return;
    }

    // Never intercept the passphrase API — network only, no cache.
    if (isLyricsApi(pathname)) return;

    var enc = isEncSong(req.url);
    if (!isShellAsset(req.url) && !enc) return;

    event.respondWith(
      caches.open(CACHE).then(function (cache) {
        if (enc || isDataJsonPath(pathname)) {
          return cacheFirst(req, cache, true);
        }
        if (isNetworkFirst(req, pathname)) {
          return networkFirst(req, cache);
        }
        return cacheFirst(req, cache, false);
      })
    );
  });
})();
