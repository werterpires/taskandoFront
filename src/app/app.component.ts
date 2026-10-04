import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { Subscription, filter } from 'rxjs';
import { ApiError, ApiService, ClosedWorkState, Item, closedWorkStates } from './api.service';
import { fixedRoute, navigation, routeScope, scopedRoute, sectionForRoute, type RouteScope } from './navigation';
import { orderTasks } from './task-order';
import { environment } from '../environments/environment';
import { DependencyGraph, DependencyGraphComponent, EMPTY_DEPENDENCY_GRAPH } from './shared/dependency-graph/dependency-graph.component';

import { DrawerService } from './shared/drawer.service';

const paths: Record<string, string> = { task: 'tasks', project: 'projects', front: 'fronts', product: 'products', process: 'processes', phase: 'phases', organization: 'organizations', list: 'lists', reminder: 'reminders', series: 'recurrence-series' };
@Component({ selector: 'app-root', standalone: true, imports: [CommonModule, FormsModule, RouterOutlet, DependencyGraphComponent], templateUrl: './app.component.html' })
export class AppComponent implements OnInit, OnDestroy {
  api = inject(ApiService);
  router = inject(Router);
  drawer = inject(DrawerService);
  user = signal<Item | null>(null); authenticating = signal(true); loading = signal(false); saving = signal(false);
  error = signal(''); notice = signal(''); section = signal('Início'); mobile = signal(false);
  loginEmail = ''; loginPassword = '';
  newUserDisplayName = ''; newUserEmail = ''; newUserPassword = '';
  currentPassword = ''; newPassword = '';
  readonly navigation = navigation;
  statuses: Record<string,string> = { planned:'Planejado', todo:'A fazer', in_progress:'Em execução', awaiting_approval:'Aguardando aprovação', completed:'Concluído', cancelled:'Cancelado', archived:'Arquivado', active:'Ativo', inactive:'Inativo' };
  types: Record<string,string> = { simple:'Simples', recurring:'Recorrente', commitment:'Compromisso', scheduled:'Agendada', date:'Data', event:'Evento', cyclic:'Cíclica', periodic:'Periódica' };
  labels: Record<string,string> = { task:'Tarefa', project:'Projeto', front:'Frente', product:'Produto', process:'Processo', phase:'Fase', department:'Departamento', team:'Time', organization:'Organização', list:'Lista', reminder:'Lembrete' };
  workStatuses = ['planned','todo','in_progress','awaiting_approval','completed','cancelled','archived'];
  levels = ['high','medium','low']; levelLabels: Record<string,string> = { high:'Alta', medium:'Média', low:'Baixa' };
  roles = ['watcher','contributor','executor','reviewer','editor','leader'];
  rows = signal<Item[]>([]); tasks = signal<Item[]>([]); organizations = signal<Item[]>([]); lists = signal<Item[]>([]);
  notifications = signal<Item[]>([]); unreadNotificationCount = signal(0); showReadNotifications = signal(false);
  notificationsLoading = signal(false); notificationsError = signal('');
  invitations = signal<Item[]>([]); transfers = signal<Item[]>([]); dueReminders = signal<Item[]>([]);
  scope = signal<Item | null>(null);
  selected = this.drawer.openedItem;
  children = this.drawer.children;
  detail = this.drawer.detail;
  tab = this.drawer.initialTab;
  showNotifications = signal(false);
  search = signal(''); view = signal('list'); temporal = signal('all');
  includeClosed = signal<ClosedWorkState[]>([]);
  readonly closedStates = closedWorkStates;
  readonly closedLabels: Record<ClosedWorkState,string> = { completed:'Concluídos', cancelled:'Cancelados', archived:'Arquivados' };
  reportStart = ''; reportEnd = ''; reportStatus = ''; reportType = ''; reportImportance = ''; reportUrgency = '';
  month = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  editing = signal(false); draft: Record<string,any> = {}; editorKind = 'task'; editorId: string | null = null;
  newText = ''; inviteEmail = ''; inviteRole = 'watcher';
  templateName = ''; transferTarget = ''; transferMode = 'normal'; listTaskId = ''; characteristics = '';
  settings = signal<Record<string,any>>({}); token = signal(''); sizeLabels = 'Muito pequeno, Pequeno, Médio, Grande, Muito grande';
  readonly preferenceFields = [
    { key: 'dueSoonEnabled', label: 'Avisar quando um prazo estiver próximo' },
    { key: 'overdueEnabled', label: 'Avisar sobre tarefas atrasadas' },
    { key: 'scheduledEnabled', label: 'Avisar antes de tarefas agendadas' },
    { key: 'reminderEnabled', label: 'Exibir lembretes no aplicativo' },
  ];
  readonly emptyDependencyGraph = EMPTY_DEPENDENCY_GRAPH;
  readonly mcpUrl = `${environment.apiBaseUrl || location.origin}/api/integrations/mcp`;
  templateSetup = signal<Item | null>(null); templateTarget = '0'; templateTitle = ''; templateDate = '';
  decision = signal<{ title: string; options: { value:string; label:string }[]; resolve:(v:string|null)=>void } | null>(null);
  private timer?: ReturnType<typeof setInterval>; private requestVersion = 0; private notificationRequestVersion = 0; private routeSubscription?: Subscription; private activeRouteScope: RouteScope | null = null;
  visibleNotifications = computed(() => this.showReadNotifications() ? this.notifications() : this.notifications().filter(row => !row['readAt']));
  taskCollection = computed(() => this.section() === 'Minhas tarefas' || this.scope()?.kind === 'list');
  kanbanStatuses = computed(() => this.workStatuses.filter(status => !closedWorkStates.includes(status as ClosedWorkState) || this.includeClosed().includes(status as ClosedWorkState)));
  visible = computed(() => this.rows().filter(row => {
    const q = this.search().toLocaleLowerCase();
    if (q && !`${row.title ?? row.name} ${row['description'] ?? ''}`.toLocaleLowerCase().includes(q)) return false;
    if (row.kind === 'task' && this.taskCollection()) {
      const date = row['dueDate'] ?? row['dateAt'] ?? row['startAt']?.slice(0,10);
      const today = this.localDate(new Date());
      if (this.temporal() === 'today' && date !== today && !row['pinnedForToday']) return false;
      if (this.temporal() === 'overdue' && (!date || date >= today)) return false;
      if (this.temporal() === 'no_due' && date) return false;
    }
    return true;
  }));
  orderedVisible = computed(() => {
    const rows = this.visible();
    if (this.section() === 'Minhas tarefas') return orderTasks(rows);
    if (this.section() === 'Cíclicas') return [...rows.filter(row => row['released']), ...rows.filter(row => !row['released'])];
    return rows;
  });
  byStatus = computed(() => Object.fromEntries(this.workStatuses.map(status => {
    const rows = this.visible().filter(row => row['status'] === status);
    return [status, this.section() === 'Minhas tarefas' ? orderTasks(rows) : rows];
  })) as Record<string, Item[]>);
  readonly homeGroupDefinitions = [
    { kind: 'organization', label: 'Organizações' },
    { kind: 'department', label: 'Departamentos' },
    { kind: 'team', label: 'Times' },
    { kind: 'project', label: 'Projetos' },
    { kind: 'product', label: 'Produtos' },
    { kind: 'process', label: 'Processos' },
    { kind: 'task', label: 'Tarefas' },
  ];
  homeGroups = computed(() => {
    if (this.section() !== 'Início') return [];
    return this.homeGroupDefinitions.map(group => ({
      ...group,
      rows: this.visible().filter(row => row.kind === group.kind),
    })).filter(group => group.rows.length);
  });
  openCount = computed(() => this.tasks().filter(t => !['completed','cancelled','archived'].includes(t['status'])).length);
  completedCount = computed(() => this.tasks().filter(t => t['status'] === 'completed').length);
  dashboard = computed(() => {
    const today = this.localDate(new Date());
    const next = new Date(); next.setDate(next.getDate() + 7);
    const nextWeek = this.localDate(next);
    const tasks = this.tasks();
    const items = this.rows();
    const active = (item: Item) => !['completed','cancelled','archived'].includes(item['status']);
    const total = items.filter(item => !['cancelled','archived'].includes(item['status'])).length;
    const completed = items.filter(item => item['status'] === 'completed').length;
    return {
      overdue: tasks.filter(task => active(task) && task['dueDate'] && task['dueDate'] < today).length,
      blocked: tasks.filter(task => active(task) && task['dependencyState'] === 'blocked').length,
      approval: items.filter(item => item['status'] === 'awaiting_approval').length,
      upcoming: tasks.filter(task => active(task) && task['dueDate'] >= today && task['dueDate'] <= nextWeek).sort((a,b) => a['dueDate'].localeCompare(b['dueDate'])).slice(0,8),
      total, completed, progress: total ? Math.round(completed / total * 100) : 0,
    };
  });
  reportRows = computed(() => this.tasks().filter(task => {
    const due = String(task['dueDate'] ?? '').slice(0,10);
    return (!this.reportStart || !!due && due >= this.reportStart)
      && (!this.reportEnd || !!due && due <= this.reportEnd)
      && (!this.reportStatus || task['status'] === this.reportStatus)
      && (!this.reportType || task['taskType'] === this.reportType)
      && (!this.reportImportance || task['importance'] === this.reportImportance)
      && (!this.reportUrgency || task['urgency'] === this.reportUrgency);
  }));
  reportCompleted = computed(() => this.reportRows().filter(task => task['status'] === 'completed').length);
  calendarDays = computed(() => {
    const start = new Date(this.month()); start.setDate(1 - ((start.getDay() + 6) % 7));
    return Array.from({length:42}, (_, i) => { const d = new Date(start); d.setDate(start.getDate()+i); return { key:this.localDate(d), day:d.getDate(), current:d.getMonth()===this.month().getMonth() }; });
  });
  async ngOnInit() {
    this.routeSubscription = this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd)).subscribe(() => {
      if (this.user()) void this.applyRoute();
    });
    try { const data = await this.api.request('auth/me'); this.user.set(data.user); await this.bootstrap(); }
    catch (e) { if (!(e instanceof ApiError && e.status === 401)) this.fail(e); }
    finally { this.authenticating.set(false); }
  }
  ngOnDestroy() { if (this.timer) clearInterval(this.timer); this.timer = undefined; this.requestVersion += 1; this.routeSubscription?.unsubscribe(); }
  async bootstrap() {
    const initialSection = this.currentRoute()?.section;
    await this.reloadNavigation(initialSection !== 'Minhas tarefas');
    if (!this.isProcessRoute()) await this.applyRoute();
    await this.poll(); if (this.user()) this.timer = setInterval(() => void this.poll(), 30_000);
  }
  async reloadNavigation(includeTasks = true) {
    const [orgs, lists, taskData] = await Promise.all([this.api.request('organizations'),this.api.request('lists'),includeTasks ? this.api.request('tasks') : Promise.resolve(null)]);
    this.organizations.set(orgs.organizations ?? []); this.invitations.set(orgs.invitations ?? []); this.lists.set(lists.lists ?? []);
    if (taskData) this.tasks.set(this.mark(taskData.tasks,'task'));
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
    if ([unread, reminders, all].some(result => result.status === 'rejected' && result.reason instanceof ApiError && result.reason.status === 401)) {
      this.user.set(null); this.ngOnDestroy(); return;
    }
    if (!this.user() || version !== this.notificationRequestVersion) return;
    this.notificationsLoading.set(false);
    if (unread.status === 'fulfilled') this.unreadNotificationCount.set(unread.value.unreadCount ?? 0);
    const listing = showRead ? all : unread;
    if (listing.status === 'fulfilled' && listing.value) this.notifications.set(listing.value.notifications ?? []);
    this.notificationsError.set(unread.status === 'rejected' || listing.status === 'rejected' ? 'Não foi possível carregar as notificações.' : '');
    if (reminders.status === 'fulfilled' && reminders.value.reminders?.length) this.dueReminders.update(old => [...old, ...reminders.value.reminders]);
  }
  async toggleReadNotifications() { this.showReadNotifications.set(!this.showReadNotifications()); await this.poll(); }
  async navigate(section: string, scope: Item | null = null) {
    this.mobile.set(false);
    const route = scope && ['list', 'organization', 'department', 'team'].includes(scope.kind ?? '')
      ? scopedRoute({ kind: scope.kind as RouteScope['kind'], id: scope.id })
      : [fixedRoute(section)];
    await this.router.navigate(route);
  }
  private currentRoute(): { section: string | null; scope: RouteScope | null } | null {
    const segments = this.router.parseUrl(this.router.url).root.children['primary']?.segments.map(segment => segment.path) ?? [];
    if (segments[0] === 'processos' && segments.length === 2) return null;
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
    const version = ++this.requestVersion; this.loading.set(true); this.error.set('');
    try {
      let rows: Item[] = []; const section = this.section(), scope = this.activeRouteScope ?? this.scope();
      if (scope?.kind === 'list') {
        const data = await this.api.requestWithClosed(`lists/${scope.id}/tasks`,this.includeClosed());
        if (version === this.requestVersion) this.scope.set({ ...data.list, kind: 'list' });
        rows = this.mark(data.tasks,'task');
      } else if (scope) {
        const data = await this.api.requestWithClosed(`context?parentType=${scope.kind}&parentId=${scope.id}`,this.includeClosed());
        if (version === this.requestVersion) this.scope.set(data.scope ?? null);
        rows = this.contextRows(data);
      } else if (section === 'Painel') {
        const [matrix, taskData] = await Promise.all([this.api.requestWithClosed('priority-matrix',closedWorkStates), this.api.request('tasks')]);
        this.tasks.set(this.mark(taskData.tasks,'task')); rows = matrix.items ?? [];
      } else if (section === 'Início') {
        rows = this.contextRows(await this.api.requestWithClosed('context?parentType=root',this.includeClosed()));
      } else if (['Minhas tarefas','Relatórios'].includes(section)) {
        const included = section === 'Relatórios' ? this.reportClosedStates() : this.includeClosed();
        const data = await this.api.requestWithClosed('tasks',included); this.tasks.set(this.mark(data.tasks,'task')); rows = this.tasks();
      } else if (section === 'Calendário') {
        const from = this.calendarDays()[0].key, to = this.calendarDays()[41].key;
        await this.api.request('recurrence-series/materialize-window','POST',{from,to});
        rows = this.mark((await this.api.requestWithClosed('tasks',this.includeClosed())).tasks,'task');
      } else if (section === 'Quadrante') { rows = (await this.api.requestWithClosed('priority-matrix',this.includeClosed())).items ?? []; }
      else if (section === 'Cíclicas') rows = this.mark((await this.api.request('cyclic-queue')).tasks,'task');
      else if (section === 'Estrutura') rows = this.contextRows(await this.api.requestWithClosed('context?parentType=personal',this.includeClosed()));
      else if (section === 'Lixeira') rows = this.mark((await this.api.request('recycle-bin/tasks')).tasks,'task');
      else if (section === 'Configurações') {
        const [prefs, sizes, token, transfers, invitations] = await Promise.all([this.api.request('notification-preferences'),this.api.request('preferences/size-labels'),this.api.request('mcp-token'),this.api.request('owner-transfers'),this.api.request('item-invitations')]);
        this.settings.set({...prefs.preferences,...token}); this.sizeLabels=(sizes.labels ?? []).join(', '); this.transfers.set(transfers.requests ?? []); this.invitations.set(invitations.invitations ?? []);
      } else {
        const resource: Record<string,[string,string,string,boolean]> = { Projetos:['projects','projects','project',true],Produtos:['products','products','product',true],Processos:['processes','processes','process',true],Listas:['lists','lists','list',false],Lembretes:['reminders','reminders','reminder',false],Séries:['recurrence-series','series','series',false],Templates:['templates','templates','template',false] };
        const entry=resource[section]; if (entry) { const data=entry[3]?await this.api.requestWithClosed(entry[0],this.includeClosed()):await this.api.request(entry[0]);rows=this.mark(data[entry[1]],entry[2]); }
      }
      if (version===this.requestVersion) this.rows.set(rows);
    } catch(e) { if(version===this.requestVersion)this.fail(e); } finally { if (version===this.requestVersion) this.loading.set(false); }
  }
  supportsClosedFilters() { return Boolean(this.scope()) || ['Início','Minhas tarefas','Calendário','Quadrante','Projetos','Produtos','Processos','Estrutura'].includes(this.section()); }
  isClosedIncluded(state:ClosedWorkState) { return this.includeClosed().includes(state); }
  async toggleClosed(state:ClosedWorkState,checked:boolean) { const selected=new Set(this.includeClosed());if(checked)selected.add(state);else selected.delete(state);this.includeClosed.set(closedWorkStates.filter(value=>selected.has(value)));await this.load(); }
  reportClosedStates():ClosedWorkState[] { return closedWorkStates.includes(this.reportStatus as ClosedWorkState)?[this.reportStatus as ClosedWorkState]:[]; }
  async changeReportStatus(status:string) { this.reportStatus=status;await this.load(); }
  isProcessRoute() { return this.router.url.startsWith('/processos/'); }
  mark(rows: Item[] | undefined, kind:string):Item[] { return (rows ?? []).map(row=>({...row,kind})); }
  contextRows(data: Record<string,any>) { return ['organizations','departments','teams','projects','products','processes','tasks'].flatMap(key=>this.mark(data[key],({organizations:'organization',departments:'department',teams:'team',projects:'project',products:'product',processes:'process',tasks:'task'} as Record<string,string>)[key])); }
  fail(e:unknown) { this.error.set(e instanceof Error ? e.message : 'Não foi possível concluir a operação.'); }
  async run(action:()=>Promise<void>) { if(this.saving()) return; this.saving.set(true);this.error.set('');try { await action(); } catch(e) { this.fail(e); } finally { this.saving.set(false); } }
  async runNotification(action:()=>Promise<void>) { await this.run(action); if(this.error()) this.notificationsError.set(this.error()); }
  async authenticate() { await this.run(async()=>{
    const data=await this.api.request('auth/login','POST',{email:this.loginEmail,password:this.loginPassword});
    this.loginPassword='';this.showReadNotifications.set(false);this.unreadNotificationCount.set(0);this.notifications.set([]);this.notificationsError.set('');this.user.set(data.user);await this.bootstrap();
  }); }
  async createUser() { await this.run(async()=>{
    await this.api.request('auth/users','POST',{displayName:this.newUserDisplayName,email:this.newUserEmail,password:this.newUserPassword});
    this.newUserDisplayName='';this.newUserEmail='';this.newUserPassword='';this.notice.set('Usuário criado. Informe a senha inicial à pessoa.');
  }); }
  async changePassword() { await this.run(async()=>{
    await this.api.request('auth/password','PATCH',{currentPassword:this.currentPassword,newPassword:this.newPassword});
    this.currentPassword='';this.newPassword='';this.notice.set('Senha alterada.');
  }); }
  async logout() { await this.run(async()=>{await this.api.request('auth/logout','POST',{});this.user.set(null);this.showReadNotifications.set(false);this.ngOnDestroy();}); }
  localDate(date:Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  title(row:Item) { return row.title ?? row.name ?? ''; }
  parentChainLabel(row:Item) { return (row['parentChain'] ?? []).map((parent:Item) => this.title(parent)).filter(Boolean).join(' → '); }
  inCell(importance:string,urgency:string) { return this.visible().filter(r=>r['importance']===importance&&r['urgency']===urgency); }
  onDay(day:string) { return this.rows().filter(r => r['taskType']!=='reminder' && (r['dateAt']===day || r['dueDate']===day || r['startAt']?.slice(0,10)===day || (r['taskType']==='event' && r['startAt']?.slice(0,10)<=day && r['endAt']?.slice(0,10)>=day))); }
  async changeMonth(offset:number) { const d=new Date(this.month());d.setMonth(d.getMonth()+offset);this.month.set(d);await this.load(); }
  newItem(kind='task', parent?:Item) {
    this.editorKind=kind;this.editorId=null;this.draft={title:'',description:'',taskType:'simple',status:kind==='task'?'todo':'planned',approvalRequired:false,size:null,importance:null,urgency:null,relevance:3,parentType:parent?.kind ?? this.scope()?.kind ?? null,parentId:parent?.id ?? this.scope()?.id ?? null,startDate:this.localDate(new Date()),time:'09:00',cadence:'week',interval:1,occurrencesPerPeriod:1,periodSlots:'1',timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone, durationMinutes:30};
    if(this.draft['parentType']==='list'){this.draft['parentType']=null;this.draft['parentId']=null;}
    this.characteristics='';this.editing.set(true);
  }
  edit(row:Item) { this.editorKind=row.kind!;this.editorId=row.id;this.draft={...row,tags:(row['tags']??[]).map((t:any)=>t.name).join(', ')};for(const key of ['startAt','endAt','remindAt']) if(this.draft[key]){const d=new Date(this.draft[key]);this.draft[key]=`${this.localDate(d)}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;}this.characteristics=(row['characteristics']??[]).map((c:any)=>`${c.key}: ${c.value}`).join('\n');this.editing.set(true); }
  async save() { await this.run(async()=>{
    const d=this.draft,kind=this.editorKind; let path=paths[kind];
    const payload:Record<string,any>={title:String(d['title']??d['name']??'').trim(),description:d['description']??''};
    if(['task','project','front','product','process','phase'].includes(kind)) Object.assign(payload,{approvalRequired:!!d['approvalRequired'],size:d['size']||null,importance:d['importance']||null,urgency:d['urgency']||null});
    if(!this.editorId) Object.assign(payload,{parentType:d['parentType']||null,parentId:d['parentId']||null});
    if(kind==='task') {
      payload['tags']=String(d['tags']??'').split(',').map(t=>t.trim()).filter(Boolean);
      if(d['taskType']!=='cyclic') payload['dueDate']=d['dueDate']||null;
      if(!this.editorId) payload['taskType']=d['taskType'];
      if(d['taskType']==='date') payload['dateAt']=d['dateAt'];
      if(['commitment','event'].includes(d['taskType'])) payload['startAt']=d['startAt']?new Date(d['startAt']).toISOString():null;
      if(d['taskType']==='commitment') payload['durationMinutes']=Number(d['durationMinutes']);
      if(d['taskType']==='event') payload['endAt']=d['endAt']?new Date(d['endAt']).toISOString():null;
      if(d['taskType']==='cyclic') payload['relevance']=Number(d['relevance']);
      if(['recurring','scheduled','periodic'].includes(d['taskType'])&&!this.editorId) payload['recurrenceDefinition']={cadence:d['cadence'],interval:Number(d['interval']),startDate:d['startDate'],endDate:d['endDate']||null,time:d['time'],timeZone:d['timeZone'],weekdays:d['cadence']==='week'?String(d['periodSlots']).split(',').map(Number):undefined,occurrencesPerPeriod:Number(d['occurrencesPerPeriod']),periodSlots:String(d['periodSlots']).split(',').map(v=>d['cadence']==='year'?v.trim():Number(v)),durationMinutes:Number(d['durationMinutes'])};
      if(!this.editorId&&d['parentType']) path=d['parentType']==='task'?`tasks/${d['parentId']}/subtasks`:`task-containers/${d['parentType']}/${d['parentId']}`;
    }
    if(kind==='product') payload['characteristics']=this.characteristics.split('\n').filter(Boolean).map(line=>{const colon=line.indexOf(':');return {key:line.slice(0,colon).trim(),value:line.slice(colon+1).trim()};});
    if(kind==='process') payload['autoCompleteWhenChildrenDone']=!!d['autoCompleteWhenChildrenDone'];
    if(kind==='front'&&!this.editorId) path=`projects/${d['parentId']}/fronts`;
    if(kind==='phase'&&!this.editorId) path=`processes/${d['parentId']}/phases`;
    if(['organization','department','team','list'].includes(kind)) { payload['name']=payload['title'];delete payload['title']; }
    if(['department','team'].includes(kind)) { payload['kind']=kind;const org=this.scope()?.kind==='organization'?this.scope()!.id:null;path=org?`organizations/${org}/structure`:'personal/structure';if(this.editorId)path+=`/${kind}`; }
    if(kind==='reminder') { payload['remindAt']=new Date(d['remindAt']).toISOString();payload['timeZone']=d['timeZone']??Intl.DateTimeFormat().resolvedOptions().timeZone;if(this.editorId)payload['id']=this.editorId; }
    if(kind==='list') { delete payload['parentType'];delete payload['parentId']; }
    if(this.editorId&&kind!=='reminder') path+=`/${this.editorId}`;
    const data=await this.api.request(path,this.editorId?'PATCH':'POST',payload);
    this.editing.set(false);this.notice.set('Salvo.');await this.reloadNavigation();await this.load();
    if(this.selected()) { const updated=data[kind]??data.item;if(updated) this.selected.set({...this.selected(),...updated});await this.loadDetail(); }
    this.drawer.notifyMutation(this.selected() ?? data[kind] ?? data.item, this.editorId ? 'update' : 'create');
  }); }
  async open(row:Item) {
    if(['organization','department','team'].includes(row.kind!)) { await this.navigate('Estrutura',row);return; }
    if(row.kind==='list'){await this.navigate('Listas',row);return;}
    if(row.kind==='template'){await this.prepareTemplate(row);return;}
    if(row.kind==='process'){await this.router.navigate(['/processos',row.id],{state:{fromTaskando:true}});return;}
    try {
      await this.drawer.open(row, 'Detalhes', this.includeClosed());
    } catch(e) {
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
    } catch(e) {
      this.fail(e);
    }
  }
  async patch(row:Item,payload:Record<string,any>) {
    try { const data=await this.api.request(`${paths[row.kind!]}/${row.id}`,'PATCH',payload);if(this.selected()?.id===row.id)this.selected.set({...row,...data[row.kind!]});await this.reloadNavigation();await this.load();if(this.selected())await this.loadDetail();this.drawer.notifyMutation(row,'patch'); }
    catch(e) {
      if(e instanceof ApiError && (e.details['requiresSubtaskResolution'] || e.details['requiresCancelDecision'] || e.details['requiresDecision'] || e.status===409)) {
        let extra:Record<string,string>|null=null;
        if(e.message.toLowerCase().includes('subtarefa')) {const choice=await this.ask(e.message,[{value:'complete',label:'Concluir subtarefas'},{value:'cancel',label:'Cancelar subtarefas'}]);if(choice)extra={subtaskResolution:choice};}
        else if(payload['status']==='cancelled'){const choice=await this.ask(e.message,[{value:'release',label:'Liberar sucessoras'},{value:'cascade',label:'Cancelar em cascata'}]);if(choice)extra={cancelDecision:choice};}
        else throw e;
        if(extra)await this.patch(row,{...payload,...extra});
      } else throw e;
    }
  }
  async status(row:Item,value:string) { await this.run(()=>this.patch(row,{status:value})); }
  async pin(row:Item) { await this.run(()=>this.patch(row,{pinnedForToday:!row['pinnedForToday']})); }
  ask(title:string,options:{value:string;label:string}[]) { return new Promise<string|null>(resolve=>this.decision.set({title,options,resolve})); }
  answer(value:string|null) {const d=this.decision();this.decision.set(null);d?.resolve(value);}
  async remove(row:Item) {
    const answer=await this.ask(row.kind==='task'?'Mover esta tarefa para a lixeira?':'Remover este item?',[{value:'yes',label:'Confirmar remoção'}]);if(!answer)return;
    await this.run(async()=>{await this.api.request(row.kind==='reminder'?'reminders':`${paths[row.kind!]}/${row.id}`,'DELETE',row.kind==='reminder'?{id:row.id}:{});this.selected.set(null);await this.reloadNavigation();await this.load();this.drawer.notifyMutation(row,'delete');});
  }
  async restore(row:Item) {await this.run(async()=>{await this.api.request('recycle-bin/tasks','POST',{id:row.id});await this.reloadNavigation();await this.load();});}
  async approve(decision:string) {const row=this.selected()!;await this.run(async()=>{await this.api.request('approvals','POST',{subjectType:row.kind,subjectId:row.id,decision});this.selected.set(null);await this.load();this.drawer.notifyMutation(row,'approve');});}
  async addChecklist() {await this.run(async()=>{await this.api.request(`tasks/${this.selected()!.id}/checklist`,'POST',{title:this.newText});this.newText='';await this.loadDetail();this.drawer.notifyMutation(this.selected()!,'checklist');});}
  async toggleCheck(item:Item) {await this.run(async()=>{await this.api.request(`tasks/${this.selected()!.id}/checklist/${item.id}`,'PATCH',{completed:!item['completed']});await this.loadDetail();this.drawer.notifyMutation(this.selected()!,'checklist');});}
  async deleteCheck(item:Item) {await this.run(async()=>{await this.api.request(`tasks/${this.selected()!.id}/checklist/${item.id}`,'DELETE',{});await this.loadDetail();this.drawer.notifyMutation(this.selected()!,'checklist');});}
  async comment() {await this.run(async()=>{await this.api.request(`tasks/${this.selected()!.id}/comments`,'POST',{body:this.newText});this.newText='';await this.loadDetail();this.drawer.notifyMutation(this.selected()!,'comment');});}
  async deleteComment(item:Item) {await this.run(async()=>{await this.api.request(`tasks/${this.selected()!.id}/comments/${item.id}`,'DELETE',{});await this.loadDetail();this.drawer.notifyMutation(this.selected()!,'comment');});}
  async invite() {const row=this.selected()??this.scope();if(!row)return;await this.run(async()=>{if(row.kind==='organization')await this.api.request(`organizations/${row.id}/members`,'POST',{email:this.inviteEmail,role:this.inviteRole});else await this.api.request('item-roles','POST',{itemType:row.kind,itemId:row.id,email:this.inviteEmail,role:this.inviteRole});this.inviteEmail='';await this.loadDetail();});}
  async revoke(assignment:Item) {const row=this.selected()!;await this.run(async()=>{if(row.kind==='organization')await this.api.request(`organizations/${row.id}/members/${assignment.id}`,'PATCH',{status:'removed'});else await this.api.request('item-roles','DELETE',{itemType:row.kind,itemId:row.id,assignmentId:assignment.id});await this.loadDetail();});}
  async transferOwner() {const row=this.selected()!;if(!await this.ask('Confirmar transferência de Owner?',[{value:'yes',label:'Solicitar transferência'}]))return;await this.run(async()=>{await this.api.request('owner-transfers','POST',{itemType:row.kind,itemId:row.id,proposedOwnerUserId:this.transferTarget,mode:this.transferMode});await this.loadDetail();});}
  async respondTransfer(row:Item,action:string) {await this.run(async()=>{await this.api.request('owner-transfers','PATCH',{id:row.id,action});await this.load();});}
  updateDetailGraph(graph:DependencyGraph) { this.detail.update(detail=>({...detail,graph})); }
  async saveTemplate() {const row=this.selected()!;await this.run(async()=>{await this.api.request('templates','POST',{sourceType:row.kind,sourceId:row.id,name:this.templateName||this.title(row)});this.notice.set('Template salvo com a estrutura de filhos.');this.templateName='';});}
  async prepareTemplate(row:Item) {await this.run(async()=>{const data=await this.api.request(`templates/${row.id}/instantiate`);this.templateSetup.set({...data.setup,id:row.id});this.templateTitle=data.setup.title;this.templateTarget='0';});}
  async instantiate() {const setup=this.templateSetup()!;await this.run(async()=>{const target=setup['targets'][Number(this.templateTarget)];await this.api.request(`templates/${setup.id}/instantiate`,'POST',{title:this.templateTitle,parentType:target.type,parentId:target.id,startDate:this.templateDate||null});this.templateSetup.set(null);this.notice.set('Estrutura criada a partir do template.');await this.reloadNavigation();await this.load();});}
  async copyList(row:Item) {await this.run(async()=>{await this.api.request('lists','POST',{copyFromId:row.id});await this.reloadNavigation();await this.load();});}
  async addToList() {await this.run(async()=>{await this.api.request(`lists/${this.scope()!.id}/tasks`,'POST',{taskId:this.listTaskId});await this.load();});}
  async removeFromList(row:Item) {await this.run(async()=>{await this.api.request(`lists/${this.scope()!.id}/tasks/${row.id}`,'DELETE',{});await this.load();});}
  async toggleSeries(row:Item) {await this.run(async()=>{await this.api.request(`recurrence-series/${row.id}`,'PATCH',{active:!row['active']});await this.load();});}
  async readNotification(row:Item) {await this.runNotification(async()=>{await this.api.request('notifications','PATCH',{id:row.id,read:true});await this.poll();});}
  async openNotification(row:Item) {await this.runNotification(async()=>{if(!row['readAt'])await this.api.request('notifications','PATCH',{id:row.id,read:true});await this.poll();const task=this.tasks().find(t=>t.id===row['taskId']);if(task)await this.open(task);});}
  async readAllNotifications() {await this.runNotification(async()=>{await this.api.request('notifications','PATCH',{all:true,read:true});await this.poll();});}
  async saveSettings() {await this.run(async()=>{const settings=this.settings();const prefs:Record<string,any>={};for(const key of ['dueSoonEnabled','overdueEnabled','scheduledEnabled','reminderEnabled','timeZone'])if(key in settings)prefs[key]=settings[key];await this.api.request('notification-preferences','PATCH',prefs);await this.api.request('preferences/size-labels','PATCH',{labels:this.sizeLabels.split(',').map(v=>v.trim())});this.notice.set('Preferências salvas.');});}
  async generateToken() {if(!await this.ask('Gerar um token invalida o anterior. Continuar?',[{value:'yes',label:'Gerar token'}]))return;await this.run(async()=>{const data=await this.api.request('mcp-token','POST',{});this.token.set(data.secret);});}
  async revokeToken(){await this.run(async()=>{await this.api.request('mcp-token','DELETE',{});this.token.set('');this.notice.set('Token revogado.');});}
  async exportData(){await this.run(async()=>{const data=await this.api.request('privacy/export');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='taskando-export.json';a.click();URL.revokeObjectURL(url);});}
  async clearReport() { const reload=Boolean(this.reportStatus);this.reportStart='';this.reportEnd='';this.reportStatus='';this.reportType='';this.reportImportance='';this.reportUrgency='';if(reload)await this.load(); }
  exportReport() {
    const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"','""')}"`;
    const lines = [['Título','Status','Tipo','Importância','Urgência','Prazo','Contêiner','Owner','Responsáveis'], ...this.reportRows().map(task => [this.title(task),this.statuses[task['status']]??task['status'],this.types[task['taskType']]??task['taskType'],this.levelLabels[task['importance']]??'',this.levelLabels[task['urgency']]??'',task['dueDate']??'',task['parentName']??'Área pessoal',task['ownerName']??'',(task['assignees']??[]).map((person:Item)=>person['displayName']).join(', ')])].map(row=>row.map(quote).join(',')).join('\n');
    const url=URL.createObjectURL(new Blob([`\uFEFF${lines}`],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='relatorio-taskando.csv';link.click();URL.revokeObjectURL(url);
  }
  async deleteAccount(){if(!await this.ask('Registrar solicitação de exclusão da conta? Os dados compartilhados serão analisados.',[{value:'yes',label:'Solicitar exclusão'}]))return;await this.run(async()=>{await this.api.request('privacy/deletion-request','POST',{confirmation:'EXCLUIR'});this.notice.set('Solicitação registrada.');});}
  async acceptInvitation(row:Item,accept:boolean){await this.run(async()=>{await this.api.request(row['organization']?`organizations/${row['organization'].id}/members/${row.id}`:'item-invitations','PATCH',row['organization']?{action:accept?'accept':'decline'}:{id:row.id,accept});await this.reloadNavigation();await this.load();});}
  async drop(event:DragEvent,status:string){event.preventDefault();const id=event.dataTransfer?.getData('text/plain');const task=this.rows().find(r=>r.id===id);if(task)await this.status(task,status);}
  drag(event:DragEvent,row:Item){event.dataTransfer?.setData('text/plain',row.id);}
}
