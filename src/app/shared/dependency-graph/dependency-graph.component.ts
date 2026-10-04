import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ApiService } from '../../api.service';
import { DrawerService } from '../drawer.service';

export type DependencyNodeType = 'task' | 'phase';
export type DependencyState = 'independent' | 'blocked' | 'released';

export type DependencyNode = {
  type: DependencyNodeType;
  id: string;
  title: string;
  status: string;
  released?: boolean;
  position?: number;
  containerType: 'process' | 'phase';
  containerId: string;
  processId: string;
  dependencyState: DependencyState;
  dependencyBlockers: { type: DependencyNodeType; id: string; title: string }[];
  canConnect: boolean;
};

export type DependencyEdge = {
  id: string;
  predecessorType: DependencyNodeType;
  predecessorId: string;
  successorType: DependencyNodeType;
  successorId: string;
  canRemove: boolean;
};

export type DependencyGraph = {
  tasks: DependencyNode[];
  phases: DependencyNode[];
  edges: DependencyEdge[];
};

export const EMPTY_DEPENDENCY_GRAPH: DependencyGraph = { tasks: [], phases: [], edges: [] };

const NODE_WIDTH = 224;
const NODE_HEIGHT = 166;
const COLUMN_GAP = 92;
const ROW_GAP = 26;
const CANVAS_PADDING = 28;
const LANE_HEADER_HEIGHT = 46;
const LANE_GAP = 34;

type PlacedNode = { key: string; node: DependencyNode; x: number; y: number };
type PlacedEdge = { edge: DependencyEdge; path: string; removeX: number; removeY: number };
type GraphLane = { type: DependencyNodeType; label: string; y: number };

export type DependencyGraphLayout = {
  width: number;
  height: number;
  nodes: PlacedNode[];
  edges: PlacedEdge[];
  lanes: GraphLane[];
};

type ConnectionPreview = {
  mode: 'pointer' | 'keyboard';
  sourceKey: string;
  targetKey?: string;
  x: number;
  y: number;
};

let graphInstance = 0;

function nodeKey(type: DependencyNodeType, id: string): string {
  return `${type}:${id}`;
}

function nodeOrder(left: DependencyNode, right: DependencyNode): number {
  const position = (left.position ?? Number.MAX_SAFE_INTEGER) - (right.position ?? Number.MAX_SAFE_INTEGER);
  return position || left.title.localeCompare(right.title, 'pt-BR') || left.id.localeCompare(right.id);
}

function edgePath(sourceX: number, sourceY: number, targetX: number, targetY: number): string {
  const reach = Math.max(38, Math.abs(targetX - sourceX) * 0.45);
  return `M ${sourceX} ${sourceY} C ${sourceX + reach} ${sourceY}, ${targetX - reach} ${targetY}, ${targetX} ${targetY}`;
}

