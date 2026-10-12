import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiError, ApiService, ClosedWorkState, Item, closedWorkStates } from '../api.service';
import { DependencyGraph, DependencyGraphComponent } from '../shared/dependency-graph/dependency-graph.component';
import { DrawerService } from '../shared/drawer.service';
import { BreadcrumbCrumb, entityBreadcrumbs } from '../shared/breadcrumb';

type LoadState = 'loading' | 'ready' | 'forbidden' | 'not-found' | 'temporary-error';
type Progress = { percentage: number; completed: number; total: number; excluded: number; visible: number };

@Component({
  selector: 'app-process-view',
  standalone: true,
  imports: [CommonModule, FormsModule, DependencyGraphComponent],
  templateUrl: './process-view.component.html',
})
export class ProcessViewComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly drawer = inject(DrawerService);
  private routeSubscription?: Subscription;
  private requestVersion = 0;
  private processId = '';

  readonly closedStates = closedWorkStates;
  readonly closedLabels: Record<ClosedWorkState, string> = {
    completed: 'Concluídos',
    cancelled: 'Cancelados',
    archived: 'Arquivados',
  };
  readonly statusLabels: Record<string, string> = {
    planned: 'Planejado',
    todo: 'A fazer',
    in_progress: 'Em execução',
    awaiting_approval: 'Aguardando aprovação',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    archived: 'Arquivado',
  };
  state = signal<LoadState>('loading');
  errorMessage = signal('');
  process = signal<Item | null>(null);
  progress = signal<Progress | null>(null);
  graph = signal<DependencyGraph>({ tasks: [], phases: [], edges: [] });
  phases = signal<Item[]>([]);
  tasks = signal<Item[]>([]);
  capabilities = signal<string[]>([]);
  includeClosed = signal<ClosedWorkState[]>([]);
  search = signal('');
  temporal = signal('all');

  breadcrumbs = computed(() => entityBreadcrumbs(this.process()));
  navigateCrumb(crumb: BreadcrumbCrumb) { if (crumb.route) void this.router.navigate(crumb.route); }

  readOnly = computed(() => {
    const capabilities = this.capabilities();
    return !capabilities.some(capability => ['edit', 'interact', 'add_children'].includes(capability));
  });
  visiblePhases = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    return this.phases().filter(phase => !query || this.matchesSearch(phase, query));
  });
  visibleTasks = computed(() => {
    const query = this.search().trim().toLocaleLowerCase();
    const today = this.localDate(new Date());
    return this.tasks().filter(task => {
      if (query && !this.matchesSearch(task, query)) return false;
      const date = task['dueDate'] ?? task['dateAt'] ?? task['startAt']?.slice(0, 10);
      if (this.temporal() === 'today') return date === today || Boolean(task['pinnedForToday']);
      if (this.temporal() === 'overdue') return Boolean(date && date < today);
      if (this.temporal() === 'no_due') return !date;
      return true;
    });
  });
  hasVisibleContent = computed(() => this.visiblePhases().length > 0 || this.visibleTasks().length > 0);
  graphNodes = computed(() => [...this.graph().phases, ...this.graph().tasks]);

  constructor() {
    effect(() => {
      const refresh = this.drawer.refreshNotification();
      if (refresh > 0) {
        untracked(() => {
          if (this.processId && this.state() === 'ready') {
            void this.load();
          }
        });
      }
    });
  }

  async openPhase(phase: Item): Promise<void> {
    await this.router.navigate(['/fases', phase.id]);
  }

  async openTask(task: Item): Promise<void> {
    await this.router.navigate(['/tarefas', task.id]);
  }

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      const id = params.get('id') ?? '';
      this.processId = id;
      this.includeClosed.set([]);
      this.search.set('');
      this.temporal.set('all');
      void this.load();
    });
  }

  ngOnDestroy(): void {
    this.requestVersion += 1;
    this.routeSubscription?.unsubscribe();
  }

  async load(): Promise<void> {
    const id = this.processId;
    if (!id) {
      this.state.set('not-found');
      return;
    }
    const version = ++this.requestVersion;
    const included = this.includeClosed();
    this.state.set('loading');
    this.errorMessage.set('');
    try {
      const [processData, progress, graph, phases, tasks, access] = await Promise.all([
        this.api.request(`processes/${id}`),
        this.api.request(`work-progress/process/${id}`),
        this.api.request(`dependencies?containerType=process&containerId=${encodeURIComponent(id)}`),
        this.api.requestWithClosed(`processes/${id}/phases`, included),
        this.api.requestWithClosed(`task-containers/process/${id}`, included),
        this.api.request(`item-roles?itemType=process&itemId=${encodeURIComponent(id)}`),
      ]);
      if (version !== this.requestVersion) return;
      this.process.set({ ...processData.process, kind: 'process' });
      this.progress.set(progress);
      this.graph.set({ tasks: graph.tasks ?? [], phases: graph.phases ?? [], edges: graph.edges ?? [] });
      this.phases.set((phases.phases ?? []).map((phase: Item) => ({ ...phase, kind: 'phase' })));
      this.tasks.set((tasks.tasks ?? []).map((task: Item) => ({ ...task, kind: 'task' })));
      this.capabilities.set(access.capabilities ?? []);
      this.state.set('ready');
    } catch (error) {
      if (version !== this.requestVersion) return;
      this.process.set(null);
      this.progress.set(null);
      this.graph.set({ tasks: [], phases: [], edges: [] });
      this.phases.set([]);
      this.tasks.set([]);
      this.setErrorState(error);
    }
  }

  async toggleClosed(state: ClosedWorkState, checked: boolean): Promise<void> {
    const selected = new Set(this.includeClosed());
    if (checked) selected.add(state); else selected.delete(state);
    this.includeClosed.set(closedWorkStates.filter(value => selected.has(value)));
    await this.load();
  }

  back(): void {
    void this.router.navigate(['/processos']);
  }

  isIncluded(state: ClosedWorkState): boolean {
    return this.includeClosed().includes(state);
  }

  title(item: Item): string {
    return item.title ?? item.name ?? '';
  }

  private matchesSearch(item: Item, query: string): boolean {
    return `${this.title(item)} ${item['description'] ?? ''}`.toLocaleLowerCase().includes(query);
  }

  private localDate(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private setErrorState(error: unknown): void {
    if (error instanceof ApiError && error.status === 403) {
      this.state.set('forbidden');
      this.errorMessage.set('Você não tem permissão para consultar este processo.');
      return;
    }
    if (error instanceof ApiError && error.status === 404) {
      this.state.set('not-found');
      this.errorMessage.set('Este processo não foi encontrado ou não está mais disponível.');
      return;
    }
    this.state.set('temporary-error');
    this.errorMessage.set(error instanceof Error ? error.message : 'Não foi possível carregar o processo agora.');
  }
}
