import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiError, ApiService, ClosedWorkState, Item, closedWorkStates } from '../api.service';
import { DependencyGraph, DependencyGraphComponent } from '../shared/dependency-graph/dependency-graph.component';
import { DrawerService } from '../shared/drawer.service';
import { BreadcrumbCrumb, entityBreadcrumbs } from '../shared/breadcrumb';
import { DateBrPipe } from '../shared/date-br.pipe';

type LoadState = 'loading' | 'ready' | 'forbidden' | 'not-found' | 'temporary-error';
type Progress = { percentage: number; completed: number; total: number; excluded: number; visible: number };

@Component({
  selector: 'app-phase-view',
  standalone: true,
  imports: [CommonModule, FormsModule, DependencyGraphComponent, DateBrPipe],
  templateUrl: './phase-view.component.html',
})
export class PhaseViewComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly drawer = inject(DrawerService);
  private routeSubscription?: Subscription;
  private requestVersion = 0;
  phaseId = '';

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
  phase = signal<Item | null>(null);
  progress = signal<Progress | null>(null);
  graph = signal<DependencyGraph>({ tasks: [], phases: [], edges: [] });
  tasks = signal<Item[]>([]);
  includeClosed = signal<ClosedWorkState[]>([]);
  search = signal('');
  temporal = signal('all');

  breadcrumbs = computed(() => entityBreadcrumbs(this.phase()));
  navigateCrumb(crumb: BreadcrumbCrumb) { if (crumb.route) void this.router.navigate(crumb.route); }

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

  constructor() {
    effect(() => {
      const refresh = this.drawer.refreshNotification();
      if (refresh > 0) {
        untracked(() => {
          if (this.phaseId && this.state() === 'ready') {
            void this.load();
          }
        });
      }
    });
  }

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      const id = params.get('id') ?? '';
      if (!id) {
        this.state.set('not-found');
        this.errorMessage.set('Fase não informada.');
        return;
      }
      this.phaseId = id;
      void this.load();
    });
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  async load(): Promise<void> {
    const version = ++this.requestVersion;
    this.state.set('loading');
    this.errorMessage.set('');

    try {
      const [phaseData, containerData, graphData, progressData] = await Promise.all([
        this.api.request(`phases/${this.phaseId}`),
        this.api.requestWithClosed(`task-containers/phase/${this.phaseId}`, this.includeClosed()),
        this.api.request(`dependencies?containerType=phase&containerId=${this.phaseId}`),
        this.api.request(`work-progress/phase/${this.phaseId}`).catch(() => null),
      ]);

      if (version !== this.requestVersion) return;

      const phase = phaseData.phase ?? phaseData;
      this.phase.set(phase);
      this.tasks.set(containerData.tasks ?? []);
      this.graph.set(graphData ?? { tasks: [], phases: [], edges: [] });
      if (progressData?.progress) {
        this.progress.set(progressData.progress);
      } else {
        const total = (containerData.tasks ?? []).length;
        const completed = (containerData.tasks ?? []).filter((t: Item) => t['status'] === 'completed').length;
        this.progress.set({
          percentage: total ? Math.round((completed / total) * 100) : 0,
          completed,
          total,
          excluded: 0,
          visible: total,
        });
      }
      this.state.set('ready');
    } catch (error) {
      if (version !== this.requestVersion) return;
      if (error instanceof ApiError) {
        if (error.status === 404) {
          this.state.set('not-found');
          this.errorMessage.set('Fase não encontrada.');
          return;
        }
        if (error.status === 403) {
          this.state.set('forbidden');
          this.errorMessage.set('Você não tem acesso a esta fase.');
          return;
        }
      }
      this.state.set('temporary-error');
      this.errorMessage.set(error instanceof Error ? error.message : 'Não foi possível carregar os detalhes da fase.');
    }
  }

  async openTask(task: Item): Promise<void> {
    await this.router.navigate(['/tarefas', task.id]);
  }

  back(): void {
    const processId = this.phase()?.['processId'] ?? this.phase()?.['parentId'];
    if (processId) {
      void this.router.navigate(['/processos', processId]);
    } else {
      void this.router.navigate(['/processos']);
    }
  }

  isIncluded(state: ClosedWorkState): boolean {
    return this.includeClosed().includes(state);
  }

  async toggleClosed(state: ClosedWorkState, checked: boolean): Promise<void> {
    const current = new Set(this.includeClosed());
    if (checked) current.add(state);
    else current.delete(state);
    this.includeClosed.set(closedWorkStates.filter(s => current.has(s)));
    await this.load();
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
}
