import type {
  DependencyEdge,
  DependencyNode,
  DependencyNodeType,
} from '../dependency-graph/dependency-graph.component';

export type ItemSize = 'xs' | 's' | 'm' | 'l' | 'xl';
export type TimelineZoom = 'day' | 'week' | 'month';
export type TimelineAnchorSource =
  | 'event'
  | 'commitment'
  | 'date'
  | 'dueDate'
  | 'predecessor'
  | 'createdAt'
  | 'unscheduled';

export interface TimelineNodeInput extends DependencyNode {
  taskType?: string | null;
  approvalRequired?: boolean;
  dueDate?: string | null;
  dateAt?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  durationMinutes?: number | null;
  size?: ItemSize | string | null;
  createdAt?: string | null;
}

export interface TimelineGraphInput {
  tasks: TimelineNodeInput[];
  phases: TimelineNodeInput[];
  edges: DependencyEdge[];
}

export interface TimelineLayoutOptions {
  containerType?: 'process' | 'phase';
  zoom?: TimelineZoom;
  now?: Date | number | string;
  dayWidthPx?: number;
  rowHeightPx?: number;
  rowGapPx?: number;
  laneHeaderHeightPx?: number;
  laneGapPx?: number;
  minBarWidthPx?: number;
  milestoneSizePx?: number;
}

export interface TimelineNodeLayout {
  key: string;
  node: TimelineNodeInput;
  kind: 'bar' | 'milestone';
  anchorSource: Exclude<TimelineAnchorSource, 'unscheduled'>;
  durationDays: number;
  startMs: number;
  endMs: number;
  startDateIso: string;
  endDateIso: string;
  dueDateMs: number | null;
  laneType: DependencyNodeType;
  row: number;
  x: number;
  y: number;
  width: number;
  height: number;
  anchorLeftX: number;
  anchorRightX: number;
  centerY: number;
  hasDateConflict: boolean;
  conflictPredecessorKeys: string[];
  isOverdue: boolean;
  isBlocked: boolean;
  isClosed: boolean;
}

export interface TimelineUnscheduledItem {
  key: string;
  node: TimelineNodeInput;
  durationDays: number;
  isBlocked: boolean;
  isOverdue: boolean;
  isClosed: boolean;
  reason: 'missing_anchor';
}

export interface TimelineEdgeLayout {
  id: string;
  edge: DependencyEdge;
  predecessorKey: string;
  successorKey: string;
  path: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  hasConflict: boolean;
}

export interface TimelineLaneLayout {
  type: DependencyNodeType;
  label: string;
  y: number;
  height: number;
  nodeCount: number;
}

export interface TimelineTick {
  key: string;
  label: string;
  secondaryLabel: string;
  startMs: number;
  endMs: number;
  x: number;
  width: number;
  isWeekend: boolean;
  isToday: boolean;
}

export interface TimelineLayout {
  zoom: TimelineZoom;
  dayWidthPx: number;
  rangeStartMs: number;
  rangeEndMs: number;
  totalDays: number;
  width: number;
  height: number;
  nowMs: number;
  todayX: number | null;
  rawTodayX: number;
  ticks: TimelineTick[];
  lanes: TimelineLaneLayout[];
  nodes: TimelineNodeLayout[];
  edges: TimelineEdgeLayout[];
  unscheduled: TimelineUnscheduledItem[];
}

export const MS_PER_MINUTE = 60_000;
export const MS_PER_DAY = 86_400_000;
export const DEFAULT_DURATION_DAYS = 3;

export const SIZE_DURATION_DAYS: Readonly<Record<ItemSize, number>> = {
  xs: 1,
  s: 2,
  m: 4,
  l: 7,
  xl: 14,
};

export const ZOOM_DAY_WIDTH: Readonly<Record<TimelineZoom, number>> = {
  day: 44,
  week: 18,
  month: 6,
};

const CLOSED_STATUSES = new Set(['completed', 'cancelled', 'archived']);
const RELEASED_STATUSES = new Set(['completed', 'cancelled']);
const PT_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const;
const PT_MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const;

const DEFAULT_ROW_HEIGHT_PX = 40;
const DEFAULT_ROW_GAP_PX = 10;
const DEFAULT_LANE_HEADER_HEIGHT_PX = 34;
const DEFAULT_LANE_GAP_PX = 18;
const DEFAULT_CANVAS_TOP_PADDING_PX = 10;
const DEFAULT_CANVAS_BOTTOM_PADDING_PX = 14;
const DEFAULT_MIN_BAR_WIDTH_PX = 14;
const DEFAULT_MILESTONE_SIZE_PX = 18;

