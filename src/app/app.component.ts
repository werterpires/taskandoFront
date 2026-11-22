import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ApiError, ApiService, ClosedWorkState, Item, closedWorkStates } from './api.service';
import { fixedRoute, routeScope, scopedRoute, sectionForRoute, type RouteScope } from './navigation';
import { DependencyGraph } from './shared/dependency-graph/dependency-graph.component';
import { DrawerService } from './shared/drawer.service';
import { BreadcrumbCrumb, entityBreadcrumbs } from './shared/breadcrumb';
import { DateBrPipe } from './shared/date-br.pipe';
import { LegalGateService } from './legal/legal-gate.service';
import { TermsAcceptanceModalComponent } from './legal/terms-acceptance-modal.component';
import { ToastContainerComponent } from './shared/toast/toast-container.component';
import { ToastService } from './shared/toast/toast.service';
import { ItemEditorModalComponent } from './shared/item-editor-modal/item-editor-modal.component';
import { ItemEditorService } from './shared/item-editor-modal/item-editor.service';
import { CommandPaletteComponent } from './shared/command-palette/command-palette.component';
import { CommandPaletteService } from './shared/command-palette/command-palette.service';
import { WorkFilterService } from './shared/work-filter.service';
import { computeCalendarDays } from './shared/work-labels';
import { LoginComponent, LoginCredentials } from './features/login/login.component';
import { SidebarComponent } from './features/sidebar/sidebar.component';
import { DashboardViewComponent } from './features/dashboard/dashboard-view.component';
import { ReportsViewComponent } from './features/reports/reports-view.component';
import { SettingsViewComponent } from './features/settings/settings-view.component';
import { WorkListViewComponent } from './features/work-list/work-list-view.component';
import { ItemDrawerComponent } from './features/item-drawer/item-drawer.component';
import type { InviteQuota, InviteQuotaUser } from './features/settings/settings.types';

export type { InviteQuota, InviteQuotaUser };

const paths: Record<string, string> = {
  task: 'tasks',
  project: 'projects',
  front: 'fronts',
  product: 'products',
  process: 'processes',
  phase: 'phases',
  organization: 'organizations',
  list: 'lists',
  reminder: 'reminders',
  series: 'recurrence-series',
};

