import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Item } from '../../api.service';
import { ToastService } from '../../shared/toast/toast.service';
import { ReportsViewComponent } from './reports-view.component';

describe('ReportsViewComponent', () => {
  afterEach(() => {
    TestBed.inject(ToastService).clear();
    vi.restoreAllMocks();
  });

  const sampleTasks: Item[] = [
    {
      id: 't-1',
      title: 'Revisar contrato',
      status: 'todo',
      taskType: 'simple',
      importance: 'high',
      urgency: 'medium',
      dueDate: '2026-11-10',
      parentName: 'Jurídico',
    },
    {
      id: 't-2',
      title: 'Publicar release',
      status: 'completed',
      taskType: 'event',
      importance: 'medium',
      urgency: 'high',
      dueDate: '2026-11-20',
      parentName: 'Produto',
    },
  ];

  it('filters tasks reactively with Signals and computes summary counts', async () => {
    await TestBed.configureTestingModule({
      imports: [ReportsViewComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(ReportsViewComponent);
    fixture.componentRef.setInput('tasks', sampleTasks);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.reportRows()).toHaveLength(2);
    expect(component.reportCompleted()).toBe(1);

    component.reportStart.set('2026-11-15');
    component.reportImportance.set('medium');
    fixture.detectChanges();

    expect(component.reportRows().map(t => t.id)).toEqual(['t-2']);
    expect(component.reportCompleted()).toBe(1);

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('.reports-table .report-row:not(.report-head)');
    expect(rows).toHaveLength(1);
    expect(rows[0].textContent).toContain('Publicar release');
    fixture.destroy();
  });

  it('emits statusChange and resets filters on clearReport', async () => {
    await TestBed.configureTestingModule({
      imports: [ReportsViewComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(ReportsViewComponent);
    fixture.componentRef.setInput('tasks', sampleTasks);
    fixture.detectChanges();

    const statusChanges: string[] = [];
    fixture.componentInstance.statusChange.subscribe(s => statusChanges.push(s));

    fixture.componentInstance.changeReportStatus('completed');
    fixture.componentInstance.reportType.set('event');
    fixture.detectChanges();

    expect(fixture.componentInstance.reportRows().map(t => t.id)).toEqual(['t-2']);

    fixture.componentInstance.clearReport();
    fixture.detectChanges();

    expect(statusChanges).toEqual(['completed', '']);
    expect(fixture.componentInstance.reportType()).toBe('');
    expect(fixture.componentInstance.reportRows()).toHaveLength(2);
    fixture.destroy();
  });

  it('exports CSV with toast notification and emits openItem on row click', async () => {
    await TestBed.configureTestingModule({
      imports: [ReportsViewComponent],
    }).compileComponents();

    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const createObjectUrl = vi.fn(() => 'blob:report-url');
    const revokeObjectUrl = vi.fn();
    URL.createObjectURL = createObjectUrl;
    URL.revokeObjectURL = revokeObjectUrl;
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    const fixture = TestBed.createComponent(ReportsViewComponent);
    try {
      fixture.componentRef.setInput('tasks', sampleTasks);
      fixture.detectChanges();

      const opened: Item[] = [];
      fixture.componentInstance.openItem.subscribe(item => opened.push(item));

      const firstRow = (fixture.nativeElement as HTMLElement).querySelector('.reports-table button.report-row') as HTMLButtonElement;
      firstRow.click();
      expect(opened).toEqual([sampleTasks[0]]);

      fixture.componentInstance.exportReport();
      expect(createObjectUrl).toHaveBeenCalledTimes(1);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(revokeObjectUrl).toHaveBeenCalledWith('blob:report-url');
      expect(TestBed.inject(ToastService).toasts().some(t => t.kind === 'success')).toBe(true);
    } finally {
      URL.createObjectURL = originalCreateObjectUrl;
      URL.revokeObjectURL = originalRevokeObjectUrl;
      fixture.destroy();
    }
  });
});
