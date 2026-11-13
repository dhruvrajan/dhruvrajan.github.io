import { Component, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { videos } from '../../data';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class HomePage {
  private readonly sanitizer = inject(DomSanitizer);

  readonly featured = videos[0];
  readonly moreVideos = videos.slice(1);
  readonly featuredEmbed: SafeResourceUrl | null = this.featured
    ? this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://www.youtube.com/embed/${this.featured.id}`,
      )
    : null;
}
