import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DependencyEdge } from '../dependency-graph/dependency-graph.component';
import { TimelineGanttComponent } from './timeline-gantt.component';
import type { TimelineGraphInput, TimelineNodeInput, TimelineZoom } from './timeline-layout';

function taskNode(overrides: Partial<TimelineNodeInput> & { id: string }): TimelineNodeInput {
  return {
    type: 'task',
    title: `Tarefa ${overrides.id}`,
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
    title: `Fase ${overrides.id}`,
    status: 'todo',
    containerType: 'process',
    containerId: 'proc-1',
    processId: 'proc-1',
    dependencyState: 'independent',
    dependencyBlockers: [],
    canConnect: true,
    ...overrides,
  };
}

function edge(
  id: string,
  predecessor: TimelineNodeInput,
  successor: TimelineNodeInput,
): DependencyEdge {
  return {
    id,
    predecessorType: predecessor.type,
    predecessorId: predecessor.id,
    successorType: successor.type,
    successorId: successor.id,
    canRemove: true,
  };
}

async function createFixture(options: {
  graph: TimelineGraphInput;
  containerType?: 'process' | 'phase';
  now?: string;
  zoom?: TimelineZoom;
}) {
  const router = { navigate: vi.fn() };
  await TestBed.configureTestingModule({
    imports: [TimelineGanttComponent],
    providers: [{ provide: Router, useValue: router }],
  }).compileComponents();

  const fixture = TestBed.createComponent(TimelineGanttComponent);
  fixture.componentRef.setInput('graph', options.graph);
  fixture.componentRef.setInput('containerType', options.containerType ?? 'process');
  if (options.now !== undefined) {
    fixture.componentRef.setInput('now', options.now);
  }
  if (options.zoom !== undefined) {
    fixture.componentRef.setInput('zoom', options.zoom);
  }
  fixture.detectChanges();
  return { fixture, router };
}

afterEach(() => {
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
});

