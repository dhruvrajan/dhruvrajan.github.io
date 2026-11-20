/** Song page content mode: lyrics vs chord sheet (same body slot). */
export type SongContentView = 'lyrics' | 'chords';

export interface SongBodyContent {
  kind: SongContentView;
  text: string;
  monospace: boolean;
}

const CONTENT_VIEWS: readonly SongContentView[] = ['lyrics', 'chords'];

/** Normalize a stored or UI value to a valid content view (default lyrics). */
export function normalizeSongContentView(value: string | null | undefined): SongContentView {
  return value === 'chords' ? 'chords' : 'lyrics';
}

/** Toggle only when the song has a chord sheet. */
export function shouldShowContentToggle(hasChords: boolean): boolean {
  return !!hasChords;
}

/**
 * Resolve which text to show in the song body for the current view.
 * Falls back to lyrics when chords were requested but are missing/empty.
 */
export function resolveSongBodyContent(
  view: SongContentView | string | null | undefined,
  lyricsText: string | null | undefined,
  chordsText: string | null | undefined,
): SongBodyContent {
  const mode = normalizeSongContentView(view);
  const lyrics = lyricsText == null ? '' : String(lyricsText);
  const chords = chordsText == null ? '' : String(chordsText);
  if (mode === 'chords' && chords.trim()) {
    return { kind: 'chords', text: chords, monospace: true };
  }
  return { kind: 'lyrics', text: lyrics, monospace: false };
}

/**
 * Pull chord-sheet plaintext from a decrypted payload.
 * Expected shape: `{ chords_text: string }` (same as encrypted chord blobs).
 */
export function extractChordsText(sheet: unknown): string | null {
  if (!sheet || typeof sheet !== 'object') return null;
  const text = (sheet as { chords_text?: unknown }).chords_text;
  if (text == null) return null;
  const s = String(text);
  return s.trim() ? s : null;
}

export function isSongContentView(value: unknown): value is SongContentView {
  return typeof value === 'string' && (CONTENT_VIEWS as readonly string[]).includes(value);
}
