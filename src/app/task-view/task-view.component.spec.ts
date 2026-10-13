import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, ApiService } from '../api.service';
import { TaskViewComponent } from './task-view.component';
import { DrawerService } from '../shared/drawer.service';

function taskApiResponse(path: string) {
  if (path === 'tasks/task-1') {
    return {
      task: {
        id: 'task-1',
        title: 'Criar tela',
        status: 'todo',
        parentType: 'phase',
        parentId: 'phase-10',
        dueDate: '2026-10-05',
      },
    };
  }
  if (path === 'tasks/task-1/checklist') {
    return { items: [{ id: 'chk-1', title: 'Item 1', completed: false }] };
  }
  if (path === 'tasks/task-1/comments') {
    return { comments: [{ id: 'c-1', body: 'Comentário', authorName: 'Tester', createdAt: '2026-10-04T10:00:00Z' }] };
  }
  if (path === 'tasks/task-1/audit') {
    return { events: [{ id: 'e-1', summary: 'criou a tarefa', actorName: 'Tester', createdAt: '2026-10-04T10:00:00Z' }] };
  }
  throw new Error(`Unexpected request: ${path}`);
}

describe('TaskViewComponent', () => {
  it('loads task details, checklist, comments and audit', async () => {
    const api = {
      request: vi.fn(async (path: string) => taskApiResponse(path)),
      requestWithClosed: vi.fn(async (_path: string) => ({ subtasks: [{ id: 'sub-1', title: 'Sub 1' }] })),
    };
    const router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TaskViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'task-1' })) } },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TaskViewComponent);
    fixture.detectChanges();
    await fixture.componentInstance.load();

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('05/10/2026');
    expect(fixture.componentInstance.state()).toBe('ready');
    expect(fixture.componentInstance.task()?.title).toBe('Criar tela');
    expect(fixture.componentInstance.checklist().length).toBe(1);
    expect(fixture.componentInstance.subtasks().length).toBe(1);
    expect(fixture.componentInstance.comments().length).toBe(1);
    expect(fixture.componentInstance.audit().length).toBe(1);
  });

  it('updates status and notifies mutation', async () => {
    const api = {
      request: vi.fn(async (path: string, method?: string, body?: any) => {
        if (method === 'PATCH' && path === 'tasks/task-1') {
          return { task: { id: 'task-1', title: 'Criar tela', status: body.status } };
        }
        return taskApiResponse(path);
      }),
      requestWithClosed: vi.fn(async (_path: string) => ({ subtasks: [] })),
    };
    const drawer = { notifyMutation: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TaskViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'task-1' })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: DrawerService, useValue: drawer },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TaskViewComponent);
    fixture.detectChanges();
    await fixture.componentInstance.load();
    await fixture.componentInstance.updateStatus('in_progress');

    expect(fixture.componentInstance.task()?.status).toBe('in_progress');
    expect(drawer.notifyMutation).toHaveBeenCalled();
  });

  it('navigates back to phase container when parentType is phase', async () => {
    const api = {
      request: vi.fn(async (path: string) => taskApiResponse(path)),
      requestWithClosed: vi.fn(async (_path: string) => ({ subtasks: [] })),
    };
    const router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TaskViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'task-1' })) } },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TaskViewComponent);
    fixture.detectChanges();
    await fixture.componentInstance.load();
    fixture.componentInstance.back();

    expect(router.navigate).toHaveBeenCalledWith(['/fases', 'phase-10']);
  });

  it('handles 404 not-found', async () => {
    const api = {
      request: vi.fn(async (_path: string) => {
        throw new ApiError(404, { error: 'Não encontrada' });
      }),
      requestWithClosed: vi.fn(async (_path: string) => ({ subtasks: [] })),
    };

    await TestBed.configureTestingModule({
      imports: [TaskViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'task-missing' })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TaskViewComponent);
    fixture.detectChanges();
    await fixture.componentInstance.load();

    expect(fixture.componentInstance.state()).toBe('not-found');
  });

  it('renders breadcrumbs path starting from pessoal and navigates on crumb click', async () => {
    const api = {
      request: vi.fn(async (path: string) => {
        if (path === 'tasks/task-1') {
          return {
            task: {
              id: 'task-1',
              title: 'Criar tela',
              status: 'todo',
              parentType: 'phase',
              parentId: 'phase-10',
              parentChain: [
                { type: 'organization', id: 'org-1', name: 'edubazu' },
                { type: 'process', id: 'proc-1', name: 'Entrega' },
                { type: 'phase', id: 'phase-10', name: 'Fase Beta' },
              ],
            },
          };
        }
        return taskApiResponse(path);
      }),
      requestWithClosed: vi.fn(async () => ({ subtasks: [] })),
    };
    const router = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TaskViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'task-1' })) } },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TaskViewComponent);
    fixture.detectChanges();
    await fixture.componentInstance.load();
    fixture.detectChanges();

    const crumbs = fixture.componentInstance.breadcrumbs();
    expect(crumbs.map(c => c.label)).toEqual(['pessoal', 'edubazu', 'Entrega', 'Fase Beta', 'Criar tela']);

    const compiled = fixture.nativeElement as HTMLElement;
    const pathEl = compiled.querySelector('.page-heading .entity-path');
    expect(pathEl).toBeTruthy();
    expect(pathEl?.textContent).toContain('pessoal');
    expect(pathEl?.textContent).toContain('edubazu');
    expect(pathEl?.textContent).toContain('Entrega');
    expect(pathEl?.textContent).toContain('Fase Beta');
    expect(pathEl?.textContent).toContain('Criar tela');

    fixture.componentInstance.navigateCrumb(crumbs[2]);
    expect(router.navigate).toHaveBeenCalledWith(['/processos', 'proc-1']);
  });

  it('adds and toggles checklist item with correct title payload', async () => {
    const postPayloads: any[] = [];
    const patchPayloads: any[] = [];
    const api = {
      request: vi.fn(async (path: string, method?: string, body?: any) => {
        if (method === 'POST' && path === 'tasks/task-1/checklist') {
          postPayloads.push(body);
          return { item: { id: 'chk-2', title: body.title, completed: false } };
        }
        if (method === 'PATCH' && path === 'tasks/task-1/checklist/chk-1') {
          patchPayloads.push(body);
          return { item: { id: 'chk-1', title: 'Item 1', completed: body.completed } };
        }
        if (path === 'tasks/task-1/checklist') {
          return {
            items: [
              { id: 'chk-1', title: 'Item 1', completed: false },
              ...(postPayloads.length ? [{ id: 'chk-2', title: postPayloads[0].title, completed: false }] : []),
            ],
          };
        }
        return taskApiResponse(path);
      }),
      requestWithClosed: vi.fn(async () => ({ subtasks: [] })),
    };
    const drawer = { notifyMutation: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [TaskViewComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'task-1' })) } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: DrawerService, useValue: drawer },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(TaskViewComponent);
    fixture.detectChanges();
    await fixture.componentInstance.load();

    expect(fixture.componentInstance.checklist().length).toBe(1);

    fixture.componentInstance.newChecklistText = 'Cobrar Bianca';
    await fixture.componentInstance.addChecklistItem();

    expect(postPayloads).toEqual([{ title: 'Cobrar Bianca' }]);
    expect(fixture.componentInstance.checklist().length).toBe(2);
    expect(fixture.componentInstance.checklist()[1].title).toBe('Cobrar Bianca');

    await fixture.componentInstance.toggleChecklistItem(fixture.componentInstance.checklist()[0]);
    expect(patchPayloads).toEqual([{ completed: true }]);
    expect(fixture.componentInstance.checklist()[0].completed).toBe(true);
  });
});

