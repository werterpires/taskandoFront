import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Item } from '../../api.service';
import { flushVirtualScroll, scrollVirtualViewport } from '../../testing/virtual-scroll.helper';
import { WorkListViewComponent } from './work-list-view.component';

describe('WorkListViewComponent', () => {
  it('renders home groups in Início and filters rows via search signal under OnPush', async () => {
    await TestBed.configureTestingModule({
      imports: [WorkListViewComponent],
    }).compileComponents();

    const rows: Item[] = [
      { id: 'org-1', kind: 'organization', name: 'Edubazu' },
      { id: 'task-1', kind: 'task', title: 'Revisar contrato', status: 'todo', taskType: 'simple' },
      { id: 'task-2', kind: 'task', title: 'Comprar café', status: 'completed', taskType: 'simple' },
    ];

    const fixture = TestBed.createComponent(WorkListViewComponent);
    fixture.componentRef.setInput('section', 'Início');
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('month', new Date(2026, 10, 1));
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.home-group')).toHaveLength(2);
    expect(el.textContent).toContain('Organizações');
    expect(el.textContent).toContain('Tarefas');

    fixture.componentInstance.search.set('contrato');
    fixture.detectChanges();

    expect(fixture.componentInstance.homeGroups()).toHaveLength(1);
    expect(el.querySelectorAll('.home-group')).toHaveLength(1);
    expect(el.textContent).toContain('Revisar contrato');
    expect(el.textContent).not.toContain('Comprar café');
    fixture.destroy();
  });

  it('switches to Kanban view and emits statusChange on column drop', async () => {
    await TestBed.configureTestingModule({
      imports: [WorkListViewComponent],
    }).compileComponents();

    const rows: Item[] = [
      { id: 'task-1', kind: 'task', title: 'Planejar sprint', status: 'todo', taskType: 'simple' },
    ];

    const fixture = TestBed.createComponent(WorkListViewComponent);
    fixture.componentRef.setInput('section', 'Minhas tarefas');
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('month', new Date(2026, 10, 1));
    fixture.detectChanges();

    const emitted: { item: Item; status: string }[] = [];
    fixture.componentInstance.statusChange.subscribe(value => emitted.push(value));

    fixture.componentInstance.view.set('kanban');
    const viewports = await flushVirtualScroll(fixture, { height: 380 });

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.kanban')).toBeTruthy();
    expect(viewports).toHaveLength(4);
    expect(el.querySelectorAll('.kanban .work-card')).toHaveLength(1);
    expect(el.querySelector('.kanban .work-card')?.textContent).toContain('Planejar sprint');

    const inProgressColumn = el.querySelectorAll('.kanban > section')[2] as HTMLElement;
    const dragOverEvent = new Event('dragover', { cancelable: true });
    inProgressColumn.dispatchEvent(dragOverEvent);
    expect(dragOverEvent.defaultPrevented).toBe(true);

    const dropEvent = new Event('drop', { cancelable: true }) as Event & {
      dataTransfer: { getData: (type: string) => string };
    };
    Object.defineProperty(dropEvent, 'dataTransfer', {
      value: { getData: () => 'task-1' },
    });
    inProgressColumn.dispatchEvent(dropEvent);

    expect(emitted).toEqual([{ item: rows[0], status: 'in_progress' }]);
    fixture.destroy();
  });

  it('virtualizes the main .item-list with uniform rows and updates on scroll and search', async () => {
    await TestBed.configureTestingModule({
      imports: [WorkListViewComponent],
    }).compileComponents();

    const rows: Item[] = Array.from({ length: 45 }, (_, i) => ({
      id: `task-${i + 1}`,
      kind: 'task',
      title: `Tarefa ${String(i + 1).padStart(2, '0')}`,
      description: `Detalhe da tarefa ${i + 1}`,
      status: 'todo',
      taskType: 'simple',
    }));

    const fixture = TestBed.createComponent(WorkListViewComponent);
    fixture.componentRef.setInput('section', 'Minhas tarefas');
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('month', new Date(2026, 10, 1));
    const viewports = await flushVirtualScroll(fixture, { height: 320 });

    expect(viewports).toHaveLength(1);
    const el = fixture.nativeElement as HTMLElement;
    const renderedRows = el.querySelectorAll('.virtual-list-viewport .item-row');
    expect(renderedRows.length).toBeGreaterThan(0);
    expect(renderedRows.length).toBeLessThan(rows.length);
    expect(el.textContent).toContain('Tarefa 01');

    await scrollVirtualViewport(fixture, viewports[0], 64 * 30);
    expect(el.textContent).toContain('Tarefa 35');

    fixture.componentInstance.search.set('Tarefa 43');
    await flushVirtualScroll(fixture, { height: 320 });
    const filteredRows = el.querySelectorAll('.virtual-list-viewport .item-row');
    expect(filteredRows).toHaveLength(1);
    expect(filteredRows[0].textContent).toContain('Tarefa 43');
    fixture.destroy();
  });

  it('virtualizes large Kanban columns while keeping outer section drop target intact', async () => {
    await TestBed.configureTestingModule({
      imports: [WorkListViewComponent],
    }).compileComponents();

    const rows: Item[] = Array.from({ length: 30 }, (_, i) => ({
      id: `todo-${i + 1}`,
      kind: 'task',
      title: `Card ${String(i + 1).padStart(2, '0')}`,
      status: 'todo',
      taskType: 'simple',
    }));

    const fixture = TestBed.createComponent(WorkListViewComponent);
    fixture.componentRef.setInput('section', 'Minhas tarefas');
    fixture.componentRef.setInput('rows', rows);
    fixture.componentRef.setInput('month', new Date(2026, 10, 1));
    fixture.detectChanges();

    fixture.componentInstance.view.set('kanban');
    const viewports = await flushVirtualScroll(fixture, { height: 380 });

    const el = fixture.nativeElement as HTMLElement;
    const todoColumn = el.querySelectorAll('.kanban > section')[1];
    const renderedCards = todoColumn.querySelectorAll('.work-card');
    expect(renderedCards.length).toBeGreaterThan(0);
    expect(renderedCards.length).toBeLessThan(rows.length);
    expect(todoColumn.textContent).toContain('Card 01');

    await scrollVirtualViewport(fixture, viewports[1], 76 * 20);
    expect(todoColumn.textContent).toContain('Card 24');
    fixture.destroy();
  });

  it('renders Calendar and Quadrant views and handles listTaskId signal in list scope', async () => {
    await TestBed.configureTestingModule({
      imports: [WorkListViewComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(WorkListViewComponent);
    fixture.componentRef.setInput('section', 'Calendário');
    fixture.componentRef.setInput('month', new Date(2026, 10, 1));
    fixture.componentRef.setInput('rows', [
      { id: 't-1', kind: 'task', title: 'Evento dia 10', status: 'todo', taskType: 'simple', dueDate: '2026-11-10' },
    ]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.calendar')).toBeTruthy();
    expect(el.textContent).toContain('Evento dia 10');

    fixture.componentRef.setInput('section', 'Quadrante');
    fixture.componentRef.setInput('rows', [
      { id: 't-2', kind: 'task', title: 'Urgente', status: 'todo', importance: 'high', urgency: 'high' },
      { id: 't-3', kind: 'task', title: 'Sem matriz', status: 'todo' },
    ]);
    fixture.detectChanges();
    expect(el.querySelector('.quadrant')).toBeTruthy();
    expect(el.querySelector('.unclassified')?.textContent).toContain('Sem matriz');

    const addedTaskIds: string[] = [];
    fixture.componentInstance.addTaskToList.subscribe(id => addedTaskIds.push(id));
    fixture.componentRef.setInput('section', 'Listas');
    fixture.componentRef.setInput('scope', { id: 'list-1', kind: 'list', name: 'Compras' });
    fixture.componentRef.setInput('tasks', [{ id: 'task-9', kind: 'task', title: 'Pão', status: 'todo' }]);
    fixture.detectChanges();

    fixture.componentInstance.listTaskId.set('task-9');
    fixture.detectChanges();
    const addBtn = Array.from(el.querySelectorAll('.inline-form button')).find(b =>
      b.textContent?.includes('Adicionar referência'),
    ) as HTMLButtonElement;
    addBtn.click();
    expect(addedTaskIds).toEqual(['task-9']);
    fixture.destroy();
  });
});