interface ParsedDate {
  ms: number;
  dateOnly: boolean;
}

interface DerivedInterval {
  kind: 'bar' | 'milestone';
  anchorSource: Exclude<TimelineAnchorSource, 'unscheduled'>;
  startMs: number;
  endMs: number;
  dueDateMs: number | null;
}

export function timelineNodeKey(type: DependencyNodeType, id: string): string {
  return `${type}:${id}`;
}

export function durationDaysForSize(size?: string | null): number {
  if (!size) return DEFAULT_DURATION_DAYS;
  const normalized = size.toLowerCase() as ItemSize;
  return SIZE_DURATION_DAYS[normalized] ?? DEFAULT_DURATION_DAYS;
}

export function startOfUtcDay(ms: number): number {
  return Math.floor(ms / MS_PER_DAY) * MS_PER_DAY;
}

export function endOfUtcDay(ms: number): number {
  return startOfUtcDay(ms) + MS_PER_DAY - 1;
}

export function formatUtcYmd(ms: number): string {
  return new Date(startOfUtcDay(ms)).toISOString().slice(0, 10);
}

function parseDateInput(value?: string | null): ParsedDate | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (ymdMatch) {
    const year = Number(ymdMatch[1]);
    const month = Number(ymdMatch[2]);
    const day = Number(ymdMatch[3]);
    const ms = Date.UTC(year, month - 1, day);
    const check = new Date(ms);
    if (
      check.getUTCFullYear() !== year ||
      check.getUTCMonth() !== month - 1 ||
      check.getUTCDate() !== day
    ) {
      return null;
    }
    return { ms, dateOnly: true };
  }

  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return { ms: parsed, dateOnly: false };
}

function resolveNowMs(now?: Date | number | string): number {
  if (now instanceof Date) {
    const t = now.getTime();
    return Number.isFinite(t) ? t : Date.now();
  }
  if (typeof now === 'number') {
    return Number.isFinite(now) ? now : Date.now();
  }
  if (typeof now === 'string') {
    const parsed = parseDateInput(now);
    return parsed ? parsed.ms : Date.now();
  }
  return Date.now();
}

function nodeDeterministicOrder(left: TimelineNodeInput, right: TimelineNodeInput): number {
  const positionDiff =
    (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER);
  if (positionDiff !== 0) return positionDiff;
  return left.title.localeCompare(right.title, 'pt-BR') || left.id.localeCompare(right.id);
}

function isPredecessorReleased(node: TimelineNodeInput, nowMs: number): boolean {
  if (typeof node.released === 'boolean') return node.released;
  if (RELEASED_STATUSES.has(node.status)) return true;
  if (node.status === 'archived') return false;
  if (node.taskType === 'date') {
    const parsed = parseDateInput(node.dateAt);
    return Boolean(parsed && formatUtcYmd(parsed.ms) <= formatUtcYmd(nowMs));
  }
  if (node.taskType === 'event') {
    const parsed = parseDateInput(node.endAt);
    return Boolean(parsed && parsed.ms <= nowMs);
  }
  return false;
}

function isNodeBlocked(
  node: TimelineNodeInput,
  incomingEdges: DependencyEdge[],
  byKey: Map<string, TimelineNodeInput>,
  nowMs: number,
): boolean {
  if (CLOSED_STATUSES.has(node.status)) return false;
  if (node.dependencyState === 'blocked') return true;
  if (node.dependencyState === 'released') return false;
  for (const edge of incomingEdges) {
    const pred = byKey.get(timelineNodeKey(edge.predecessorType, edge.predecessorId));
    if (pred && !isPredecessorReleased(pred, nowMs)) return true;
  }
  return false;
}

function isNodeOverdue(
  node: TimelineNodeInput,
  interval: DerivedInterval | null,
  nowMs: number,
): boolean {
  if (CLOSED_STATUSES.has(node.status)) return false;
  if (!interval) return false;
  if (interval.anchorSource === 'createdAt' || interval.anchorSource === 'predecessor') {
    return false;
  }
  return interval.endMs < nowMs;
}

