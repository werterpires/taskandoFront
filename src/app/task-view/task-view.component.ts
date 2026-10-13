import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiError, ApiService, Item } from '../api.service';
import { DrawerService } from '../shared/drawer.service';
import { BreadcrumbCrumb, entityBreadcrumbs } from '../shared/breadcrumb';

type LoadState = 'loading' | 'ready' | 'forbidden' | 'not-found' | 'temporary-error';

export interface ChecklistItem {
  id: string;
  title: string;
  completed: boolean;
  position?: number;
}

export interface TaskComment {
  id: string;
  body: string;
  authorName?: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  summary: string;
  actorName?: string;
  createdAt: string;
}

@Component({
  selector: 'app-task-view',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './task-view.component.html',
})
export class TaskViewComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly drawer = inject(DrawerService);
  private routeSubscription?: Subscription;
  private requestVersion = 0;
  taskId = '';

  readonly statusLabels: Record<string, string> = {
    planned: 'Planejado',
    todo: 'A fazer',
    in_progress: 'Em execução',
    awaiting_approval: 'Aguardando aprovação',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    archived: 'Arquivado',
  };

  readonly statuses = ['todo', 'in_progress', 'completed', 'planned', 'awaiting_approval', 'cancelled', 'archived'];

  readonly sizeLabels: Record<string, string> = {
    xs: 'Muito pequeno (XS)',
    s: 'Pequeno (S)',
    m: 'Médio (M)',
    l: 'Grande (L)',
    xl: 'Muito grande (XL)',
  };

  readonly priorityLabels: Record<string, string> = {
    low: 'Baixa',
    medium: 'Média',
    high: 'Alta',
  };

  state = signal<LoadState>('loading');
  errorMessage = signal('');
  task = signal<Item | null>(null);
  checklist = signal<ChecklistItem[]>([]);
  subtasks = signal<Item[]>([]);
  comments = signal<TaskComment[]>([]);
  audit = signal<AuditEvent[]>([]);
  activeTab = signal<'checklist' | 'subtasks' | 'comments' | 'audit'>('checklist');
  saving = signal(false);

  breadcrumbs = computed(() => entityBreadcrumbs(this.task()));
  navigateCrumb(crumb: BreadcrumbCrumb) { if (crumb.route) void this.router.navigate(crumb.route); }

  newCommentText = '';
  newChecklistText = '';
  newSubtaskTitle = '';

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      const id = params.get('id') ?? '';
      if (!id) {
        this.state.set('not-found');
        this.errorMessage.set('Tarefa não informada.');
        return;
      }
      this.taskId = id;
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
      const [taskData, checklistData, subtasksData, commentsData, auditData] = await Promise.all([
        this.api.request(`tasks/${this.taskId}`),
        this.api.request(`tasks/${this.taskId}/checklist`).catch(() => ({ items: [] })),
        this.api.requestWithClosed(`tasks/${this.taskId}/subtasks`, ['completed', 'cancelled', 'archived']).catch(() => ({ subtasks: [] })),
        this.api.request(`tasks/${this.taskId}/comments`).catch(() => ({ comments: [] })),
        this.api.request(`tasks/${this.taskId}/audit`).catch(() => ({ events: [] })),
      ]);

      if (version !== this.requestVersion) return;

      const task = taskData.task ?? taskData;
      this.task.set(task);
      this.checklist.set(checklistData.items ?? checklistData.checklist ?? []);
      this.subtasks.set(subtasksData.subtasks ?? []);
      this.comments.set(commentsData.comments ?? []);
      this.audit.set(auditData.events ?? auditData.audit ?? []);
      this.state.set('ready');
    } catch (error) {
      if (version !== this.requestVersion) return;
      if (error instanceof ApiError) {
        if (error.status === 404) {
          this.state.set('not-found');
          this.errorMessage.set('Tarefa não encontrada.');
          return;
        }
        if (error.status === 403) {
          this.state.set('forbidden');
          this.errorMessage.set('Você não tem acesso a esta tarefa.');
          return;
        }
      }
      this.state.set('temporary-error');
      this.errorMessage.set(error instanceof Error ? error.message : 'Não foi possível carregar os detalhes da tarefa.');
    }
  }

  async updateStatus(status: string): Promise<void> {
    if (this.saving() || !this.task()) return;
    this.saving.set(true);
    try {
      const data = await this.api.request(`tasks/${this.taskId}`, 'PATCH', { status });
      const updated = data.task ?? { ...this.task()!, status };
      this.task.set(updated);
      this.drawer.notifyMutation(updated, 'status');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Falha ao atualizar status.');
    } finally {
      this.saving.set(false);
    }
  }

  async togglePin(): Promise<void> {
    const current = this.task();
    if (this.saving() || !current) return;
    this.saving.set(true);
    const pinnedForToday = !current['pinnedForToday'];
    try {
      const data = await this.api.request(`tasks/${this.taskId}`, 'PATCH', { pinnedForToday });
      const updated = data.task ?? { ...current, pinnedForToday };
      this.task.set(updated);
      this.drawer.notifyMutation(updated, 'pin');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Falha ao fixar tarefa.');
    } finally {
      this.saving.set(false);
    }
  }

  async addChecklistItem(): Promise<void> {
    const title = this.newChecklistText.trim();
    if (!title || this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.request(`tasks/${this.taskId}/checklist`, 'POST', { title });
      this.newChecklistText = '';
      const refreshed = await this.api.request(`tasks/${this.taskId}/checklist`);
      this.checklist.set(refreshed.items ?? refreshed.checklist ?? []);
      this.drawer.notifyMutation(this.task() ?? undefined, 'checklist');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Falha ao adicionar item.');
    } finally {
      this.saving.set(false);
    }
  }

  async toggleChecklistItem(item: ChecklistItem): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.request(`tasks/${this.taskId}/checklist/${item.id}`, 'PATCH', { completed: !item.completed });
      this.checklist.update(list =>
        list.map(i => (i.id === item.id ? { ...i, completed: !item.completed } : i)),
      );
      this.drawer.notifyMutation(this.task() ?? undefined, 'checklist');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Falha ao atualizar item.');
    } finally {
      this.saving.set(false);
    }
  }

  async deleteChecklistItem(item: ChecklistItem): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.request(`tasks/${this.taskId}/checklist/${item.id}`, 'DELETE');
      this.checklist.update(list => list.filter(i => i.id !== item.id));
      this.drawer.notifyMutation(this.task() ?? undefined, 'checklist');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Falha ao remover item.');
    } finally {
      this.saving.set(false);
    }
  }

  async addComment(): Promise<void> {
    const body = this.newCommentText.trim();
    if (!body || this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.request(`tasks/${this.taskId}/comments`, 'POST', { body });
      this.newCommentText = '';
      const refreshed = await this.api.request(`tasks/${this.taskId}/comments`);
      this.comments.set(refreshed.comments ?? []);
      this.drawer.notifyMutation(this.task() ?? undefined, 'comment');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Falha ao enviar comentário.');
    } finally {
      this.saving.set(false);
    }
  }

  async addSubtask(): Promise<void> {
    const title = this.newSubtaskTitle.trim();
    if (!title || this.saving()) return;
    this.saving.set(true);
    try {
      await this.api.request(`tasks/${this.taskId}/subtasks`, 'POST', { title, taskType: 'simple' });
      this.newSubtaskTitle = '';
      const refreshed = await this.api.requestWithClosed(`tasks/${this.taskId}/subtasks`, ['completed', 'cancelled', 'archived']);
      this.subtasks.set(refreshed.subtasks ?? []);
      this.drawer.notifyMutation(this.task() ?? undefined, 'subtask');
    } catch (error) {
      this.errorMessage.set(error instanceof Error ? error.message : 'Falha ao criar subtarefa.');
    } finally {
      this.saving.set(false);
    }
  }

  async openSubtask(subtask: Item): Promise<void> {
    await this.router.navigate(['/tarefas', subtask.id]);
  }

  back(): void {
    const task = this.task();
    const parentType = task?.['parentType'];
    const parentId = task?.['parentId'];

    if (parentType === 'phase' && parentId) {
      void this.router.navigate(['/fases', parentId]);
      return;
    }
    if (parentType === 'process' && parentId) {
      void this.router.navigate(['/processos', parentId]);
      return;
    }
    if (task?.['parentTaskId']) {
      void this.router.navigate(['/tarefas', task['parentTaskId']]);
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
    } else {
      void this.router.navigate(['/inicio']);
    }
  }

  backLabel(): string {
    const task = this.task();
    const parentType = task?.['parentType'];
    if (parentType === 'phase') return '← Voltar à Fase';
    if (parentType === 'process') return '← Voltar ao Processo';
    if (task?.['parentTaskId']) return '← Voltar à Tarefa Mãe';
    return '← Voltar';
  }
}