function laneLayout(nodes: DependencyNode[], edges: DependencyEdge[], laneTop: number): { nodes: PlacedNode[]; height: number; levels: number } {
  const ordered = [...nodes].sort(nodeOrder);
  const byId = new Map(ordered.map(node => [node.id, node]));
  const incoming = new Map(ordered.map(node => [node.id, 0]));
  const outgoing = new Map(ordered.map(node => [node.id, [] as string[]]));
  const level = new Map(ordered.map(node => [node.id, 0]));

  for (const edge of edges) {
    if (!byId.has(edge.predecessorId) || !byId.has(edge.successorId)) continue;
    incoming.set(edge.successorId, (incoming.get(edge.successorId) ?? 0) + 1);
    outgoing.get(edge.predecessorId)?.push(edge.successorId);
  }
  for (const successors of outgoing.values()) successors.sort((left, right) => nodeOrder(byId.get(left)!, byId.get(right)!));

  const ready = ordered.filter(node => incoming.get(node.id) === 0);
  const processed = new Set<string>();
  while (ready.length) {
    ready.sort(nodeOrder);
    const current = ready.shift()!;
    processed.add(current.id);
    for (const successorId of outgoing.get(current.id) ?? []) {
      level.set(successorId, Math.max(level.get(successorId) ?? 0, (level.get(current.id) ?? 0) + 1));
      const remaining = (incoming.get(successorId) ?? 1) - 1;
      incoming.set(successorId, remaining);
      if (remaining === 0) ready.push(byId.get(successorId)!);
    }
  }

  // The API rejects cycles. Keeping any unexpected nodes in a final column still
  // makes the graph inspectable instead of dropping content from the projection.
  const maximumLevel = Math.max(0, ...level.values());
  for (const node of ordered) if (!processed.has(node.id)) level.set(node.id, maximumLevel + 1);

  const columns = new Map<number, DependencyNode[]>();
  for (const node of ordered) {
    const nodeLevel = level.get(node.id) ?? 0;
    columns.set(nodeLevel, [...(columns.get(nodeLevel) ?? []), node]);
  }
  const rows = Math.max(1, ...[...columns.values()].map(column => column.length));
  const placed = [...columns.entries()].flatMap(([column, columnNodes]) => columnNodes.sort(nodeOrder).map((node, row) => ({
    key: nodeKey(node.type, node.id),
    node,
    x: CANVAS_PADDING + column * (NODE_WIDTH + COLUMN_GAP),
    y: laneTop + LANE_HEADER_HEIGHT + row * (NODE_HEIGHT + ROW_GAP),
  })));
  return {
    nodes: placed,
    height: LANE_HEADER_HEIGHT + rows * NODE_HEIGHT + Math.max(0, rows - 1) * ROW_GAP + CANVAS_PADDING,
    levels: Math.max(0, ...columns.keys()) + 1,
  };
}

/** Pure, deterministic layout used by the component and unit tests. */
export function layoutDependencyGraph(graph: DependencyGraph, containerType: 'process' | 'phase', viewportWidth: number): DependencyGraphLayout {
  const lanes: { type: DependencyNodeType; label: string; nodes: DependencyNode[] }[] = containerType === 'process'
    ? [
        { type: 'phase', label: 'Fases', nodes: graph.phases },
        { type: 'task', label: 'Tarefas diretas', nodes: graph.tasks },
      ]
    : [{ type: 'task', label: 'Tarefas da fase', nodes: graph.tasks }];
  const visibleLanes = lanes.filter(lane => lane.nodes.length);
  const placedNodes: PlacedNode[] = [];
  const graphLanes: GraphLane[] = [];
  let top = CANVAS_PADDING;
  let levelCount = 1;

  for (const lane of visibleLanes) {
    graphLanes.push({ type: lane.type, label: lane.label, y: top });
    const laneEdges = graph.edges.filter(edge => edge.predecessorType === lane.type && edge.successorType === lane.type);
    const result = laneLayout(lane.nodes, laneEdges, top);
    placedNodes.push(...result.nodes);
    levelCount = Math.max(levelCount, result.levels);
    top += result.height + LANE_GAP;
  }

  const byKey = new Map(placedNodes.map(node => [node.key, node]));
  const placedEdges = graph.edges.flatMap(edge => {
    const source = byKey.get(nodeKey(edge.predecessorType, edge.predecessorId));
    const target = byKey.get(nodeKey(edge.successorType, edge.successorId));
    if (!source || !target || source.node.type !== target.node.type) return [];
    const sourceX = source.x + NODE_WIDTH;
    const sourceY = source.y + NODE_HEIGHT / 2;
    const targetX = target.x;
    const targetY = target.y + NODE_HEIGHT / 2;
    return [{
      edge,
      path: edgePath(sourceX, sourceY, targetX, targetY),
      removeX: (sourceX + targetX) / 2 - 22,
      removeY: (sourceY + targetY) / 2 - 22,
    }];
  });
  const contentWidth = CANVAS_PADDING * 2 + levelCount * NODE_WIDTH + Math.max(0, levelCount - 1) * COLUMN_GAP;
  return {
    width: Math.max(Math.max(320, viewportWidth), contentWidth),
    height: visibleLanes.length ? Math.max(220, top - LANE_GAP) : 220,
    nodes: placedNodes,
    edges: placedEdges,
    lanes: graphLanes,
  };
}

