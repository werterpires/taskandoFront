import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiError, ApiService } from '../../api.service';
import { NavigationItem, navigation } from '../../navigation';
import { DrawerService } from '../drawer.service';
import { ItemEditorService } from '../item-editor-modal/item-editor.service';
import { ToastService } from '../toast/toast.service';
import { WorkFilterService } from '../work-filter.service';
import { CommandPaletteService } from './command-palette.service';

export const SEARCH_DEBOUNCE_MS = 220;
const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_LENGTH = 160;

export type SearchResultType =
  | 'organization'
  | 'department'
  | 'team'
  | 'project'
  | 'front'
  | 'product'
  | 'process'
  | 'phase'
  | 'task'
  | 'list';

export interface SearchResultParentCrumb {
  type: Exclude<SearchResultType, 'list'>;
  id: string;
  name: string;
}

export interface SearchResultItem {
  id: string;
  type: SearchResultType;
  title: string;
  description: string;
  status: string | null;
  taskType: string | null;
  dueDate: string | null;
  organizationId: string | null;
  parentTaskId: string | null;
  projectId: string | null;
  processId: string | null;
  updatedAt: string;
  parentChain: SearchResultParentCrumb[];
}

interface SearchResponse {
  query: string;
  items: SearchResultItem[];
  total: number;
}

export type QuickActionId =
  | 'new-task'
  | 'new-process'
  | 'new-project'
  | 'new-reminder'
  | 'toggle-completed';

export type CommandPaletteOption =
  | {
      id: string;
      group: 'results';
      index: number;
      label: string;
      badge: string;
      subtitle: string;
      statusBadge: string | null;
      statusRaw: string | null;
      item: SearchResultItem;
    }
  | {
      id: string;
      group: 'actions';
      index: number;
      label: string;
      icon: string;
      subtitle: string;
      actionId: QuickActionId;
    }
  | {
      id: string;
      group: 'navigation';
      index: number;
      label: string;
      icon: string;
      subtitle: string;
      navItem: NavigationItem;
    };

export interface CommandPaletteGroup {
  key: 'results' | 'actions' | 'navigation';
  label: string;
  options: CommandPaletteOption[];
}

const RESULT_TYPE_LABELS: Record<SearchResultType, string> = {
  organization: 'Organização',
  department: 'Departamento',
  team: 'Time',
  project: 'Projeto',
  front: 'Frente',
  product: 'Produto',
  process: 'Processo',
  phase: 'Fase',
  task: 'Tarefa',
  list: 'Lista',
};

const STATUS_LABELS: Record<string, string> = {
  planned: 'Planejado',
  todo: 'A fazer',
  in_progress: 'Em execução',
  awaiting_approval: 'Aguardando aprovação',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  archived: 'Arquivado',
  active: 'Ativo',
  inactive: 'Inativo',
};

interface QuickActionDefinition {
  id: QuickActionId;
  label: string;
  icon: string;
  keywords: readonly string[];
}

const QUICK_ACTIONS: readonly QuickActionDefinition[] = [
  { id: 'new-task', label: '+ Nova Tarefa', icon: '+', keywords: ['criar', 'tarefa', 'nova tarefa'] },
  { id: 'new-process', label: '+ Novo Processo', icon: '+', keywords: ['criar', 'processo', 'novo processo'] },
  { id: 'new-project', label: '+ Novo Projeto', icon: '+', keywords: ['criar', 'projeto', 'novo projeto'] },
  { id: 'new-reminder', label: '+ Novo Lembrete', icon: '+', keywords: ['criar', 'lembrete', 'novo lembrete'] },
  {
    id: 'toggle-completed',
    label: 'Alternar Concluídos',
    icon: '☑',
    keywords: ['concluidos', 'completos', 'ocultar', 'exibir', 'mostrar', 'filtro'],
  },
];

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

@Component({
  selector: 'app-command-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CdkTrapFocus],
  templateUrl: './command-palette.component.html',
})
export class CommandPaletteComponent implements OnDestroy {
  readonly enabled = input<boolean>(true);

  private readonly palette = inject(CommandPaletteService);
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  private readonly drawer = inject(DrawerService);
  private readonly itemEditor = inject(ItemEditorService);
  private readonly workFilter = inject(WorkFilterService);
  private readonly toast = inject(ToastService);
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');

  readonly isOpen = this.palette.isOpen;
  readonly query = signal('');
  readonly results = signal<SearchResultItem[]>([]);
  readonly searching = signal(false);
  readonly searchError = signal('');
  readonly activeIndex = signal(0);
  readonly showCompleted = this.workFilter.showCompleted;

  private debounceTimer?: ReturnType<typeof setTimeout>;
  private focusTimer?: ReturnType<typeof setTimeout>;
  private searchVersion = 0;
  private previousFocusedElement: HTMLElement | null = null;

