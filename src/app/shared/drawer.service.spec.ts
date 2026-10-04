import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ApiService, Item } from '../api.service';
import { DrawerService } from './drawer.service';

describe('DrawerService', () => {
  function setup(apiOverrides: Partial<ApiService> = {}) {
    const api = {
      request: vi.fn(async (path: string) => {
        if (path === 'tasks/task-1/checklist') return { checklist: [{ id: 'chk-1', title: 'Check 1' }] };
        if (path === 'tasks/task-1/comments') return { comments: [{ id: 'cmt-1', body: 'Comment 1' }] };
        if (path === 'tasks/task-1/audit') return { events: [{ id: 'evt-1', summary: 'Created' }] };
        if (path === 'organizations/org-1/members') {
          return { owner: { id: 'u1' }, members: [], capabilities: { canAddMembers: true } };
        }
        if (path === 'organizations/org-1/audit') return { events: [] };
        if (path.startsWith('work-progress/')) return { percentage: 50 };
        if (path.startsWith('dependencies?')) return { tasks: [], phases: [], edges: [] };
        if (path.startsWith('item-roles?')) return { roles: [] };
        if (path.startsWith('owner-transfers?')) return { transfers: [] };
        return {};
      }),
      requestWithClosed: vi.fn(async (path: string) => {
        if (path === 'tasks/task-1/subtasks') return { subtasks: [{ id: 'sub-1', title: 'Subtask 1' }] };
        if (path === 'task-containers/process/proc-1') return { tasks: [{ id: 't1', title: 'Task in proc' }] };
        if (path === 'processes/proc-1/phases') return { phases: [{ id: 'ph-1', title: 'Phase 1' }] };
        return {};
      }),
      ...apiOverrides,
    };

    TestBed.configureTestingModule({
      providers: [
        DrawerService,
        { provide: ApiService, useValue: api },
      ],
    });

    const service = TestBed.inject(DrawerService);
    return { service, api };
  }

  it('initializes with closed drawer and default state', () => {
    const { service } = setup();

    expect(service.openedItem()).toBeNull();
    expect(service.isOpen()).toBe(false);
    expect(service.initialTab()).toBe('Detalhes');
    expect(service.tab()).toBe('Detalhes');
    expect(service.detail()).toEqual({});
    expect(service.children()).toEqual([]);
    expect(service.loading()).toBe(false);
    expect(service.error()).toBe('');
    expect(service.mutationNotification()).toBeNull();
    expect(service.refreshNotification()).toBe(0);
  });

  it('opens a task, sets tab, and loads its details and children', async () => {
    const { service, api } = setup();
    const task: Item = { id: 'task-1', title: 'Test Task', kind: 'task' };

    await service.open(task, 'Checklist');

    expect(service.openedItem()).toEqual(task);
    expect(service.isOpen()).toBe(true);
    expect(service.initialTab()).toBe('Checklist');
    expect(service.tab()).toBe('Checklist');
    expect(api.request).toHaveBeenCalledWith('tasks/task-1/checklist');
    expect(api.requestWithClosed).toHaveBeenCalledWith('tasks/task-1/subtasks', []);
    expect(api.request).toHaveBeenCalledWith('tasks/task-1/comments');
    expect(api.request).toHaveBeenCalledWith('tasks/task-1/audit');
    expect(service.children()).toEqual([{ id: 'sub-1', title: 'Subtask 1', kind: 'task' }]);
    expect(service.detail()['checklist']).toHaveLength(1);
    expect(service.detail()['comments']).toHaveLength(1);
  });

  it('decorates parentChain when opening a child subtask', async () => {
    const { service } = setup();
    const parentTask: Item = { id: 'parent-1', title: 'Parent Task', kind: 'task' };
    await service.open(parentTask);

    const childTask: Item = { id: 'child-1', parentTaskId: 'parent-1', title: 'Child Task', kind: 'task' };
    await service.open(childTask);

    expect(service.openedItem()?.['parentChain']).toEqual([
      { type: 'task', id: 'parent-1', name: 'Parent Task' },
    ]);
  });

  it('loads container details including progress and graph', async () => {
    const { service, api } = setup();
    const processItem: Item = { id: 'proc-1', title: 'Onboarding', kind: 'process' };

    await service.open(processItem, 'Detalhes');

    expect(service.openedItem()).toEqual(processItem);
    expect(api.requestWithClosed).toHaveBeenCalledWith('task-containers/process/proc-1', []);
    expect(api.requestWithClosed).toHaveBeenCalledWith('processes/proc-1/phases', []);
    expect(api.request).toHaveBeenCalledWith('dependencies?containerType=process&containerId=proc-1');
    expect(api.request).toHaveBeenCalledWith('work-progress/process/proc-1');
    expect(service.children()).toHaveLength(2); // 1 task + 1 phase
    expect(service.detail()['progress']).toEqual({ percentage: 50 });
  });

  it('loads organization access and audit details', async () => {
    const { service, api } = setup();
    const orgItem: Item = { id: 'org-1', title: 'My Org', kind: 'organization' };

    await service.open(orgItem, 'Acessos');

    expect(service.openedItem()).toEqual(orgItem);
    expect(api.request).toHaveBeenCalledWith('organizations/org-1/members');
    expect(api.request).toHaveBeenCalledWith('organizations/org-1/audit');
    expect(service.detail()['access']?.owner).toEqual({ id: 'u1' });
  });

  it('closes drawer and resets signals', async () => {
    const { service } = setup();
    const task: Item = { id: 'task-1', title: 'Test Task', kind: 'task' };
    await service.open(task);

    service.close();

    expect(service.openedItem()).toBeNull();
    expect(service.isOpen()).toBe(false);
    expect(service.initialTab()).toBe('Detalhes');
    expect(service.detail()).toEqual({});
    expect(service.children()).toEqual([]);
  });

  it('updates tab via setTab', () => {
    const { service } = setup();
    service.setTab('Histórico');
    expect(service.initialTab()).toBe('Histórico');
    expect(service.tab()).toBe('Histórico');
  });

  it('manages mutation and refresh notifications', () => {
    const { service } = setup();
    const task: Item = { id: 'task-1', title: 'Task', kind: 'task' };

    service.notifyMutation(task, 'status');
    expect(service.mutationNotification()?.item).toEqual(task);
    expect(service.mutationNotification()?.action).toBe('status');
    expect(service.refreshNotification()).toBe(1);

    service.notifyRefresh();
    expect(service.refreshNotification()).toBe(2);
  });

  it('records error when detail request fails', async () => {
    const failingApi: Partial<ApiService> = {
      request: vi.fn(async () => {
        throw new Error('Network failure');
      }),
      requestWithClosed: vi.fn(async () => {
        throw new Error('Network failure');
      }),
    };
    const { service } = setup(failingApi);
    const task: Item = { id: 'task-1', title: 'Task', kind: 'task' };

    await expect(service.open(task)).rejects.toThrow('Network failure');
    expect(service.error()).toBe('Network failure');
    expect(service.loading()).toBe(false);
  });
});
