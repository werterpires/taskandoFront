import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Item } from '../../api.service';
import { BreadcrumbCrumb, entityBreadcrumbs } from '../../shared/breadcrumb';
import { DateBrPipe } from '../../shared/date-br.pipe';
import {
  DependencyGraph,
  DependencyGraphComponent,
  EMPTY_DEPENDENCY_GRAPH,
} from '../../shared/dependency-graph/dependency-graph.component';
import {
  ITEM_KIND_LABELS,
  PRIORITY_LEVEL_LABELS,
  STATUS_LABELS,
  TASK_TYPE_LABELS,
  WORK_STATUSES,
} from '../../shared/work-labels';

@Component({
  selector: 'app-item-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, DependencyGraphComponent, DateBrPipe],
  templateUrl: './item-drawer.component.html',
})
export class ItemDrawerComponent {
  readonly item = input.required<Item>();
  readonly tab = input<string>('Detalhes');
  readonly detail = input<Record<string, any>>({});
  readonly children = input<Item[]>([]);
  readonly saving = input<boolean>(false);
  readonly error = input<string>('');

  readonly close = output<void>();
  readonly tabChange = output<string>();
  readonly navigateCrumb = output<BreadcrumbCrumb>();
  readonly statusChange = output<string>();
  readonly approveDecision = output<'approve' | 'reject'>();
  readonly editItem = output<Item>();
  readonly removeItem = output<Item>();
  readonly saveTemplateRequested = output<{ name: string; reset: () => void }>();
  readonly createChild = output<{ kind: string; parent: Item }>();
  readonly openItem = output<Item>();
  readonly addChecklistItem = output<{ title: string; reset: () => void }>();
  readonly toggleChecklistItem = output<Item>();
  readonly deleteChecklistItem = output<Item>();
  readonly addComment = output<{ body: string; reset: () => void }>();
  readonly deleteComment = output<Item>();
  readonly graphChange = output<DependencyGraph>();
  readonly revokeAccess = output<Item>();
  readonly inviteAccess = output<{ email: string; role: string; reset: () => void }>();
  readonly transferOwnerRequested = output<{ targetUserId: string; mode: string }>();

  readonly templateName = linkedSignal(() => {
    this.item().id;
    return '';
  });
  readonly newChecklistText = linkedSignal(() => {
    this.item().id;
    return '';
  });
  readonly newCommentText = linkedSignal(() => {
    this.item().id;
    return '';
  });
  readonly inviteEmail = linkedSignal(() => {
    this.item().id;
    return '';
  });
  readonly inviteRole = linkedSignal(() => {
    this.item().id;
    return 'watcher';
  });
  readonly transferTarget = linkedSignal(() => {
    this.item().id;
    return '';
  });
  readonly transferMode = linkedSignal(() => {
    this.item().id;
    return 'normal';
  });

  readonly breadcrumbs = computed(() => entityBreadcrumbs(this.item()));

  readonly labels = ITEM_KIND_LABELS;
  readonly statuses = STATUS_LABELS;
  readonly types = TASK_TYPE_LABELS;
  readonly workStatuses = WORK_STATUSES;
  readonly levelLabels = PRIORITY_LEVEL_LABELS;
  readonly roles = ['watcher', 'contributor', 'executor', 'reviewer', 'editor', 'leader'] as const;
  readonly emptyDependencyGraph = EMPTY_DEPENDENCY_GRAPH;

  title(row: Item): string {
    return row.title ?? row.name ?? '';
  }

  submitTemplate(): void {
    this.saveTemplateRequested.emit({
      name: this.templateName(),
      reset: () => this.templateName.set(''),
    });
  }

  submitChecklist(): void {
    this.addChecklistItem.emit({
      title: this.newChecklistText(),
      reset: () => this.newChecklistText.set(''),
    });
  }

  submitComment(): void {
    this.addComment.emit({
      body: this.newCommentText(),
      reset: () => this.newCommentText.set(''),
    });
  }

  submitInvite(): void {
    this.inviteAccess.emit({
      email: this.inviteEmail(),
      role: this.inviteRole(),
      reset: () => this.inviteEmail.set(''),
    });
  }

  submitTransfer(): void {
    this.transferOwnerRequested.emit({
      targetUserId: this.transferTarget(),
      mode: this.transferMode(),
    });
  }
}
