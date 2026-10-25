/**
 * Shared song setup helpers: normalize flat + instruments[] shapes,
 * compact tuning/capo display for list rows, PDF, and public pages.
 */
(function (root) {
  "use strict";

  function normalizeInstrumentName(name) {
    var s = String(name || "").trim();
    if (!s) return "";
    var lower = s.toLowerCase();
    if (lower === "guitar") return "Guitar";
    if (
      lower === "octave mandolin" ||
      lower === "octave-mandolin" ||
      lower === "mandolin" ||
      lower === "om"
    ) {
      return "Octave mandolin";
    }
    if (lower === "banjo") return "Banjo";
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function abbreviateInstrument(name) {
    var n = normalizeInstrumentName(name);
    if (n === "Guitar") return "Gtr";
    if (n === "Octave mandolin") return "OM";
    if (n === "Banjo") return "Banjo";
    return n || "Gtr";
  }

  function normalizeInstrumentEntry(inst) {
    if (!inst || typeof inst !== "object") return null;
    var out = {
      name: normalizeInstrumentName(inst.name) || "Guitar",
      tuning: "",
      capo: null,
      unverified: false,
    };
    if (inst.tuning != null && String(inst.tuning).trim() !== "") {
      out.tuning = String(inst.tuning).trim();
    }
    if (inst.capo != null && inst.capo !== "") {
      var capoNum = Number(inst.capo);
      if (!isNaN(capoNum)) out.capo = capoNum;
    }
    if (
      inst.unverified === true ||
      inst.unverified === "true" ||
      inst.tuning_unverified === true ||
      inst.tuning_unverified === "true"
    ) {
      out.unverified = true;
    }
    if (!out.tuning && out.capo == null && !out.unverified) return null;
    return out;
  }

  /**
   * Prefer instruments[]; fall back to flat tuning/capo/tuning_unverified
   * as a single Guitar (or entry.instrument) entry.
   */
  function normalizeInstruments(entry) {
    var list = [];
    if (entry && Array.isArray(entry.instruments)) {
      entry.instruments.forEach(function (inst) {
        var n = normalizeInstrumentEntry(inst);
        if (n) list.push(n);
      });
    }
    if (!list.length && entry) {
      var flat = normalizeInstrumentEntry({
        name: entry.instrument || "Guitar",
        tuning: entry.tuning,
        capo: entry.capo,
        unverified: entry.tuning_unverified || entry.unverified,
      });
      if (flat) list.push(flat);
    }
    return list;
  }

  function pickInstrument(instruments, preferredRaw) {
    var list = instruments || [];
    if (!list.length) return null;
    var preferred = normalizeInstrumentName(preferredRaw);
    if (!preferred || preferred === "all") {
      for (var i = 0; i < list.length; i++) {
        if (list[i].name === "Guitar") return list[i];
      }
      return list[0];
    }
    for (var j = 0; j < list.length; j++) {
      if (list[j].name === preferred) return list[j];
    }
    return null;
  }

  function bitsForInstrument(inst) {
    if (!inst) return [];
    var bits = [];
    if (inst.tuning) {
      bits.push(inst.tuning + (inst.unverified && !/\?$/.test(String(inst.tuning)) ? "?" : ""));
    }
    if (inst.capo != null && Number(inst.capo) !== 0) {
      bits.push("Capo " + Number(inst.capo));
    }
    return bits;
  }

  /**
   * Compact muted line for UI/PDF.
   * preferred: instrument name → only that entry ("GDAD · Capo 2")
   * otherwise all: "OM: GDAD · Gtr: DADGAD · Capo 2"
   */
  function formatSetupCompact(entryOrInstruments, preferred) {
    var instruments = Array.isArray(entryOrInstruments)
      ? entryOrInstruments
      : normalizeInstruments(entryOrInstruments);
    if (!instruments.length) return "";

    var preferredName = preferred && preferred !== "all" ? preferred : "";
    if (preferredName) {
      var one = pickInstrument(instruments, preferredName);
      if (!one) return "";
      return bitsForInstrument(one).join(" · ");
    }

    if (instruments.length === 1) {
      return bitsForInstrument(instruments[0]).join(" · ");
    }

    return instruments
      .map(function (inst) {
        var bits = bitsForInstrument(inst);
        if (!bits.length) return "";
        return abbreviateInstrument(inst.name) + ": " + bits.join(" · ");
      })
      .filter(Boolean)
      .join(" · ");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatSetupCompactHtml(entryOrInstruments, preferred) {
    var text = formatSetupCompact(entryOrInstruments, preferred);
    if (!text) return "";
    // Keep "?" visually distinct when present
    var html = escapeHtml(text).replace(
      /\?/g,
      '<span class="setup-unverified" title="Tuning not verified">?</span>'
    );
    return '<span class="song-setup">' + html + "</span>";
  }

  root.LyricsSetup = {
    normalizeInstrumentName: normalizeInstrumentName,
    abbreviateInstrument: abbreviateInstrument,
    normalizeInstruments: normalizeInstruments,
    pickInstrument: pickInstrument,
    formatSetupCompact: formatSetupCompact,
    formatSetupCompactHtml: formatSetupCompactHtml,
  };
})(typeof window !== "undefined" ? window : globalThis);
