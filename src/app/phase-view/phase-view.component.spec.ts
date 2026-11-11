import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, ApiService } from '../api.service';
import { PhaseViewComponent } from './phase-view.component';

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
});
