import { Injectable, signal } from '@angular/core';
import { Item } from '../../api.service';

export interface ItemEditorSavedEvent {
  item: Item | null;
  kind: string;
  action: 'create' | 'update';
  timestamp: number;
}

export function formatLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class ItemEditorService {
  readonly isOpen = signal(false);
  readonly kind = signal<string>('task');
  readonly itemId = signal<string | null>(null);
  readonly draft = signal<Record<string, any>>({});
  readonly characteristics = signal('');
  readonly error = signal('');
  readonly saving = signal(false);
  readonly sizeLabels = signal('Muito pequeno, Pequeno, Médio, Grande, Muito grande');
  readonly contextOrganizationId = signal<string | null>(null);
  readonly lastSaved = signal<ItemEditorSavedEvent | null>(null);

  openCreate(kind = 'task', parent?: Item | null, organizationId?: string | null): void {
    this.error.set('');
    this.kind.set(kind);
    this.itemId.set(null);

    const parentType = parent?.kind === 'list' ? null : (parent?.kind ?? null);
    const parentId = parent?.kind === 'list' ? null : (parent?.id ?? null);
    const resolvedOrgId =
      organizationId ??
      (parent?.kind === 'organization' ? parent.id : (parent?.['organizationId'] ?? null));
    this.contextOrganizationId.set(resolvedOrgId ?? null);

    this.draft.set({
      title: '',
      description: '',
      taskType: 'simple',
      status: kind === 'task' ? 'todo' : 'planned',
      approvalRequired: false,
      size: null,
      importance: null,
      urgency: null,
      relevance: 3,
      parentType,
      parentId,
      startDate: formatLocalDate(new Date()),
      time: '09:00',
      cadence: 'week',
      interval: 1,
      occurrencesPerPeriod: 1,
      periodSlots: '1',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      durationMinutes: 30,
    });
    this.characteristics.set('');
    this.isOpen.set(true);
  }

  openEdit(row: Item, organizationId?: string | null): void {
    this.error.set('');
    const kind = row.kind ?? 'task';
    this.kind.set(kind);
    this.itemId.set(row.id);

    const nextDraft: Record<string, any> = {
      ...row,
      title: row.title ?? row.name ?? '',
      tags: (row['tags'] ?? []).map((t: any) => t.name).join(', '),
    };
    for (const key of ['startAt', 'endAt', 'remindAt']) {
      if (nextDraft[key]) {
        const d = new Date(nextDraft[key]);
        nextDraft[key] = `${formatLocalDate(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
      }
    }

    this.contextOrganizationId.set(organizationId ?? row['organizationId'] ?? null);
    this.draft.set(nextDraft);
    this.characteristics.set(
      (row['characteristics'] ?? []).map((c: any) => `${c.key}: ${c.value}`).join('\n'),
    );
    this.isOpen.set(true);
  }

  setField(key: string, value: unknown): void {
    this.draft.update(current => ({ ...current, [key]: value }));
  }

  setSizeLabels(labels: string): void {
    if (labels.trim()) {
      this.sizeLabels.set(labels);
    }
  }

  close(): void {
    if (this.saving()) return;
    this.forceClose();
  }

  forceClose(): void {
    this.isOpen.set(false);
    this.error.set('');
  }

  notifySaved(item: Item | null, kind: string, action: 'create' | 'update'): void {
    this.lastSaved.set({
      item,
      kind,
      action,
      timestamp: Date.now(),
    });
  }
}
