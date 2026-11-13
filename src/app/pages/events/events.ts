import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RepertoireService } from '../../core/services/repertoire.service';

@Component({
  selector: 'app-events',
  templateUrl: './events.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EventsPage {
  private readonly repertoire = inject(RepertoireService);

  readonly groups = this.repertoire.groupEventsByYear();
}
