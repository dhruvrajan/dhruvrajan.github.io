import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { RepertoireService } from '../../core/services/repertoire.service';
import {
  LyricsRouteState,
  buildLyricsUrl,
  legacySongHashToPath,
  parseLyricsUrl,
} from '../../core/utils/lyrics-routes';

export interface LyricsNavApi {
  parse: () => LyricsRouteState;
  go: (state: Partial<LyricsRouteState>, opts?: { replace?: boolean }) => void;
  goSong: (slug: string, opts?: { replace?: boolean }) => void;
  goArtists: (opts?: { replace?: boolean }) => void;
  goArtist: (artistSlug: string, opts?: { replace?: boolean }) => void;
  goIndex: (filters?: Partial<LyricsRouteState>, opts?: { replace?: boolean }) => void;
  /** Prefer history.back when this session pushed the song; else fallback URL. */
  back: (fallbackUrl?: string) => void;
  subscribe: (listener: (state: LyricsRouteState) => void) => () => void;
  /** Full-page load to /lyrics so Cloudflare Access can intercept. */
  accessReload: () => void;
}

declare global {
  interface Window {
    LyricsApp?: { init?: () => void | Promise<void>; browseApi?: () => unknown };
    LyricsBrowse?: unknown;
    LyricsNav?: LyricsNavApi;
  }
}

const LYRICS_SCRIPTS = [
  '/assets/js/vendor/jspdf.umd.min.js',
  '/assets/js/lyrics-setup.js',
  '/assets/js/lyrics-notes.js',
  '/assets/js/songbook-pdf.js',
  '/assets/js/lyrics-chords.js',
  '/assets/js/lyrics-browse.js',
  '/assets/js/lyrics.js',
] as const;

function loadScript(doc: Document, src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = doc.querySelector(`script[data-lyrics-src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }
    const script = doc.createElement('script');
    script.src = src;
    script.defer = true;
    script.dataset['lyricsSrc'] = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load ' + src));
    doc.body.appendChild(script);
  });
}

@Component({
  selector: 'app-lyrics',
  templateUrl: './lyrics.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LyricsPage implements AfterViewInit, OnDestroy {
  private readonly doc = inject(DOCUMENT);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly repertoire = inject(RepertoireService);
  private readonly router = inject(Router);

  private routeSub: Subscription | null = null;
  private listeners = new Set<(state: LyricsRouteState) => void>();

  async ngAfterViewInit(): Promise<void> {
    const body = this.doc.body;
    body.setAttribute('data-lyrics-base', '/assets/data/lyrics/');
    body.setAttribute('data-lyrics-sw', '/lyrics-sw.js');

    this.ensureJsonScript('songs-meta-json', this.repertoire.songsMetaJson());
    this.ensureJsonScript('songbook-sections-json', this.repertoire.songbookSectionsJson());

    this.installNavBridge();
    this.migrateLegacySongHash();

    for (const src of LYRICS_SCRIPTS) {
      await loadScript(this.doc, src);
    }

    if (window.LyricsApp && typeof window.LyricsApp.init === 'function') {
      await window.LyricsApp.init();
    }
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.routeSub = null;
    this.listeners.clear();
    if (window.LyricsNav) {
      delete window.LyricsNav;
    }
  }

  private installNavBridge(): void {
    const notify = () => {
      const state = this.currentState();
      this.listeners.forEach((fn) => {
        try {
          fn(state);
        } catch {
          /* ignore listener errors */
        }
      });
    };

    this.routeSub?.unsubscribe();
    this.routeSub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(() => notify());

    window.LyricsNav = {
      parse: () => this.currentState(),
      go: (state, opts) => this.navigate(buildLyricsUrl(state), opts),
      goSong: (slug, opts) =>
        this.navigate(buildLyricsUrl({ view: 'song', songSlug: slug }), {
          ...opts,
          markNav: true,
        }),
      goArtists: (opts) =>
        this.navigate(buildLyricsUrl({ view: 'artists' }), { ...opts, markNav: true }),
      goArtist: (artistSlug, opts) =>
        this.navigate(buildLyricsUrl({ view: 'artist', artistSlug }), {
          ...opts,
          markNav: true,
        }),
      goIndex: (filters, opts) =>
        this.navigate(buildLyricsUrl({ view: 'index', ...filters }), {
          ...opts,
          markNav: opts?.replace ? false : true,
        }),
      back: (fallbackUrl) => this.back(fallbackUrl || '/lyrics'),
      subscribe: (listener) => {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
      },
      accessReload: () => {
        window.location.href = '/lyrics';
      },
    };
  }

  private currentState(): LyricsRouteState {
    const raw = this.router.url || '/lyrics';
    const qIndex = raw.indexOf('?');
    const pathname = (qIndex === -1 ? raw : raw.slice(0, qIndex)).split('#')[0] || '/lyrics';
    const search = qIndex === -1 ? '' : raw.slice(qIndex);
    return parseLyricsUrl(pathname, search);
  }


  private navigate(
    url: string,
    opts?: { replace?: boolean; markNav?: boolean },
  ): void {
    const replace = !!opts?.replace;
    const state = opts?.markNav ? { lyricsNav: true } : undefined;
    void this.router.navigateByUrl(url, { replaceUrl: replace, state });
  }

  private back(fallbackUrl: string): void {
    const histState = window.history.state as { lyricsNav?: boolean } | null;
    if (histState && histState.lyricsNav) {
      window.history.back();
      return;
    }
    void this.router.navigateByUrl(fallbackUrl, { replaceUrl: true });
  }

  private migrateLegacySongHash(): void {
    const path = legacySongHashToPath(window.location.hash || '');
    if (!path) return;
    void this.router.navigateByUrl(path, { replaceUrl: true });
  }

  private ensureJsonScript(id: string, json: string): void {
    let el = this.doc.getElementById(id) as HTMLScriptElement | null;
    if (!el) {
      el = this.doc.createElement('script');
      el.type = 'application/json';
      el.id = id;
      this.host.nativeElement.appendChild(el);
    }
    el.textContent = json;
  }
}
