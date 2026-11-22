import { ChangeDetectionStrategy, Component } from '@angular/core';

/** A route activation marker; AppComponent owns the shared application shell. */
@Component({
  selector: 'app-section-route',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class SectionRouteComponent {}
