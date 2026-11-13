import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

const DEFAULT_DESCRIPTION =
  'Solo acoustic and folk performer based in Palo Alto, CA';

const PAGE_DESCRIPTIONS: Record<string, string> = {
  '/': DEFAULT_DESCRIPTION,
  '/events': 'Past performances by Dhruv Rajan — solo acoustic and folk in Palo Alto, CA.',
  '/setlists': 'Sample setlists and recordings from Dhruv Rajan.',
  '/songs': 'Songs by artist from Dhruv Rajan\'s acoustic and folk repertoire.',
  '/lyrics': 'Private lyrics browser for Dhruv Rajan’s repertoire.',
};

/**
 * Keeps document title/meta description aligned with the active route.
 * Route-level `title` values remain the source of truth for page titles.
 */
@Injectable({ providedIn: 'root' })
export class DocumentMetaService {
  private readonly router = inject(Router);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private started = false;

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        const path = event.urlAfterRedirects.split('?')[0].split('#')[0] || '/';
        this.applyDescription(path);
      });

    this.applyDescription(this.router.url.split('?')[0].split('#')[0] || '/');
  }

  setTitle(value: string): void {
    this.title.setTitle(value);
  }

  private applyDescription(path: string): void {
    const description = PAGE_DESCRIPTIONS[path] ?? DEFAULT_DESCRIPTION;
    this.meta.updateTag({ name: 'description', content: description });
  }
}