@Component({
  selector: 'app-root',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterOutlet,
    DateBrPipe,
    TermsAcceptanceModalComponent,
    ToastContainerComponent,
    ItemEditorModalComponent,
    CommandPaletteComponent,
    LoginComponent,
    SidebarComponent,
    DashboardViewComponent,
    ReportsViewComponent,
    SettingsViewComponent,
    WorkListViewComponent,
    ItemDrawerComponent,
  ],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit, OnDestroy {
  api = inject(ApiService);
  router = inject(Router);
  drawer = inject(DrawerService);
  legalGate = inject(LegalGateService);
  toast = inject(ToastService);
  itemEditor = inject(ItemEditorService);
  commandPalette = inject(CommandPaletteService);
  workFilter = inject(WorkFilterService);
  private readonly settingsView = viewChild(SettingsViewComponent);
  private bootstrapped = false;

  user = signal<Item | null>(null);
  inviteQuota = signal<InviteQuota | null>(null);
  authenticating = signal(true);
  loading = signal(false);
  saving = signal(false);
  error = signal('');
  section = signal('Início');
  mobile = signal(false);
  currentUrl = signal(this.router.url);

  loginEmail = '';
  loginPassword = '';
  newUserDisplayName = '';
  newUserEmail = '';
  newUserPassword = '';

  rows = signal<Item[]>([]);
  tasks = signal<Item[]>([]);
  organizations = signal<Item[]>([]);
  lists = signal<Item[]>([]);
  notifications = signal<Item[]>([]);
  unreadNotificationCount = signal(0);
  showReadNotifications = signal(false);
  notificationsLoading = signal(false);
  notificationsError = signal('');
  invitations = signal<Item[]>([]);
  transfers = signal<Item[]>([]);
  dueReminders = signal<Item[]>([]);
  scope = signal<Item | null>(null);
  selected = this.drawer.openedItem;
  children = this.drawer.children;
  detail = this.drawer.detail;
  tab = this.drawer.initialTab;
  scopeBreadcrumbs = computed(() => entityBreadcrumbs(this.scope()));
  drawerBreadcrumbs = computed(() => entityBreadcrumbs(this.selected()));

  showNotifications = signal(false);
  search = signal('');
  includeClosed = this.workFilter.includeClosed;
  reportStatus = signal('');
  month = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  settings = signal<Record<string, any>>({});
  sizeLabels = signal('Muito pequeno, Pequeno, Médio, Grande, Muito grande');
  templateSetup = signal<Item | null>(null);
  templateTarget = signal('0');
  templateTitle = signal('');
  templateDate = signal('');
  decision = signal<{
    title: string;
    options: { value: string; label: string }[];
    resolve: (v: string | null) => void;
  } | null>(null);

  private timer?: ReturnType<typeof setInterval>;
  private requestVersion = 0;
  private notificationRequestVersion = 0;
  private routeSubscription?: Subscription;
  private activeRouteScope: RouteScope | null = null;

  visibleNotifications = computed(() =>
    this.showReadNotifications()
      ? this.notifications()
      : this.notifications().filter(row => !row['readAt']),
  );
  openCount = computed(
    () => this.tasks().filter(t => !['completed', 'cancelled', 'archived'].includes(t['status'])).length,
  );
  completedCount = computed(() => this.tasks().filter(t => t['status'] === 'completed').length);
  calendarDays = computed(() => computeCalendarDays(this.month()));

  constructor() {
    effect(() => {
      const saved = this.itemEditor.lastSaved();
      if (saved) {
        untracked(() => {
          void this.handleEditorSaved();
        });
      }
    });
    effect(() => {
      const tick = this.workFilter.syncTick();
      if (tick > 0) {
        untracked(() => {
          if (this.user() && !this.isStandaloneRoute() && this.supportsClosedFilters()) {
            void this.load();
          }
          if (this.user() && this.selected()) {
            void this.loadDetail();
          }
        });
      }
    });
  }

  navigateCrumb(crumb: BreadcrumbCrumb) {
    if (crumb.route) {
      this.selected.set(null);
      void this.router.navigate(crumb.route);
    }
  }

  private async handleEditorSaved(): Promise<void> {
    if (!this.user()) return;
    try {
      await this.reloadNavigation();
      if (!this.isStandaloneRoute()) {
        await this.load();
      }
      if (this.selected()) {
        await this.loadDetail();
      }
    } catch (e) {
      this.fail(e);
    }
  }

  async ngOnInit() {
    this.currentUrl.set(this.router.url);
    this.routeSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.currentUrl.set(this.router.url);
        if (this.user()) void this.applyRoute();
      });
    try {
      const data = await this.api.request('auth/me');
      this.user.set(data.user);
      this.inviteQuota.set(data.inviteQuota ?? null);
      this.legalGate.syncStatus(data.legalStatus);
      if (!this.legalGate.requiresAcceptance()) {
        await this.bootstrap();
      }
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 401)) this.fail(e);
    } finally {
      this.authenticating.set(false);
    }
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.requestVersion += 1;
    this.routeSubscription?.unsubscribe();
  }

  async bootstrap() {
    const initialSection = this.currentRoute()?.section;
    await this.reloadNavigation(initialSection !== 'Minhas tarefas');
    if (!this.isStandaloneRoute()) await this.applyRoute();
    await this.poll();
    this.bootstrapped = true;
    if (this.user() && !this.timer) this.timer = setInterval(() => void this.poll(), 30_000);
  }

  async reloadNavigation(includeTasks = true) {
    const [orgs, lists, taskData] = await Promise.all([
      this.api.request('organizations'),
      this.api.request('lists'),
      includeTasks ? this.api.request('tasks') : Promise.resolve(null),
    ]);
    this.organizations.set(orgs.organizations ?? []);
    this.invitations.set(orgs.invitations ?? []);
    this.lists.set(lists.lists ?? []);
    if (taskData) this.tasks.set(this.mark(taskData.tasks, 'task'));
  }

  async poll() {
    if (!this.user()) return;
    const version = ++this.notificationRequestVersion;
    const showRead = this.showReadNotifications();
    this.notificationsLoading.set(true);
    const [unread, reminders, all] = await Promise.allSettled([
      this.api.request('notifications?unreadOnly=1'),
      this.api.request('reminders/due'),
      showRead ? this.api.request('notifications') : Promise.resolve(null),
    ]);
    if (version !== this.notificationRequestVersion) return;
    if (
      [unread, reminders, all].some(
        result => result.status === 'rejected' && result.reason instanceof ApiError && result.reason.status === 401,
      )
    ) {
      this.user.set(null);
      this.inviteQuota.set(null);
      this.bootstrapped = false;
      this.legalGate.clear();
      this.ngOnDestroy();
      return;
    }
    const rejected428 = [unread, reminders, all].find(
      (result): result is PromiseRejectedResult =>
        result.status === 'rejected' &&
        result.reason instanceof ApiError &&
        result.reason.status === 428 &&
        result.reason.details['code'] === 'LEGAL_ACCEPTANCE_REQUIRED',
    );
    if (rejected428) {
      this.legalGate.intercept428(rejected428.reason.details);
      this.notificationsLoading.set(false);
      return;
    }
    if (!this.user() || version !== this.notificationRequestVersion) return;
    this.notificationsLoading.set(false);
    if (unread.status === 'fulfilled') this.unreadNotificationCount.set(unread.value.unreadCount ?? 0);
    const listing = showRead ? all : unread;
    if (listing.status === 'fulfilled' && listing.value) {
      this.notifications.set(listing.value.notifications ?? []);
    }
    this.notificationsError.set(
      unread.status === 'rejected' || listing.status === 'rejected'
        ? 'Não foi possível carregar as notificações.'
        : '',
    );
    if (reminders.status === 'fulfilled' && reminders.value.reminders?.length) {
      this.dueReminders.update(old => [...old, ...reminders.value.reminders]);
    }
  }

  async toggleReadNotifications() {
    this.showReadNotifications.set(!this.showReadNotifications());
    await this.poll();
  }

  async navigate(section: string, scope: Item | null = null) {
    this.mobile.set(false);
    const route =
      scope && ['list', 'organization', 'department', 'team'].includes(scope.kind ?? '')
        ? scopedRoute({ kind: scope.kind as RouteScope['kind'], id: scope.id })
        : [fixedRoute(section)];
    await this.router.navigate(route);
  }

  private routeSegments(): string[] {
    const url = this.currentUrl();
    return this.router.parseUrl(url).root.children['primary']?.segments.map(segment => segment.path) ?? [];
  }

  isPublicLegalRoute(): boolean {
    const segments = this.routeSegments();
    return segments.length === 1 && (segments[0] === 'termos' || segments[0] === 'privacidade');
  }

  openLegalRoute(event: Event, path: '/termos' | '/privacidade') {
    event.preventDefault();
    this.mobile.set(false);
    void this.router.navigate([path]);
  }

  async onLegalAccepted() {
    this.error.set('');
    this.notificationsError.set('');
    this.legalGate.notifyRecovered();
    if (!this.user()) return;
    try {
      if (!this.bootstrapped) {
        await this.bootstrap();
        return;
      }
      const currentSection = this.currentRoute()?.section;
      await this.reloadNavigation(currentSection !== 'Minhas tarefas');
      if (!this.isStandaloneRoute()) await this.applyRoute();
      await this.poll();
    } catch (e) {
      this.fail(e);
    }
  }

  private currentRoute(): { section: string | null; scope: RouteScope | null } | null {
    const segments = this.routeSegments();
    const standaloneSegments = ['processos', 'fases', 'phases', 'tarefas', 'tasks'];
    if (standaloneSegments.includes(segments[0]) && segments.length === 2) return null;
    if (this.isPublicLegalRoute()) return null;
    return { section: sectionForRoute(segments), scope: routeScope(segments) };
  }

  private async applyRoute() {
    const route = this.currentRoute();
    if (!route?.section) return;
    this.requestVersion += 1;
    this.activeRouteScope = route.scope;
    this.section.set(route.section);
    this.scope.set(null);
    this.rows.set([]);
    this.selected.set(null);
    this.search.set('');
    this.mobile.set(false);
    this.error.set('');
    await this.load();
  }

  async load() {
    const version = ++this.requestVersion;
    this.loading.set(true);
    this.error.set('');
    try {
      let rows: Item[] = [];
      const section = this.section();
      const scope = this.activeRouteScope ?? this.scope();
      if (scope?.kind === 'list') {
        const data = await this.api.requestWithClosed(`lists/${scope.id}/tasks`, this.includeClosed());
        if (version === this.requestVersion) this.scope.set({ ...data.list, kind: 'list' });
        rows = this.mark(data.tasks, 'task');
      } else if (scope) {
        const data = await this.api.requestWithClosed(
          `context?parentType=${scope.kind}&parentId=${scope.id}`,
          this.includeClosed(),
        );
        if (version === this.requestVersion) this.scope.set(data.scope ?? null);
        rows = this.contextRows(data);
      } else if (section === 'Painel') {
        const [matrix, taskData] = await Promise.all([
          this.api.requestWithClosed('priority-matrix', closedWorkStates),
          this.api.request('tasks'),
        ]);
        this.tasks.set(this.mark(taskData.tasks, 'task'));
        rows = matrix.items ?? [];
      } else if (section === 'Início') {
        rows = this.contextRows(
          await this.api.requestWithClosed('context?parentType=root', this.includeClosed()),
        );
      } else if (['Minhas tarefas', 'Relatórios'].includes(section)) {
        const included = section === 'Relatórios' ? this.reportClosedStates() : this.includeClosed();
        const data = await this.api.requestWithClosed('tasks', included);
        this.tasks.set(this.mark(data.tasks, 'task'));
        rows = this.tasks();
      } else if (section === 'Calendário') {
        const from = this.calendarDays()[0].key;
        const to = this.calendarDays()[41].key;
        await this.api.request('recurrence-series/materialize-window', 'POST', { from, to });
        rows = this.mark((await this.api.requestWithClosed('tasks', this.includeClosed())).tasks, 'task');
      } else if (section === 'Quadrante') {
        rows = (await this.api.requestWithClosed('priority-matrix', this.includeClosed())).items ?? [];
      } else if (section === 'Cíclicas') {
        rows = this.mark((await this.api.request('cyclic-queue')).tasks, 'task');
      } else if (section === 'Estrutura') {
        rows = this.contextRows(
          await this.api.requestWithClosed('context?parentType=personal', this.includeClosed()),
        );
      } else if (section === 'Lixeira') {
        rows = this.mark((await this.api.request('recycle-bin/tasks')).tasks, 'task');
      } else if (section === 'Configurações') {
        const [prefs, sizes, token, transfers, invitations] = await Promise.all([
          this.api.request('notification-preferences'),
          this.api.request('preferences/size-labels'),
          this.api.request('mcp-token'),
          this.api.request('owner-transfers'),
          this.api.request('item-invitations'),
        ]);
        this.settings.set({ ...prefs.preferences, ...token });
        const nextLabels = (sizes.labels ?? []).join(', ');
        this.sizeLabels.set(nextLabels);
        this.itemEditor.setSizeLabels(nextLabels);
        this.transfers.set(transfers.requests ?? []);
        this.invitations.set(invitations.invitations ?? []);
      } else {
        const resource: Record<string, [string, string, string, boolean]> = {
          Projetos: ['projects', 'projects', 'project', true],
          Produtos: ['products', 'products', 'product', true],
          Processos: ['processes', 'processes', 'process', true],
          Listas: ['lists', 'lists', 'list', false],
          Lembretes: ['reminders', 'reminders', 'reminder', false],
          Séries: ['recurrence-series', 'series', 'series', false],
          Templates: ['templates', 'templates', 'template', false],
        };
        const entry = resource[section];
        if (entry) {
          const data = entry[3]
            ? await this.api.requestWithClosed(entry[0], this.includeClosed())
            : await this.api.request(entry[0]);
          rows = this.mark(data[entry[1]], entry[2]);
        }
      }
      if (version === this.requestVersion) this.rows.set(rows);
    } catch (e) {
      if (version === this.requestVersion) this.fail(e);
    } finally {
      if (version === this.requestVersion) this.loading.set(false);
    }
  }

  supportsClosedFilters() {
    return (
      Boolean(this.scope()) ||
      [
        'Início',
        'Minhas tarefas',
        'Calendário',
        'Quadrante',
        'Projetos',
        'Produtos',
        'Processos',
        'Estrutura',
      ].includes(this.section())
    );
  }

  async toggleClosed(state: ClosedWorkState, checked: boolean) {
    this.workFilter.setClosedState(state, checked);
    await this.load();
  }

  reportClosedStates(): ClosedWorkState[] {
    return closedWorkStates.includes(this.reportStatus() as ClosedWorkState)
      ? [this.reportStatus() as ClosedWorkState]
      : [];
  }

  async changeReportStatus(status: string) {
    this.reportStatus.set(status);
    await this.load();
  }

  isProcessRoute() {
    return this.router.url.startsWith('/processos/');
  }

  isStandaloneRoute(): boolean {
    this.currentUrl();
    const url = this.router.url;
    return (
      url.startsWith('/processos/') ||
      url.startsWith('/fases/') ||
      url.startsWith('/phases/') ||
      url.startsWith('/tarefas/') ||
      url.startsWith('/tasks/') ||
      this.isPublicLegalRoute()
    );
  }

  standaloneRouteTitle(): string {
    this.currentUrl();
    const url = this.router.url;
    if (url.startsWith('/processos/')) return 'Processo';
    if (url.startsWith('/fases/') || url.startsWith('/phases/')) return 'Fase';
    if (url.startsWith('/tarefas/') || url.startsWith('/tasks/')) return 'Tarefa';
    if (this.routeSegments()[0] === 'termos') return 'Termos de Uso';
    if (this.routeSegments()[0] === 'privacidade') return 'Política de Privacidade';
    return '';
  }

  mark(rows: Item[] | undefined, kind: string): Item[] {
    return (rows ?? []).map(row => ({ ...row, kind }));
  }

  contextRows(data: Record<string, any>) {
    return ['organizations', 'departments', 'teams', 'projects', 'products', 'processes', 'tasks'].flatMap(
      key =>
        this.mark(
          data[key],
          (
            {
              organizations: 'organization',
              departments: 'department',
              teams: 'team',
              projects: 'project',
              products: 'product',
              processes: 'process',
              tasks: 'task',
            } as Record<string, string>
          )[key],
        ),
    );
  }

  fail(e: unknown) {
    if (e instanceof ApiError && e.status === 428 && e.details['code'] === 'LEGAL_ACCEPTANCE_REQUIRED') {
      this.legalGate.intercept428(e.details);
      this.error.set('');
      return;
    }
    const message = e instanceof Error ? e.message : 'Não foi possível concluir a operação.';
    this.error.set(message);
    if (this.user() && !this.itemEditor.isOpen() && !this.selected()) {
      this.toast.error(message);
    }
  }

  async run(action: () => Promise<void>) {
    if (this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    try {
      await action();
    } catch (e) {
      this.fail(e);
    } finally {
      this.saving.set(false);
    }
  }

  async runNotification(action: () => Promise<void>) {
    this.notificationsError.set('');
    await this.run(action);
    if (this.error()) this.notificationsError.set(this.error());
  }

  async authenticate(credentials?: LoginCredentials) {
    await this.run(async () => {
      const email = credentials?.email ?? this.loginEmail;
      const password = credentials?.password ?? this.loginPassword;
      const data = await this.api.request('auth/login', 'POST', { email, password });
      this.loginPassword = '';
      this.showReadNotifications.set(false);
      this.unreadNotificationCount.set(0);
      this.notifications.set([]);
      this.notificationsError.set('');
      this.user.set(data.user);
      this.inviteQuota.set(data.inviteQuota ?? null);
      this.legalGate.syncStatus(data.legalStatus);
      if (!this.legalGate.requiresAcceptance()) {
        await this.bootstrap();
      }
    });
  }

  async createUser() {
    const view = this.settingsView();
    if (!view) return;
    view.newUserDisplayName.set(this.newUserDisplayName);
    view.newUserEmail.set(this.newUserEmail);
    view.newUserPassword.set(this.newUserPassword);
    await view.createUser();
    this.newUserDisplayName = view.newUserDisplayName();
    this.newUserEmail = view.newUserEmail();
    this.newUserPassword = view.newUserPassword();
  }

  async logout() {
    await this.run(async () => {
      await this.api.request('auth/logout', 'POST', {});
      this.user.set(null);
      this.inviteQuota.set(null);
      this.bootstrapped = false;
      this.legalGate.clear();
      this.commandPalette.close();
      this.workFilter.reset();
      this.showReadNotifications.set(false);
      this.ngOnDestroy();
    });
  }

  title(row: Item) {
    return row.title ?? row.name ?? '';
  }

  async changeMonth(offset: number) {
    const d = new Date(this.month());
    d.setMonth(d.getMonth() + offset);
    this.month.set(d);
    await this.load();
  }

  newItem(kind = 'task', parent?: Item) {
    this.error.set('');
    this.itemEditor.setSizeLabels(this.sizeLabels());
    const effectiveParent = parent ?? (this.scope()?.kind === 'list' ? null : this.scope());
    const orgId = this.scope()?.kind === 'organization' ? this.scope()!.id : null;
    this.itemEditor.openCreate(kind, effectiveParent, orgId);
  }

  edit(row: Item) {
    this.error.set('');
    this.itemEditor.setSizeLabels(this.sizeLabels());
    const orgId = this.scope()?.kind === 'organization' ? this.scope()!.id : null;
    this.itemEditor.openEdit(row, orgId);
  }

  async open(row: Item) {
    if (['organization', 'department', 'team'].includes(row.kind!)) {
      await this.navigate('Estrutura', row);
      return;
    }
    if (row.kind === 'list') {
      await this.navigate('Listas', row);
      return;
    }
    if (row.kind === 'template') {
      await this.prepareTemplate(row);
      return;
    }
    if (row.kind === 'process') {
      await this.router.navigate(['/processos', row.id], { state: { fromTaskando: true } });
      return;
    }
    if (row.kind === 'phase') {
      await this.router.navigate(['/fases', row.id], { state: { fromTaskando: true } });
      return;
    }
    if (row.kind === 'task') {
      await this.router.navigate(['/tarefas', row.id], { state: { fromTaskando: true } });
      return;
    }
    try {
      await this.drawer.open(row, 'Detalhes', this.includeClosed());
    } catch (e) {
      this.fail(e);
    }
  }

  async openOrganization() {
    const organization = this.scope();
    if (!organization || organization.kind !== 'organization') return;
    await this.run(async () => {
      const [members, audit] = await Promise.all([
        this.api.request(`organizations/${organization.id}/members`),
        this.api.request(`organizations/${organization.id}/audit`),
      ]);
      this.selected.set(organization);
      this.tab.set('Acessos');
      this.detail.set({
        access: {
          owner: members.owner,
          assignments: members.members ?? [],
          canManage: members.capabilities?.canAddMembers ?? false,
        },
        events: audit.events ?? [],
      });
    });
  }

  async loadDetail() {
    try {
      await this.drawer.loadDetail(this.selected(), this.includeClosed());
    } catch (e) {
      this.fail(e);
    }
  }

  async patch(row: Item, payload: Record<string, any>) {
    try {
      const data = await this.api.request(`${paths[row.kind!]}/${row.id}`, 'PATCH', payload);
      if (this.selected()?.id === row.id) this.selected.set({ ...row, ...data[row.kind!] });
      await this.reloadNavigation();
      await this.load();
      if (this.selected()) await this.loadDetail();
      this.drawer.notifyMutation(row, 'patch');
    } catch (e) {
      if (
        e instanceof ApiError &&
        (e.details['requiresSubtaskResolution'] ||
          e.details['requiresCancelDecision'] ||
          e.details['requiresDecision'] ||
          e.status === 409)
      ) {
        let extra: Record<string, string> | null = null;
        if (e.message.toLowerCase().includes('subtarefa')) {
          const choice = await this.ask(e.message, [
            { value: 'complete', label: 'Concluir subtarefas' },
            { value: 'cancel', label: 'Cancelar subtarefas' },
          ]);
          if (choice) extra = { subtaskResolution: choice };
        } else if (payload['status'] === 'cancelled') {
          const choice = await this.ask(e.message, [
            { value: 'release', label: 'Liberar sucessoras' },
            { value: 'cascade', label: 'Cancelar em cascata' },
          ]);
          if (choice) extra = { cancelDecision: choice };
        } else throw e;
        if (extra) await this.patch(row, { ...payload, ...extra });
      } else throw e;
    }
  }

  async status(row: Item, value: string) {
    await this.run(() => this.patch(row, { status: value }));
  }

  async pin(row: Item) {
    await this.run(() => this.patch(row, { pinnedForToday: !row['pinnedForToday'] }));
  }

  ask(title: string, options: { value: string; label: string }[]) {
    return new Promise<string | null>(resolve => this.decision.set({ title, options, resolve }));
  }

  answer(value: string | null) {
    const d = this.decision();
    this.decision.set(null);
    d?.resolve(value);
  }

  async remove(row: Item) {
    const answer = await this.ask(
      row.kind === 'task' ? 'Mover esta tarefa para a lixeira?' : 'Remover este item?',
      [{ value: 'yes', label: 'Confirmar remoção' }],
    );
    if (!answer) return;
    await this.run(async () => {
      await this.api.request(
        row.kind === 'reminder' ? 'reminders' : `${paths[row.kind!]}/${row.id}`,
        'DELETE',
        row.kind === 'reminder' ? { id: row.id } : {},
      );
      this.selected.set(null);
      this.toast.info(row.kind === 'task' ? 'Tarefa movida para a lixeira.' : 'Item removido.');
      await this.reloadNavigation();
      await this.load();
      this.drawer.notifyMutation(row, 'delete');
    });
  }

  async restore(row: Item) {
    await this.run(async () => {
      await this.api.request('recycle-bin/tasks', 'POST', { id: row.id });
      this.toast.success('Tarefa restaurada.');
      await this.reloadNavigation();
      await this.load();
    });
  }

  async approve(decision: string) {
    const row = this.selected()!;
    let reason: string | undefined;
    if (decision === 'reject') {
      const input = prompt('Informe o motivo da devolução:');
      if (!input || !input.trim()) return;
      reason = input.trim();
    }
    await this.run(async () => {
      await this.api.request('approvals', 'POST', {
        subjectType: row.kind,
        subjectId: row.id,
        decision,
        ...(reason ? { reason } : {}),
      });
      this.selected.set(null);
      this.toast.success(decision === 'approve' ? 'Item aprovado.' : 'Item devolvido para execução.');
      await this.load();
      this.drawer.notifyMutation(row, 'approve');
    });
  }

  async addChecklist(title: string, reset?: () => void) {
    await this.run(async () => {
      await this.api.request(`tasks/${this.selected()!.id}/checklist`, 'POST', { title });
      reset?.();
      await this.loadDetail();
      this.drawer.notifyMutation(this.selected()!, 'checklist');
    });
  }

  async toggleCheck(item: Item) {
    await this.run(async () => {
      await this.api.request(`tasks/${this.selected()!.id}/checklist/${item.id}`, 'PATCH', {
        completed: !item['completed'],
      });
      await this.loadDetail();
      this.drawer.notifyMutation(this.selected()!, 'checklist');
    });
  }

  async deleteCheck(item: Item) {
    await this.run(async () => {
      await this.api.request(`tasks/${this.selected()!.id}/checklist/${item.id}`, 'DELETE', {});
      await this.loadDetail();
      this.drawer.notifyMutation(this.selected()!, 'checklist');
    });
  }

  async comment(body: string, reset?: () => void) {
    await this.run(async () => {
      await this.api.request(`tasks/${this.selected()!.id}/comments`, 'POST', { body });
      reset?.();
      await this.loadDetail();
      this.drawer.notifyMutation(this.selected()!, 'comment');
    });
  }

  async deleteComment(item: Item) {
    await this.run(async () => {
      await this.api.request(`tasks/${this.selected()!.id}/comments/${item.id}`, 'DELETE', {});
      await this.loadDetail();
      this.drawer.notifyMutation(this.selected()!, 'comment');
    });
  }

  async invite(email: string, role = 'watcher', reset?: () => void) {
    const row = this.selected() ?? this.scope();
    if (!row) return;
    await this.run(async () => {
      if (row.kind === 'organization') {
        await this.api.request(`organizations/${row.id}/members`, 'POST', { email, role });
      } else {
        await this.api.request('item-roles', 'POST', {
          itemType: row.kind,
          itemId: row.id,
          email,
          role,
        });
      }
      reset?.();
      this.toast.success('Convite enviado.');
      await this.loadDetail();
    });
  }

  async revoke(assignment: Item) {
    const row = this.selected()!;
    await this.run(async () => {
      if (row.kind === 'organization') {
        await this.api.request(`organizations/${row.id}/members/${assignment.id}`, 'PATCH', {
          status: 'removed',
        });
      } else {
        await this.api.request('item-roles', 'DELETE', {
          itemType: row.kind,
          itemId: row.id,
          assignmentId: assignment.id,
        });
      }
      this.toast.info('Acesso removido.');
      await this.loadDetail();
    });
  }

  async transferOwner(proposedOwnerUserId: string, mode = 'normal') {
    const row = this.selected()!;
    if (
      !(await this.ask('Confirmar transferência de Owner?', [
        { value: 'yes', label: 'Solicitar transferência' },
      ]))
    ) {
      return;
    }
    await this.run(async () => {
      await this.api.request('owner-transfers', 'POST', {
        itemType: row.kind,
        itemId: row.id,
        proposedOwnerUserId,
        mode,
      });
      this.toast.success('Solicitação de transferência enviada.');
      await this.loadDetail();
    });
  }

  updateDetailGraph(graph: DependencyGraph) {
    this.detail.update(detail => ({ ...detail, graph }));
  }

  async saveTemplate(name: string, reset?: () => void) {
    const row = this.selected()!;
    await this.run(async () => {
      await this.api.request('templates', 'POST', {
        sourceType: row.kind,
        sourceId: row.id,
        name: name || this.title(row),
      });
      this.toast.success('Template salvo com a estrutura de filhos.');
      reset?.();
    });
  }

  async prepareTemplate(row: Item) {
    await this.run(async () => {
      const data = await this.api.request(`templates/${row.id}/instantiate`);
      this.templateSetup.set({ ...data.setup, id: row.id });
      this.templateTitle.set(data.setup.title);
      this.templateTarget.set('0');
    });
  }

  async instantiate() {
    const setup = this.templateSetup()!;
    await this.run(async () => {
      const target = setup['targets'][Number(this.templateTarget())];
      await this.api.request(`templates/${setup.id}/instantiate`, 'POST', {
        title: this.templateTitle(),
        parentType: target.type,
        parentId: target.id,
        startDate: this.templateDate() || null,
      });
      this.templateSetup.set(null);
      this.toast.success('Estrutura criada a partir do template.');
      await this.reloadNavigation();
      await this.load();
    });
  }

  async copyList(row: Item) {
    await this.run(async () => {
      await this.api.request('lists', 'POST', { copyFromId: row.id });
      this.toast.success('Lista copiada.');
      await this.reloadNavigation();
      await this.load();
    });
  }

  async addToList(taskId: string) {
    await this.run(async () => {
      await this.api.request(`lists/${this.scope()!.id}/tasks`, 'POST', { taskId });
      this.toast.success('Tarefa adicionada à lista.');
      await this.load();
    });
  }

  async removeFromList(row: Item) {
    await this.run(async () => {
      await this.api.request(`lists/${this.scope()!.id}/tasks/${row.id}`, 'DELETE', {});
      this.toast.info('Tarefa removida da lista.');
      await this.load();
    });
  }

  async toggleSeries(row: Item) {
    await this.run(async () => {
      await this.api.request(`recurrence-series/${row.id}`, 'PATCH', { active: !row['active'] });
      this.toast.info(row['active'] ? 'Série pausada.' : 'Série retomada.');
      await this.load();
    });
  }

  async readNotification(row: Item) {
    await this.runNotification(async () => {
      await this.api.request('notifications', 'PATCH', { id: row.id, read: true });
      await this.poll();
    });
  }

  async openNotification(row: Item) {
    await this.runNotification(async () => {
      if (!row['readAt']) await this.api.request('notifications', 'PATCH', { id: row.id, read: true });
      await this.poll();
      const task = this.tasks().find(t => t.id === row['taskId']);
      if (task) await this.open(task);
    });
  }

  async readAllNotifications() {
    await this.runNotification(async () => {
      await this.api.request('notifications', 'PATCH', { all: true, read: true });
      await this.poll();
    });
  }
}
