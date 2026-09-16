import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, ApiService } from '../api.service';
import { ProcessViewComponent } from './process-view.component';

function apiResponse(path: string) {
  if (path === 'processes/process-1') return { process: { id: 'process-1', title: 'Entrega', status: 'in_progress' } };
  if (path === 'work-progress/process/process-1') return { percentage: 50, completed: 1, total: 2, excluded: 0, visible: 2 };
  if (path.startsWith('dependencies?')) return { tasks: [], phases: [], edges: [] };
  if (path.startsWith('item-roles?')) return { capabilities: ['view'] };
  throw new Error(`Unexpected request: ${path}`);
}

describe('ProcessViewComponent', () => {
  it('loads a deep link and identifies read-only access', async () => {
    const api = {
      request: vi.fn(async (path: string) => apiResponse(path)),
      requestWithClosed: vi.fn(async (path: string) => path.includes('/phases') ? { phases: [] } : { tasks: [] }),
    };
    await TestBed.configureTestingModule({
      imports: [ProcessViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'process-1' })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: Location, useValue: { back: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProcessViewComponent);
    fixture.detectChanges();
    await fixture.componentInstance.load();

    expect(fixture.componentInstance.state()).toBe('ready');
    expect(fixture.componentInstance.process()?.title).toBe('Entrega');
    expect(fixture.componentInstance.readOnly()).toBe(true);
    expect(api.requestWithClosed).toHaveBeenCalledWith('processes/process-1/phases', []);
    expect(api.requestWithClosed).toHaveBeenCalledWith('task-containers/process/process-1', []);
  });

  it('requests selected closed states again and exposes a forbidden state', async () => {
    const api = {
      request: vi.fn(async (path: string) => apiResponse(path)),
      requestWithClosed: vi.fn(async (path: string) => path.includes('/phases') ? { phases: [] } : { tasks: [] }),
    };
    await TestBed.configureTestingModule({
      imports: [ProcessViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'process-1' })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: Location, useValue: { back: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProcessViewComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await fixture.componentInstance.toggleClosed('archived', true);
    await fixture.componentInstance.toggleClosed('completed', true);

    expect(fixture.componentInstance.includeClosed()).toEqual(['completed', 'archived']);
    expect(api.requestWithClosed).toHaveBeenLastCalledWith('task-containers/process/process-1', ['completed', 'archived']);

    api.request.mockRejectedValueOnce(new ApiError(403, { error: 'Sem acesso.' }));
    await fixture.componentInstance.load();
    expect(fixture.componentInstance.state()).toBe('forbidden');
  });
});
