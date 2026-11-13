import { Component } from '@angular/core';
import { events } from '../../data';
import { EventItem } from '../../models/site';

interface YearGroup {
  year: string;
  items: { event: EventItem; dateLabel: string }[];
}

function eventYear(date: string): string {
  const parts = date.split(',');
  return (parts[parts.length - 1] || '').trim();
}

function dateWithoutYear(date: string, year: string): string {
  return date.replace(year, '').replace(/,/g, '').trim();
}

@Component({
  selector: 'app-events',
  templateUrl: './events.html',
})
export class EventsPage {
  readonly groups: YearGroup[] = (() => {
    const years: string[] = [];
    for (const event of events) {
      const y = eventYear(event.date);
      if (y && !years.includes(y)) years.push(y);
    }
    return years.map((year) => ({
      year,
      items: events
        .filter((e) => eventYear(e.date) === year)
        .map((event) => ({
          event,
          dateLabel: dateWithoutYear(event.date, year),
        })),
    }));
  })();
}
