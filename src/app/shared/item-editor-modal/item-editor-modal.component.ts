import { CdkTrapFocus } from '@angular/cdk/a11y';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiError, ApiService, Item } from '../../api.service';
import { LegalGateService } from '../../legal/legal-gate.service';
import { DrawerService } from '../drawer.service';
import { ToastService } from '../toast/toast.service';
import { ItemEditorService } from './item-editor.service';

const ITEM_PATHS: Record<string, string> = {
  task: 'tasks',
  project: 'projects',
  front: 'fronts',
  product: 'products',
  process: 'processes',
  phase: 'phases',
  organization: 'organizations',
  list: 'lists',
  reminder: 'reminders',
  series: 'recurrence-series',
};

@Component({
  selector: 'app-item-editor-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CdkTrapFocus],
  templateUrl: './item-editor-modal.component.html',
})
export class ItemEditorModalComponent {
  readonly editor = inject(ItemEditorService);
  private readonly api = inject(ApiService);
  private readonly drawer = inject(DrawerService);
  private readonly toast = inject(ToastService);
  private readonly legalGate = inject(LegalGateService);

  readonly isOpen = this.editor.isOpen;
  readonly kind = this.editor.kind;
  readonly itemId = this.editor.itemId;
  readonly draft = this.editor.draft;
  readonly characteristics = this.editor.characteristics;
  readonly error = this.editor.error;
  readonly saving = this.editor.saving;
  readonly sizeLabels = this.editor.sizeLabels;

  readonly types: Record<string, string> = {
    simple: 'Simples',
    recurring: 'Recorrente',
    commitment: 'Compromisso',
    scheduled: 'Agendada',
    date: 'Data',
    event: 'Evento',
    cyclic: 'Cíclica',
    periodic: 'Periódica',
  };

  readonly labels: Record<string, string> = {
    task: 'Tarefa',
    project: 'Projeto',
    front: 'Frente',
    product: 'Produto',
    process: 'Processo',
    phase: 'Fase',
    department: 'Departamento',
    team: 'Time',
    organization: 'Organização',
    list: 'Lista',
    reminder: 'Lembrete',
  };

  readonly levels = ['high', 'medium', 'low'];
  readonly levelLabels: Record<string, string> = {
    high: 'Alta',
    medium: 'Média',
    low: 'Baixa',
  };

  close(): void {
    this.editor.close();
  }

  sizeOptionLabel(index: number): string {
    return (this.sizeLabels().split(',')[index] ?? '').trim();
  }