describe('TimelineGanttComponent', () => {
  it('renders editorial empty state when there are no nodes', async () => {
    const { fixture } = await createFixture({
      graph: { tasks: [], phases: [], edges: [] },
      now: '2026-12-05T12:00:00.000Z',
    });

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.timeline-empty')?.textContent).toContain(
      'Nenhuma atividade disponível nesta projeção.',
    );
    expect(el.querySelector('.timeline-viewport')).toBeNull();
    expect(el.querySelector('.timeline-unscheduled')).toBeNull();
  });

  it('renders separate process lanes (Fases and Tarefas diretas) and phase lane (Tarefas da fase)', async () => {
    const p1 = phaseNode({ id: 'ph-1', title: 'Descoberta', dueDate: '2026-12-08', size: 's' });
    const t1 = taskNode({ id: 'tk-1', title: 'Briefing', dueDate: '2026-12-06', size: 'xs' });

    const { fixture } = await createFixture({
      graph: { phases: [p1], tasks: [t1], edges: [] },
      containerType: 'process',
      now: '2026-12-05T12:00:00.000Z',
    });

    const el = fixture.nativeElement as HTMLElement;
    const processLanes = Array.from(el.querySelectorAll('.timeline-lane h3')).map((h) =>
      h.textContent?.trim(),
    );
    expect(processLanes).toEqual(['Fases', 'Tarefas diretas']);

    fixture.componentRef.setInput('containerType', 'phase');
    fixture.componentRef.setInput('graph', {
      phases: [],
      tasks: [taskNode({ id: 'tk-2', containerType: 'phase', containerId: 'ph-1', dueDate: '2026-12-07' })],
      edges: [],
    });
    fixture.detectChanges();

    const phaseLanes = Array.from(el.querySelectorAll('.timeline-lane h3')).map((h) =>
      h.textContent?.trim(),
    );
    expect(phaseLanes).toEqual(['Tarefas da fase']);
  });

  it('switches zoom between Dia, Semana, and Mês and recalculates layout scale', async () => {
    const t1 = taskNode({ id: 'tk-1', dueDate: '2026-12-10', size: 'm' });
    const { fixture } = await createFixture({
      graph: { tasks: [t1], phases: [], edges: [] },
      now: '2026-12-05T12:00:00.000Z',
    });

    const el = fixture.nativeElement as HTMLElement;
    const dayBtn = el.querySelector('button[data-zoom="day"]') as HTMLButtonElement;
    const weekBtn = el.querySelector('button[data-zoom="week"]') as HTMLButtonElement;
    const monthBtn = el.querySelector('button[data-zoom="month"]') as HTMLButtonElement;

    expect(dayBtn.getAttribute('aria-pressed')).toBe('true');
    const dayWidth = fixture.componentInstance.layout().dayWidthPx;

    weekBtn.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.zoom()).toBe('week');
    expect(weekBtn.getAttribute('aria-pressed')).toBe('true');
    expect(dayBtn.getAttribute('aria-pressed')).toBe('false');
    expect(fixture.componentInstance.layout().dayWidthPx).toBeLessThan(dayWidth);

    monthBtn.click();
    fixture.detectChanges();
    expect(fixture.componentInstance.zoom()).toBe('month');
    expect(monthBtn.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.componentInstance.layout().ticks.some((t) => t.label.includes('/2026'))).toBe(true);
  });

  it('renders the vertical Hoje line only when now is within the visible timeline range', async () => {
    const t1 = taskNode({ id: 'tk-1', dueDate: '2026-12-08', size: 's' });
    const { fixture } = await createFixture({
      graph: { tasks: [t1], phases: [], edges: [] },
      now: '2026-12-07T12:00:00.000Z',
    });

    const el = fixture.nativeElement as HTMLElement;
    const todayLine = el.querySelector('.timeline-today-line') as HTMLElement | null;
    expect(todayLine).not.toBeNull();
    expect(todayLine?.textContent).toContain('Hoje');
    expect(el.querySelector('.timeline-today-jump')).not.toBeNull();

    fixture.componentRef.setInput('now', '2026-01-01T12:00:00.000Z');
    fixture.detectChanges();
    expect(el.querySelector('.timeline-today-line')).toBeNull();
    expect(el.querySelector('.timeline-today-jump')).toBeNull();
  });

  it('renders duration bars, milestone diamonds, and status/blocked/conflict/overdue indicators', async () => {
    const pred = taskNode({
      id: 'pred',
      title: 'Predecessora atrasada',
      status: 'in_progress',
      dueDate: '2026-12-04',
      size: 'xs',
    });
    const succ = taskNode({
      id: 'succ',
      title: 'Sucessora em conflito',
      status: 'todo',
      taskType: 'event',
      startAt: '2026-12-03T09:00:00.000Z',
      endAt: '2026-12-06T18:00:00.000Z',
      dueDate: '2026-12-06',
    });
    const milestone = taskNode({
      id: 'ms',
      title: 'Entrega final',
      taskType: 'date',
      dateAt: '2026-12-09',
      status: 'awaiting_approval',
    });

    const { fixture } = await createFixture({
      graph: {
        tasks: [pred, succ, milestone],
        phases: [],
        edges: [edge('e-1', pred, succ)],
      },
      now: '2026-12-05T12:00:00.000Z',
    });

    const el = fixture.nativeElement as HTMLElement;
    const predEl = el.querySelector('[data-node-key="task:pred"]') as HTMLElement;
    const succEl = el.querySelector('[data-node-key="task:succ"]') as HTMLElement;
    const msEl = el.querySelector('[data-node-key="task:ms"]') as HTMLElement;

    expect(predEl.dataset['kind']).toBe('bar');
    expect(predEl.dataset['overdue']).toBe('true');
    expect(predEl.textContent).toContain('Em execução');
    expect(predEl.textContent).toContain('Atrasado');

    expect(succEl.dataset['kind']).toBe('bar');
    expect(succEl.dataset['blocked']).toBe('true');
    expect(succEl.dataset['conflict']).toBe('true');
    expect(succEl.textContent).toContain('Bloqueado');
    expect(succEl.textContent).toContain('Conflito');

    expect(msEl.dataset['kind']).toBe('milestone');
    expect(msEl.querySelector('.milestone-diamond')).not.toBeNull();
    expect(msEl.textContent).toContain('Aguardando aprovação');

    const summaryText = el.querySelector('.timeline-summary')?.textContent ?? '';
    expect(summaryText).toContain('3 agendados');
    expect(summaryText).toContain('1 em conflito');
    expect(summaryText).toContain('1 atrasados');
    expect(summaryText).toContain('1 bloqueados');
  });

  it('renders interactive SVG dependency arrows and inspects/highlights dependencies on click or keyboard', async () => {
    const pred = taskNode({ id: 'pred', title: 'Analisar', dueDate: '2026-12-10', size: 's' });
    const succ = taskNode({ id: 'succ', title: 'Publicar', dueDate: '2026-12-08', size: 'xs' });

    const { fixture, router } = await createFixture({
      graph: {
        tasks: [pred, succ],
        phases: [],
        edges: [edge('edge-1', pred, succ)],
      },
      now: '2026-12-05T12:00:00.000Z',
    });

    const el = fixture.nativeElement as HTMLElement;
    const edgeGroup = el.querySelector('[data-edge-id="edge-1"]') as SVGGElement;
    const hitPath = edgeGroup.querySelector('.timeline-edge-hit') as SVGPathElement;

    expect(edgeGroup.getAttribute('data-conflict')).toBe('true');
    expect(edgeGroup.querySelector('.timeline-edge-path')?.getAttribute('d')).toContain('M ');

    hitPath.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fixture.detectChanges();

    const inspector = el.querySelector('.timeline-edge-inspector');
    expect(inspector).not.toBeNull();
    expect(inspector?.textContent).toContain('Conflito de dependência');
    expect(inspector?.textContent).toContain('Analisar');
    expect(inspector?.textContent).toContain('Publicar');
    expect(el.querySelector('[data-node-key="task:pred"]')?.classList.contains('is-edge-linked')).toBe(true);
    expect(el.querySelector('[data-node-key="task:succ"]')?.classList.contains('is-edge-linked')).toBe(true);

    const openSuccBtn = Array.from(el.querySelectorAll('.inspector-link')).find((btn) =>
      btn.textContent?.includes('Abrir sucessora'),
    ) as HTMLButtonElement;
    openSuccBtn.click();
    expect(router.navigate).toHaveBeenCalledWith(['/tarefas', 'succ']);

    const closeBtn = el.querySelector('.inspector-close') as HTMLButtonElement;
    closeBtn.click();
    fixture.detectChanges();
    expect(el.querySelector('.timeline-edge-inspector')).toBeNull();

    hitPath.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    fixture.detectChanges();
    expect(el.querySelector('.timeline-edge-inspector')).not.toBeNull();
  });

  it('renders collapsible Sem prazo definido bucket and navigates on click', async () => {
    const scheduled = taskNode({ id: 'sched', title: 'Com prazo', dueDate: '2026-12-08', size: 's' });
    const unscheduled = taskNode({ id: 'unsched', title: 'Sem data ainda', size: 'm' });

    const { fixture, router } = await createFixture({
      graph: { tasks: [scheduled, unscheduled], phases: [], edges: [] },
      now: '2026-12-05T12:00:00.000Z',
    });

    const el = fixture.nativeElement as HTMLElement;
    const toggle = el.querySelector('.unscheduled-toggle') as HTMLButtonElement;
    expect(toggle.textContent).toContain('Sem prazo definido');
    expect(toggle.textContent).toContain('1');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('.unscheduled-list')).toBeNull();

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    const itemBtn = el.querySelector('.unscheduled-item') as HTMLButtonElement;
    expect(itemBtn.textContent).toContain('Sem data ainda');
    expect(itemBtn.textContent).toContain('~4d');

    itemBtn.click();
    expect(router.navigate).toHaveBeenCalledWith(['/tarefas', 'unsched']);
  });

  it('auto-expands Sem prazo definido bucket when no scheduled items exist', async () => {
    const unscheduled = taskNode({ id: 'unsched', title: 'Sem data ainda', size: 'm' });
    const { fixture } = await createFixture({
      graph: { tasks: [unscheduled], phases: [], edges: [] },
      now: '2026-12-05T12:00:00.000Z',
    });
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.unscheduled-toggle')?.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelectorAll('.unscheduled-item')).toHaveLength(1);
  });

  it('navigates to /fases/:id for phases and /tarefas/:id for tasks on click', async () => {
    const p1 = phaseNode({ id: 'phase-42', title: 'Execução', dueDate: '2026-12-09', size: 'm' });
    const t1 = taskNode({ id: 'task-99', title: 'Revisar', dueDate: '2026-12-08', size: 's' });

    const { fixture, router } = await createFixture({
      graph: { phases: [p1], tasks: [t1], edges: [] },
      containerType: 'process',
      now: '2026-12-05T12:00:00.000Z',
    });

    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('[data-node-key="phase:phase-42"]') as HTMLButtonElement).click();
    expect(router.navigate).toHaveBeenNthCalledWith(1, ['/fases', 'phase-42']);

    (el.querySelector('[data-node-key="task:task-99"]') as HTMLButtonElement).click();
    expect(router.navigate).toHaveBeenNthCalledWith(2, ['/tarefas', 'task-99']);
  });
});
