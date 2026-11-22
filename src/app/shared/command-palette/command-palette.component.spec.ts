import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, ApiService } from '../../api.service';
import { DrawerService } from '../drawer.service';
import { ItemEditorService } from '../item-editor-modal/item-editor.service';
import { ToastService } from '../toast/toast.service';
import { WorkFilterService } from '../work-filter.service';
import {
  CommandPaletteComponent,
  SEARCH_DEBOUNCE_MS,
  SearchResultItem,
} from './command-palette.component';
import { CommandPaletteService } from './command-palette.service';

function makeSearchResult(overrides: Partial<SearchResultItem> & Pick<SearchResultItem, 'id' | 'type' | 'title'>): SearchResultItem {
  return {
    description: '',
    status: 'todo',
    taskType: null,
    dueDate: null,
    organizationId: null,
    parentTaskId: null,
    projectId: null,
    processId: null,
    updatedAt: '2026-11-22T10:00:00.000Z',
    parentChain: [],
    ...overrides,
  };
}

describe('CommandPaletteComponent', () => {
  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  function setup(options?: {
    apiRequest?: ReturnType<typeof vi.fn>;
    enabled?: boolean;
  }) {
    const api = {
      request: options?.apiRequest ?? vi.fn(async () => ({ query: '', items: [], total: 0 })),
      requestWithClosed: vi.fn(async () => ({})),
    };
    const router = {
      navigate: vi.fn(async () => true),
    };
    const drawer = {
      open: vi.fn(async () => {}),
      close: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [CommandPaletteComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: Router, useValue: router },
        { provide: DrawerService, useValue: drawer },
      ],
    });

    const fixture = TestBed.createComponent(CommandPaletteComponent);
    if (options?.enabled !== undefined) {
      fixture.componentRef.setInput('enabled', options.enabled);
    }
    fixture.detectChanges();

    const paletteService = TestBed.inject(CommandPaletteService);
    const itemEditor = TestBed.inject(ItemEditorService);
    const workFilter = TestBed.inject(WorkFilterService);
    const toast = TestBed.inject(ToastService);

    return {
      fixture,
      component: fixture.componentInstance,
      el: fixture.nativeElement as HTMLElement,
      api,
      router,
      drawer,
      paletteService,
      itemEditor,
      workFilter,
      toast,
    };
  }

  it('opens and toggles on global Ctrl+K and Cmd+K, and closes on Escape', () => {
    const { fixture, el, paletteService } = setup();

    expect(el.querySelector('[data-testid="command-palette"]')).toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true }));
    fixture.detectChanges();

    const dialog = el.querySelector('[data-testid="command-palette"]') as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(paletteService.isOpen()).toBe(true);

    // Pressing Cmd+K toggles closed
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, cancelable: true }));
    fixture.detectChanges();
    expect(paletteService.isOpen()).toBe(false);
    expect(el.querySelector('[data-testid="command-palette"]')).toBeNull();

    // Re-open with Cmd+K and close with Escape
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, cancelable: true }));
    fixture.detectChanges();
    expect(paletteService.isOpen()).toBe(true);

    const openDialog = el.querySelector('[data-testid="command-palette"]') as HTMLElement;
    openDialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
    fixture.detectChanges();
    expect(paletteService.isOpen()).toBe(false);
    expect(el.querySelector('[data-testid="command-palette"]')).toBeNull();

    fixture.destroy();
  });

  it('does not open via shortcut when disabled or when ItemEditorModal is already open', () => {
    const { fixture, paletteService, itemEditor } = setup({ enabled: false });

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true }));
    fixture.detectChanges();
    expect(paletteService.isOpen()).toBe(false);

    fixture.componentRef.setInput('enabled', true);
    fixture.detectChanges();
    itemEditor.openCreate('task');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true }));
    fixture.detectChanges();
    expect(paletteService.isOpen()).toBe(false);

    itemEditor.forceClose();
    fixture.destroy();
  });

  it('debounces GET /api/search?q=... by 220ms and skips queries shorter than 2 characters', async () => {
    vi.useFakeTimers();

    const apiRequest = vi.fn(async (path: string) => {
      if (path.startsWith('search?q=')) {
        return {
          query: 'relatório',
          total: 1,
          items: [
            makeSearchResult({
              id: 'task-42',
              type: 'task',
              title: 'Revisar relatório LGPD',
              parentChain: [{ type: 'project', id: 'proj-1', name: 'Conformidade' }],
            }),
          ],
        };
      }
      throw new Error(`Unexpected request: ${path}`);
    });

    const { fixture, component, el, paletteService } = setup({ apiRequest });
    paletteService.open();
    fixture.detectChanges();

    // Single character should not trigger API search
    component.onQueryChange('r');
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS + 50);
    expect(apiRequest).not.toHaveBeenCalled();

    // Rapid typing resets debounce
    component.onQueryChange('re');
    await vi.advanceTimersByTimeAsync(150);
    expect(apiRequest).not.toHaveBeenCalled();

    component.onQueryChange('relatório');
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS - 20);
    expect(apiRequest).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(20);
    await Promise.resolve();
    fixture.detectChanges();

    expect(apiRequest).toHaveBeenCalledTimes(1);
    expect(apiRequest).toHaveBeenCalledWith(`search?q=${encodeURIComponent('relatório')}`);
    expect(el.textContent).toContain('Revisar relatório LGPD');
    expect(el.textContent).toContain('Conformidade');

    fixture.destroy();
  });

  it('navigates options with ArrowDown / ArrowUp and activates with Enter', async () => {
    const { fixture, component, el, paletteService, router } = setup();
    paletteService.open();
    fixture.detectChanges();

    component.onQueryChange('inicio');
    fixture.detectChanges();

    const options = component.flatOptions();
    expect(options.length).toBeGreaterThanOrEqual(1);
    expect(options[0].group).toBe('navigation');
    expect(options[0].label).toBe('Início');

    const dialog = el.querySelector('[data-testid="command-palette"]') as HTMLElement;

    // ArrowUp wraps to last option, ArrowDown returns to index 0
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', cancelable: true }));
    fixture.detectChanges();
    expect(component.activeIndex()).toBe(options.length - 1);

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', cancelable: true }));
    fixture.detectChanges();
    expect(component.activeIndex()).toBe(0);

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', cancelable: true }));
    await Promise.resolve();
    fixture.detectChanges();

    expect(router.navigate).toHaveBeenCalledWith(['/inicio']);
    expect(paletteService.isOpen()).toBe(false);

    fixture.destroy();
  });

  it('supports accent-insensitive section filtering and routes across all search result item types', async () => {
    vi.useFakeTimers();

    const apiRequest = vi.fn(async () => ({
      query: 'alpha',
      total: 6,
      items: [
        makeSearchResult({ id: 't-1', type: 'task', title: 'Alpha Task' }),
        makeSearchResult({ id: 'pr-1', type: 'process', title: 'Alpha Process' }),
        makeSearchResult({ id: 'ph-1', type: 'phase', title: 'Alpha Phase' }),
        makeSearchResult({ id: 'org-1', type: 'organization', title: 'Alpha Org' }),
        makeSearchResult({ id: 'list-1', type: 'list', title: 'Alpha List' }),
        makeSearchResult({ id: 'proj-1', type: 'project', title: 'Alpha Project' }),
      ],
    }));

    const { fixture, component, router, drawer, paletteService, workFilter } = setup({ apiRequest });
    workFilter.setClosedState('completed', true);

    paletteService.open();
    fixture.detectChanges();
    component.onQueryChange('alpha');
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    await Promise.resolve();
    fixture.detectChanges();

    const resultOptions = component.flatOptions().filter(o => o.group === 'results');
    expect(resultOptions).toHaveLength(6);

    await component.executeOption(resultOptions[0]);
    expect(router.navigate).toHaveBeenCalledWith(['/tarefas', 't-1'], { state: { fromTaskando: true } });

    await component.executeOption(resultOptions[1]);
    expect(router.navigate).toHaveBeenCalledWith(['/processos', 'pr-1'], { state: { fromTaskando: true } });

    await component.executeOption(resultOptions[2]);
    expect(router.navigate).toHaveBeenCalledWith(['/fases', 'ph-1'], { state: { fromTaskando: true } });

    await component.executeOption(resultOptions[3]);
    expect(router.navigate).toHaveBeenCalledWith(['/estrutura', 'organizacao', 'org-1']);

    await component.executeOption(resultOptions[4]);
    expect(router.navigate).toHaveBeenCalledWith(['/listas', 'list-1']);

    await component.executeOption(resultOptions[5]);
    expect(drawer.open).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'proj-1', kind: 'project', title: 'Alpha Project' }),
      'Detalhes',
      ['completed'],
    );

    // Section filter matches without diacritics ("calendario" -> "Calendário")
    paletteService.open();
    fixture.detectChanges();
    component.onQueryChange('calendario');
    fixture.detectChanges();
    const navMatch = component.flatOptions().find(o => o.group === 'navigation');
    expect(navMatch?.label).toBe('Calendário');

    fixture.destroy();
  });

  it('executes quick actions (+ Nova Tarefa, + Novo Processo, + Novo Projeto, + Novo Lembrete, Alternar Concluídos)', async () => {
    const { fixture, component, paletteService, itemEditor, workFilter, toast } = setup();
    paletteService.open();
    fixture.detectChanges();

    const actions = component.flatOptions().filter(o => o.group === 'actions');
    expect(actions.map(a => a.label)).toEqual([
      '+ Nova Tarefa',
      '+ Novo Processo',
      '+ Novo Projeto',
      '+ Novo Lembrete',
      'Alternar Concluídos',
    ]);

    await component.executeOption(actions[0]);
    expect(itemEditor.isOpen()).toBe(true);
    expect(itemEditor.kind()).toBe('task');
    expect(paletteService.isOpen()).toBe(false);
    itemEditor.forceClose();

    paletteService.open();
    await component.executeOption(actions[1]);
    expect(itemEditor.kind()).toBe('process');
    itemEditor.forceClose();

    paletteService.open();
    await component.executeOption(actions[2]);
    expect(itemEditor.kind()).toBe('project');
    itemEditor.forceClose();

    paletteService.open();
    await component.executeOption(actions[3]);
    expect(itemEditor.kind()).toBe('reminder');
    itemEditor.forceClose();

    expect(workFilter.showCompleted()).toBe(false);
    paletteService.open();
    fixture.detectChanges();
    await component.executeOption(actions[4]);
    expect(workFilter.showCompleted()).toBe(true);
    expect(workFilter.includeClosed()).toEqual(['completed']);
    expect(toast.toasts().some(t => t.message.includes('Exibindo itens concluídos'))).toBe(true);

    paletteService.open();
    fixture.detectChanges();
    const updatedToggle = component.flatOptions().find(o => o.id === 'action:toggle-completed');
    expect(updatedToggle?.subtitle).toContain('Concluídos visíveis');
    await component.executeOption(updatedToggle!);
    expect(workFilter.showCompleted()).toBe(false);
    expect(toast.toasts().some(t => t.message.includes('Ocultando itens concluídos'))).toBe(true);

    toast.clear();
    fixture.destroy();
  });

  it('shows inline error on search failure and closes on 428 legal acceptance error', async () => {
    vi.useFakeTimers();

    let failWith428 = false;
    const apiRequest = vi.fn(async () => {
      if (failWith428) {
        throw new ApiError(428, { code: 'LEGAL_ACCEPTANCE_REQUIRED', error: 'Aceite pendente.' });
      }
      throw new Error('Falha temporária na busca.');
    });

    const { fixture, component, el, paletteService } = setup({ apiRequest });
    paletteService.open();
    fixture.detectChanges();

    component.onQueryChange('teste');
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    await Promise.resolve();
    fixture.detectChanges();

    expect(component.searchError()).toBe('Falha temporária na busca.');
    expect(el.querySelector('[data-testid="command-palette-error"]')?.textContent).toContain('Falha temporária na busca.');

    failWith428 = true;
    component.onQueryChange('outro');
    await vi.advanceTimersByTimeAsync(SEARCH_DEBOUNCE_MS);
    await Promise.resolve();
    fixture.detectChanges();

    expect(paletteService.isOpen()).toBe(false);

    fixture.destroy();
  });
});
