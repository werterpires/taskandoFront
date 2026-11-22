import { BreakpointObserver } from '@angular/cdk/layout';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { CommonModule, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { ClosedWorkState, Item, closedWorkStates } from '../../api.service';
import { DateBrPipe } from '../../shared/date-br.pipe';
import {
  ITEM_KIND_LABELS,
  PRIORITY_LEVELS,
  PRIORITY_LEVEL_LABELS,
  STATUS_LABELS,
  TASK_TYPE_LABELS,
  WORK_STATUSES,
  computeCalendarDays,
  localDateString,
} from '../../shared/work-labels';
import { orderTasks } from '../../task-order';

const HOME_GROUP_DEFINITIONS = [
  { kind: 'organization', label: 'Organizações' },
  { kind: 'department', label: 'Departamentos' },
  { kind: 'team', label: 'Times' },
  { kind: 'project', label: 'Projetos' },
  { kind: 'product', label: 'Produtos' },
  { kind: 'process', label: 'Processos' },
  { kind: 'task', label: 'Tarefas' },
] as const;

@Component({
  selector: 'app-work-list-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, NgTemplateOutlet, ScrollingModule, DateBrPipe],
  templateUrl: './work-list-view.component.html',
})
export class WorkListViewComponent {
  private readonly breakpointObserver = inject(BreakpointObserver);
  private readonly isMobile = toSignal(
    this.breakpointObserver.observe('(max-width: 900px)').pipe(map(state => state.matches)),
    {
      initialValue:
        typeof window !== 'undefined' && typeof window.matchMedia === 'function'
          ? window.matchMedia('(max-width: 900px)').matches
          : false,
    },
  );
  readonly section = input.required<string>();
  readonly scope = input<Item | null>(null);
  readonly rows = input<Item[]>([]);
  readonly tasks = input<Item[]>([]);
  readonly loading = input<boolean>(false);
  readonly saving = input<boolean>(false);
  readonly month = input.required<Date>();
  readonly supportsClosedFilters = input<boolean>(false);
  readonly includeClosed = input<readonly ClosedWorkState[]>([]);

  readonly search = model<string>('');

  readonly openItem = output<Item>();
  readonly statusChange = output<{ item: Item; status: string }>();
  readonly togglePin = output<Item>();
  readonly restoreItem = output<Item>();
  readonly removeFromList = output<Item>();
  readonly copyList = output<Item>();
  readonly toggleSeries = output<Item>();
  readonly toggleClosedState = output<{ state: ClosedWorkState; checked: boolean }>();
  readonly changeMonth = output<number>();
  readonly createItem = output<{ kind: string; parent?: Item }>();
  readonly navigateSection = output<string>();
  readonly addTaskToList = output<string>();
  readonly editScope = output<Item>();
  readonly removeScope = output<Item>();

  readonly view = signal<'list' | 'kanban'>('list');
  readonly temporal = signal<string>('all');
  readonly listTaskId = linkedSignal(() => {
    this.scope()?.id;
    return '';
  });

  readonly statuses = STATUS_LABELS;
  readonly types = TASK_TYPE_LABELS;
  readonly labels = ITEM_KIND_LABELS;
  readonly workStatuses = WORK_STATUSES;
  readonly levels = PRIORITY_LEVELS;
  readonly levelLabels = PRIORITY_LEVEL_LABELS;
  readonly closedStates = closedWorkStates;
  readonly closedLabels: Record<ClosedWorkState, string> = {
    completed: 'Concluídos',
    cancelled: 'Cancelados',
    archived: 'Arquivados',
  };

  readonly taskCollection = computed(
    () => this.section() === 'Minhas tarefas' || this.scope()?.kind === 'list',
  );

  readonly kanbanStatuses = computed(() =>
    this.workStatuses.filter(
      status =>
        !closedWorkStates.includes(status as ClosedWorkState) ||
        this.includeClosed().includes(status as ClosedWorkState),
    ),
  );

  readonly visible = computed(() => {
    const query = this.search().toLocaleLowerCase();
    const temporalFilter = this.temporal();
    const isTaskCollection = this.taskCollection();
    const today = localDateString(new Date());

    return this.rows().filter(row => {
      if (query && !`${row.title ?? row.name} ${row['description'] ?? ''}`.toLocaleLowerCase().includes(query)) {
        return false;
      }
      if (row.kind === 'task' && isTaskCollection) {
        const date = row['dueDate'] ?? row['dateAt'] ?? row['startAt']?.slice(0, 10);
        if (temporalFilter === 'today' && date !== today && !row['pinnedForToday']) return false;
        if (temporalFilter === 'overdue' && (!date || date >= today)) return false;
        if (temporalFilter === 'no_due' && date) return false;
      }
      return true;
    });
  });

  readonly orderedVisible = computed(() => {
    const rows = this.visible();
    if (this.section() === 'Minhas tarefas') return orderTasks(rows);
    if (this.section() === 'Cíclicas') {
      return [...rows.filter(row => row['released']), ...rows.filter(row => !row['released'])];
    }
    return rows;
  });

  readonly byStatus = computed(
    () =>
      Object.fromEntries(
        this.workStatuses.map(status => {
          const rows = this.visible().filter(row => row['status'] === status);
          return [status, this.section() === 'Minhas tarefas' ? orderTasks(rows) : rows];
        }),
      ) as Record<string, Item[]>,
  );

  readonly homeGroups = computed(() => {
    if (this.section() !== 'Início') return [];
    const visibleRows = this.visible();
    return HOME_GROUP_DEFINITIONS.map(group => ({
      ...group,
      rows: visibleRows.filter(row => row.kind === group.kind),
    })).filter(group => group.rows.length > 0);
  });

  readonly calendarDays = computed(() => computeCalendarDays(this.month()));

  readonly listItemSize = computed(() => {
    if (!this.isMobile()) return 64;
    if (this.section() === 'Cíclicas') return 140;
    if (this.section() === 'Minhas tarefas') return 84;
    return 64;
  });

  readonly trackById = (_index: number, item: Item): string => item.id;

  title(row: Item): string {
    return row.title ?? row.name ?? '';
  }

  isClosedIncluded(state: ClosedWorkState): boolean {
    return this.includeClosed().includes(state);
  }

  inCell(importance: string, urgency: string): Item[] {
    return this.visible().filter(r => r['importance'] === importance && r['urgency'] === urgency);
  }

  onDay(day: string): Item[] {
    return this.rows().filter(
      r =>
        r['taskType'] !== 'reminder' &&
        (r['dateAt'] === day ||
          r['dueDate'] === day ||
          r['startAt']?.slice(0, 10) === day ||
          (r['taskType'] === 'event' && r['startAt']?.slice(0, 10) <= day && r['endAt']?.slice(0, 10) >= day)),
    );
  }

  drag(event: DragEvent, row: Item): void {
    event.dataTransfer?.setData('text/plain', row.id);
  }

  drop(event: DragEvent, status: string): void {
    event.preventDefault();
    const id = event.dataTransfer?.getData('text/plain');
    const task = this.rows().find(r => r.id === id);
    if (task) {
      this.statusChange.emit({ item: task, status });
    }
  }
}
