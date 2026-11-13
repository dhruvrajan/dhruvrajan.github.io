import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Song } from '../../core/models/site';
import { RepertoireService } from '../../core/services/repertoire.service';

@Component({
  selector: 'app-songs',
  imports: [RouterLink],
  templateUrl: './songs.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SongsPage {
  private readonly repertoire = inject(RepertoireService);

  readonly filter = signal('');

  readonly groups = computed(() => this.repertoire.filterArtistGroups(this.filter()));

  readonly filterStatus = computed(() =>
    this.repertoire.filterStatus(this.filter(), this.groups()),
  );

  setup(song: Song): string {
    return this.repertoire.formatSetup(song);
  }

  href(song: Song): string | null {
    return this.repertoire.mediaLink(song);
  }

  lyricsSlug(song: Song): string {
    return this.repertoire.lyricsSlug(song);
  }

  onFilter(value: string): void {
    this.filter.set(value);
  }
}