  async save(): Promise<void> {
    if (this.editor.saving()) return;
    this.editor.saving.set(true);
    this.editor.error.set('');

    try {
      const d = this.editor.draft();
      const kind = this.editor.kind();
      const editorId = this.editor.itemId();
      let path = ITEM_PATHS[kind];

      const payload: Record<string, any> = {
        title: String(d['title'] ?? d['name'] ?? '').trim(),
        description: d['description'] ?? '',
      };

      if (['task', 'project', 'front', 'product', 'process', 'phase'].includes(kind)) {
        Object.assign(payload, {
          approvalRequired: !!d['approvalRequired'],
          size: d['size'] || null,
          importance: d['importance'] || null,
          urgency: d['urgency'] || null,
        });
      }

      if (!editorId) {
        Object.assign(payload, {
          parentType: d['parentType'] || null,
          parentId: d['parentId'] || null,
        });
      }

      if (kind === 'task') {
        payload['tags'] = String(d['tags'] ?? '')
          .split(',')
          .map(t => t.trim())
          .filter(Boolean);
        if (d['taskType'] !== 'cyclic') payload['dueDate'] = d['dueDate'] || null;
        if (!editorId) payload['taskType'] = d['taskType'];
        if (d['taskType'] === 'date') payload['dateAt'] = d['dateAt'];
        if (['commitment', 'event'].includes(d['taskType'])) {
          payload['startAt'] = d['startAt'] ? new Date(d['startAt']).toISOString() : null;
        }
        if (d['taskType'] === 'commitment') {
          payload['durationMinutes'] = Number(d['durationMinutes']);
        }
        if (d['taskType'] === 'event') {
          payload['endAt'] = d['endAt'] ? new Date(d['endAt']).toISOString() : null;
        }
        if (d['taskType'] === 'cyclic') {
          payload['relevance'] = Number(d['relevance']);
        }
        if (['recurring', 'scheduled', 'periodic'].includes(d['taskType']) && !editorId) {
          payload['recurrenceDefinition'] = {
            cadence: d['cadence'],
            interval: Number(d['interval']),
            startDate: d['startDate'],
            endDate: d['endDate'] || null,
            time: d['time'],
            timeZone: d['timeZone'],
            weekdays:
              d['cadence'] === 'week'
                ? String(d['periodSlots']).split(',').map(Number)
                : undefined,
            occurrencesPerPeriod: Number(d['occurrencesPerPeriod']),
            periodSlots: String(d['periodSlots'])
              .split(',')
              .map(v => (d['cadence'] === 'year' ? v.trim() : Number(v))),
            durationMinutes: Number(d['durationMinutes']),
          };
        }
        if (!editorId && d['parentType']) {
          path =
            d['parentType'] === 'task'
              ? `tasks/${d['parentId']}/subtasks`
              : `task-containers/${d['parentType']}/${d['parentId']}`;
        }
      }

      if (kind === 'product') {
        payload['characteristics'] = this.editor
          .characteristics()
          .split('\n')
          .filter(Boolean)
          .map(line => {
            const colon = line.indexOf(':');
            return {
              key: line.slice(0, colon).trim(),
              value: line.slice(colon + 1).trim(),
            };
          });
      }

      if (kind === 'process') {
        payload['autoCompleteWhenChildrenDone'] = !!d['autoCompleteWhenChildrenDone'];
      }
      if (kind === 'front' && !editorId) {
        path = `projects/${d['parentId']}/fronts`;
      }
      if (kind === 'phase' && !editorId) {
        path = `processes/${d['parentId']}/phases`;
      }
      if (['organization', 'department', 'team', 'list'].includes(kind)) {
        payload['name'] = payload['title'];
        delete payload['title'];
      }
      if (['department', 'team'].includes(kind)) {
        payload['kind'] = kind;
        const org =
          d['parentType'] === 'organization'
            ? d['parentId']
            : (d['organizationId'] ?? this.editor.contextOrganizationId() ?? null);
        path = org ? `organizations/${org}/structure` : 'personal/structure';
        if (editorId) path += `/${kind}`;
      }
      if (kind === 'reminder') {
        payload['remindAt'] = d['remindAt'] ? new Date(d['remindAt']).toISOString() : null;
        payload['timeZone'] = d['timeZone'] ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (editorId) payload['id'] = editorId;
      }
      if (kind === 'list') {
        delete payload['parentType'];
        delete payload['parentId'];
      }
      if (editorId && kind !== 'reminder') {
        path += `/${editorId}`;
      }

      const data = await this.api.request(path, editorId ? 'PATCH' : 'POST', payload);
      const rawItem = (data?.[kind] ?? data?.['item'] ?? null) as Item | null;
      const savedItem = rawItem ? { ...rawItem, kind: rawItem.kind ?? kind } : null;
      const action: 'create' | 'update' = editorId ? 'update' : 'create';

      this.editor.forceClose();
      this.toast.success('Salvo.');

      const opened = this.drawer.openedItem();
      if (editorId && savedItem && opened?.id === savedItem.id) {
        this.drawer.openedItem.set({ ...opened, ...savedItem });
      }

      this.editor.notifySaved(savedItem, kind, action);
      this.drawer.notifyMutation(this.drawer.openedItem() ?? savedItem ?? undefined, action);
    } catch (e) {
      if (
        e instanceof ApiError &&
        e.status === 428 &&
        e.details['code'] === 'LEGAL_ACCEPTANCE_REQUIRED'
      ) {
        this.legalGate.intercept428(e.details);
        this.editor.error.set('');
        return;
      }
      const message = e instanceof Error ? e.message : 'Não foi possível concluir a operação.';
      this.editor.error.set(message);
    } finally {
      this.editor.saving.set(false);
    }
  }
}
