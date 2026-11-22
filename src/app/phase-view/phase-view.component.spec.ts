import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, ApiService } from '../api.service';
import { PhaseViewComponent } from './phase-view.component';
import { ToastService } from '../shared/toast/toast.service';
import { flushVirtualScroll, scrollVirtualViewport } from '../testing/virtual-scroll.helper';

function phaseApiResponse(path: string) {
  if (path === 'phases/phase-1') return { phase: { id: 'phase-1', title: 'Fase Beta', status: 'in_progress', processId: 'process-9' } };
  if (path === 'work-progress/phase/phase-1') return { progress: { percentage: 75, completed: 3, total: 4, excluded: 0, visible: 4 } };
  if (path.startsWith('dependencies?')) return { tasks: [], phases: [], edges: [] };
  throw new Error(`Unexpected request: ${path}`);
}

describe('PhaseViewComponent', () => {
  it('loads phase data, tasks and progress', async () => {
    const api = {
      request: vi.fn(async (path: string) => phaseApiResponse(path)),
      requestWithClosed: vi.fn(async (_path: string) => ({
        tasks: [
          { id: 'task-1', title: 'Task 1', status: 'completed' },
          { id: 'task-2', title: 'Task 2', status: 'in_progress' },
        ],
      })),
    };
    const router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PhaseViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'phase-1' })) } },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PhaseViewComponent);
    fixture.detectChanges();
    await fixture.componentInstance.load();

    expect(fixture.componentInstance.state()).toBe('ready');
    expect(fixture.componentInstance.phase()?.title).toBe('Fase Beta');
    expect(fixture.componentInstance.tasks().length).toBe(2);
    expect(api.requestWithClosed).toHaveBeenCalledWith('task-containers/phase/phase-1', []);
  });

  it('navigates to task route on openTask', async () => {
    const api = {
      request: vi.fn(async (path: string) => phaseApiResponse(path)),
      requestWithClosed: vi.fn(async (_path: string) => ({ tasks: [] })),
    };
    const router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PhaseViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'phase-1' })) } },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PhaseViewComponent);
    fixture.detectChanges();
    await fixture.componentInstance.openTask({ id: 'task-99', title: 'Subtask Test' });

    expect(router.navigate).toHaveBeenCalledWith(['/tarefas', 'task-99']);
  });

  it('navigates back to parent process on back()', async () => {
    const api = {
      request: vi.fn(async (path: string) => phaseApiResponse(path)),
      requestWithClosed: vi.fn(async (_path: string) => ({ tasks: [] })),
    };
    const router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PhaseViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'phase-1' })) } },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PhaseViewComponent);
    fixture.detectChanges();
    await fixture.componentInstance.load();
    fixture.componentInstance.back();

    expect(router.navigate).toHaveBeenCalledWith(['/processos', 'process-9']);
  });

  it('handles 404 not-found and 403 forbidden states', async () => {
    const api = {
      request: vi.fn(async (_path: string) => {
        throw new ApiError(404, { error: 'Não encontrada' });
      }),
      requestWithClosed: vi.fn(async (_path: string) => ({ tasks: [] })),
    };

    await TestBed.configureTestingModule({
      imports: [PhaseViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'phase-missing' })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PhaseViewComponent);
    fixture.detectChanges();
    await fixture.componentInstance.load();

    expect(fixture.componentInstance.state()).toBe('not-found');
  });

  it('renders breadcrumbs path starting from pessoal and navigates on crumb click', async () => {
    const api = {
      request: vi.fn(async (path: string) => {
        if (path === 'phases/phase-1') {
          return {
            phase: {
              id: 'phase-1',
              title: 'Fase Beta',
              status: 'in_progress',
              processId: 'process-9',
              parentChain: [
                { type: 'organization', id: 'org-1', name: 'edubazu' },
                { type: 'process', id: 'process-9', name: 'Processo Core' },
              ],
            },
          };
        }
        return phaseApiResponse(path);
      }),
      requestWithClosed: vi.fn(async () => ({ tasks: [] })),
    };
    const router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PhaseViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'phase-1' })) } },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PhaseViewComponent);
    fixture.detectChanges();
    await fixture.componentInstance.load();
    fixture.detectChanges();

    const crumbs = fixture.componentInstance.breadcrumbs();
    expect(crumbs.map(c => c.label)).toEqual(['pessoal', 'edubazu', 'Processo Core', 'Fase Beta']);

    const compiled = fixture.nativeElement as HTMLElement;
    const pathEl = compiled.querySelector('.page-heading .entity-path');
    expect(pathEl).toBeTruthy();
    expect(pathEl?.textContent).toContain('pessoal');
    expect(pathEl?.textContent).toContain('edubazu');
    expect(pathEl?.textContent).toContain('Processo Core');
    expect(pathEl?.textContent).toContain('Fase Beta');

    fixture.componentInstance.navigateCrumb(crumbs[2]);
    expect(router.navigate).toHaveBeenCalledWith(['/processos', 'process-9']);
  });

  it('renders approve/reject buttons and submits approval decision', async () => {
    let currentStatus = 'awaiting_approval';
    const api = {
      request: vi.fn(async (path: string, method?: string, body?: any) => {
        if (path === 'approvals' && method === 'POST') {
          currentStatus = body.decision === 'approve' ? 'completed' : 'in_progress';
          return { subjectType: 'phase', item: { id: 'phase-1', status: currentStatus } };
        }
        if (path === 'phases/phase-1') {
          return { phase: { id: 'phase-1', title: 'Fase Beta', status: currentStatus, processId: 'process-9' } };
        }
        return phaseApiResponse(path);
      }),
      requestWithClosed: vi.fn(async () => ({ tasks: [] })),
    };
    const router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PhaseViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'phase-1' })) } },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PhaseViewComponent);
    fixture.detectChanges();
    await fixture.componentInstance.load();
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const approveBtn = compiled.querySelector('.page-heading .actions button.primary') as HTMLButtonElement;
    expect(approveBtn).toBeTruthy();
    expect(approveBtn.textContent).toContain('Aprovar');

    await fixture.componentInstance.approve('approve');
    expect(api.request).toHaveBeenCalledWith('approvals', 'POST', {
      subjectType: 'phase',
      subjectId: 'phase-1',
      decision: 'approve',
    });
    expect(fixture.componentInstance.phase()?.status).toBe('completed');
    const toast = TestBed.inject(ToastService);
    expect(toast.toasts().some(t => t.kind === 'success' && t.message.includes('Fase aprovada'))).toBe(true);
    toast.clear();
  });

  it('opens reject modal and confirms rejection with reason', async () => {
    const api = {
      request: vi.fn(async (path: string, method?: string, body?: any) => {
        if (path === 'approvals' && method === 'POST') {
          return { subjectType: 'phase', item: { id: 'phase-1', status: 'in_progress' } };
        }
        if (path === 'phases/phase-1') {
          return { phase: { id: 'phase-1', title: 'Fase Beta', status: 'awaiting_approval', processId: 'process-9' } };
        }
        return phaseApiResponse(path);
      }),
      requestWithClosed: vi.fn(async () => ({ tasks: [] })),
    };

    await TestBed.configureTestingModule({
      imports: [PhaseViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'phase-1' })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PhaseViewComponent);
    fixture.detectChanges();
    await fixture.componentInstance.load();
    fixture.detectChanges();

    fixture.componentInstance.promptReject();
    expect(fixture.componentInstance.rejectModalOpen()).toBe(true);

    fixture.componentInstance.confirmReject();
    expect(fixture.componentInstance.actionError()).toContain('Informe o motivo');

    fixture.componentInstance.rejectReason.set('Necessário ajustar cobertura.');
    fixture.componentInstance.confirmReject();
    await Promise.resolve();

    expect(api.request).toHaveBeenCalledWith('approvals', 'POST', {
      subjectType: 'phase',
      subjectId: 'phase-1',
      decision: 'reject',
      reason: 'Necessário ajustar cobertura.',
    });
    expect(fixture.componentInstance.rejectModalOpen()).toBe(false);
  });

  it('virtualizes phase task list, navigates on virtualized item click, and updates on scroll and search', async () => {
    const manyTasks = Array.from({ length: 45 }, (_, i) => ({
      id: `task-${i + 1}`,
      title: `Atividade ${String(i + 1).padStart(2, '0')}`,
      status: i % 2 === 0 ? 'todo' : 'in_progress',
    }));
    const api = {
      request: vi.fn(async (path: string) => phaseApiResponse(path)),
      requestWithClosed: vi.fn(async () => ({ tasks: manyTasks })),
    };
    const router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PhaseViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'phase-1' })) } },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PhaseViewComponent);
    fixture.detectChanges();
    await fixture.componentInstance.load();
    const viewports = await flushVirtualScroll(fixture, { height: 340 });

    expect(viewports).toHaveLength(1);
    const el = fixture.nativeElement as HTMLElement;
    const buttons = el.querySelectorAll('.phase-task-list button.process-item');
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.length).toBeLessThan(manyTasks.length);

    const firstBtn = el.querySelector('button.process-item[aria-label="Abrir tarefa Atividade 01"]') as HTMLButtonElement | null;
    expect(firstBtn).not.toBeNull();
    firstBtn?.click();
    expect(router.navigate).toHaveBeenCalledWith(['/tarefas', 'task-1']);

    await scrollVirtualViewport(fixture, viewports[0], 68 * 30);
    expect(el.textContent).toContain('Atividade 35');

    fixture.componentInstance.search.set('Atividade 44');
    await flushVirtualScroll(fixture, { height: 340 });
    const filteredButtons = el.querySelectorAll('.phase-task-list button.process-item');
    expect(filteredButtons).toHaveLength(1);
    expect(filteredButtons[0].textContent).toContain('Atividade 44');
    fixture.destroy();
  });

  it('switches between Lista, Grafo, and Linha do tempo and synchronizes filters in phase view', async () => {
    const today = new Date();
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const yesterday = new Date(today.getTime() - 86_400_000);
    const yesterdayIso = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    const tomorrow = new Date(today.getTime() + 86_400_000);
    const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    const allTasks = [
      { id: 'task-1', title: 'Checklist Inicial', status: 'completed', dueDate: yesterdayIso, description: 'Concluída' },
      { id: 'task-2', title: 'Executar Revisão', status: 'in_progress', dueDate: todayIso, description: 'Foco principal' },
      { id: 'task-3', title: 'Ajuste Atrasado', status: 'todo', dueDate: yesterdayIso, description: 'Pendente' },
    ];
    const graphResponse = {
      phases: [],
      tasks: [
        {
          id: 'task-1',
          type: 'task',
          title: 'Checklist Inicial',
          status: 'completed',
          taskType: 'simple',
          dueDate: yesterdayIso,
          size: 'xs',
          containerType: 'phase',
          containerId: 'phase-1',
          processId: 'process-9',
          dependencyState: 'independent',
          dependencyBlockers: [],
          canConnect: true,
        },
        {
          id: 'task-2',
          type: 'task',
          title: 'Executar Revisão',
          status: 'in_progress',
          taskType: 'simple',
          dueDate: todayIso,
          size: 's',
          containerType: 'phase',
          containerId: 'phase-1',
          processId: 'process-9',
          dependencyState: 'released',
          dependencyBlockers: [],
          canConnect: true,
        },
        {
          id: 'task-3',
          type: 'task',
          title: 'Ajuste Atrasado',
          status: 'todo',
          taskType: 'simple',
          dueDate: yesterdayIso,
          size: 'xs',
          containerType: 'phase',
          containerId: 'phase-1',
          processId: 'process-9',
          dependencyState: 'independent',
          dependencyBlockers: [],
          canConnect: true,
        },
        {
          id: 'task-4',
          type: 'task',
          title: 'Entrega Futura',
          status: 'todo',
          taskType: 'simple',
          dueDate: tomorrowIso,
          size: 'xs',
          containerType: 'phase',
          containerId: 'phase-1',
          processId: 'process-9',
          dependencyState: 'independent',
          dependencyBlockers: [],
          canConnect: true,
        },
      ],
      edges: [
        {
          id: 'edge-1',
          predecessorType: 'task',
          predecessorId: 'task-1',
          successorType: 'task',
          successorId: 'task-2',
          canRemove: true,
        },
      ],
    };

    const api = {
      request: vi.fn(async (path: string) => {
        if (path.startsWith('dependencies?')) return graphResponse;
        return phaseApiResponse(path);
      }),
      requestWithClosed: vi.fn(async (_path: string, closed: string[]) => ({
        tasks: allTasks.filter(task => task.status !== 'completed' || closed.includes('completed')),
      })),
    };
    const router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [PhaseViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'phase-1' })) } },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(PhaseViewComponent);
    fixture.detectChanges();
    await fixture.componentInstance.load();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const tabs = Array.from(el.querySelectorAll('.process-view-tabs button[role="tab"]')) as HTMLButtonElement[];
    expect(tabs.map(t => t.textContent?.trim())).toEqual(['☷ Lista', '◇ Grafo', '◷ Linha do tempo']);

    tabs[1].click();
    fixture.detectChanges();
    expect(el.querySelector('app-dependency-graph')).toBeTruthy();
    expect(el.querySelector('app-timeline-gantt')).toBeNull();
    expect(el.querySelector('.phase-task-list')).toBeNull();

    tabs[2].click();
    fixture.detectChanges();
    expect(el.querySelector('app-timeline-gantt')).toBeTruthy();
    expect(el.querySelector('app-dependency-graph')).toBeNull();
    expect(el.querySelector('[data-node-key="task:task-1"]')).toBeNull();
    expect(el.querySelector('[data-node-key="task:task-2"]')).toBeTruthy();
    expect(el.querySelector('[data-edge-id="edge-1"]')).toBeNull();

    await fixture.componentInstance.toggleClosed('completed', true);
    fixture.detectChanges();
    expect(el.querySelector('[data-node-key="task:task-1"]')).toBeTruthy();
    expect(el.querySelector('[data-edge-id="edge-1"]')).toBeTruthy();

    fixture.componentInstance.temporal.set('today');
    fixture.detectChanges();
    expect(el.querySelector('[data-node-key="task:task-2"]')).toBeTruthy();
    expect(el.querySelector('[data-node-key="task:task-3"]')).toBeNull();

    fixture.componentInstance.temporal.set('all');
    fixture.componentInstance.search.set('Foco principal');
    fixture.detectChanges();
    expect(el.querySelector('[data-node-key="task:task-2"]')).toBeTruthy();
    expect(el.querySelector('[data-node-key="task:task-3"]')).toBeNull();

    (el.querySelector('[data-node-key="task:task-2"]') as HTMLButtonElement)?.click();
    expect(router.navigate).toHaveBeenCalledWith(['/tarefas', 'task-2']);

    await fixture.componentInstance.toggleClosed('completed', false);
    fixture.destroy();
  });
});
