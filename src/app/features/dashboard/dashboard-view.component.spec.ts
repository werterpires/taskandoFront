import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Item } from '../../api.service';
import { localDateString } from '../../shared/work-labels';
import { DashboardViewComponent } from './dashboard-view.component';

describe('DashboardViewComponent', () => {
  it('computes overdue, blocked, approval, upcoming tasks, and progress percentage', async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardViewComponent],
    }).compileComponents();

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const inTwoDays = new Date(today);
    inTwoDays.setDate(today.getDate() + 2);
    const inTwentyDays = new Date(today);
    inTwentyDays.setDate(today.getDate() + 20);

    const tasks: Item[] = [
      { id: 't-1', title: 'Atrasada', status: 'todo', dueDate: localDateString(yesterday) },
      { id: 't-2', title: 'Bloqueada', status: 'in_progress', dependencyState: 'blocked', dueDate: localDateString(inTwoDays) },
      { id: 't-3', title: 'Futura distante', status: 'todo', dueDate: localDateString(inTwentyDays) },
      { id: 't-4', title: 'Concluída', status: 'completed', dueDate: localDateString(yesterday) },
    ];
    const items: Item[] = [
      ...tasks,
      { id: 'p-1', title: 'Aprovar', status: 'awaiting_approval' },
      { id: 'p-2', title: 'Cancelada', status: 'cancelled' },
    ];

    const fixture = TestBed.createComponent(DashboardViewComponent);
    fixture.componentRef.setInput('tasks', tasks);
    fixture.componentRef.setInput('items', items);
    fixture.detectChanges();

    const opened: Item[] = [];
    fixture.componentInstance.openItem.subscribe(item => opened.push(item));

    const summary = fixture.componentInstance.dashboard();
    expect(summary.overdue).toBe(1);
    expect(summary.blocked).toBe(1);
    expect(summary.approval).toBe(1);
    expect(summary.upcoming.map(t => t.id)).toEqual(['t-2']);
    expect(summary.total).toBe(5);
    expect(summary.completed).toBe(1);
    expect(summary.progress).toBe(20);

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('20% concluído');
    const agendaButton = el.querySelector('.child-row') as HTMLButtonElement;
    expect(agendaButton.textContent).toContain('Bloqueada');
    agendaButton.click();
    expect(opened).toEqual([tasks[1]]);
    fixture.destroy();
  });

  it('renders empty state when there are no upcoming tasks in the next 7 days', async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardViewComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardViewComponent);
    fixture.componentRef.setInput('tasks', []);
    fixture.componentRef.setInput('items', []);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Nenhum prazo nos próximos sete dias.');
    fixture.destroy();
  });
});
