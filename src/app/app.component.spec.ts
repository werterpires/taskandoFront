import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject, of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, ApiService, Item } from './api.service';
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

  it('renders month label in Brazilian format in topbar', async () => {
    const api = {
      request: vi.fn(async (path: string) => {
        if (path === 'auth/me') return { user: { id: 'u-1', displayName: 'Werter', email: 'w@test.com' } };
        if (path === 'navigation') return { roots: [] };
        if (path === 'notifications?unreadOnly=1') return { count: 0 };
        throw new Error(`Unexpected request: ${path}`);
      }),
      requestWithClosed: vi.fn(async () => ({ tasks: [] })),
    };
    const router = {
      events: of(new NavigationEnd(1, '/minhas-tarefas', '/minhas-tarefas')),
      url: '/minhas-tarefas',
      parseUrl: vi.fn(() => ({ root: { children: { primary: { segments: [{ path: 'minhas-tarefas' }] } } } })),
      navigate: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: ApiService, useValue: api }, { provide: Router, useValue: router }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    fixture.componentInstance.month.set(new Date(2026, 9, 1));
    await fixture.componentInstance.ngOnInit();
    fixture.detectChanges();

    const topbarLabel = (fixture.nativeElement as HTMLElement).querySelector('.today-label');
    expect(topbarLabel?.textContent).toContain('Outubro de 2026');
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

describe('AppComponent inviteQuota in Settings', () => {
  function createSettingsContext(options?: {
    initialMeQuota?: Record<string, unknown> | null;
    refreshedMeQuota?: Record<string, unknown> | null;
    loginQuota?: Record<string, unknown> | null;
    authenticatedInitially?: boolean;
  }) {
    const events = new Subject<unknown>();
    let url = '/configuracoes';
    let meCalls = 0;
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
      request: vi.fn(async (path: string, method = 'GET', body?: unknown) => {
        if (path === 'auth/me') {
          meCalls += 1;
          if (meCalls === 1 && options?.authenticatedInitially === false) {
            throw new ApiError(401, { error: 'Não autenticado.' });
          }
          const quota = meCalls === 1 ? options?.initialMeQuota : (options?.refreshedMeQuota ?? options?.initialMeQuota);
          return {
            user: { id: 'user-1', displayName: 'Pessoa', email: 'pessoa@example.test' },
            inviteQuota: quota ?? null,
          };
        }
        if (path === 'auth/login' && method === 'POST') {
          return {
            user: { id: 'user-1', displayName: 'Pessoa', email: 'pessoa@example.test' },
            inviteQuota: options?.loginQuota ?? null,
          };
        }
        if (path === 'auth/users' && method === 'POST') {
          const payload = (body ?? {}) as Record<string, string>;
          return {
            user: { id: 'invited-1', displayName: payload['displayName'], email: payload['email'] },
          };
        }
        if (path === 'auth/logout' && method === 'POST') return { ok: true };
        if (path === 'organizations') return { organizations: [], invitations: [] };
        if (path === 'lists') return { lists: [] };
        if (path === 'tasks') return { tasks: [] };
        if (path === 'notifications?unreadOnly=1') return { unreadCount: 0, notifications: [] };
        if (path === 'reminders/due') return { reminders: [] };
        if (path === 'notification-preferences') return { preferences: {} };
        if (path === 'preferences/size-labels') return { labels: ['PP', 'P', 'M', 'G', 'GG'] };
        if (path === 'mcp-token') return { hasToken: false };
        if (path === 'owner-transfers') return { requests: [] };
        if (path === 'item-invitations') return { invitations: [] };
        throw new Error(`Unexpected request: ${method} ${path}`);
      }),
      requestWithClosed: vi.fn(async () => ({ tasks: [] })),
    };
    return { api, router };
  }

  it('stores inviteQuota from auth/me, shows remaining 1 de 1, and refreshes quota after createUser', async () => {
    const initialQuota = { limit: 1, used: 0, remaining: 1, invitedUser: null };
    const refreshedQuota = {
      limit: 1,
      used: 1,
      remaining: 0,
      invitedUser: {
        id: 'invited-1',
        displayName: 'Maria Convidada',
        email: 'maria@example.test',
        createdAt: '2026-11-22T15:00:00.000Z',
      },
    };
    const { api, router } = createSettingsContext({
      initialMeQuota: initialQuota,
      refreshedMeQuota: refreshedQuota,
    });
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: ApiService, useValue: api }, { provide: Router, useValue: router }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    await component.ngOnInit();
    fixture.detectChanges();

    expect(component.inviteQuota()).toEqual(initialQuota);
    const panel = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="create-user-panel"]');
    expect(panel?.textContent).toContain('Convites restantes: 1 de 1');
    expect(panel?.querySelector('form')).toBeTruthy();

    component.newUserDisplayName = 'Maria Convidada';
    component.newUserEmail = 'maria@example.test';
    component.newUserPassword = 'password123';
    await component.createUser();
    fixture.detectChanges();

    expect(api.request).toHaveBeenCalledWith('auth/users', 'POST', {
      displayName: 'Maria Convidada',
      email: 'maria@example.test',
      password: 'password123',
    });
    expect(component.inviteQuota()).toEqual(refreshedQuota);
    expect(panel?.querySelector('form')).toBeNull();
    expect(panel?.textContent).toContain('Maria Convidada');
    expect(panel?.textContent).toContain('maria@example.test');
    expect(panel?.textContent).toContain('0 de 1');
    fixture.destroy();
  });

  it('stores inviteQuota from auth/login, hides form when remaining === 0, and clears on logout', async () => {
    const exhaustedQuota = {
      limit: 1,
      used: 1,
      remaining: 0,
      invitedUser: {
        id: 'invited-2',
        displayName: 'João Já Convidado',
        email: 'joao@example.test',
        createdAt: '2026-11-20T10:30:00.000Z',
      },
    };
    const { api, router } = createSettingsContext({
      authenticatedInitially: false,
      loginQuota: exhaustedQuota,
    });
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: ApiService, useValue: api }, { provide: Router, useValue: router }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    await component.ngOnInit();
    expect(component.user()).toBeNull();

    component.loginEmail = 'pessoa@example.test';
    component.loginPassword = 'password123';
    await component.authenticate();
    fixture.detectChanges();

    expect(component.inviteQuota()).toEqual(exhaustedQuota);
    const panel = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="create-user-panel"]');
    expect(panel?.querySelector('form')).toBeNull();
    expect(panel?.textContent).toContain('João Já Convidado');
    expect(panel?.textContent).toContain('joao@example.test');

    await component.logout();
    expect(component.inviteQuota()).toBeNull();
    fixture.destroy();
  });
});

