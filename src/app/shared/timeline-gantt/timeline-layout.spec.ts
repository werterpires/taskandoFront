import { describe, expect, it } from 'vitest';
import type { DependencyEdge } from '../dependency-graph/dependency-graph.component';
import {
  DEFAULT_DURATION_DAYS,
  MS_PER_DAY,
  SIZE_DURATION_DAYS,
  ZOOM_DAY_WIDTH,
  bezierEdgePath,
  buildTimelineLayout,
  durationDaysForSize,
  hasEdgeDateConflict,
  type TimelineGraphInput,
  type TimelineNodeInput,
} from './timeline-layout';

function taskNode(overrides: Partial<TimelineNodeInput> & { id: string }): TimelineNodeInput {
  return {
    type: 'task',
    title: `Task ${overrides.id}`,
    status: 'todo',
    taskType: 'simple',
    containerType: 'process',
    containerId: 'proc-1',
    processId: 'proc-1',
    dependencyState: 'independent',
    dependencyBlockers: [],
    canConnect: true,
    ...overrides,
  };
}

function phaseNode(overrides: Partial<TimelineNodeInput> & { id: string }): TimelineNodeInput {
  return {
    type: 'phase',
    title: `Phase ${overrides.id}`,
    status: 'todo',
    containerType: 'process',
    containerId: 'proc-1',
    processId: 'proc-1',
    dependencyState: 'independent',
    dependencyBlockers: [],
    canConnect: true,
    dueDate: null,
    dateAt: null,
    startAt: null,
    endAt: null,
    durationMinutes: null,
    ...overrides,
  };
}

function edge(
  id: string,
  predecessorId: string,
  successorId: string,
  nodeType: 'task' | 'phase' = 'task',
): DependencyEdge {
  return {
    id,
    predecessorType: nodeType,
    predecessorId,
    successorType: nodeType,
    successorId,
    canRemove: true,
  };
}

