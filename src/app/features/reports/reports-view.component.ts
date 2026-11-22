import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Item } from '../../api.service';
import { DateBrPipe } from '../../shared/date-br.pipe';
import { ToastService } from '../../shared/toast/toast.service';
import {
  PRIORITY_LEVELS,
  PRIORITY_LEVEL_LABELS,
  STATUS_LABELS,
  TASK_TYPE_LABELS,
  WORK_STATUSES,
} from '../../shared/work-labels';

@Component({
  selector: 'app-reports-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DateBrPipe],
  templateUrl: './reports-view.component.html',
})
export class ReportsViewComponent {
  private readonly toast = inject(ToastService);

  readonly tasks = input<Item[]>([]);
  readonly openItem = output<Item>();
  readonly statusChange = output<string>();

  readonly workStatuses = WORK_STATUSES;
  readonly statuses = STATUS_LABELS;
  readonly types = TASK_TYPE_LABELS;
  readonly levels = PRIORITY_LEVELS;
  readonly levelLabels = PRIORITY_LEVEL_LABELS;

  readonly reportStart = signal('');
  readonly reportEnd = signal('');
  readonly reportStatus = signal('');
  readonly reportType = signal('');
  readonly reportImportance = signal('');
  readonly reportUrgency = signal('');

  readonly reportRows = computed(() => {
    const start = this.reportStart();
    const end = this.reportEnd();
    const status = this.reportStatus();
    const type = this.reportType();
    const importance = this.reportImportance();
    const urgency = this.reportUrgency();

    return this.tasks().filter(task => {
      const due = String(task['dueDate'] ?? '').slice(0, 10);
      return (
        (!start || (Boolean(due) && due >= start)) &&
        (!end || (Boolean(due) && due <= end)) &&
        (!status || task['status'] === status) &&
        (!type || task['taskType'] === type) &&
        (!importance || task['importance'] === importance) &&
        (!urgency || task['urgency'] === urgency)
      );
    });
  });

  readonly reportCompleted = computed(
    () => this.reportRows().filter(task => task['status'] === 'completed').length,
  );

  changeReportStatus(status: string): void {
    this.reportStatus.set(status);
    this.statusChange.emit(status);
  }

  clearReport(): void {
    const hadStatus = Boolean(this.reportStatus());
    this.reportStart.set('');
    this.reportEnd.set('');
    this.reportStatus.set('');
    this.reportType.set('');
    this.reportImportance.set('');
    this.reportUrgency.set('');
    if (hadStatus) {
      this.statusChange.emit('');
    }
  }

  exportReport(): void {
    const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const lines = [
      ['Título', 'Status', 'Tipo', 'Importância', 'Urgência', 'Prazo', 'Contêiner', 'Owner', 'Responsáveis'],
      ...this.reportRows().map(task => [
        task.title ?? task.name ?? '',
        this.statuses[task['status']] ?? task['status'],
        this.types[task['taskType']] ?? task['taskType'],
        this.levelLabels[task['importance']] ?? '',
        this.levelLabels[task['urgency']] ?? '',
        task['dueDate'] ?? '',
        task['parentName'] ?? 'Área pessoal',
        task['ownerName'] ?? '',
        (task['assignees'] ?? []).map((person: Item) => person['displayName']).join(', '),
      ]),
    ]
      .map(row => row.map(quote).join(','))
      .join('\n');

    const url = URL.createObjectURL(new Blob([`\uFEFF${lines}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'relatorio-taskando.csv';
    link.click();
    URL.revokeObjectURL(url);
    this.toast.success('Relatório exportado.');
  }
}
