import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiService, Item } from './api.service';
import { AppComponent } from './app.component';
import { DrawerService } from './shared/drawer.service';

describe('AppComponent routing', () => {
  it('boots My Tasks directly with one task listing request', async () => {
    const events = new Subject<unknown>();
    let url = '/minhas-tarefas';
    const router = {
      events,
      get url() { return url; },
      parseUrl: vi.fn(() => ({ root: { children: { primary: { segments: url.split('/').filter(Boolean).map(path => ({ path })) } } } })),
      navigate: vi.fn(async (commands: string[]) => {
        url = `/${commands.join('/')}`;
        events.next(new NavigationEnd(1, url, url));
        return true;
      }),
    };
    const api = {
      request: vi.fn(async (path: string) => {
        if (path === 'auth/me') return { user: { id: 'user-1', displayName: 'Pessoa', email: 'pessoa@example.test' } };
        if (path === 'organizations') return { organizations: [], invitations: [] };
        if (path === 'lists') return { lists: [] };
        if (path === 'notifications?unreadOnly=1') return { unreadCount: 0, notifications: [] };
        if (path === 'reminders/due') return { reminders: [] };
        throw new Error(`Unexpected request: ${path}`);
      }),
      requestWithClosed: vi.fn(async (path: string) => {
        if (path === 'tasks') return { tasks: [{ id: 'task-1', title: 'Uma tarefa', status: 'todo' }] };
        throw new Error(`Unexpected request: ${path}`);
      }),
    };
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: ApiService, useValue: api }, { provide: Router, useValue: router }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.componentInstance.ngOnInit();

    expect(api.requestWithClosed).toHaveBeenCalledTimes(1);
    expect(api.requestWithClosed).toHaveBeenCalledWith('tasks', []);
    expect(fixture.componentInstance.section()).toBe('Minhas tarefas');
    fixture.destroy();
  });
});