function topologicalOrder(
  nodes: TimelineNodeInput[],
  edges: DependencyEdge[],
  byKey: Map<string, TimelineNodeInput>,
): {
  orderedKeys: string[];
  predecessorsByKey: Map<string, string[]>;
} {
  const sorted = [...nodes].sort(nodeDeterministicOrder);
  const inDegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  const predecessorsByKey = new Map<string, string[]>();

  for (const node of sorted) {
    const key = timelineNodeKey(node.type, node.id);
    inDegree.set(key, 0);
    outgoing.set(key, []);
    predecessorsByKey.set(key, []);
  }

  for (const edge of edges) {
    const predKey = timelineNodeKey(edge.predecessorType, edge.predecessorId);
    const succKey = timelineNodeKey(edge.successorType, edge.successorId);
    if (!byKey.has(predKey) || !byKey.has(succKey) || predKey === succKey) continue;
    inDegree.set(succKey, (inDegree.get(succKey) ?? 0) + 1);
    outgoing.get(predKey)!.push(succKey);
    predecessorsByKey.get(succKey)!.push(predKey);
  }

  const ready: TimelineNodeInput[] = sorted.filter(
    (node) => inDegree.get(timelineNodeKey(node.type, node.id)) === 0,
  );
  const orderedKeys: string[] = [];
  const processed = new Set<string>();

  while (ready.length > 0) {
    ready.sort(nodeDeterministicOrder);
    const current = ready.shift()!;
    const currentKey = timelineNodeKey(current.type, current.id);
    if (processed.has(currentKey)) continue;
    processed.add(currentKey);
    orderedKeys.push(currentKey);

    for (const succKey of outgoing.get(currentKey) ?? []) {
      const remaining = (inDegree.get(succKey) ?? 1) - 1;
      inDegree.set(succKey, remaining);
      if (remaining === 0) {
        const succNode = byKey.get(succKey);
        if (succNode) ready.push(succNode);
      }
    }
  }

  // Fallback for any unexpected cycle: append remaining nodes deterministically.
  for (const node of sorted) {
    const key = timelineNodeKey(node.type, node.id);
    if (!processed.has(key)) orderedKeys.push(key);
  }

  return { orderedKeys, predecessorsByKey };
}

function deriveExplicitInterval(
  node: TimelineNodeInput,
  durationDays: number,
): DerivedInterval | null {
  const parsedDue = parseDateInput(node.dueDate);
  const dueDateMs = parsedDue ? endOfUtcDay(parsedDue.ms) : null;

  if (node.type === 'task' && node.taskType === 'event') {
    const start = parseDateInput(node.startAt);
    const end = parseDateInput(node.endAt);
    if (start && end) {
      const startMs = start.ms;
      const endMs = end.dateOnly ? endOfUtcDay(end.ms) : Math.max(startMs, end.ms);
      return {
        kind: 'bar',
        anchorSource: 'event',
        startMs,
        endMs,
        dueDateMs,
      };
    }
    return null;
  }

  if (node.type === 'task' && node.taskType === 'commitment') {
    const start = parseDateInput(node.startAt);
    if (start) {
      const durationMs =
        typeof node.durationMinutes === 'number' && Number.isFinite(node.durationMinutes)
          ? Math.max(0, node.durationMinutes) * MS_PER_MINUTE
          : durationDays * MS_PER_DAY;
      return {
        kind: 'bar',
        anchorSource: 'commitment',
        startMs: start.ms,
        endMs: start.ms + durationMs,
        dueDateMs,
      };
    }
    return null;
  }

  if (node.type === 'task' && node.taskType === 'date') {
    const dateAt = parseDateInput(node.dateAt);
    if (dateAt) {
      const dayStart = startOfUtcDay(dateAt.ms);
      return {
        kind: 'milestone',
        anchorSource: 'date',
        startMs: dayStart,
        endMs: endOfUtcDay(dayStart),
        dueDateMs: dueDateMs ?? endOfUtcDay(dayStart),
      };
    }
    return null;
  }

  if (parsedDue) {
    const dueDayStart = startOfUtcDay(parsedDue.ms);
    return {
      kind: 'bar',
      anchorSource: 'dueDate',
      startMs: dueDayStart - (durationDays - 1) * MS_PER_DAY,
      endMs: endOfUtcDay(dueDayStart),
      dueDateMs,
    };
  }

  return null;
}

