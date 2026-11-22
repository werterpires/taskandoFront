import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { WorkFilterService } from './work-filter.service';

describe('WorkFilterService', () => {
  it('maintains canonical closed state order and notifies external toggles', () => {
    const service = TestBed.inject(WorkFilterService);

    expect(service.includeClosed()).toEqual([]);
    expect(service.showCompleted()).toBe(false);
    expect(service.syncTick()).toBe(0);

    service.setClosedState('archived', true);
    service.setClosedState('completed', true);
    expect(service.includeClosed()).toEqual(['completed', 'archived']);
    expect(service.showCompleted()).toBe(true);
    expect(service.syncTick()).toBe(0);

    const next = service.toggleCompleted();
    expect(next).toBe(false);
    expect(service.includeClosed()).toEqual(['archived']);
    expect(service.syncTick()).toBe(1);

    service.reset();
    expect(service.includeClosed()).toEqual([]);
  });
});
