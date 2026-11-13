import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';

const NARROW_PATHS = new Set(['/events', '/setlists', '/songs', '/lyrics']);

@Component({
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);

  readonly year = new Date().getFullYear();

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd),
      map((e) => e.urlAfterRedirects.split('?')[0].split('#')[0]),
      startWith(this.router.url.split('?')[0].split('#')[0]),
    ),
    { initialValue: '/' },
  );

  readonly narrow = computed(() => NARROW_PATHS.has(this.url() || '/'));
}
