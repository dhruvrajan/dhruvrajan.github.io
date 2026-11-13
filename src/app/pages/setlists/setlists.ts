import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { RepertoireService } from '../../core/services/repertoire.service';

@Component({
  selector: 'app-setlists',
  imports: [RouterLink],
  templateUrl: './setlists.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SetlistsPage {
  private readonly repertoire = inject(RepertoireService);

  readonly resolved = this.repertoire.resolveSetlists();
}
