import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiError, ApiService, Item } from './api.service';
import { environment } from '../environments/environment';

const paths: Record<string, string> = { task: 'tasks', project: 'projects', front: 'fronts', product: 'products', process: 'processes', phase: 'phases', organization: 'organizations', list: 'lists', reminder: 'reminders', series: 'recurrence-series' };
@Component({ selector: 'app-root', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './app.component.html' })
export class AppComponent implements OnInit, OnDestroy {
  api = inject(ApiService);
  user = signal<Item | null>(null); authenticating = signal(true); loading = signal(false); saving = signal(false);
  error = signal(''); notice = signal(''); section = signal('Início'); mobile = signal(false);
  loginEmail = ''; loginPassword = '';
  newUserDisplayName = ''; newUserEmail = ''; newUserPassword = '';
  currentPassword = ''; newPassword = '';
  navigation = ['Início', 'Minhas tarefas', 'Cíclicas', 'Lembretes', 'Calendário', 'Quadrante', 'Painel', 'Relatórios', 'Listas', 'Projetos', 'Produtos', 'Processos', 'Séries', 'Templates', 'Estrutura', 'Lixeira', 'Configurações'];
  icons = ['⌂','✓','↻','♧','▦','⊞','◷','▤','☷','◇','◈','⇢','⟳','▧','⌘','♲','⚙'];
  statuses: Record<string,string> = { planned:'Planejado', todo:'A fazer', in_progress:'Em execução', awaiting_approval:'Aguardando aprovação', completed:'Concluído', cancelled:'Cancelado', archived:'Arquivado', active:'Ativo', inactive:'Inativo' };
  types: Record<string,string> = { simple:'Simples', recurring:'Recorrente', commitment:'Compromisso', scheduled:'Agendada', date:'Data', event:'Evento', cyclic:'Cíclica', periodic:'Periódica' };
  labels: Record<string,string> = { task:'Tarefa', project:'Projeto', front:'Frente', product:'Produto', process:'Processo', phase:'Fase', department:'Departamento', team:'Time', organization:'Organização', list:'Lista', reminder:'Lembrete' };
  workStatuses = ['planned','todo','in_progress','awaiting_approval','completed','cancelled','archived'];
  levels = ['high','medium','low']; levelLabels: Record<string,string> = { high:'Alta', medium:'Média', low:'Baixa' };
  roles = ['watcher','contributor','executor','reviewer','editor','leader'];
  rows = signal<Item[]>([]); tasks = signal<Item[]>([]); organizations = signal<Item[]>([]); lists = signal<Item[]>([]);
  notifications = signal<Item[]>([]); invitations = signal<Item[]>([]); transfers = signal<Item[]>([]); dueReminders = signal<Item[]>([]);
  scope = signal<Item | null>(null); selected = signal<Item | null>(null); children = signal<Item[]>([]);
  detail = signal<Record<string,any>>({}); tab = signal('Detalhes'); showNotifications = signal(false);
  search = signal(''); filter = signal('open'); view = signal('list'); temporal = signal('all');
  reportStart = ''; reportEnd = ''; reportStatus = ''; reportType = ''; reportImportance = ''; reportUrgency = '';
  month = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  editing = signal(false); draft: Record<string,any> = {}; editorKind = 'task'; editorId: string | null = null;
  newText = ''; inviteEmail = ''; inviteRole = 'watcher'; predecessor = ''; successor = ''; dependencyKind = 'task';
  templateName = ''; transferTarget = ''; transferMode = 'normal'; listTaskId = ''; characteristics = '';
  settings = signal<Record<string,any>>({}); token = signal(''); sizeLabels = 'Muito pequeno, Pequeno, Médio, Grande, Muito grande';
  readonly preferenceFields = [
    { key: 'dueSoonEnabled', label: 'Avisar quando um prazo estiver próximo' },
    { key: 'overdueEnabled', label: 'Avisar sobre tarefas atrasadas' },
    { key: 'scheduledEnabled', label: 'Avisar antes de tarefas agendadas' },
    { key: 'reminderEnabled', label: 'Exibir lembretes no aplicativo' },
  ];
  readonly mcpUrl = `${environment.apiBaseUrl || location.origin}/api/integrations/mcp`;
  templateSetup = signal<Item | null>(null); templateTarget = '0'; templateTitle = ''; templateDate = '';
  decision = signal<{ title: string; options: { value:string; label:string }[]; resolve:(v:string|null)=>void } | null>(null);
  private timer?: ReturnType<typeof setInterval>; private requestVersion = 0;
  taskCollection = computed(() => this.section() === 'Minhas tarefas' || this.scope()?.kind === 'list');
  visible = computed(() => this.rows().filter(row => {
    const q = this.search().toLocaleLowerCase();
    if (q && !`${row.title ?? row.name} ${row['description'] ?? ''}`.toLocaleLowerCase().includes(q)) return false;
    if (row.kind === 'task' && this.taskCollection()) {
      if (this.filter() === 'open' && ['completed','cancelled','archived'].includes(row['status'])) return false;
      if (this.filter() === 'completed' && row['status'] !== 'completed') return false;
      const date = row['dueDate'] ?? row['dateAt'] ?? row['startAt']?.slice(0,10);
      const today = this.localDate(new Date());
      if (this.temporal() === 'today' && date !== today && !row['pinnedForToday']) return false;
      if (this.temporal() === 'overdue' && (!date || date >= today)) return false;
      if (this.temporal() === 'no_due' && date) return false;
    }
    return true;
  }));
  openCount = computed(() => this.tasks().filter(t => !['completed','cancelled','archived'].includes(t['status'])).length);
  completedCount = computed(() => this.tasks().filter(t => t['status'] === 'completed').length);
  dashboard = computed(() => {
    const today = this.localDate(new Date());
    const next = new Date(); next.setDate(next.getDate() + 7);
    const nextWeek = this.localDate(next);
    const tasks = this.tasks();
    const items = this.rows();
    const active = (item: Item) => !['completed','cancelled','archived'].includes(item['status']);
    const total = items.filter(item => item['status'] !== 'archived').length;
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
    try { const data = await this.api.request('auth/me'); this.user.set(data.user); await this.bootstrap(); }
    catch (e) { if (!(e instanceof ApiError && e.status === 401)) this.fail(e); }
    finally { this.authenticating.set(false); }
  }
  ngOnDestroy() { if (this.timer) clearInterval(this.timer); }
  async bootstrap() { await this.reloadNavigation(); await this.load(); await this.poll(); this.timer = setInterval(() => void this.poll(), 30_000); }
  async reloadNavigation() {
    const [orgs, lists, tasks] = await Promise.all([this.api.request('organizations'),this.api.request('lists'),this.api.request('tasks')]);
    this.organizations.set(orgs.organizations ?? []); this.invitations.set(orgs.invitations ?? []); this.lists.set(lists.lists ?? []); this.tasks.set(this.mark(tasks.tasks,'task'));
  }
  async poll() {
    if (!this.user()) return;
    try {
      const [notifications, reminders] = await Promise.all([this.api.request('notifications'),this.api.request('reminders/due','POST',{})]);
      this.notifications.set(notifications.notifications ?? []);
      if (reminders.reminders?.length) this.dueReminders.update(old => [...old,...reminders.reminders]);
    } catch (e) { if (e instanceof ApiError && e.status===401) { this.user.set(null); this.ngOnDestroy(); } }
  }
  async navigate(section: string, scope: Item | null = null) { this.section.set(section); this.scope.set(scope); this.selected.set(null); this.search.set(''); this.mobile.set(false); this.error.set(''); await this.load(); }
  async load() {
    const version = ++this.requestVersion; this.loading.set(true); this.error.set('');
    try {
      let rows: Item[] = []; const section = this.section(), scope = this.scope();
      if (scope?.kind === 'list') {
        const data = await this.api.request(`lists/${scope.id}/tasks`); rows = this.mark(data.tasks,'task');
      } else if (scope) {
        const data = await this.api.request(`context?parentType=${scope.kind}&parentId=${scope.id}`); rows = this.contextRows(data);
      } else if (section === 'Painel') {
        const [matrix, taskData] = await Promise.all([this.api.request('priority-matrix'), this.api.request('tasks')]);
        this.tasks.set(this.mark(taskData.tasks,'task')); rows = matrix.items ?? [];
      } else if (section === 'Início') {
        rows = this.contextRows(await this.api.request('context?parentType=root'));
      } else if (['Minhas tarefas','Relatórios'].includes(section)) {
        const data = await this.api.request('tasks'); this.tasks.set(this.mark(data.tasks,'task')); rows = this.tasks();
      } else if (section === 'Calendário') {
        const from = this.calendarDays()[0].key, to = this.calendarDays()[41].key;
        await this.api.request('recurrence-series/materialize-window','POST',{from,to});
        rows = this.mark((await this.api.request('tasks')).tasks,'task');
      } else if (section === 'Quadrante') { rows = (await this.api.request('priority-matrix')).items ?? []; }
      else if (section === 'Cíclicas') rows = this.mark((await this.api.request('cyclic-queue')).tasks,'task');
      else if (section === 'Estrutura') rows = this.contextRows(await this.api.request('context?parentType=personal'));
      else if (section === 'Lixeira') rows = this.mark((await this.api.request('recycle-bin/tasks')).tasks,'task');
      else if (section === 'Configurações') {
        const [prefs, sizes, token, transfers, invitations] = await Promise.all([this.api.request('notification-preferences'),this.api.request('preferences/size-labels'),this.api.request('mcp-token'),this.api.request('owner-transfers'),this.api.request('item-invitations')]);
        this.settings.set({...prefs.preferences,...token}); this.sizeLabels=(sizes.labels ?? []).join(', '); this.transfers.set(transfers.requests ?? []); this.invitations.set(invitations.invitations ?? []);
      } else {
        const resource: Record<string,[string,string,string]> = { Projetos:['projects','projects','project'],Produtos:['products','products','product'],Processos:['processes','processes','process'],Listas:['lists','lists','list'],Lembretes:['reminders','reminders','reminder'],Séries:['recurrence-series','series','series'],Templates:['templates','templates','template'] };
        const entry=resource[section]; if (entry) rows=this.mark((await this.api.request(entry[0]))[entry[1]],entry[2]);
      }
      if (version===this.requestVersion) this.rows.set(rows);
    } catch(e) { this.fail(e); } finally { if (version===this.requestVersion) this.loading.set(false); }
  }
  mark(rows: Item[] | undefined, kind:string):Item[] { return (rows ?? []).map(row=>({...row,kind})); }
  contextRows(data: Record<string,any>) { return ['organizations','departments','teams','projects','products','processes','tasks'].flatMap(key=>this.mark(data[key],({organizations:'organization',departments:'department',teams:'team',projects:'project',products:'product',processes:'process',tasks:'task'} as Record<string,string>)[key])); }
  fail(e:unknown) { this.error.set(e instanceof Error ? e.message : 'Não foi possível concluir a operação.'); }
  async run(action:()=>Promise<void>) { if(this.saving()) return; this.saving.set(true);this.error.set('');try { await action(); } catch(e) { this.fail(e); } finally { this.saving.set(false); } }
  async authenticate() { await this.run(async()=>{
    const data=await this.api.request('auth/login','POST',{email:this.loginEmail,password:this.loginPassword});
    this.loginPassword='';this.user.set(data.user);await this.bootstrap();
  }); }
  async createUser() { await this.run(async()=>{
    await this.api.request('auth/users','POST',{displayName:this.newUserDisplayName,email:this.newUserEmail,password:this.newUserPassword});
    this.newUserDisplayName='';this.newUserEmail='';this.newUserPassword='';this.notice.set('Usuário criado. Informe a senha inicial à pessoa.');
  }); }
  async changePassword() { await this.run(async()=>{
    await this.api.request('auth/password','PATCH',{currentPassword:this.currentPassword,newPassword:this.newPassword});
    this.currentPassword='';this.newPassword='';this.notice.set('Senha alterada.');
  }); }
  async logout() { await this.run(async()=>{await this.api.request('auth/logout','POST',{});this.user.set(null);this.ngOnDestroy();}); }
  localDate(date:Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
  title(row:Item) { return row.title ?? row.name ?? ''; }
  byStatus(status:string) { return this.visible().filter(r=>r['status']===status); }
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
      Object.assign(payload,{dueDate:d['dueDate']||null,tags:String(d['tags']??'').split(',').map(t=>t.trim()).filter(Boolean)});
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
  }); }
  async open(row:Item) {
    if(['organization','department','team'].includes(row.kind!)) { await this.navigate('Estrutura',row);return; }
    if(row.kind==='list'){await this.navigate('Listas',row);return;}
    if(row.kind==='template'){await this.prepareTemplate(row);return;}
    this.selected.set(row);this.tab.set('Detalhes');this.detail.set({});await this.loadDetail();
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
    const row=this.selected();if(!row)return;
    try {
      const kind=row.kind!,id=row.id;const detail:Record<string,any>={};let children:Item[]=[];
      if(kind==='task') {
        const [checks,subtasks,comments,audit]=await Promise.all([this.api.request(`tasks/${id}/checklist`),this.api.request(`tasks/${id}/subtasks`),this.api.request(`tasks/${id}/comments`),this.api.request(`tasks/${id}/audit`)]);
        Object.assign(detail,{...checks,...comments,...audit});children=this.mark(subtasks.subtasks,'task');
      } else if(['project','front','product','process','phase'].includes(kind)) {
        children=this.mark((await this.api.request(`task-containers/${kind}/${id}`)).tasks,'task');
        if(kind==='project') children.push(...this.mark((await this.api.request(`projects/${id}/fronts`)).fronts,'front'));
        if(kind==='process') children.push(...this.mark((await this.api.request(`processes/${id}/phases`)).phases,'phase'));
        if(['process','phase'].includes(kind)) Object.assign(detail,{graph:await this.api.request(`dependencies?containerType=${kind}&containerId=${id}`)});
        detail['progress']=await this.api.request(`work-progress/${kind}/${id}`);
      }
      if(kind === 'organization') {
        const [members, audit] = await Promise.all([this.api.request(`organizations/${id}/members`), this.api.request(`organizations/${id}/audit`)]);
        detail['access'] = { owner: members.owner, assignments: members.members ?? [], canManage: members.capabilities?.canAddMembers ?? false };
        detail['events'] = audit.events ?? [];
      } else if(!['reminder','series'].includes(kind)) {
        detail['access']=await this.api.request(`item-roles?itemType=${kind}&itemId=${id}`);
        detail['transfer']=await this.api.request(`owner-transfers?itemType=${kind}&itemId=${id}`);
      }
      this.children.set(children);this.detail.set(detail);
    } catch(e){this.fail(e);}
  }
  async patch(row:Item,payload:Record<string,any>) {
    try { const data=await this.api.request(`${paths[row.kind!]}/${row.id}`,'PATCH',payload);if(this.selected()?.id===row.id)this.selected.set({...row,...data[row.kind!]});await this.reloadNavigation();await this.load();if(this.selected())await this.loadDetail(); }
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
    await this.run(async()=>{await this.api.request(row.kind==='reminder'?'reminders':`${paths[row.kind!]}/${row.id}`,'DELETE',row.kind==='reminder'?{id:row.id}:{});this.selected.set(null);await this.reloadNavigation();await this.load();});
  }
  async restore(row:Item) {await this.run(async()=>{await this.api.request('recycle-bin/tasks','POST',{id:row.id});await this.reloadNavigation();await this.load();});}
  async approve(decision:string) {const row=this.selected()!;await this.run(async()=>{await this.api.request('approvals','POST',{subjectType:row.kind,subjectId:row.id,decision});this.selected.set(null);await this.load();});}
  async addChecklist() {await this.run(async()=>{await this.api.request(`tasks/${this.selected()!.id}/checklist`,'POST',{title:this.newText});this.newText='';await this.loadDetail();});}
  async toggleCheck(item:Item) {await this.run(async()=>{await this.api.request(`tasks/${this.selected()!.id}/checklist/${item.id}`,'PATCH',{completed:!item['completed']});await this.loadDetail();});}
  async deleteCheck(item:Item) {await this.run(async()=>{await this.api.request(`tasks/${this.selected()!.id}/checklist/${item.id}`,'DELETE',{});await this.loadDetail();});}
  async comment() {await this.run(async()=>{await this.api.request(`tasks/${this.selected()!.id}/comments`,'POST',{body:this.newText});this.newText='';await this.loadDetail();});}
  async deleteComment(item:Item) {await this.run(async()=>{await this.api.request(`tasks/${this.selected()!.id}/comments/${item.id}`,'DELETE',{});await this.loadDetail();});}
  async invite() {const row=this.selected()??this.scope();if(!row)return;await this.run(async()=>{if(row.kind==='organization')await this.api.request(`organizations/${row.id}/members`,'POST',{email:this.inviteEmail,role:this.inviteRole});else await this.api.request('item-roles','POST',{itemType:row.kind,itemId:row.id,email:this.inviteEmail,role:this.inviteRole});this.inviteEmail='';await this.loadDetail();});}
  async revoke(assignment:Item) {const row=this.selected()!;await this.run(async()=>{if(row.kind==='organization')await this.api.request(`organizations/${row.id}/members/${assignment.id}`,'PATCH',{status:'removed'});else await this.api.request('item-roles','DELETE',{itemType:row.kind,itemId:row.id,assignmentId:assignment.id});await this.loadDetail();});}
  async transferOwner() {const row=this.selected()!;if(!await this.ask('Confirmar transferência de Owner?',[{value:'yes',label:'Solicitar transferência'}]))return;await this.run(async()=>{await this.api.request('owner-transfers','POST',{itemType:row.kind,itemId:row.id,proposedOwnerUserId:this.transferTarget,mode:this.transferMode});await this.loadDetail();});}
  async respondTransfer(row:Item,action:string) {await this.run(async()=>{await this.api.request('owner-transfers','PATCH',{id:row.id,action});await this.load();});}
  async addDependency() {await this.run(async()=>{await this.api.request('dependencies','POST',{predecessorType:this.dependencyKind,predecessorId:this.predecessor,successorType:this.dependencyKind,successorId:this.successor});await this.loadDetail();});}
  async removeDependency(edge:Item) {await this.run(async()=>{await this.api.request(`dependencies/${edge.id}`,'DELETE',{});await this.loadDetail();});}
  graphTitle(id:string) {return this.title([...(this.detail()['graph']?.tasks??[]),...(this.detail()['graph']?.phases??[])].find((r:Item)=>r.id===id)??{id,title:id});}
  async saveTemplate() {const row=this.selected()!;await this.run(async()=>{await this.api.request('templates','POST',{sourceType:row.kind,sourceId:row.id,name:this.templateName||this.title(row)});this.notice.set('Template salvo com a estrutura de filhos.');this.templateName='';});}
  async prepareTemplate(row:Item) {await this.run(async()=>{const data=await this.api.request(`templates/${row.id}/instantiate`);this.templateSetup.set({...data.setup,id:row.id});this.templateTitle=data.setup.title;this.templateTarget='0';});}
  async instantiate() {const setup=this.templateSetup()!;await this.run(async()=>{const target=setup['targets'][Number(this.templateTarget)];await this.api.request(`templates/${setup.id}/instantiate`,'POST',{title:this.templateTitle,parentType:target.type,parentId:target.id,startDate:this.templateDate||null});this.templateSetup.set(null);this.notice.set('Estrutura criada a partir do template.');await this.reloadNavigation();await this.load();});}
  async copyList(row:Item) {await this.run(async()=>{await this.api.request('lists','POST',{copyFromId:row.id});await this.reloadNavigation();await this.load();});}
  async addToList() {await this.run(async()=>{await this.api.request(`lists/${this.scope()!.id}/tasks`,'POST',{taskId:this.listTaskId});await this.load();});}
  async removeFromList(row:Item) {await this.run(async()=>{await this.api.request(`lists/${this.scope()!.id}/tasks/${row.id}`,'DELETE',{});await this.load();});}
  async toggleSeries(row:Item) {await this.run(async()=>{await this.api.request(`recurrence-series/${row.id}`,'PATCH',{active:!row['active']});await this.load();});}
  async readNotification(row:Item) {await this.run(async()=>{await this.api.request('notifications','PATCH',{id:row.id,read:true});await this.poll();const task=this.tasks().find(t=>t.id===row['taskId']);if(task)await this.open(task);});}
  async saveSettings() {await this.run(async()=>{const settings=this.settings();const prefs:Record<string,any>={};for(const key of ['dueSoonEnabled','overdueEnabled','scheduledEnabled','reminderEnabled','timeZone'])if(key in settings)prefs[key]=settings[key];await this.api.request('notification-preferences','PATCH',prefs);await this.api.request('preferences/size-labels','PATCH',{labels:this.sizeLabels.split(',').map(v=>v.trim())});this.notice.set('Preferências salvas.');});}
  async generateToken() {if(!await this.ask('Gerar um token invalida o anterior. Continuar?',[{value:'yes',label:'Gerar token'}]))return;await this.run(async()=>{const data=await this.api.request('mcp-token','POST',{});this.token.set(data.secret);});}
  async revokeToken(){await this.run(async()=>{await this.api.request('mcp-token','DELETE',{});this.token.set('');this.notice.set('Token revogado.');});}
  async exportData(){await this.run(async()=>{const data=await this.api.request('privacy/export');const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='taskando-export.json';a.click();URL.revokeObjectURL(url);});}
  clearReport() { this.reportStart='';this.reportEnd='';this.reportStatus='';this.reportType='';this.reportImportance='';this.reportUrgency=''; }
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
