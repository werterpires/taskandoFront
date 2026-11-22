import { Injectable, computed, signal } from '@angular/core';
import { ClosedWorkState, closedWorkStates } from '../api.service';

@Injectable({ providedIn: 'root' })
export class WorkFilterService {
  readonly includeClosed = signal<ClosedWorkState[]>([]);
  readonly showCompleted = computed(() => this.includeClosed().includes('completed'));
  readonly syncTick = signal(0);

  isClosedIncluded(state: ClosedWorkState): boolean {
    return this.includeClosed().includes(state);
  }

  setClosedState(state: ClosedWorkState, included: boolean, notify = false): void {
    const selected = new Set(this.includeClosed());
    if (included) {
      selected.add(state);
    } else {
      selected.delete(state);
    }
    this.includeClosed.set(closedWorkStates.filter(value => selected.has(value)));
    if (notify) {
      this.syncTick.update(n => n + 1);
    }
  }

  setIncludeClosed(states: readonly ClosedWorkState[], notify = false): void {
    const selected = new Set(states);
    this.includeClosed.set(closedWorkStates.filter(value => selected.has(value)));
    if (notify) {
      this.syncTick.update(n => n + 1);
    }
  }

  toggleCompleted(): boolean {
    const next = !this.showCompleted();
    this.setClosedState('completed', next, true);
    return next;
  }

  reset(): void {
    this.includeClosed.set([]);
  }
}
