import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Item } from '../../api.service';
import { DateBrPipe } from '../../shared/date-br.pipe';
import { STATUS_LABELS, localDateString } from '../../shared/work-labels';

@Component({
  selector: 'app-dashboard-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DateBrPipe],
  templateUrl: './dashboard-view.component.html',
})
export class DashboardViewComponent {
  readonly tasks = input<Item[]>([]);
  readonly items = input<Item[]>([]);
  readonly openItem = output<Item>();

  readonly statuses = STATUS_LABELS;

  readonly dashboard = computed(() => {
    const today = localDateString(new Date());
    const next = new Date();
    next.setDate(next.getDate() + 7);
    const nextWeek = localDateString(next);

    const tasks = this.tasks();
    const items = this.items();
    const active = (item: Item) => !['completed', 'cancelled', 'archived'].includes(item['status']);
    const total = items.filter(item => !['cancelled', 'archived'].includes(item['status'])).length;
    const completed = items.filter(item => item['status'] === 'completed').length;

    return {
      overdue: tasks.filter(task => active(task) && Boolean(task['dueDate']) && String(task['dueDate']) < today).length,
      blocked: tasks.filter(task => active(task) && task['dependencyState'] === 'blocked').length,
      approval: items.filter(item => item['status'] === 'awaiting_approval').length,
      upcoming: tasks
        .filter(task => active(task) && String(task['dueDate'] ?? '') >= today && String(task['dueDate'] ?? '') <= nextWeek)
        .sort((a, b) => String(a['dueDate'] ?? '').localeCompare(String(b['dueDate'] ?? '')))
        .slice(0, 8),
      total,
      completed,
      progress: total ? Math.round((completed / total) * 100) : 0,
    };
  });
}
