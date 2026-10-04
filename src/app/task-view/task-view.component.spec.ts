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
    return { checklist: [{ id: 'chk-1', text: 'Item 1', completed: false }] };
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
});
