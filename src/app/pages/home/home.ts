import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { CatalogService } from '../../core/services/catalog.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomePage {
  private readonly catalog = inject(CatalogService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly featured = this.catalog.featuredVideo;
  readonly moreVideos = this.catalog.moreVideos;

  readonly featuredEmbed = computed<SafeResourceUrl | null>(() => {
    const video = this.featured();
    if (!video) {
      return null;
    }
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${video.id}`,
    );
  });
}
