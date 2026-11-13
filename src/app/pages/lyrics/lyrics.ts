import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  inject,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RepertoireService } from '../../core/services/repertoire.service';

declare global {
  interface Window {
    LyricsApp?: { init?: () => void | Promise<void>; browseApi?: () => unknown };
    LyricsBrowse?: unknown;
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

  async ngAfterViewInit(): Promise<void> {
    const body = this.doc.body;
    body.setAttribute('data-lyrics-base', '/assets/data/lyrics/');
    body.setAttribute('data-lyrics-sw', '/lyrics-sw.js');

    this.ensureJsonScript('songs-meta-json', this.repertoire.songsMetaJson());
    this.ensureJsonScript('songbook-sections-json', this.repertoire.songbookSectionsJson());

    for (const src of LYRICS_SCRIPTS) {
      await loadScript(this.doc, src);
    }

    if (window.LyricsApp && typeof window.LyricsApp.init === 'function') {
      await window.LyricsApp.init();
    }
  }

  ngOnDestroy(): void {
    // Keep scripts loaded for SPA revisits; lock UI is handled by lyrics.js.
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