  readonly groups = computed<CommandPaletteGroup[]>(() => {
    const normalizedQuery = normalizeSearchText(this.query());
    const hasSearchLength = normalizedQuery.length >= MIN_SEARCH_LENGTH;

    const resultItems: Omit<Extract<CommandPaletteOption, { group: 'results' }>, 'index'>[] = this.results().map(
      item => {
        const chain = (item.parentChain ?? []).map(crumb => crumb.name).filter(Boolean).join(' → ');
        return {
          id: `result:${item.type}:${item.id}`,
          group: 'results',
          label: item.title,
          badge: RESULT_TYPE_LABELS[item.type] ?? item.type,
          subtitle: chain || item.description || 'Área pessoal',
          statusBadge: item.status ? (STATUS_LABELS[item.status] ?? item.status) : null,
          statusRaw: item.status,
          item,
        };
      },
    );

    const completedVisible = this.showCompleted();
    const actionItems: Omit<Extract<CommandPaletteOption, { group: 'actions' }>, 'index'>[] = QUICK_ACTIONS.filter(
      action => {
        if (!normalizedQuery) return true;
        const haystack = normalizeSearchText(
          `${action.label} ${action.keywords.join(' ')}`,
        );
        return haystack.includes(normalizedQuery);
      },
    ).map(action => ({
      id: `action:${action.id}`,
      group: 'actions',
      label: action.label,
      icon: action.id === 'toggle-completed' ? (completedVisible ? '☑' : '☐') : action.icon,
      subtitle:
        action.id === 'toggle-completed'
          ? completedVisible
            ? 'Concluídos visíveis — Enter para ocultar'
            : 'Concluídos ocultos — Enter para exibir'
          : 'Ação rápida',
      actionId: action.id,
    }));

    const navItems: Omit<Extract<CommandPaletteOption, { group: 'navigation' }>, 'index'>[] = navigation
      .filter(nav => {
        if (!normalizedQuery) return true;
        return normalizeSearchText(`${nav.section} ${nav.path}`).includes(normalizedQuery);
      })
      .map(nav => ({
        id: `nav:${nav.path}`,
        group: 'navigation',
        label: nav.section,
        icon: nav.icon,
        subtitle: 'Ir para seção',
        navItem: nav,
      }));

    const rawGroups: { key: CommandPaletteGroup['key']; label: string; items: Omit<CommandPaletteOption, 'index'>[] }[] = [];

    if (hasSearchLength && resultItems.length > 0) {
      rawGroups.push({ key: 'results', label: 'Resultados', items: resultItems });
    }
    if (actionItems.length > 0) {
      rawGroups.push({ key: 'actions', label: 'Ações rápidas', items: actionItems });
    }
    if (navItems.length > 0) {
      rawGroups.push({ key: 'navigation', label: 'Navegação', items: navItems });
    }

    let flatIndex = 0;
    return rawGroups.map(group => ({
      key: group.key,
      label: group.label,
      options: group.items.map(item => ({ ...item, index: flatIndex++ }) as CommandPaletteOption),
    }));
  });

  readonly flatOptions = computed<CommandPaletteOption[]>(() =>
    this.groups().flatMap(group => group.options),
  );

  constructor() {
    effect(() => {
      const open = this.palette.isOpen();
      untracked(() => {
        if (open) {
          this.onOpened();
        } else {
          this.cleanupTimersAndSearch();
        }
      });
    });

    effect(() => {
      if (!this.enabled() && this.palette.isOpen()) {
        untracked(() => this.close(false));
      }
    });
  }

  ngOnDestroy(): void {
    this.cleanupTimersAndSearch();
    this.clearFocusTimer();
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.enabled()) return;
    const isShortcut =
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === 'k';

    if (!isShortcut) return;

    if (!this.isOpen() && this.itemEditor.isOpen()) {
      return;
    }