@Component({
  selector: 'app-dependency-graph',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dependency-graph.component.html',
  styleUrl: './dependency-graph.component.css',
})
export class DependencyGraphComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly drawer = inject(DrawerService);
  private readonly zone = inject(NgZone);
  private readonly instanceId = ++graphInstance;
  private resizeObserver?: ResizeObserver;

  openNode(node: DependencyNode): void {
    const tab = node.type === 'phase' ? 'Filhos' : 'Detalhes';
    void this.drawer.open(
      { id: node.id, title: node.title, kind: node.type, status: node.status },
      tab,
    );
  }

  @Input({ required: true }) graph: DependencyGraph = EMPTY_DEPENDENCY_GRAPH;
  @Input({ required: true }) containerType: 'process' | 'phase' = 'process';
  @Input({ required: true }) containerId = '';
  @Input() readOnly = false;
  @Output() readonly graphChange = new EventEmitter<DependencyGraph>();

  @ViewChild('viewport') private viewport?: ElementRef<HTMLElement>;
  @ViewChild('canvas') private canvas?: ElementRef<HTMLElement>;

  readonly markerId = `dependency-arrow-${this.instanceId}`;
  readonly currentGraph = signal<DependencyGraph>(EMPTY_DEPENDENCY_GRAPH);
  readonly viewportWidth = signal(720);
  readonly pending = signal(false);
  readonly connection = signal<ConnectionPreview | null>(null);
  readonly message = signal('');
  readonly errorMessage = signal('');
  readonly layout = computed(() => layoutDependencyGraph(this.currentGraph(), this.containerType, this.viewportWidth()));
  readonly previewPath = computed(() => {
    const preview = this.connection();
    if (!preview || (preview.mode === 'keyboard' && !preview.targetKey)) return null;
    const source = this.layout().nodes.find(node => node.key === preview.sourceKey);
    if (!source) return null;
    const target = preview.targetKey ? this.layout().nodes.find(node => node.key === preview.targetKey) : undefined;
    return edgePath(
      source.x + NODE_WIDTH,
      source.y + NODE_HEIGHT / 2,
      target?.x ?? preview.x,
      target ? target.y + NODE_HEIGHT / 2 : preview.y,
    );
  });

  readonly statusLabels: Record<string, string> = {
    planned: 'Planejado',
    todo: 'A fazer',
    in_progress: 'Em execução',
    awaiting_approval: 'Aguardando aprovação',
    completed: 'Concluído',
    cancelled: 'Cancelado',
    archived: 'Arquivado',
  };
  readonly statusSymbols: Record<string, string> = {
    planned: '○',
    todo: '◌',
    in_progress: '◐',
    awaiting_approval: '◫',
    completed: '●',
    cancelled: '×',
    archived: '□',
  };
  readonly dependencyLabels: Record<DependencyState, string> = {
    independent: 'Independente',
    blocked: 'Bloqueado',
    released: 'Liberado',
  };
  readonly dependencySymbols: Record<DependencyState, string> = {
    independent: '◇',
    blocked: '⊘',
    released: '→',
  };

  private readonly onWindowResize = () => this.measureViewport();

  ngOnChanges(): void {
    this.currentGraph.set(this.normalizedGraph(this.graph));
    this.cancelConnection();
  }

  ngAfterViewInit(): void {
    this.measureViewport();
    if (typeof ResizeObserver !== 'undefined' && this.viewport) {
      this.resizeObserver = new ResizeObserver(entries => {
        const width = entries[0]?.contentRect.width;
        if (width) this.zone.run(() => this.viewportWidth.set(Math.floor(width)));
      });
      this.resizeObserver.observe(this.viewport.nativeElement);
    } else if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.onWindowResize);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.onWindowResize);
  }

  sourceAvailable(node: DependencyNode): boolean {
    return !this.readOnly && !this.pending() && node.canConnect;
  }

  targetAvailable(node: DependencyNode): boolean {
    const preview = this.connection();
    if (!preview) return false;
    const source = this.nodeByKey(preview.sourceKey);
    return Boolean(source && this.validConnection(source, node));
  }

  startPointer(node: DependencyNode, event: PointerEvent): void {
    if (!this.sourceAvailable(node) || (event.pointerType === 'mouse' && event.button !== 0)) return;
    event.preventDefault();
    const placed = this.placedNode(node);
    if (!placed) return;
    this.errorMessage.set('');
    this.connection.set({
      mode: 'pointer',
      sourceKey: nodeKey(node.type, node.id),
      x: placed.x + NODE_WIDTH,
      y: placed.y + NODE_HEIGHT / 2,
    });
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
  }

  movePointer(event: PointerEvent): void {
    const preview = this.connection();
    if (!preview || preview.mode !== 'pointer') return;
    const point = this.canvasPoint(event.clientX, event.clientY);
    this.connection.set({ ...preview, ...point, targetKey: this.targetKeyAt(event.clientX, event.clientY) });
  }

  endPointer(event: PointerEvent): void {
    const preview = this.connection();
    if (!preview || preview.mode !== 'pointer') return;
    event.preventDefault();
    const targetKey = this.targetKeyAt(event.clientX, event.clientY) ?? preview.targetKey;
    const source = this.nodeByKey(preview.sourceKey);
    const target = targetKey ? this.nodeByKey(targetKey) : undefined;
    if (source && target && this.validConnection(source, target)) {
      const point = this.canvasPoint(event.clientX, event.clientY);
      this.connection.set({ ...preview, ...point, targetKey });
      void this.createDependency(source, target);
    } else {
      this.cancelConnection();
    }
  }

  activateSource(node: DependencyNode, event: MouseEvent): void {
    if (event.detail !== 0 || !this.sourceAvailable(node)) return;
    event.preventDefault();
    const key = nodeKey(node.type, node.id);
    if (this.connection()?.sourceKey === key) {
      this.cancelConnection();
      return;
    }
    const placed = this.placedNode(node);
    this.connection.set({
      mode: 'keyboard',
      sourceKey: key,
      x: (placed?.x ?? 0) + NODE_WIDTH,
      y: (placed?.y ?? 0) + NODE_HEIGHT / 2,
    });
    this.message.set(`${node.title} selecionado como predecessor. Escolha a porta de entrada da sucessora.`);
  }

  previewKeyboardTarget(node: DependencyNode): void {
    const preview = this.connection();
    if (preview?.mode === 'keyboard' && this.targetAvailable(node)) {
      this.connection.set({ ...preview, targetKey: nodeKey(node.type, node.id) });
    }
  }

  activateTarget(node: DependencyNode, event: MouseEvent): void {
    if (event.detail !== 0 || !this.targetAvailable(node)) return;
    event.preventDefault();
    const preview = this.connection();
    const source = preview ? this.nodeByKey(preview.sourceKey) : undefined;
    if (preview && source) {
      this.connection.set({ ...preview, targetKey: nodeKey(node.type, node.id) });
      void this.createDependency(source, node);
    }
  }

  cancelConnection(): void {
    this.connection.set(null);
  }

  async removeDependency(edge: DependencyEdge): Promise<void> {
    if (this.readOnly || !edge.canRemove || this.pending()) return;
    const description = this.edgeLabel(edge);
    this.pending.set(true);
    this.errorMessage.set('');
    try {
      await this.api.request(`dependencies/${edge.id}`, 'DELETE', {});
      this.setGraph({ ...this.currentGraph(), edges: this.currentGraph().edges.filter(item => item.id !== edge.id) });
      try {
        await this.reloadGraph();
        this.message.set(`${description} removida.`);
      } catch (error) {
        this.errorMessage.set(`A ligação foi removida, mas o grafo não pôde ser recarregado. ${this.errorText(error)}`);
        this.message.set('Ligação removida. A atualização completa do grafo falhou.');
      }
    } catch (error) {
      this.errorMessage.set(this.errorText(error));
      this.message.set(`Não foi possível remover ${description.toLocaleLowerCase()}.`);
    } finally {
      this.pending.set(false);
      this.cancelConnection();
    }
  }

  edgeLabel(edge: DependencyEdge): string {
    const source = this.nodeByKey(nodeKey(edge.predecessorType, edge.predecessorId));
    const target = this.nodeByKey(nodeKey(edge.successorType, edge.successorId));
    return `Dependência de ${source?.title ?? edge.predecessorId} para ${target?.title ?? edge.successorId}`;
  }

  nodeTypeLabel(node: DependencyNode): string {
    return node.type === 'phase' ? 'Fase' : 'Tarefa';
  }

  blockersLabel(node: DependencyNode): string {
    return node.dependencyBlockers.map(blocker => blocker.title).join(', ');
  }

  private async createDependency(source: DependencyNode, target: DependencyNode): Promise<void> {
    if (!this.validConnection(source, target) || this.pending()) return;
    this.pending.set(true);
    this.errorMessage.set('');
    try {
      await this.api.request('dependencies', 'POST', {
        predecessorType: source.type,
        predecessorId: source.id,
        successorType: target.type,
        successorId: target.id,
      });
      try {
        await this.reloadGraph();
        this.message.set(`Dependência de ${source.title} para ${target.title} criada.`);
      } catch (error) {
        this.errorMessage.set(`A ligação foi criada, mas o grafo não pôde ser recarregado. ${this.errorText(error)}`);
        this.message.set('Ligação criada. A atualização completa do grafo falhou.');
      }
    } catch (error) {
      this.errorMessage.set(this.errorText(error));
      this.message.set(`Não foi possível criar a dependência de ${source.title} para ${target.title}.`);
    } finally {
      this.pending.set(false);
      this.cancelConnection();
    }
  }

  private validConnection(source: DependencyNode, target: DependencyNode): boolean {
    if (this.readOnly || !source.canConnect || !target.canConnect || source.id === target.id || source.type !== target.type) return false;
    if (source.type === 'task' && (source.containerType !== target.containerType || source.containerId !== target.containerId)) return false;
    if (source.type === 'phase' && source.processId !== target.processId) return false;
    return !this.currentGraph().edges.some(edge => edge.predecessorType === source.type
      && edge.predecessorId === source.id
      && edge.successorType === target.type
      && edge.successorId === target.id);
  }

  private async reloadGraph(): Promise<void> {
    const graph = await this.api.request<DependencyGraph>(`dependencies?containerType=${this.containerType}&containerId=${encodeURIComponent(this.containerId)}`);
    this.setGraph(graph);
  }

  private setGraph(graph: DependencyGraph): void {
    const normalized = this.normalizedGraph(graph);
    this.currentGraph.set(normalized);
    this.graphChange.emit(normalized);
  }

  private normalizedGraph(graph: DependencyGraph | null | undefined): DependencyGraph {
    return { tasks: graph?.tasks ?? [], phases: graph?.phases ?? [], edges: graph?.edges ?? [] };
  }

  private nodeByKey(key: string): DependencyNode | undefined {
    return [...this.currentGraph().phases, ...this.currentGraph().tasks].find(node => nodeKey(node.type, node.id) === key);
  }

  private placedNode(node: DependencyNode): PlacedNode | undefined {
    return this.layout().nodes.find(item => item.key === nodeKey(node.type, node.id));
  }

  private canvasPoint(clientX: number, clientY: number): { x: number; y: number } {
    const bounds = this.canvas?.nativeElement.getBoundingClientRect();
    return { x: clientX - (bounds?.left ?? 0), y: clientY - (bounds?.top ?? 0) };
  }

  private targetKeyAt(clientX: number, clientY: number): string | undefined {
    const element = typeof document !== 'undefined' ? document.elementFromPoint(clientX, clientY) as HTMLElement | null : null;
    return element?.closest<HTMLElement>('[data-graph-target-key]')?.dataset['graphTargetKey'];
  }

  private measureViewport(): void {
    const width = this.viewport?.nativeElement.clientWidth;
    if (width) this.viewportWidth.set(width);
  }

  private errorText(error: unknown): string {
    return error instanceof Error ? error.message : 'Não foi possível concluir a alteração.';
  }
}