describe('AppComponent legal routes, blocking gate, and 428 recovery', () => {
  const PENDING_LEGAL_STATUS = {
    requiresAcceptance: true,
    activeVersions: { terms: '1.0', privacy: '1.0' },
    acceptedVersions: { terms: null, privacy: null },
    pendingDocuments: ['terms', 'privacy'],
  };
  const ACCEPTED_LEGAL_STATUS = {
    requiresAcceptance: false,
    activeVersions: { terms: '1.0', privacy: '1.0' },
    acceptedVersions: { terms: '1.0', privacy: '1.0' },
    pendingDocuments: [],
  };
  const LEGAL_DOCS = {
    activeVersions: { terms: '1.0', privacy: '1.0' },
    documents: [
      { type: 'terms', title: 'Termos de Uso — Taskando', version: '1.0', content: '# Termos de Uso\n\nConteúdo dos termos.' },
      { type: 'privacy', title: 'Política de Privacidade — Taskando', version: '1.0', content: '# Política de Privacidade\n\nConteúdo da privacidade.' },
    ],
  };

  async function flushMicrotasks() {
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  function createLegalRouter(initialUrl = '/minhas-tarefas') {
    const events = new Subject<unknown>();
    let url = initialUrl;
    return {
      events,
      get url() { return url; },
      parseUrl: vi.fn(() => ({ root: { children: { primary: { segments: url.split('/').filter(Boolean).map(path => ({ path })) } } } })),
      navigate: vi.fn(async (commands: string[]) => {
        url = commands[0].startsWith('/') ? commands.join('/') : `/${commands.join('/')}`;
        events.next(new NavigationEnd(1, url, url));
        return true;
      }),
    };
  }

  it('renders public legal links in login card, footer, and Settings profile card and exposes public router-outlet on #/termos', async () => {
    const router = createLegalRouter('/configuracoes');
    let authenticated = false;
    const api = {
      request: vi.fn(async (path: string) => {
        if (path === 'auth/me') {
          if (!authenticated) throw new ApiError(401, { error: 'Não autenticado.' });
          return {
            user: { id: 'u-1', displayName: 'Pessoa', email: 'pessoa@example.test' },
            legalStatus: ACCEPTED_LEGAL_STATUS,
          };
        }
        if (path === 'organizations') return { organizations: [], invitations: [] };
        if (path === 'lists') return { lists: [] };
        if (path === 'tasks') return { tasks: [] };
        if (path === 'notifications?unreadOnly=1') return { unreadCount: 0, notifications: [] };
        if (path === 'reminders/due') return { reminders: [] };
        if (path === 'notification-preferences') return { preferences: {} };
        if (path === 'preferences/size-labels') return { labels: ['PP', 'P', 'M', 'G', 'GG'] };
        if (path === 'mcp-token') return { hasToken: false };
        if (path === 'owner-transfers') return { requests: [] };
        if (path === 'item-invitations') return { invitations: [] };
        throw new Error(`Unexpected request: ${path}`);
      }),
      requestWithClosed: vi.fn(async () => ({ tasks: [] })),
    };

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: ApiService, useValue: api }, { provide: Router, useValue: router }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    await component.ngOnInit();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const loginLinks = el.querySelector('[data-testid="login-legal-links"]');
    expect(loginLinks?.querySelectorAll('a').length).toBe(2);
    expect(loginLinks?.textContent).toContain('Termos de Uso');
    expect(loginLinks?.textContent).toContain('Política de Privacidade');

    const firstLoginLink = loginLinks?.querySelector('a') as HTMLAnchorElement;
    firstLoginLink.click();
    fixture.detectChanges();
    expect(router.navigate).toHaveBeenCalledWith(['/termos']);
    expect(component.isPublicLegalRoute()).toBe(true);
    expect(el.querySelector('.public-legal-shell')).toBeTruthy();

    await router.navigate(['/configuracoes']);
    authenticated = true;
    await component.ngOnInit();
    fixture.detectChanges();

    const profileLinks = el.querySelector('[data-testid="settings-profile-card"] [data-testid="settings-legal-links"]');
    const footerLinks = el.querySelector('[data-testid="footer-legal-links"]');
    expect(profileLinks?.textContent).toContain('Termos de Uso');
    expect(profileLinks?.textContent).toContain('Política de Privacidade');
    expect(footerLinks?.textContent).toContain('Termos de Uso');
    expect(footerLinks?.textContent).toContain('Política de Privacidade');
    fixture.destroy();
  });

  it('shows blocking acceptance modal on session restore when requiresAcceptance is true and bootstraps after acceptance', async () => {
    const router = createLegalRouter('/minhas-tarefas');
    let accepted = false;
    const api = {
      request: vi.fn(async (path: string, method = 'GET') => {
        if (path === 'auth/me') {
          return {
            user: { id: 'u-1', displayName: 'Pessoa', email: 'pessoa@example.test' },
            legalStatus: PENDING_LEGAL_STATUS,
          };
        }
        if (path === 'legal/documents') return LEGAL_DOCS;
        if (path === 'legal/accept' && method === 'POST') {
          accepted = true;
          return { legalStatus: ACCEPTED_LEGAL_STATUS };
        }
        if (!accepted) {
          throw new Error(`Domain endpoint called before acceptance: ${path}`);
        }
        if (path === 'organizations') return { organizations: [], invitations: [] };
        if (path === 'lists') return { lists: [] };
        if (path === 'notifications?unreadOnly=1') return { unreadCount: 0, notifications: [] };
        if (path === 'reminders/due') return { reminders: [] };
        throw new Error(`Unexpected request: ${method} ${path}`);
      }),
      requestWithClosed: vi.fn(async (path: string) => {
        if (!accepted) throw new Error(`Domain endpoint called before acceptance: ${path}`);
        return { tasks: [{ id: 't-1', title: 'Tarefa após aceite', status: 'todo' }] };
      }),
    };

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: ApiService, useValue: api }, { provide: Router, useValue: router }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    await component.ngOnInit();
    fixture.detectChanges();
    await flushMicrotasks();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="legal-acceptance-modal"]')).toBeTruthy();
    expect(api.requestWithClosed).not.toHaveBeenCalled();

    const checkbox = el.querySelector('[data-testid="legal-acceptance-checkbox"]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const submit = el.querySelector('[data-testid="legal-acceptance-submit"]') as HTMLButtonElement;
    submit.click();
    await flushMicrotasks();
    await flushMicrotasks();
    fixture.detectChanges();

    expect(api.request).toHaveBeenCalledWith('legal/accept', 'POST', {
      documents: [
        { documentType: 'terms', version: '1.0' },
        { documentType: 'privacy', version: '1.0' },
      ],
      channel: 'web',
    });
    expect(el.querySelector('[data-testid="legal-acceptance-modal"]')).toBeNull();
    expect(api.requestWithClosed).toHaveBeenCalledWith('tasks', []);
    expect(component.tasks().some(t => t.id === 't-1')).toBe(true);
    fixture.destroy();
  });

  it('recovers from mid-session HTTP 428 LEGAL_ACCEPTANCE_REQUIRED after accepting terms', async () => {
    const router = createLegalRouter('/minhas-tarefas');
    let legalGateBlocked = false;
    let tasksRequests = 0;

    const api = {
      request: vi.fn(async (path: string, method = 'GET') => {
        if (path === 'auth/me') {
          return {
            user: { id: 'u-1', displayName: 'Pessoa', email: 'pessoa@example.test' },
            legalStatus: ACCEPTED_LEGAL_STATUS,
          };
        }
        if (path === 'organizations') return { organizations: [], invitations: [] };
        if (path === 'lists') return { lists: [] };
        if (path === 'notifications?unreadOnly=1') return { unreadCount: 0, notifications: [] };
        if (path === 'reminders/due') return { reminders: [] };
        if (path === 'legal/documents') return LEGAL_DOCS;
        if (path === 'legal/accept' && method === 'POST') {
          legalGateBlocked = false;
          return { legalStatus: ACCEPTED_LEGAL_STATUS };
        }
        throw new Error(`Unexpected request: ${method} ${path}`);
      }),
      requestWithClosed: vi.fn(async (path: string) => {
        if (path === 'tasks') {
          tasksRequests += 1;
          if (legalGateBlocked) {
            throw new ApiError(428, {
              error: 'É necessário aceitar os Termos de Uso e a Política de Privacidade vigentes para continuar.',
              code: 'LEGAL_ACCEPTANCE_REQUIRED',
              legalStatus: PENDING_LEGAL_STATUS,
            });
          }
          return { tasks: [{ id: 't-recovered', title: 'Recuperada após 428', status: 'todo' }] };
        }
        throw new Error(`Unexpected requestWithClosed: ${path}`);
      }),
    };

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [{ provide: ApiService, useValue: api }, { provide: Router, useValue: router }],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    await flushMicrotasks();
    await flushMicrotasks();
    fixture.detectChanges();
    expect(tasksRequests).toBe(1);

    legalGateBlocked = true;
    await component.load();
    fixture.detectChanges();
    await flushMicrotasks();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(component.legalGate.requiresAcceptance()).toBe(true);
    expect(component.error()).toBe('');
    expect(el.querySelector('[data-testid="legal-acceptance-modal"]')).toBeTruthy();

    const checkbox = el.querySelector('[data-testid="legal-acceptance-checkbox"]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const submit = el.querySelector('[data-testid="legal-acceptance-submit"]') as HTMLButtonElement;
    submit.click();
    await flushMicrotasks();
    await flushMicrotasks();
    fixture.detectChanges();

    expect(component.legalGate.requiresAcceptance()).toBe(false);
    expect(el.querySelector('[data-testid="legal-acceptance-modal"]')).toBeNull();
    expect(tasksRequests).toBe(3);
    expect(component.tasks().some(t => t.id === 't-recovered')).toBe(true);
    fixture.destroy();
  });
});


