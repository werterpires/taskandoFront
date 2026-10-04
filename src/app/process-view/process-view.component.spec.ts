import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, ApiService } from '../api.service';
import { ProcessViewComponent } from './process-view.component';
import { DrawerService } from '../shared/drawer.service';

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

  it('returns a process detail to the process collection', async () => {
    const router = { navigate: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [ProcessViewComponent],
      providers: [
        { provide: ApiService, useValue: { request: vi.fn(), requestWithClosed: vi.fn() } },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'process-1' })) } },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProcessViewComponent);
    fixture.componentInstance.back();
    expect(router.navigate).toHaveBeenCalledWith(['/processos']);
    fixture.destroy();
  });

  it('opens phase card on Filhos tab and direct task on Detalhes tab in drawer', async () => {
    const api = {
      request: vi.fn(async (path: string) => {
        if (path === 'processes/process-1') return { process: { id: 'process-1', title: 'Entrega', status: 'in_progress' } };
        if (path.startsWith('work-progress/')) return { percentage: 50, completed: 1, total: 2, excluded: 0, visible: 2 };
        if (path.startsWith('dependencies?')) return { tasks: [], phases: [], edges: [] };
        if (path.startsWith('item-roles?')) return { capabilities: ['edit'] };
        if (path.startsWith('owner-transfers?')) return { transfers: [] };
        if (path === 'tasks/task-1/checklist') return { checklist: [] };
        if (path === 'tasks/task-1/comments') return { comments: [] };
        if (path === 'tasks/task-1/audit') return { events: [] };
        throw new Error(`Unexpected request: ${path}`);
      }),
      requestWithClosed: vi.fn(async (path: string) => {
        if (path === 'processes/process-1/phases') return { phases: [{ id: 'phase-1', title: 'Fase 1', status: 'todo' }] };
        if (path === 'task-containers/process/process-1') return { tasks: [{ id: 'task-1', title: 'Tarefa 1', status: 'todo' }] };
        if (path === 'processes/phase-1/phases') return { phases: [] };
        if (path === 'task-containers/phase/phase-1') return { tasks: [] };
        if (path === 'tasks/task-1/subtasks') return { subtasks: [] };
        throw new Error(`Unexpected requestWithClosed: ${path}`);
      }),
    };
    await TestBed.configureTestingModule({
      imports: [ProcessViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'process-1' })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProcessViewComponent);
    const drawer = TestBed.inject(DrawerService);
    fixture.detectChanges();
    await fixture.componentInstance.load();
    fixture.detectChanges();

    const phaseBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector('button.process-item[aria-label="Abrir fase Fase 1"]');
    expect(phaseBtn).not.toBeNull();
    phaseBtn?.click();
    await fixture.whenStable();

    expect(drawer.openedItem()?.id).toBe('phase-1');
    expect(drawer.initialTab()).toBe('Filhos');

    const taskBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector('button.process-item[aria-label="Abrir tarefa Tarefa 1"]');
    expect(taskBtn).not.toBeNull();
    taskBtn?.click();
    await fixture.whenStable();

    expect(drawer.openedItem()?.id).toBe('task-1');
    expect(drawer.initialTab()).toBe('Detalhes');
    fixture.destroy();
  });

  it('opens graph node in drawer when clicking node heading in dependency graph', async () => {
    const api = {
      request: vi.fn(async (path: string) => {
        if (path === 'processes/process-1') return { process: { id: 'process-1', title: 'Entrega', status: 'in_progress' } };
        if (path.startsWith('work-progress/')) return { percentage: 50, completed: 1, total: 2, excluded: 0, visible: 2 };
        if (path.startsWith('dependencies?')) {
          return {
            tasks: [{ id: 'task-1', type: 'task', title: 'Tarefa 1', status: 'todo', dependencyState: 'independent', dependencyBlockers: [], canConnect: true }],
            phases: [{ id: 'phase-1', type: 'phase', title: 'Fase 1', status: 'todo', dependencyState: 'independent', dependencyBlockers: [], canConnect: true }],
            edges: [],
          };
        }
        if (path.startsWith('item-roles?')) return { capabilities: ['edit'] };
        if (path.startsWith('owner-transfers?')) return { transfers: [] };
        if (path.startsWith('tasks/')) return { checklist: [], comments: [], audit: [] };
        throw new Error(`Unexpected request: ${path}`);
      }),
      requestWithClosed: vi.fn(async (path: string) => {
        if (path === 'processes/process-1/phases') return { phases: [{ id: 'phase-1', title: 'Fase 1', status: 'todo' }] };
        if (path === 'task-containers/process/process-1') return { tasks: [{ id: 'task-1', title: 'Tarefa 1', status: 'todo' }] };
        if (path.startsWith('tasks/')) return { subtasks: [] };
        if (path.startsWith('processes/')) return { phases: [] };
        if (path.startsWith('task-containers/')) return { tasks: [] };
        throw new Error(`Unexpected requestWithClosed: ${path}`);
      }),
    };
    await TestBed.configureTestingModule({
      imports: [ProcessViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'process-1' })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProcessViewComponent);
    const drawer = TestBed.inject(DrawerService);
    fixture.detectChanges();
    await fixture.componentInstance.load();
    fixture.detectChanges();

    const nodeBtn: HTMLButtonElement | null = fixture.nativeElement.querySelector('button.node-heading[aria-label="Abrir detalhes de Tarefa 1"]');
    expect(nodeBtn).not.toBeNull();
    nodeBtn?.click();
    await fixture.whenStable();

    expect(drawer.openedItem()?.id).toBe('task-1');
    expect(drawer.initialTab()).toBe('Detalhes');
    fixture.destroy();
  });

  it('refreshes process view when drawer mutation notification occurs', async () => {
    let loadCount = 0;
    const api = {
      request: vi.fn(async (path: string) => {
        if (path === 'processes/process-1') {
          loadCount++;
          return { process: { id: 'process-1', title: 'Entrega', status: 'in_progress' } };
        }
        if (path === 'work-progress/process/process-1') return { percentage: 50, completed: 1, total: 2, excluded: 0, visible: 2 };
        if (path.startsWith('dependencies?')) return { tasks: [], phases: [], edges: [] };
        if (path.startsWith('item-roles?')) return { capabilities: ['edit'] };
        throw new Error(`Unexpected request: ${path}`);
      }),
      requestWithClosed: vi.fn(async () => ({ phases: [], tasks: [] })),
    };
    await TestBed.configureTestingModule({
      imports: [ProcessViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'process-1' })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProcessViewComponent);
    const drawer = TestBed.inject(DrawerService);
    fixture.detectChanges();
    await fixture.componentInstance.load();
    expect(loadCount).toBeGreaterThanOrEqual(1);

    const prevCount = loadCount;
    drawer.notifyMutation({ id: 'task-1', title: 'Task 1', kind: 'task' }, 'patch');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(loadCount).toBeGreaterThan(prevCount);
    fixture.destroy();
  });
});
