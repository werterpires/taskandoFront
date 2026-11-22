import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  inject,
  input,
  model,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { STATUS_LABELS } from '../work-labels';
import {
  buildTimelineLayout,
  type TimelineAnchorSource,
  type TimelineEdgeLayout,
  type TimelineGraphInput,
  type TimelineLayout,
  type TimelineNodeInput,
  type TimelineNodeLayout,
  type TimelineUnscheduledItem,
  type TimelineZoom,
} from './timeline-layout';

export const EMPTY_TIMELINE_GRAPH: TimelineGraphInput = {
  tasks: [],
  phases: [],
  edges: [],
};

export const TIMELINE_ZOOM_OPTIONS: readonly { value: TimelineZoom; label: string }[] = [
  { value: 'day', label: 'Dia' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mês' },
];

const ANCHOR_SOURCE_LABELS: Readonly<Record<Exclude<TimelineAnchorSource, 'unscheduled'>, string>> = {
  event: 'Período do evento',
  commitment: 'Horário do compromisso',
  date: 'Marco de data',
  dueDate: 'Estimado pelo prazo',
  predecessor: 'Estimado por dependência',
  createdAt: 'Estimado pela criação',
};

let nextGanttInstance = 0;

@Component({
  selector: 'app-timeline-gantt',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './timeline-gantt.component.html',
  styleUrl: './timeline-gantt.component.css',
})
export class TimelineGanttComponent {
  private readonly router = inject(Router);
  private readonly instanceId = ++nextGanttInstance;

  readonly graph = input<TimelineGraphInput>(EMPTY_TIMELINE_GRAPH);
  readonly containerType = input<'process' | 'phase'>('process');
  readonly now = input<Date | number | string | undefined>(undefined);
  readonly zoom = model<TimelineZoom>('day');

  @ViewChild('viewport') private viewport?: ElementRef<HTMLElement>;

  readonly zoomOptions = TIMELINE_ZOOM_OPTIONS;
  readonly markerNormalId = `timeline-arrow-normal-${this.instanceId}`;
  readonly markerConflictId = `timeline-arrow-conflict-${this.instanceId}`;
  readonly markerActiveId = `timeline-arrow-active-${this.instanceId}`;

  readonly hoveredNodeKey = signal<string | null>(null);
  readonly hoveredEdgeId = signal<string | null>(null);
  readonly selectedEdgeId = signal<string | null>(null);
  private readonly unscheduledUserToggle = signal<boolean | null>(null);

  readonly layout = computed<TimelineLayout>(() =>
    buildTimelineLayout(this.graph() ?? EMPTY_TIMELINE_GRAPH, {
      containerType: this.containerType(),
      zoom: this.zoom(),
      now: this.now(),
    }),
  );

  readonly nodeByKey = computed(
    () => new Map(this.layout().nodes.map((node) => [node.key, node])),
  );

  readonly isUnscheduledOpen = computed(
    () =>
      this.unscheduledUserToggle() ??
      (this.layout().nodes.length === 0 && this.layout().unscheduled.length > 0),
  );

  readonly conflictCount = computed(
    () => this.layout().nodes.filter((item) => item.hasDateConflict).length,
  );

  readonly overdueCount = computed(
    () => this.layout().nodes.filter((item) => item.isOverdue).length,
  );

  readonly blockedCount = computed(
    () => this.layout().nodes.filter((item) => item.isBlocked).length,
  );

  readonly activeEdgeId = computed(() => this.hoveredEdgeId() ?? this.selectedEdgeId());

  readonly inspectedEdge = computed(() => {
    const edgeId = this.activeEdgeId();
    if (!edgeId) return null;
    const edge = this.layout().edges.find((item) => item.id === edgeId);
    if (!edge) return null;
    const byKey = this.nodeByKey();
    const predecessor = byKey.get(edge.predecessorKey) ?? null;
    const successor = byKey.get(edge.successorKey) ?? null;
    return {
      edge,
      predecessor,
      successor,
      predecessorTitle: predecessor?.node.title ?? edge.edge.predecessorId,
      successorTitle: successor?.node.title ?? edge.edge.successorId,
    };
  });

  setZoom(nextZoom: TimelineZoom): void {
    this.zoom.set(nextZoom);
  }

  toggleUnscheduled(): void {
    this.unscheduledUserToggle.set(!this.isUnscheduledOpen());
  }

  scrollToToday(): void {
    const todayX = this.layout().todayX;
    const el = this.viewport?.nativeElement;
    if (todayX === null || !el) return;
    el.scrollLeft = Math.max(0, todayX - el.clientWidth / 2);
  }

  selectEdge(edge: TimelineEdgeLayout, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    this.selectedEdgeId.update((current) => (current === edge.id ? null : edge.id));
  }

  clearInspectedEdge(): void {
    this.selectedEdgeId.set(null);
    this.hoveredEdgeId.set(null);
  }

  isEdgeHighlighted(edge: TimelineEdgeLayout): boolean {
    if (this.activeEdgeId() === edge.id) return true;
    const hoveredNode = this.hoveredNodeKey();
    return Boolean(
      hoveredNode && (edge.predecessorKey === hoveredNode || edge.successorKey === hoveredNode),
    );
  }

  isNodeHighlightedByEdge(key: string): boolean {
    const inspected = this.inspectedEdge();
    return Boolean(
      inspected &&
        (inspected.edge.predecessorKey === key || inspected.edge.successorKey === key),
    );
  }

  edgeMarkerUrl(edge: TimelineEdgeLayout): string {
    if (edge.hasConflict) return `url(#${this.markerConflictId})`;
    if (this.isEdgeHighlighted(edge)) return `url(#${this.markerActiveId})`;
    return `url(#${this.markerNormalId})`;
  }

  openNode(node: TimelineNodeInput): void {
    if (node.type === 'phase') {
      void this.router.navigate(['/fases', node.id]);
    } else {
      void this.router.navigate(['/tarefas', node.id]);
    }
  }

  statusLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  nodeTypeLabel(node: TimelineNodeInput): string {
    return node.type === 'phase' ? 'Fase' : 'Tarefa';
  }

  formatIsoBr(isoDate: string): string {
    const [year, month, day] = isoDate.split('-');
    return year && month && day ? `${day}/${month}/${year}` : isoDate;
  }

  hasInlineLabel(item: TimelineNodeLayout): boolean {
    return item.kind === 'bar' && item.width >= 150;
  }

  nodeAriaLabel(item: TimelineNodeLayout): string {
    const parts = [
      `Abrir ${this.nodeTypeLabel(item.node).toLocaleLowerCase('pt-BR')} ${item.node.title}`,
      this.statusLabel(item.node.status),
    ];
    if (item.kind === 'milestone') {
      parts.push(`em ${this.formatIsoBr(item.startDateIso)}`);
    } else {
      parts.push(`de ${this.formatIsoBr(item.startDateIso)} até ${this.formatIsoBr(item.endDateIso)}`);
    }
    if (item.hasDateConflict) parts.push('com conflito de datas');
    if (item.isBlocked) parts.push('bloqueado');
    if (item.isOverdue) parts.push('atrasado');
    return parts.join(' — ');
  }

  nodeTooltip(item: TimelineNodeLayout): string {
    const dateRange =
      item.kind === 'milestone'
        ? this.formatIsoBr(item.startDateIso)
        : `${this.formatIsoBr(item.startDateIso)} → ${this.formatIsoBr(item.endDateIso)}`;
    const lines = [
      `${this.nodeTypeLabel(item.node)}: ${item.node.title}`,
      `Status: ${this.statusLabel(item.node.status)}`,
      `Período: ${dateRange} (${ANCHOR_SOURCE_LABELS[item.anchorSource]})`,
    ];
    if (item.hasDateConflict) {
      lines.push('Conflito: predecessora termina após o início ou prazo desta atividade.');
    }
    if (item.isBlocked) lines.push('Bloqueado por dependência pendente.');
    if (item.isOverdue) lines.push('Prazo vencido.');
    return lines.join('\n');
  }

  edgeAriaLabel(edge: TimelineEdgeLayout): string {
    const byKey = this.nodeByKey();
    const predTitle = byKey.get(edge.predecessorKey)?.node.title ?? edge.predecessorKey;
    const succTitle = byKey.get(edge.successorKey)?.node.title ?? edge.successorKey;
    const suffix = edge.hasConflict ? ' (conflito de datas)' : '';
    return `Dependência de ${predTitle} para ${succTitle}${suffix}`;
  }

  unscheduledAriaLabel(item: TimelineUnscheduledItem): string {
    const parts = [
      `Abrir ${this.nodeTypeLabel(item.node).toLocaleLowerCase('pt-BR')} ${item.node.title}`,
      this.statusLabel(item.node.status),
      'sem prazo definido',
    ];
    if (item.isBlocked) parts.push('bloqueado');
    return parts.join(' — ');
  }
}