describe('AppComponent drawer delegation', () => {
  function createTestContext() {
    const events = new Subject<unknown>();
    let url = '/minhas-tarefas';
    const router = {
      events,
      get url() { return url; },
      parseUrl: vi.fn(() => ({ root: { children: { primary: { segments: url.split('/').filter(Boolean).map(path => ({ path })) } } } })),
      navigate: vi.fn(async (commands: string[]) => {
        url = `/${commands.join('/')}`;
        events.next(new NavigationEnd(1, url, url));
        return true;
      }),
    };
    const api = {
      request: vi.fn(async (path: string) => {
        if (path === 'auth/me') return { user: { id: 'user-1', displayName: 'Pessoa', email: 'pessoa@example.test' } };
        if (path === 'organizations') return { organizations: [], invitations: [] };
        if (path === 'lists') return { lists: [] };
        if (path === 'notifications?unreadOnly=1') return { unreadCount: 0, notifications: [] };
        if (path === 'reminders/due') return { reminders: [] };
        if (path === 'tasks/t-1/checklist') return { checklist: [{ id: 'chk-1', title: 'C1' }] };
        if (path === 'tasks/t-1/comments') return { comments: [] };
        if (path === 'tasks/t-1/audit') return { events: [] };
        if (path.startsWith('item-roles?')) return { roles: [] };
        if (path.startsWith('owner-transfers?')) return { transfers: [] };
        throw new Error(`Unexpected request: ${path}`);
      }),
      requestWithClosed: vi.fn(async (path: string) => {
        if (path === 'tasks') return { tasks: [{ id: 't-1', title: 'Task 1', status: 'todo' }] };
        if (path === 'tasks/t-1/subtasks') return { subtasks: [] };
        throw new Error(`Unexpected requestWithClosed: ${path}`);
      }),
    };
    return { api, router };
  }

  it('intercepts task in open() and navigates to full page route', async () => {
    const { api, router } = createTestContext();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: ApiService, useValue: api }, { provide: Router, useValue: router }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    const drawer = TestBed.inject(DrawerService);
    await component.ngOnInit();

    const task: Item = { id: 't-1', title: 'Task 1', kind: 'task' };
    await component.open(task);

    expect(router.navigate).toHaveBeenCalledWith(['/tarefas', 't-1'], { state: { fromTaskando: true } });
    expect(drawer.openedItem()).toBeNull();
    expect(component.selected()).toBeNull();
    fixture.destroy();
  });

  it('allows external callers to open items via DrawerService.open() and reflects in AppComponent', async () => {
    const { api, router } = createTestContext();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: ApiService, useValue: api }, { provide: Router, useValue: router }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    const drawer = TestBed.inject(DrawerService);
    await component.ngOnInit();

    const task: Item = { id: 't-1', title: 'Task 1', kind: 'task' };
    await drawer.open(task, 'Checklist');

    expect(component.selected()).toEqual(task);
    expect(component.tab()).toBe('Checklist');
    expect(component.detail()['checklist']).toHaveLength(1);

    drawer.close();
    expect(component.selected()).toBeNull();
    fixture.destroy();
  });

  it('intercepts process in open() and navigates instead of opening drawer', async () => {
    const { api, router } = createTestContext();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: ApiService, useValue: api }, { provide: Router, useValue: router }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    const drawer = TestBed.inject(DrawerService);
    await component.ngOnInit();

    const processItem: Item = { id: 'proc-1', title: 'Process 1', kind: 'process' };
    await component.open(processItem);

    expect(router.navigate).toHaveBeenCalledWith(['/processos', 'proc-1'], { state: { fromTaskando: true } });
    expect(drawer.openedItem()).toBeNull();
    expect(component.selected()).toBeNull();
    fixture.destroy();
  });

  it('renders breadcrumbs in drawer with root pessoal and navigates on crumb click', async () => {
    const { api, router } = createTestContext();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: ApiService, useValue: api }, { provide: Router, useValue: router }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    const drawer = TestBed.inject(DrawerService);
    await component.ngOnInit();

    const item: Item = {
      id: 't-1',
      title: 'Minha Subtarefa',
      kind: 'task',
      parentChain: [
        { type: 'organization', id: 'org-1', name: 'edubazu' },
        { type: 'process', id: 'proc-1', name: 'Entrega' },
      ],
    };
    await drawer.open(item);
    fixture.detectChanges();

    const crumbs = component.drawerBreadcrumbs();
    expect(crumbs.map(c => c.label)).toEqual(['pessoal', 'edubazu', 'Entrega', 'Minha Subtarefa']);

    const compiled = fixture.nativeElement as HTMLElement;
    const pathEl = compiled.querySelector('.drawer .entity-path');
    expect(pathEl).toBeTruthy();
    expect(pathEl?.textContent).toContain('pessoal');
    expect(pathEl?.textContent).toContain('edubazu');
    expect(pathEl?.textContent).toContain('Minha Subtarefa');

    // Clicking crumb navigates and closes drawer
    component.navigateCrumb(crumbs[1]);
    expect(component.selected()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/estrutura', 'organizacao', 'org-1']);
    fixture.destroy();
  });

  it('renders scope breadcrumbs when scope is present', async () => {
    const { api, router } = createTestContext();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: ApiService, useValue: api }, { provide: Router, useValue: router }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    await component.ngOnInit();

    component.scope.set({
      id: 'dept-1',
      name: 'Engenharia',
      kind: 'department',
      parentChain: [{ type: 'organization', id: 'org-1', name: 'edubazu' }],
    });
    fixture.detectChanges();

    const crumbs = component.scopeBreadcrumbs();
    expect(crumbs.map(c => c.label)).toEqual(['pessoal', 'edubazu', 'Engenharia']);

    const compiled = fixture.nativeElement as HTMLElement;
    const pathEl = compiled.querySelector('.page-heading .entity-path');
    expect(pathEl).toBeTruthy();
    expect(pathEl?.textContent).toContain('pessoal');
    expect(pathEl?.textContent).toContain('edubazu');
    expect(pathEl?.textContent).toContain('Engenharia');
    fixture.destroy();
  });
});