    event.preventDefault();
    if (this.isOpen()) {
      this.close(true);
    } else {
      this.open();
    }
  }

  open(): void {
    if (!this.enabled()) return;
    if (this.isOpen()) return;
    this.palette.open();
  }

  close(restoreFocus = true): void {
    const wasOpen = this.isOpen();
    this.cleanupTimersAndSearch();
    this.clearFocusTimer();
    this.palette.close();

    if (wasOpen && restoreFocus && this.previousFocusedElement) {
      const target = this.previousFocusedElement;
      this.previousFocusedElement = null;
      target.focus?.();
    } else if (!restoreFocus) {
      this.previousFocusedElement = null;
    }
  }

  onQueryChange(rawValue: string): void {
    this.query.set(rawValue);
    this.activeIndex.set(0);
    this.clearSearchTimer();
    this.searchError.set('');

    const trimmed = rawValue.trim().replace(/\s+/g, ' ');
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      this.searchVersion += 1;
      this.results.set([]);
      this.searching.set(false);
      return;
    }

    if (trimmed.length > MAX_SEARCH_LENGTH) {
      this.searchVersion += 1;
      this.results.set([]);
      this.searching.set(false);
      this.searchError.set('Use uma busca de até 160 caracteres.');
      return;
    }

    const version = ++this.searchVersion;
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = undefined;
      void this.executeSearch(trimmed, version);
    }, SEARCH_DEBOUNCE_MS);
  }

  onDialogKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close(true);
      return;
    }

    const options = this.flatOptions();
    if (!options.length) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = (this.activeIndex() + 1) % options.length;
      this.setActiveIndex(next);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = (this.activeIndex() - 1 + options.length) % options.length;
      this.setActiveIndex(prev);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const current = options[this.activeIndex()] ?? options[0];
      if (current) {
        void this.executeOption(current);
      }
    }
  }

  setActiveIndex(index: number): void {
    this.activeIndex.set(index);
    const activeEl = this.host.nativeElement.querySelector(
      `#command-palette-option-${index}`,
    ) as HTMLElement | null;
    activeEl?.scrollIntoView?.({ block: 'nearest' });
  }

  async executeOption(option: CommandPaletteOption): Promise<void> {
    if (option.group === 'navigation') {
      this.close(false);
      this.drawer.close();
      await this.router.navigate([`/${option.navItem.path}`]);
      return;
    }

    if (option.group === 'actions') {
      this.executeQuickAction(option.actionId);
      return;
    }

    await this.openSearchResult(option.item);
  }

  private executeQuickAction(actionId: QuickActionId): void {
    this.close(false);
    if (actionId === 'new-task') {
      this.itemEditor.openCreate('task');
      return;
    }
    if (actionId === 'new-process') {
      this.itemEditor.openCreate('process');
      return;
    }
    if (actionId === 'new-project') {
      this.itemEditor.openCreate('project');
      return;
    }
    if (actionId === 'new-reminder') {
      this.itemEditor.openCreate('reminder');
      return;
    }
    if (actionId === 'toggle-completed') {
      const visible = this.workFilter.toggleCompleted();
      this.toast.info(visible ? 'Exibindo itens concluídos.' : 'Ocultando itens concluídos.');
    }
  }

  private async openSearchResult(item: SearchResultItem): Promise<void> {
    this.close(false);

    if (item.type === 'organization' || item.type === 'department' || item.type === 'team') {
      this.drawer.close();
      const segment = (
        {
          organization: 'organizacao',
          department: 'departamento',
          team: 'time',
        } as const
      )[item.type];
      await this.router.navigate(['/estrutura', segment, item.id]);
      return;
    }

    if (item.type === 'list') {
      this.drawer.close();
      await this.router.navigate(['/listas', item.id]);
      return;
    }

    if (item.type === 'process') {
      this.drawer.close();
      await this.router.navigate(['/processos', item.id], { state: { fromTaskando: true } });
      return;
    }

    if (item.type === 'phase') {
      this.drawer.close();
      await this.router.navigate(['/fases', item.id], { state: { fromTaskando: true } });
      return;
    }

    if (item.type === 'task') {
      this.drawer.close();
      await this.router.navigate(['/tarefas', item.id], { state: { fromTaskando: true } });
      return;
    }

    try {
      await this.drawer.open(
        { ...item, kind: item.type },
        'Detalhes',
        this.workFilter.includeClosed(),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível abrir o item.';
      this.toast.error(message);
    }
  }

  private async executeSearch(query: string, version: number): Promise<void> {
    if (version !== this.searchVersion || !this.isOpen()) return;
    this.searching.set(true);
    this.searchError.set('');

    try {
      const data = await this.api.request<SearchResponse>(
        `search?q=${encodeURIComponent(query)}`,
      );
      if (version !== this.searchVersion || !this.isOpen()) return;
      this.results.set(data?.items ?? []);
      this.activeIndex.set(0);
    } catch (error) {
      if (version !== this.searchVersion || !this.isOpen()) return;
      if (
        error instanceof ApiError &&
        error.status === 428 &&
        error.details['code'] === 'LEGAL_ACCEPTANCE_REQUIRED'
      ) {
        this.close(false);
        return;
      }
      this.results.set([]);
      this.searchError.set(
        error instanceof Error && error.message
          ? error.message
          : 'Não foi possível concluir a busca.',
      );
    } finally {
      if (version === this.searchVersion) {
        this.searching.set(false);
      }
    }
  }

  private onOpened(): void {
    this.previousFocusedElement =
      typeof document !== 'undefined' ? (document.activeElement as HTMLElement | null) : null;
    this.query.set('');
    this.results.set([]);
    this.searching.set(false);
    this.searchError.set('');
    this.activeIndex.set(0);

    this.clearFocusTimer();
    this.focusTimer = setTimeout(() => {
      this.focusTimer = undefined;
      this.searchInput()?.nativeElement.focus();
    }, 0);
  }

  private clearSearchTimer(): void {
    if (this.debounceTimer !== undefined) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = undefined;
    }
  }

  private clearFocusTimer(): void {
    if (this.focusTimer !== undefined) {
      clearTimeout(this.focusTimer);
      this.focusTimer = undefined;
    }
  }

  private cleanupTimersAndSearch(): void {
    this.clearSearchTimer();
    this.searchVersion += 1;
    this.searching.set(false);
  }
}
