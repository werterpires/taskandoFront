import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiService } from '../../api.service';
import {
  DependencyEdge,
  DependencyGraph,
  DependencyGraphComponent,
  DependencyNode,
  layoutDependencyGraph,
} from './dependency-graph.component';

function node(id: string, type: 'task' | 'phase' = 'task', overrides: Partial<DependencyNode> = {}): DependencyNode {
  return {
    id,
    type,
    title: id.toLocaleUpperCase(),
    status: 'todo',
    released: false,
    containerType: type === 'phase' ? 'process' : 'process',
    containerId: 'process-1',
    processId: 'process-1',
    dependencyState: 'independent',
    dependencyBlockers: [],
    canConnect: true,
    ...overrides,
  };
}

function edge(id: string, predecessor: DependencyNode, successor: DependencyNode, canRemove = true): DependencyEdge {
  return {
    id,
    predecessorType: predecessor.type,
    predecessorId: predecessor.id,
    successorType: successor.type,
    successorId: successor.id,
    canRemove,
  };
}

function graph(tasks: DependencyNode[], phases: DependencyNode[] = [], edges: DependencyEdge[] = []): DependencyGraph {
  return { tasks, phases, edges };
}

async function createFixture(api: { request: ReturnType<typeof vi.fn> }, value: DependencyGraph, readOnly = false) {
  await TestBed.configureTestingModule({
    imports: [DependencyGraphComponent],
    providers: [
      { provide: ApiService, useValue: api },
      { provide: Router, useValue: { navigate: vi.fn() } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(DependencyGraphComponent);
  fixture.componentRef.setInput('graph', value);
  fixture.componentRef.setInput('containerType', 'process');
  fixture.componentRef.setInput('containerId', 'process-1');
  fixture.componentRef.setInput('readOnly', readOnly);
  fixture.detectChanges();
  return fixture;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
});

describe('dependency graph layout', () => {
  it('keeps isolated nodes, multiple predecessors and process lanes stable', () => {
    const phaseA = node('phase-a', 'phase', { position: 1 });
    const phaseB = node('phase-b', 'phase', { position: 2 });
    const taskA = node('task-a');
    const taskB = node('task-b', 'task', { dependencyState: 'blocked' });
    const isolated = node('isolated');
    const value = graph(
      [taskA, taskB, isolated],
      [phaseA, phaseB],
      [edge('phase-edge', phaseA, phaseB), edge('task-edge-a', taskA, taskB), edge('task-edge-b', isolated, taskB)],
    );

    const first = layoutDependencyGraph(value, 'process', 640);
    const second = layoutDependencyGraph(value, 'process', 640);
    const positions = new Map(first.nodes.map(item => [item.key, item]));
    const phaseBottom = Math.max(...first.nodes.filter(item => item.node.type === 'phase').map(item => item.y));
    const taskTop = Math.min(...first.nodes.filter(item => item.node.type === 'task').map(item => item.y));

    expect(second).toEqual(first);
    expect(first.nodes).toHaveLength(5);
    expect(first.edges).toHaveLength(3);
    expect(positions.get('task:isolated')).toBeDefined();
    expect(positions.get('task:task-b')!.x).toBeGreaterThan(positions.get('task:task-a')!.x);
    expect(positions.get('task:task-b')!.x).toBeGreaterThan(positions.get('task:isolated')!.x);
    expect(taskTop).toBeGreaterThan(phaseBottom);
  });
});

describe('DependencyGraphComponent', () => {
  it('creates a connection through the keyboard flow and reloads before drawing it', async () => {
    const source = node('source');
    const target = node('target');
    const created = edge('edge-1', source, target);
    const api = {
      request: vi.fn(async (path: string, method = 'GET') => {
        if (path === 'dependencies' && method === 'POST') return { edge: created };
        if (path.startsWith('dependencies?')) return graph([source, target], [], [created]);
        throw new Error(`Unexpected request: ${method} ${path}`);
      }),
    };
    const fixture = await createFixture(api, graph([source, target]));
    const component = fixture.componentInstance;
    const preventDefault = vi.fn();

    component.activateSource(source, { detail: 0, preventDefault } as unknown as MouseEvent);
    expect(component.currentGraph().edges).toHaveLength(0);
    component.activateTarget(target, { detail: 0, preventDefault } as unknown as MouseEvent);
    expect(component.pending()).toBe(true);
    expect(component.previewPath()).not.toBeNull();
    expect(component.currentGraph().edges).toHaveLength(0);

    await vi.waitFor(() => expect(component.pending()).toBe(false));
    expect(api.request).toHaveBeenNthCalledWith(1, 'dependencies', 'POST', {
      predecessorType: 'task',
      predecessorId: 'source',
      successorType: 'task',
      successorId: 'target',
    });
    expect(api.request).toHaveBeenNthCalledWith(2, 'dependencies?containerType=process&containerId=process-1');
    expect(component.currentGraph().edges).toEqual([created]);
    expect(component.message()).toContain('criada');
  });

  it('supports Pointer Events and leaves no false line when creation fails', async () => {
    const source = node('source');
    const target = node('target');
    const api = { request: vi.fn(async () => { throw new Error('Ciclo detectado.'); }) };
    const fixture = await createFixture(api, graph([source, target]));
    const component = fixture.componentInstance;
    const targetPort = fixture.nativeElement.querySelector('[data-graph-target-key="task:target"]') as HTMLElement;
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => targetPort) });
    const pointer = {
      pointerType: 'touch',
      button: 0,
      pointerId: 7,
      clientX: 100,
      clientY: 100,
      currentTarget: { setPointerCapture: vi.fn() },
      preventDefault: vi.fn(),
    } as unknown as PointerEvent;

    component.startPointer(source, { ...pointer, pointerType: 'mouse' } as unknown as PointerEvent);
    expect(component.connection()?.mode).toBe('pointer');
    component.cancelConnection();

    component.startPointer(source, pointer);
    component.movePointer(pointer);
    component.endPointer(pointer);
    Reflect.deleteProperty(document, 'elementFromPoint');

    await vi.waitFor(() => expect(component.pending()).toBe(false));
    expect(api.request).toHaveBeenCalledOnce();
    expect(component.currentGraph().edges).toEqual([]);
    expect(component.errorMessage()).toBe('Ciclo detectado.');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.dependency-line:not(.dependency-preview)')).toHaveLength(0);
  });

  it('offers an accessible removal action only for removable edges and reloads after deletion', async () => {
    const source = node('source');
    const target = node('target');
    const removable = edge('edge-1', source, target, true);
    const api = {
      request: vi.fn(async (path: string, method = 'GET') => {
        if (path === 'dependencies/edge-1' && method === 'DELETE') return { ok: true };
        if (path.startsWith('dependencies?')) return graph([source, target]);
        throw new Error(`Unexpected request: ${method} ${path}`);
      }),
    };
    const fixture = await createFixture(api, graph([source, target], [], [removable]));
    const button = fixture.nativeElement.querySelector('.remove-edge') as HTMLButtonElement;

    expect(button.getAttribute('aria-label')).toContain('source para target');
    button.click();

    await vi.waitFor(() => expect(fixture.componentInstance.pending()).toBe(false));
    expect(api.request).toHaveBeenNthCalledWith(1, 'dependencies/edge-1', 'DELETE', {});
    expect(api.request).toHaveBeenNthCalledWith(2, 'dependencies?containerType=process&containerId=process-1');
    expect(fixture.componentInstance.currentGraph().edges).toEqual([]);
  });

  it('respects read-only mode and edge removal permissions', async () => {
    const source = node('source');
    const target = node('target');
    const removable = edge('edge-1', source, target, true);
    const locked = edge('edge-2', target, source, false);
    const api = { request: vi.fn() };
    const fixture = await createFixture(api, graph([source, target], [], [removable, locked]), true);
    const component = fixture.componentInstance;

    expect(component.sourceAvailable(source)).toBe(false);
    expect(fixture.nativeElement.querySelectorAll('.remove-edge')).toHaveLength(0);
    await component.removeDependency(removable);
    expect(api.request).not.toHaveBeenCalled();
  });

  it('recalculates the responsive canvas when ResizeObserver reports a new width', async () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    class ResizeObserverMock {
      constructor(callback: ResizeObserverCallback) { resizeCallback = callback; }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
    const api = { request: vi.fn() };
    const fixture = await createFixture(api, graph([node('single')]));

    resizeCallback?.([{ contentRect: { width: 912 } } as ResizeObserverEntry], {} as ResizeObserver);
    fixture.detectChanges();

    expect(fixture.componentInstance.viewportWidth()).toBe(912);
    expect(fixture.componentInstance.layout().width).toBeGreaterThanOrEqual(912);
  });
});