describe('timeline-layout', () => {
  describe('size to duration mapping', () => {
    it('maps xs/s/m/l/xl and defaults unknown/null sizes to 3 days', () => {
      expect(SIZE_DURATION_DAYS).toEqual({ xs: 1, s: 2, m: 4, l: 7, xl: 14 });
      expect(durationDaysForSize('xs')).toBe(1);
      expect(durationDaysForSize('s')).toBe(2);
      expect(durationDaysForSize('m')).toBe(4);
      expect(durationDaysForSize('l')).toBe(7);
      expect(durationDaysForSize('xl')).toBe(14);
      expect(durationDaysForSize('L')).toBe(7);
      expect(durationDaysForSize(null)).toBe(DEFAULT_DURATION_DAYS);
      expect(durationDaysForSize(undefined)).toBe(DEFAULT_DURATION_DAYS);
      expect(durationDaysForSize('unknown')).toBe(DEFAULT_DURATION_DAYS);
    });
  });

  describe('interval derivation by task type and DAG topology', () => {
    it('derives event intervals from startAt..endAt', () => {
      const graph: TimelineGraphInput = {
        tasks: [
          taskNode({
            id: 'ev-1',
            taskType: 'event',
            startAt: '2026-12-04T09:00:00.000Z',
            endAt: '2026-12-06T18:00:00.000Z',
          }),
        ],
        phases: [],
        edges: [],
      };

      const layout = buildTimelineLayout(graph, { now: '2026-12-05T12:00:00.000Z' });
      expect(layout.nodes).toHaveLength(1);
      const node = layout.nodes[0];
      expect(node.kind).toBe('bar');
      expect(node.anchorSource).toBe('event');
      expect(node.startMs).toBe(Date.parse('2026-12-04T09:00:00.000Z'));
      expect(node.endMs).toBe(Date.parse('2026-12-06T18:00:00.000Z'));
      expect(node.startDateIso).toBe('2026-12-04');
      expect(node.endDateIso).toBe('2026-12-06');
    });

    it('derives commitment intervals from startAt + durationMinutes', () => {
      const graph: TimelineGraphInput = {
        tasks: [
          taskNode({
            id: 'com-1',
            taskType: 'commitment',
            startAt: '2026-12-04T14:00:00.000Z',
            durationMinutes: 90,
          }),
        ],
        phases: [],
        edges: [],
      };

      const layout = buildTimelineLayout(graph, { now: '2026-12-04T10:00:00.000Z' });
      const node = layout.nodes[0];
      expect(node.kind).toBe('bar');
      expect(node.anchorSource).toBe('commitment');
      expect(node.startMs).toBe(Date.parse('2026-12-04T14:00:00.000Z'));
      expect(node.endMs).toBe(Date.parse('2026-12-04T15:30:00.000Z'));
      expect(node.width).toBeGreaterThanOrEqual(14);
    });

    it('derives 1-day diamond milestone at dateAt for date tasks', () => {
      const graph: TimelineGraphInput = {
        tasks: [
          taskNode({
            id: 'dt-1',
            taskType: 'date',
            dateAt: '2026-12-10',
          }),
        ],
        phases: [],
        edges: [],
      };

      const layout = buildTimelineLayout(graph, { now: '2026-12-01' });
      const node = layout.nodes[0];
      expect(node.kind).toBe('milestone');
      expect(node.anchorSource).toBe('date');
      expect(node.startMs).toBe(Date.UTC(2026, 11, 10));
      expect(node.endMs).toBe(Date.UTC(2026, 11, 10, 23, 59, 59, 999));
      expect(node.startDateIso).toBe('2026-12-10');
      expect(node.endDateIso).toBe('2026-12-10');
    });

    it('derives simple task interval backwards from dueDate using size duration', () => {
      const graph: TimelineGraphInput = {
        tasks: [
          taskNode({
            id: 's-1',
            size: 'm', // 4 days
            dueDate: '2026-12-10',
          }),
          taskNode({
            id: 's-2',
            size: null, // default 3 days
            dueDate: '2026-12-10',
          }),
        ],
        phases: [],
        edges: [],
      };

      const layout = buildTimelineLayout(graph, { now: '2026-12-01' });
      const s1 = layout.nodes.find((n) => n.node.id === 's-1')!;
      const s2 = layout.nodes.find((n) => n.node.id === 's-2')!;
      expect(s1.anchorSource).toBe('dueDate');
      expect(s1.startDateIso).toBe('2026-12-07');
      expect(s1.endDateIso).toBe('2026-12-10');
      expect(s2.startDateIso).toBe('2026-12-08');
      expect(s2.endDateIso).toBe('2026-12-10');
    });

    it('chains undated simple tasks and phases topologically from predecessor end dates', () => {
      const graph: TimelineGraphInput = {
        tasks: [
          taskNode({ id: 't1', size: 's', dueDate: '2026-12-04' }), // Dec 3..Dec 4 (2d)
          taskNode({ id: 't2', size: 'm', dueDate: null, createdAt: '2026-11-01T00:00:00.000Z' }), // Dec 5..Dec 8 (4d)
          taskNode({ id: 't3', size: 'xs', dueDate: null, createdAt: '2026-11-01T00:00:00.000Z' }), // Dec 9..Dec 9 (1d)
        ],
        phases: [
          phaseNode({ id: 'p1', size: 's', createdAt: '2026-12-01T08:00:00.000Z' }), // unscheduled (no pred, no dueDate)
          phaseNode({ id: 'p2', size: 'm', createdAt: '2026-12-01T08:00:00.000Z' }), // pred p1 unscheduled -> createdAt + 4d (Dec 1..4)
          phaseNode({ id: 'p3', size: 's', createdAt: '2026-11-15T08:00:00.000Z' }), // pred p2 scheduled -> Dec 5..6
        ],
        edges: [
          edge('e1', 't1', 't2', 'task'),
          edge('e2', 't2', 't3', 'task'),
          edge('e3', 'p1', 'p2', 'phase'),
          edge('e4', 'p2', 'p3', 'phase'),
        ],
      };

      const layout = buildTimelineLayout(graph, { now: '2026-12-01' });

      const t2 = layout.nodes.find((n) => n.node.id === 't2')!;
      const t3 = layout.nodes.find((n) => n.node.id === 't3')!;
      expect(t2.anchorSource).toBe('predecessor');
      expect(t2.startDateIso).toBe('2026-12-05');
      expect(t2.endDateIso).toBe('2026-12-08');
      expect(t2.hasDateConflict).toBe(false);

      expect(t3.anchorSource).toBe('predecessor');
      expect(t3.startDateIso).toBe('2026-12-09');
      expect(t3.endDateIso).toBe('2026-12-09');

      // p1 is truly unanchored (no dueDate and no predecessors)
      expect(layout.unscheduled.map((u) => u.node.id)).toEqual(['p1']);

      // p2 has unscheduled predecessor p1 -> falls back to createdAt + duration
      const p2 = layout.nodes.find((n) => n.node.id === 'p2')!;
      const p3 = layout.nodes.find((n) => n.node.id === 'p3')!;
      expect(p2.anchorSource).toBe('createdAt');
      expect(p2.startDateIso).toBe('2026-12-01');
      expect(p2.endDateIso).toBe('2026-12-04');
      expect(p3.anchorSource).toBe('predecessor');
      expect(p3.startDateIso).toBe('2026-12-05');
      expect(p3.endDateIso).toBe('2026-12-06');
    });

    it('uses the latest predecessor end date in fan-in DAGs regardless of edge array order', () => {
      const graph: TimelineGraphInput = {
        tasks: [
          taskNode({ id: 'succ', size: 's', dueDate: null }),
          taskNode({ id: 'pred-late', size: 'xs', dueDate: '2026-12-10' }),
          taskNode({ id: 'pred-early', size: 'xs', dueDate: '2026-12-02' }),
        ],
        phases: [],
        edges: [
          edge('e-early', 'pred-early', 'succ'),
          edge('e-late', 'pred-late', 'succ'),
        ],
      };

      const layout = buildTimelineLayout(graph, { now: '2026-12-01' });
      const succ = layout.nodes.find((n) => n.node.id === 'succ')!;
      expect(succ.startDateIso).toBe('2026-12-11');
      expect(succ.endDateIso).toBe('2026-12-12');
    });

    it('places truly unanchored items (missing dates on date/event/commitment or standalone undated simple) into unscheduled', () => {
      const graph: TimelineGraphInput = {
        tasks: [
          taskNode({ id: 'u-simple', taskType: 'simple', dueDate: null, createdAt: '2026-11-01T00:00:00Z' }),
          taskNode({ id: 'u-date', taskType: 'date', dateAt: null }),
          taskNode({ id: 'u-event', taskType: 'event', startAt: '2026-12-04T10:00:00Z', endAt: null }),
          taskNode({ id: 'u-commit', taskType: 'commitment', startAt: null, durationMinutes: 30 }),
          taskNode({ id: 'anchored', taskType: 'simple', dueDate: '2026-12-05', size: 'xs' }),
        ],
        phases: [],
        edges: [],
      };

      const layout = buildTimelineLayout(graph, { now: '2026-12-01' });
      expect(layout.nodes.map((n) => n.node.id)).toEqual(['anchored']);
      expect(layout.unscheduled.map((u) => u.node.id).sort()).toEqual([
        'u-commit',
        'u-date',
        'u-event',
        'u-simple',
      ]);
      expect(layout.unscheduled.every((u) => u.reason === 'missing_anchor')).toBe(true);
    });
  });

  describe('conflict detection, overdue, and blocked flags', () => {
    it('flags hasDateConflict when predecessor end > successor dueDate', () => {
      const graph: TimelineGraphInput = {
        tasks: [
          taskNode({ id: 'p', size: 'xs', dueDate: '2026-12-10' }),
          taskNode({ id: 's', size: 'xs', dueDate: '2026-12-08' }),
        ],
        phases: [],
        edges: [edge('e1', 'p', 's')],
      };

      const layout = buildTimelineLayout(graph, { now: '2026-12-01' });
      const succ = layout.nodes.find((n) => n.node.id === 's')!;
      const pred = layout.nodes.find((n) => n.node.id === 'p')!;
      expect(pred.hasDateConflict).toBe(false);
      expect(succ.hasDateConflict).toBe(true);
      expect(succ.conflictPredecessorKeys).toEqual(['task:p']);
      expect(layout.edges[0].hasConflict).toBe(true);
    });

    it('flags hasDateConflict when predecessor end >= successor start even if <= successor dueDate', () => {
      // p ends Dec 6; s is due Dec 8 with size m (4d => starts Dec 5..Dec 8)
      const graph: TimelineGraphInput = {
        tasks: [
          taskNode({ id: 'p', size: 's', dueDate: '2026-12-06' }),
          taskNode({ id: 's', size: 'm', dueDate: '2026-12-08' }),
        ],
        phases: [],
        edges: [edge('e1', 'p', 's')],
      };

      const layout = buildTimelineLayout(graph, { now: '2026-12-01' });
      const succ = layout.nodes.find((n) => n.node.id === 's')!;
      expect(succ.hasDateConflict).toBe(true);
      expect(layout.edges[0].hasConflict).toBe(true);
    });

    it('detects conflicts on same-day milestones and overlapping events/commitments, and clears when sequential', () => {
      expect(
        hasEdgeDateConflict(
          Date.parse('2026-12-04T12:00:00Z'),
          Date.parse('2026-12-04T12:00:00Z'),
          null,
        ),
      ).toBe(true);
      expect(
        hasEdgeDateConflict(
          Date.parse('2026-12-04T11:59:59Z'),
          Date.parse('2026-12-04T12:00:00Z'),
          null,
        ),
      ).toBe(false);

      const graph: TimelineGraphInput = {
        tasks: [
          taskNode({ id: 'm1', taskType: 'date', dateAt: '2026-12-04' }),
          taskNode({ id: 'm2', taskType: 'date', dateAt: '2026-12-04' }),
          taskNode({ id: 'm3', taskType: 'date', dateAt: '2026-12-05' }),
        ],
        phases: [],
        edges: [
          edge('e-same', 'm1', 'm2'),
          edge('e-next', 'm1', 'm3'),
        ],
      };

      const layout = buildTimelineLayout(graph, { now: '2026-12-01' });
      expect(layout.nodes.find((n) => n.node.id === 'm2')!.hasDateConflict).toBe(true);
      expect(layout.nodes.find((n) => n.node.id === 'm3')!.hasDateConflict).toBe(false);
    });

    it('computes isOverdue and isBlocked accurately across open and closed statuses', () => {
      const graph: TimelineGraphInput = {
        tasks: [
          taskNode({
            id: 'overdue-open',
            status: 'in_progress',
            dueDate: '2026-11-20',
            size: 'xs',
          }),
          taskNode({
            id: 'due-today',
            status: 'todo',
            dueDate: '2026-11-22',
            size: 'xs',
          }),
          taskNode({
            id: 'overdue-completed',
            status: 'completed',
            released: true,
            dueDate: '2026-11-20',
            size: 'xs',
          }),
          taskNode({
            id: 'blocked-open',
            status: 'todo',
            dependencyState: 'blocked',
            dueDate: '2026-11-25',
            size: 'xs',
          }),
          taskNode({
            id: 'blocked-cancelled',
            status: 'cancelled',
            dependencyState: 'blocked',
            dueDate: '2026-11-25',
            size: 'xs',
          }),
          taskNode({
            id: 'derived-old-created',
            status: 'todo',
            dueDate: null,
            createdAt: '2026-11-01T00:00:00Z',
          }),
          taskNode({
            id: 'unsched-pred',
            status: 'todo',
            dueDate: null,
          }),
        ],
        phases: [],
        edges: [
          edge('e-block', 'overdue-open', 'blocked-open'),
          edge('e-derived', 'unsched-pred', 'derived-old-created'),
        ],
      };

      const layout = buildTimelineLayout(graph, { now: '2026-11-22T15:00:00.000Z' });
      const byId = new Map(layout.nodes.map((n) => [n.node.id, n]));

      expect(byId.get('overdue-open')!.isOverdue).toBe(true);
      expect(byId.get('due-today')!.isOverdue).toBe(false);
      expect(byId.get('overdue-completed')!.isOverdue).toBe(false);
      expect(byId.get('overdue-completed')!.isClosed).toBe(true);
      expect(byId.get('blocked-open')!.isBlocked).toBe(true);
      expect(byId.get('blocked-cancelled')!.isBlocked).toBe(false);
      // Items anchored only via createdAt without a real deadline should not claim overdue
      expect(byId.get('derived-old-created')!.isOverdue).toBe(false);
    });
  });

  describe('zoom scales, tick headers, todayX, lanes, and Bézier SVG edges', () => {
    const sampleGraph: TimelineGraphInput = {
      phases: [
        phaseNode({ id: 'ph-1', size: 'm', createdAt: '2026-12-01T00:00:00Z' }),
        phaseNode({ id: 'ph-2', size: 's', createdAt: '2026-12-01T00:00:00Z' }),
      ],
      tasks: [
        taskNode({ id: 't-1', size: 's', dueDate: '2026-12-05' }),
        taskNode({ id: 't-2', taskType: 'date', dateAt: '2026-12-08' }),
      ],
      edges: [
        edge('ep', 'ph-1', 'ph-2', 'phase'),
        edge('et', 't-1', 't-2', 'task'),
      ],
    };

    it('generates day ticks, lanes, todayX inside range, and valid cubic Bézier SVG edge paths', () => {
      const layout = buildTimelineLayout(sampleGraph, {
        containerType: 'process',
        zoom: 'day',
        now: '2026-12-04T12:00:00.000Z',
      });

      expect(layout.zoom).toBe('day');
      expect(layout.dayWidthPx).toBe(ZOOM_DAY_WIDTH.day);
      expect(layout.lanes.map((l) => l.label)).toEqual(['Fases', 'Tarefas diretas']);
      expect(layout.ticks.length).toBe(layout.totalDays);

      const todayTick = layout.ticks.find((t) => t.isToday);
      expect(todayTick?.key).toBe('2026-12-04');
      expect(todayTick?.label).toBe('04/12');
      expect(layout.todayX).not.toBeNull();
      expect(layout.todayX!).toBeCloseTo(
        ((Date.parse('2026-12-04T12:00:00.000Z') - layout.rangeStartMs) / MS_PER_DAY) *
          ZOOM_DAY_WIDTH.day,
        4,
      );

      expect(layout.edges).toHaveLength(1); // ph-1 is unscheduled, so only t-1 -> t-2 edge is drawn
      expect(layout.edges[0].path).toMatch(/^M [\d.-]+ [\d.-]+ C [\d.-]+ [\d.-]+, [\d.-]+ [\d.-]+, [\d.-]+ [\d.-]+$/);
      expect(bezierEdgePath(10, 20, 110, 60)).toBe('M 10 20 C 55 20, 65 60, 110 60');
    });

    it('generates week and month zoom ticks and returns null todayX when out of range', () => {
      const weekLayout = buildTimelineLayout(sampleGraph, {
        containerType: 'phase',
        zoom: 'week',
        now: '2026-01-01T00:00:00.000Z',
      });
      expect(weekLayout.dayWidthPx).toBe(ZOOM_DAY_WIDTH.week);
      expect(weekLayout.todayX).toBeNull();
      expect(weekLayout.ticks.every((t) => t.width === 7 * ZOOM_DAY_WIDTH.week)).toBe(true);
      expect(weekLayout.lanes.map((l) => l.label)).toEqual(['Tarefas da fase']);

      const monthLayout = buildTimelineLayout(sampleGraph, {
        zoom: 'month',
        now: '2026-12-05T00:00:00.000Z',
      });
      expect(monthLayout.dayWidthPx).toBe(ZOOM_DAY_WIDTH.month);
      expect(monthLayout.ticks.some((t) => t.key === '2026-12' && t.label === 'Dez/2026' && t.isToday)).toBe(true);
      expect(monthLayout.todayX).not.toBeNull();
    });

    it('handles empty graphs and unexpected dependency cycles deterministically without throwing', () => {
      const empty = buildTimelineLayout({ tasks: [], phases: [], edges: [] }, { now: '2026-12-01' });
      expect(empty.nodes).toEqual([]);
      expect(empty.edges).toEqual([]);
      expect(empty.unscheduled).toEqual([]);
      expect(empty.ticks.length).toBeGreaterThan(0);
      expect(empty.todayX).not.toBeNull();

      const cyclic: TimelineGraphInput = {
        tasks: [
          taskNode({ id: 'a', dueDate: null, createdAt: '2026-12-01T00:00:00Z', size: 'xs' }),
          taskNode({ id: 'b', dueDate: null, createdAt: '2026-12-02T00:00:00Z', size: 'xs' }),
        ],
        phases: [],
        edges: [edge('c1', 'a', 'b'), edge('c2', 'b', 'a')],
      };
      const cyclicLayout = buildTimelineLayout(cyclic, { now: '2026-12-05' });
      expect(cyclicLayout.nodes).toHaveLength(2);
      expect(cyclicLayout.edges).toHaveLength(2);
    });
  });
});