function deriveSimpleOrPhaseInterval(
  node: TimelineNodeInput,
  durationDays: number,
  predecessorKeys: string[],
  derivedByKey: Map<string, DerivedInterval>,
): DerivedInterval | null {
  const explicit = deriveExplicitInterval(node, durationDays);
  if (explicit) return explicit;

  // Date/event/commitment items require their explicit temporal fields.
  if (
    node.type === 'task' &&
    (node.taskType === 'event' || node.taskType === 'commitment' || node.taskType === 'date')
  ) {
    return null;
  }

  if (predecessorKeys.length === 0) {
    return null;
  }

  const scheduledPredEnds: number[] = [];
  for (const predKey of predecessorKeys) {
    const predInterval = derivedByKey.get(predKey);
    if (predInterval) scheduledPredEnds.push(predInterval.endMs);
  }

  if (scheduledPredEnds.length > 0) {
    const maxPredEndMs = Math.max(...scheduledPredEnds);
    const startMs = maxPredEndMs + 1;
    return {
      kind: 'bar',
      anchorSource: 'predecessor',
      startMs,
      endMs: startMs + durationDays * MS_PER_DAY - 1,
      dueDateMs: null,
    };
  }

  const created = parseDateInput(node.createdAt);
  if (created) {
    const startMs = startOfUtcDay(created.ms);
    return {
      kind: 'bar',
      anchorSource: 'createdAt',
      startMs,
      endMs: startMs + durationDays * MS_PER_DAY - 1,
      dueDateMs: null,
    };
  }

  return null;
}

export function hasEdgeDateConflict(
  predecessorEndMs: number,
  successorStartMs: number,
  successorDueDateMs: number | null,
): boolean {
  if (successorDueDateMs !== null && predecessorEndMs > successorDueDateMs) {
    return true;
  }
  return predecessorEndMs >= successorStartMs;
}

export function bezierEdgePath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): string {
  const reach = Math.max(32, Math.abs(targetX - sourceX) * 0.45);
  return `M ${sourceX} ${sourceY} C ${sourceX + reach} ${sourceY}, ${targetX - reach} ${targetY}, ${targetX} ${targetY}`;
}

function startOfUtcIsoWeek(ms: number): number {
  const dayStart = startOfUtcDay(ms);
  const utcDay = new Date(dayStart).getUTCDay();
  const daysFromMonday = (utcDay + 6) % 7;
  return dayStart - daysFromMonday * MS_PER_DAY;
}

function startOfUtcMonth(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

function endOfUtcMonth(ms: number): number {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999);
}

