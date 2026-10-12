import { Injectable, computed, inject, signal } from '@angular/core';
import { ApiService, ClosedWorkState, Item } from '../api.service';
import { DependencyGraph } from './dependency-graph/dependency-graph.component';

export interface DrawerMutation {
  item: Item | null;
  action: string;
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class DrawerService {
  private readonly api = inject(ApiService);

  readonly openedItem = signal<Item | null>(null);
  readonly initialTab = signal<string>('Detalhes');
  readonly tab = this.initialTab;
  readonly detail = signal<Record<string, any>>({});
  readonly children = signal<Item[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string>('');
  readonly mutationNotification = signal<DrawerMutation | null>(null);
  readonly refreshNotification = signal<number>(0);

  readonly isOpen = computed(() => this.openedItem() !== null);

  async open(
    item: Item,
    tab: string = 'Detalhes',
    includeClosed: readonly ClosedWorkState[] = [],
  ): Promise<void> {
    const current = this.openedItem();
    if (
      current &&
      !item['parentChain']?.length
    ) {
      const isSubtask = item.kind === 'task' && item['parentTaskId'] === current.id;
      const isChildPhase = item.kind === 'phase' && item['processId'] === current.id;
      const isContainerChild = item['parentId'] === current.id;
      if (isSubtask || isChildPhase || isContainerChild) {
        const currentTitle = current['title'] ?? current['name'] ?? '';
        item = {
          ...item,
          parentChain: [
            ...(current['parentChain'] ?? []),
            { type: current.kind, id: current.id, name: currentTitle },
          ],
        };
      }
    }
    this.openedItem.set(item);
    this.initialTab.set(tab);
    this.detail.set({});
    this.children.set([]);
    await this.loadDetail(item, includeClosed);
  }

  close(): void {
    this.openedItem.set(null);
    this.initialTab.set('Detalhes');
    this.detail.set({});
    this.children.set([]);
    this.error.set('');
  }

  setTab(tab: string): void {
    this.initialTab.set(tab);
  }

  notifyMutation(mutation?: Partial<DrawerMutation> | Item, action?: string): void {
    const isItem = Boolean(mutation && typeof mutation === 'object' && 'id' in mutation);
    const item = isItem
      ? (mutation as Item)
      : (mutation as Partial<DrawerMutation>)?.item ?? null;
    const resolvedAction = action ?? (mutation as Partial<DrawerMutation>)?.action ?? 'update';
    this.mutationNotification.set({
      item,
      action: resolvedAction,
      timestamp: Date.now(),
    });
    this.refreshNotification.update(n => n + 1);
  }

  notifyRefresh(): void {
    this.refreshNotification.update(n => n + 1);
  }

  updateDetailGraph(graph: DependencyGraph): void {
    this.detail.update(detail => ({ ...detail, graph }));
  }

  async loadDetail(
    item: Item | null = this.openedItem(),
    includeClosed: readonly ClosedWorkState[] = [],
  ): Promise<Record<string, any>> {
    if (!item || !item.kind) {
      this.children.set([]);
      this.detail.set({});
      return {};
    }

    this.loading.set(true);
    this.error.set('');
    try {
      const kind = item.kind;
      const id = item.id;
      const detail: Record<string, any> = {};
      let children: Item[] = [];

      if (kind === 'task') {
        const [checks, subtasks, comments, audit] = await Promise.all([
          this.api.request(`tasks/${id}/checklist`),
          this.api.requestWithClosed(`tasks/${id}/subtasks`, includeClosed),
          this.api.request(`tasks/${id}/comments`),
          this.api.request(`tasks/${id}/audit`),
        ]);
        Object.assign(detail, { ...checks, ...comments, ...audit });
        children = this.mark(subtasks?.subtasks, 'task');
      } else if (['project', 'front', 'product', 'process', 'phase'].includes(kind)) {
        const containerData = await this.api.requestWithClosed(
          `task-containers/${kind}/${id}`,
          includeClosed,
        );
        children = this.mark(containerData?.tasks, 'task');
        if (kind === 'project') {
          const frontData = await this.api.requestWithClosed(
            `projects/${id}/fronts`,
            includeClosed,
          );
          children.push(...this.mark(frontData?.fronts, 'front'));
        }
        if (kind === 'process') {
          const phaseData = await this.api.requestWithClosed(
            `processes/${id}/phases`,
            includeClosed,
          );
          children.push(...this.mark(phaseData?.phases, 'phase'));
        }
        if (['process', 'phase'].includes(kind)) {
          detail['graph'] = await this.api.request(
            `dependencies?containerType=${kind}&containerId=${id}`,
          );
        }
        detail['progress'] = await this.api.request(`work-progress/${kind}/${id}`);
      }

      if (kind === 'organization') {
        const [members, audit] = await Promise.all([
          this.api.request(`organizations/${id}/members`),
          this.api.request(`organizations/${id}/audit`),
        ]);
        detail['access'] = {
          owner: members.owner,
          assignments: members.members ?? [],
          canManage: members.capabilities?.canAddMembers ?? false,
        };
        detail['events'] = audit.events ?? [];
      } else if (!['reminder', 'series'].includes(kind)) {
        detail['access'] = await this.api.request(`item-roles?itemType=${kind}&itemId=${id}`);
        detail['transfer'] = await this.api.request(`owner-transfers?itemType=${kind}&itemId=${id}`);
      }

      this.children.set(children);
      this.detail.set(detail);
      return detail;
    } catch (e) {
      const message =
        e instanceof Error ? e.message : 'Não foi possível carregar os detalhes do item.';
      this.error.set(message);
      throw e;
    } finally {
      this.loading.set(false);
    }
  }

  private mark(rows: Item[] | undefined, kind: string): Item[] {
    return (rows ?? []).map(row => ({ ...row, kind }));
  }
}
