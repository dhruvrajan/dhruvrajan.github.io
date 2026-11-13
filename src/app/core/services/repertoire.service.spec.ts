import { TestBed } from '@angular/core/testing';
import { CatalogService } from './catalog.service';
import { RepertoireService } from './repertoire.service';

describe('RepertoireService', () => {
  let repertoire: RepertoireService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    repertoire = TestBed.inject(RepertoireService);
  });

  it('groups events by year', () => {
    const groups = repertoire.groupEventsByYear([
      { event_name: 'A', date: 'January 1st, 2024', location: 'Palo Alto' },
      { event_name: 'B', date: 'March 2nd, 2025' },
      { event_name: 'C', date: 'April 3rd, 2024' },
    ]);
    expect(groups.map((g) => g.year)).toEqual(['2024', '2025']);
    expect(groups[0].items.map((i) => i.event.event_name)).toEqual(['A', 'C']);
    expect(groups[0].items[0].dateLabel).toBe('January 1st');
  });

  it('filters songs by title or artist', () => {
    const catalog = TestBed.inject(CatalogService);
    const groups = repertoire.filterArtistGroups('zzzz-no-match');
    expect(groups.length).toBe(0);

    const sample = catalog.songs()[0];
    if (sample) {
      const hit = repertoire.filterArtistGroups(sample.title.slice(0, 4));
      expect(hit.length).toBeGreaterThan(0);
    }
  });
});