function formatDayMonth(ms: number): string {
  const d = new Date(ms);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}`;
}

function formatMonthYear(ms: number): string {
  const d = new Date(ms);
  return `${PT_MONTHS[d.getUTCMonth()]}/${d.getUTCFullYear()}`;
}

function computeTimelineRange(
  intervals: DerivedInterval[],
  nowMs: number,
  zoom: TimelineZoom,
): { rangeStartMs: number; rangeEndMs: number } {
  const rawMin = intervals.length
    ? Math.min(...intervals.map((item) => item.startMs))
    : nowMs;
  const rawMax = intervals.length
    ? Math.max(...intervals.map((item) => item.endMs))
    : nowMs + 7 * MS_PER_DAY;

  if (zoom === 'day') {
    const padDays = intervals.length ? 2 : 3;
    return {
      rangeStartMs: startOfUtcDay(rawMin) - padDays * MS_PER_DAY,
      rangeEndMs: endOfUtcDay(rawMax) + padDays * MS_PER_DAY,
    };
  }

  if (zoom === 'week') {
    const padDays = intervals.length ? 3 : 7;
    const rangeStartMs = startOfUtcIsoWeek(startOfUtcDay(rawMin) - padDays * MS_PER_DAY);
    const maxWeekStart = startOfUtcIsoWeek(startOfUtcDay(rawMax) + padDays * MS_PER_DAY);
    return {
      rangeStartMs,
      rangeEndMs: maxWeekStart + 7 * MS_PER_DAY - 1,
    };
  }

  const padDays = intervals.length ? 7 : 14;
  return {
    rangeStartMs: startOfUtcMonth(startOfUtcDay(rawMin) - padDays * MS_PER_DAY),
    rangeEndMs: endOfUtcMonth(startOfUtcDay(rawMax) + padDays * MS_PER_DAY),
  };
}

export function buildTimelineTicks(
  rangeStartMs: number,
  rangeEndMs: number,
  zoom: TimelineZoom,
  dayWidthPx: number,
  nowMs: number,
): TimelineTick[] {
  const ticks: TimelineTick[] = [];
  const todayStart = startOfUtcDay(nowMs);
  const todayYmd = formatUtcYmd(todayStart);

  if (zoom === 'day') {
    for (let cursor = rangeStartMs; cursor <= rangeEndMs; cursor += MS_PER_DAY) {
      const d = new Date(cursor);
      const utcDay = d.getUTCDay();
      const key = formatUtcYmd(cursor);
      ticks.push({
        key,
        label: formatDayMonth(cursor),
        secondaryLabel: PT_WEEKDAYS[utcDay],
        startMs: cursor,
        endMs: endOfUtcDay(cursor),
        x: ((cursor - rangeStartMs) / MS_PER_DAY) * dayWidthPx,
        width: dayWidthPx,
        isWeekend: utcDay === 0 || utcDay === 6,
        isToday: key === todayYmd,
      });
    }
    return ticks;
  }

  if (zoom === 'week') {
    for (let cursor = rangeStartMs; cursor <= rangeEndMs; cursor += 7 * MS_PER_DAY) {
      const endMs = cursor + 7 * MS_PER_DAY - 1;
      ticks.push({
        key: formatUtcYmd(cursor),
        label: formatDayMonth(cursor),
        secondaryLabel: formatMonthYear(cursor),
        startMs: cursor,
        endMs,
        x: ((cursor - rangeStartMs) / MS_PER_DAY) * dayWidthPx,
        width: 7 * dayWidthPx,
        isWeekend: false,
        isToday: todayStart >= cursor && todayStart <= endMs,
      });
    }
    return ticks;
  }

  let cursor = startOfUtcMonth(rangeStartMs);
  while (cursor <= rangeEndMs) {
    const d = new Date(cursor);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth();
    const nextMonthStart = Date.UTC(year, month + 1, 1);
    const endMs = nextMonthStart - 1;
    const daysInMonth = Math.round((nextMonthStart - cursor) / MS_PER_DAY);
    ticks.push({
      key: `${year}-${String(month + 1).padStart(2, '0')}`,
      label: `${PT_MONTHS[month]}/${year}`,
      secondaryLabel: String(year),
      startMs: cursor,
      endMs,
      x: ((cursor - rangeStartMs) / MS_PER_DAY) * dayWidthPx,
      width: daysInMonth * dayWidthPx,
      isWeekend: false,
      isToday: todayStart >= cursor && todayStart <= endMs,
    });
    cursor = nextMonthStart;
  }

  return ticks;
}

export function xForTimestamp(ms: number, rangeStartMs: number, dayWidthPx: number): number {
  return ((ms - rangeStartMs) / MS_PER_DAY) * dayWidthPx;
}

export function buildTimelineLayout(
  graph: TimelineGraphInput,
  options: TimelineLayoutOptions = {},
): TimelineLayout {
  const zoom: TimelineZoom = options.zoom ?? 'day';
  const dayWidthPx = options.dayWidthPx ?? ZOOM_DAY_WIDTH[zoom];
  const rowHeightPx = options.rowHeightPx ?? DEFAULT_ROW_HEIGHT_PX;
  const rowGapPx = options.rowGapPx ?? DEFAULT_ROW_GAP_PX;
  const laneHeaderHeightPx = options.laneHeaderHeightPx ?? DEFAULT_LANE_HEADER_HEIGHT_PX;
  const laneGapPx = options.laneGapPx ?? DEFAULT_LANE_GAP_PX;
  const minBarWidthPx = options.minBarWidthPx ?? DEFAULT_MIN_BAR_WIDTH_PX;
  const milestoneSizePx = options.milestoneSizePx ?? DEFAULT_MILESTONE_SIZE_PX;
  const containerType = options.containerType ?? 'process';
  const nowMs = resolveNowMs(options.now);

  const allNodes: TimelineNodeInput[] = [...(graph.phases ?? []), ...(graph.tasks ?? [])];
  const byKey = new Map<string, TimelineNodeInput>();
  for (const node of allNodes) {
    byKey.set(timelineNodeKey(node.type, node.id), node);
  }

  const incomingByKey = new Map<string, DependencyEdge[]>();
  for (const key of byKey.keys()) incomingByKey.set(key, []);
  for (const edge of graph.edges ?? []) {
    const succKey = timelineNodeKey(edge.successorType, edge.successorId);
    const predKey = timelineNodeKey(edge.predecessorType, edge.predecessorId);
    if (byKey.has(succKey) && byKey.has(predKey) && predKey !== succKey) {
      incomingByKey.get(succKey)!.push(edge);
    }
  }

  const { orderedKeys, predecessorsByKey } = topologicalOrder(allNodes, graph.edges ?? [], byKey);
  const derivedByKey = new Map<string, DerivedInterval>();

  for (const key of orderedKeys) {
    const node = byKey.get(key);
    if (!node) continue;
    const durationDays = durationDaysForSize(node.size);
    const interval = deriveSimpleOrPhaseInterval(
      node,
      durationDays,
      predecessorsByKey.get(key) ?? [],
      derivedByKey,
    );
    if (interval) derivedByKey.set(key, interval);
  }

  const scheduledIntervals = [...derivedByKey.values()];
  const { rangeStartMs, rangeEndMs } = computeTimelineRange(scheduledIntervals, nowMs, zoom);
  const totalDays = Math.max(1, Math.round((rangeEndMs + 1 - rangeStartMs) / MS_PER_DAY));
  const width = totalDays * dayWidthPx;
  const rawTodayX = xForTimestamp(nowMs, rangeStartMs, dayWidthPx);
  const todayX = nowMs >= rangeStartMs && nowMs <= rangeEndMs ? rawTodayX : null;
  const ticks = buildTimelineTicks(rangeStartMs, rangeEndMs, zoom, dayWidthPx, nowMs);

  const conflictMap = new Map<string, string[]>();
  const edgeConflictById = new Map<string, boolean>();
  for (const edge of graph.edges ?? []) {
    const predKey = timelineNodeKey(edge.predecessorType, edge.predecessorId);
    const succKey = timelineNodeKey(edge.successorType, edge.successorId);
    const predInterval = derivedByKey.get(predKey);
    const succInterval = derivedByKey.get(succKey);
    if (!predInterval || !succInterval) continue;
    const hasConflict = hasEdgeDateConflict(
      predInterval.endMs,
      succInterval.startMs,
      succInterval.dueDateMs,
    );
    edgeConflictById.set(edge.id, hasConflict);
    if (hasConflict) {
      conflictMap.set(succKey, [...(conflictMap.get(succKey) ?? []), predKey]);
    }
  }

  const unscheduled: TimelineUnscheduledItem[] = [];
  const scheduledByLane = new Map<DependencyNodeType, TimelineNodeInput[]>([
    ['phase', []],
    ['task', []],
  ]);

  for (const node of [...allNodes].sort(nodeDeterministicOrder)) {
    const key = timelineNodeKey(node.type, node.id);
    const durationDays = durationDaysForSize(node.size);
    const isClosed = CLOSED_STATUSES.has(node.status);
    const isBlocked = isNodeBlocked(node, incomingByKey.get(key) ?? [], byKey, nowMs);
    const interval = derivedByKey.get(key) ?? null;

    if (!interval) {
      unscheduled.push({
        key,
        node,
        durationDays,
        isBlocked,
        isOverdue: false,
        isClosed,
        reason: 'missing_anchor',
      });
      continue;
    }

    scheduledByLane.get(node.type)!.push(node);
  }

  const laneDefinitions: { type: DependencyNodeType; label: string; nodes: TimelineNodeInput[] }[] =
    containerType === 'process'
      ? [
          { type: 'phase', label: 'Fases', nodes: scheduledByLane.get('phase') ?? [] },
          { type: 'task', label: 'Tarefas diretas', nodes: scheduledByLane.get('task') ?? [] },
        ]
      : [{ type: 'task', label: 'Tarefas da fase', nodes: scheduledByLane.get('task') ?? [] }];

  const visibleLanes = laneDefinitions.filter((lane) => lane.nodes.length > 0);
  const lanes: TimelineLaneLayout[] = [];
  const placedNodes: TimelineNodeLayout[] = [];
  let cursorY = DEFAULT_CANVAS_TOP_PADDING_PX;

  for (const lane of visibleLanes) {
    const sortedLaneNodes = [...lane.nodes].sort((left, right) => {
      const leftInterval = derivedByKey.get(timelineNodeKey(left.type, left.id))!;
      const rightInterval = derivedByKey.get(timelineNodeKey(right.type, right.id))!;
      return (
        leftInterval.startMs - rightInterval.startMs ||
        leftInterval.endMs - rightInterval.endMs ||
        nodeDeterministicOrder(left, right)
      );
    });

    const laneTop = cursorY;
    const rowsTop = laneTop + laneHeaderHeightPx;

    sortedLaneNodes.forEach((node, rowIndex) => {
      const key = timelineNodeKey(node.type, node.id);
      const interval = derivedByKey.get(key)!;
      const durationDays = durationDaysForSize(node.size);
      const isClosed = CLOSED_STATUSES.has(node.status);
      const isBlocked = isNodeBlocked(node, incomingByKey.get(key) ?? [], byKey, nowMs);
      const isOverdue = isNodeOverdue(node, interval, nowMs);
      const conflictPredecessorKeys = conflictMap.get(key) ?? [];

      const x = xForTimestamp(interval.startMs, rangeStartMs, dayWidthPx);
      const y = rowsTop + rowIndex * (rowHeightPx + rowGapPx);
      const centerY = y + rowHeightPx / 2;

      let nodeWidth: number;
      let anchorLeftX: number;
      let anchorRightX: number;

      if (interval.kind === 'milestone') {
        const dayCenterX = x + dayWidthPx / 2;
        nodeWidth = milestoneSizePx;
        anchorLeftX = dayCenterX - milestoneSizePx / 2;
        anchorRightX = dayCenterX + milestoneSizePx / 2;
      } else {
        const rawWidth = ((interval.endMs + 1 - interval.startMs) / MS_PER_DAY) * dayWidthPx;
        nodeWidth = Math.max(minBarWidthPx, rawWidth);
        anchorLeftX = x;
        anchorRightX = x + nodeWidth;
      }

      placedNodes.push({
        key,
        node,
        kind: interval.kind,
        anchorSource: interval.anchorSource,
        durationDays,
        startMs: interval.startMs,
        endMs: interval.endMs,
        startDateIso: formatUtcYmd(interval.startMs),
        endDateIso: formatUtcYmd(interval.endMs),
        dueDateMs: interval.dueDateMs,
        laneType: lane.type,
        row: rowIndex,
        x: interval.kind === 'milestone' ? anchorLeftX : x,
        y,
        width: nodeWidth,
        height: rowHeightPx,
        anchorLeftX,
        anchorRightX,
        centerY,
        hasDateConflict: conflictPredecessorKeys.length > 0,
        conflictPredecessorKeys,
        isOverdue,
        isBlocked,
        isClosed,
      });
    });

    const laneHeight =
      laneHeaderHeightPx +
      sortedLaneNodes.length * rowHeightPx +
      Math.max(0, sortedLaneNodes.length - 1) * rowGapPx;
    lanes.push({
      type: lane.type,
      label: lane.label,
      y: laneTop,
      height: laneHeight,
      nodeCount: sortedLaneNodes.length,
    });
    cursorY = laneTop + laneHeight + laneGapPx;
  }

  const placedByKey = new Map(placedNodes.map((item) => [item.key, item]));
  const edges: TimelineEdgeLayout[] = [];
  for (const edge of graph.edges ?? []) {
    const predecessorKey = timelineNodeKey(edge.predecessorType, edge.predecessorId);
    const successorKey = timelineNodeKey(edge.successorType, edge.successorId);
    const source = placedByKey.get(predecessorKey);
    const target = placedByKey.get(successorKey);
    if (!source || !target) continue;
    const sourceX = source.anchorRightX;
    const sourceY = source.centerY;
    const targetX = target.anchorLeftX;
    const targetY = target.centerY;
    edges.push({
      id: edge.id,
      edge,
      predecessorKey,
      successorKey,
      path: bezierEdgePath(sourceX, sourceY, targetX, targetY),
      sourceX,
      sourceY,
      targetX,
      targetY,
      hasConflict: edgeConflictById.get(edge.id) ?? false,
    });
  }

  const height = visibleLanes.length
    ? cursorY - laneGapPx + DEFAULT_CANVAS_BOTTOM_PADDING_PX
    : 120;

  return {
    zoom,
    dayWidthPx,
    rangeStartMs,
    rangeEndMs,
    totalDays,
    width,
    height,
    nowMs,
    todayX,
    rawTodayX,
    ticks,
    lanes,
    nodes: placedNodes,
    edges,
    unscheduled,
  };
}
