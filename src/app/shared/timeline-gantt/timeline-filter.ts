import { ClosedWorkState, Item, closedWorkStates } from '../../api.service';
import type { DependencyEdge } from '../dependency-graph/dependency-graph.component';
import {
  timelineNodeKey,
  type TimelineGraphInput,
  type TimelineNodeInput,
} from './timeline-layout';

export type WorkViewMode = 'list' | 'graph' | 'timeline';

export interface TimelineFilterOptions {
  includeClosed: readonly ClosedWorkState[];
  search: string;
  temporal: string;
  phases?: readonly Item[];
  tasks?: readonly Item[];
  now?: Date;
}

const CLOSED_STATE_SET = new Set<string>(closedWorkStates);

function localDateIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function enrichNodeFromItem(node: TimelineNodeInput, item?: Item): TimelineNodeInput {
  if (!item) return node;
  return {
    ...node,
    taskType: node.taskType ?? item['taskType'],
    approvalRequired: node.approvalRequired ?? item['approvalRequired'],
    dueDate: node.dueDate ?? item['dueDate'],
    dateAt: node.dateAt ?? item['dateAt'],
    startAt: node.startAt ?? item['startAt'],
    endAt: node.endAt ?? item['endAt'],
    durationMinutes: node.durationMinutes ?? item['durationMinutes'],
    size: node.size ?? item['size'],
    createdAt: node.createdAt ?? item['createdAt'],
  };
}

function isIncludedByClosedFilter(
  status: string,
  includedClosed: ReadonlySet<string>,
): boolean {
  return !CLOSED_STATE_SET.has(status) || includedClosed.has(status);
}

function matchesSearchFilter(
  node: TimelineNodeInput,
  query: string,
  item?: Item,
): boolean {
  if (!query) return true;
  return `${node.title} ${item?.['description'] ?? ''}`
    .toLocaleLowerCase()
    .includes(query);
}

function matchesTemporalFilter(
  node: TimelineNodeInput,
  temporal: string,
  todayIso: string,
  item?: Item,
): boolean {
  if (temporal === 'all') return true;
  const date =
    node.dueDate ??
    node.dateAt ??
    node.startAt?.slice(0, 10) ??
    item?.['dueDate'] ??
    item?.['dateAt'] ??
    item?.['startAt']?.slice(0, 10);
  const pinned = Boolean(
    item?.['pinnedForToday'] ??
      (node as TimelineNodeInput & { pinnedForToday?: boolean }).pinnedForToday,
  );
  if (temporal === 'today') return date === todayIso || pinned;
  if (temporal === 'overdue') return Boolean(date && date < todayIso);
  if (temporal === 'no_due') return !date;
  return true;
}

/**
 * Synchronizes the enriched dependency graph with Process/Phase view filters
 * (`includeClosed`, `search`, and task `temporal`), pruning edges whose
 * endpoints are outside the filtered slice.
 */
export function filterTimelineGraph(
  graph: TimelineGraphInput,
  options: TimelineFilterOptions,
): TimelineGraphInput {
  const includedClosed = new Set<string>(options.includeClosed);
  const query = options.search.trim().toLocaleLowerCase();
  const todayIso = localDateIso(options.now ?? new Date());
  const phaseItemsById = new Map((options.phases ?? []).map((item) => [item.id, item]));
  const taskItemsById = new Map((options.tasks ?? []).map((item) => [item.id, item]));

  const phases = (graph.phases ?? [])
    .filter((node) => {
      const item = phaseItemsById.get(node.id);
      return (
        isIncludedByClosedFilter(node.status, includedClosed) &&
        matchesSearchFilter(node, query, item)
      );
    })
    .map((node) => enrichNodeFromItem(node, phaseItemsById.get(node.id)));

  const tasks = (graph.tasks ?? [])
    .filter((node) => {
      const item = taskItemsById.get(node.id);
      return (
        isIncludedByClosedFilter(node.status, includedClosed) &&
        matchesSearchFilter(node, query, item) &&
        matchesTemporalFilter(node, options.temporal, todayIso, item)
      );
    })
    .map((node) => enrichNodeFromItem(node, taskItemsById.get(node.id)));

  const visibleKeys = new Set<string>([
    ...phases.map((node) => timelineNodeKey(node.type, node.id)),
    ...tasks.map((node) => timelineNodeKey(node.type, node.id)),
  ]);

  const edges: DependencyEdge[] = (graph.edges ?? []).filter(
    (edge) =>
      visibleKeys.has(timelineNodeKey(edge.predecessorType, edge.predecessorId)) &&
      visibleKeys.has(timelineNodeKey(edge.successorType, edge.successorId)),
  );

  return { phases, tasks, edges };
}
