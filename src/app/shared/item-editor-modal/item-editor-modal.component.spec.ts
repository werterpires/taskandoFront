import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, ApiService } from '../../api.service';
import { LegalGateService } from '../../legal/legal-gate.service';
import { DrawerService } from '../drawer.service';
import { ToastService } from '../toast/toast.service';
import { ItemEditorModalComponent } from './item-editor-modal.component';
import { ItemEditorService } from './item-editor.service';

describe('ItemEditorModalComponent', () => {
  it('renders focus-trapped dialog when opened and closes on Escape key', () => {
    const api = { request: vi.fn(), requestWithClosed: vi.fn() };
    TestBed.configureTestingModule({
      imports: [ItemEditorModalComponent],
      providers: [{ provide: ApiService, useValue: api }],
    });

    const fixture = TestBed.createComponent(ItemEditorModalComponent);
    const editor = TestBed.inject(ItemEditorService);

    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="item-editor-modal"]')).toBeNull();

    editor.openCreate('task');
    fixture.detectChanges();

    const dialog = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="item-editor-modal"]') as HTMLElement;
    expect(dialog).toBeTruthy();
    expect(dialog.getAttribute('role')).toBe('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain('Criar Tarefa');

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(editor.isOpen()).toBe(false);
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="item-editor-modal"]')).toBeNull();
    fixture.destroy();
  });

  it('creates task, process, project, and reminder via ApiService, emits toast and DrawerService.notifyMutation', async () => {
    const api = {
      request: vi.fn(async (path: string, method: string, body: Record<string, any>) => {
        if (path === 'tasks' && method === 'POST') return { task: { id: 't-1', title: body['title'] } };
        if (path === 'processes' && method === 'POST') return { process: { id: 'p-1', title: body['title'] } };
        if (path === 'projects' && method === 'POST') return { project: { id: 'pr-1', title: body['title'] } };
        if (path === 'reminders' && method === 'POST') return { reminder: { id: 'r-1', title: body['title'] } };
        throw new Error(`Unexpected request: ${method} ${path}`);
      }),
      requestWithClosed: vi.fn(),
    };
    const drawer = {
      openedItem: vi.fn(() => null),
      notifyMutation: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [ItemEditorModalComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: DrawerService, useValue: drawer },
      ],
    });

    const fixture = TestBed.createComponent(ItemEditorModalComponent);
    const editor = TestBed.inject(ItemEditorService);
    const toast = TestBed.inject(ToastService);

    // Task
    editor.openCreate('task');
    editor.setField('title', 'Nova tarefa rápida');
    editor.setField('tags', 'urgente, revisão');
    fixture.detectChanges();
    await fixture.componentInstance.save();

    expect(api.request).toHaveBeenCalledWith(
      'tasks',
      'POST',
      expect.objectContaining({
        title: 'Nova tarefa rápida',
        taskType: 'simple',
        tags: ['urgente', 'revisão'],
      }),
    );
    expect(drawer.notifyMutation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't-1', kind: 'task' }),
      'create',
    );
    expect(editor.isOpen()).toBe(false);

    // Process
    editor.openCreate('process');
    editor.setField('title', 'Novo processo');
    editor.setField('autoCompleteWhenChildrenDone', true);
    await fixture.componentInstance.save();
    expect(api.request).toHaveBeenCalledWith(
      'processes',
      'POST',
      expect.objectContaining({
        title: 'Novo processo',
        autoCompleteWhenChildrenDone: true,
      }),
    );

    // Project
    editor.openCreate('project');
    editor.setField('title', 'Novo projeto');
    await fixture.componentInstance.save();
    expect(api.request).toHaveBeenCalledWith(
      'projects',
      'POST',
      expect.objectContaining({ title: 'Novo projeto' }),
    );

    // Reminder
    editor.openCreate('reminder');
    editor.setField('title', 'Lembrar reunião');
    editor.setField('remindAt', '2026-12-01T10:30');
    await fixture.componentInstance.save();
    expect(api.request).toHaveBeenCalledWith(
      'reminders',
      'POST',
      expect.objectContaining({
        title: 'Lembrar reunião',
        remindAt: new Date('2026-12-01T10:30').toISOString(),
      }),
    );

    expect(toast.toasts().filter(t => t.kind === 'success' && t.message === 'Salvo.')).toHaveLength(4);
    toast.clear();
    fixture.destroy();
  });

  it('creates child task inside container and updates open drawer item on edit', async () => {
    const api = {
      request: vi.fn(async (path: string, method: string, body: Record<string, any>) => {
        if (path === 'task-containers/process/proc-1' && method === 'POST') {
          return { task: { id: 't-child', title: body['title'] } };
        }
        if (path === 'tasks/t-child' && method === 'PATCH') {
          return { task: { id: 't-child', title: body['title'], description: body['description'] } };
        }
        throw new Error(`Unexpected request: ${method} ${path}`);
      }),
      requestWithClosed: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [ItemEditorModalComponent],
      providers: [{ provide: ApiService, useValue: api }],
    });

    const fixture = TestBed.createComponent(ItemEditorModalComponent);
    const editor = TestBed.inject(ItemEditorService);
    const drawer = TestBed.inject(DrawerService);
    const toast = TestBed.inject(ToastService);

    editor.openCreate('task', { id: 'proc-1', kind: 'process', title: 'Processo 1' });
    editor.setField('title', 'Atividade do processo');
    await fixture.componentInstance.save();

    expect(api.request).toHaveBeenCalledWith(
      'task-containers/process/proc-1',
      'POST',
      expect.objectContaining({
        title: 'Atividade do processo',
        parentType: 'process',
        parentId: 'proc-1',
      }),
    );

    drawer.openedItem.set({ id: 't-child', kind: 'task', title: 'Atividade do processo' });
    editor.openEdit({ id: 't-child', kind: 'task', title: 'Atividade do processo', taskType: 'simple' });
    editor.setField('title', 'Atividade atualizada');
    await fixture.componentInstance.save();

    expect(api.request).toHaveBeenCalledWith(
      'tasks/t-child',
      'PATCH',
      expect.objectContaining({ title: 'Atividade atualizada' }),
    );
    expect(drawer.openedItem()?.title).toBe('Atividade atualizada');

    toast.clear();
    fixture.destroy();
  });

  it('shows inline error on API failure and delegates 428 legal acceptance to LegalGateService', async () => {
    let failWith428 = false;
    const api = {
      request: vi.fn(async () => {
        if (failWith428) {
          throw new ApiError(428, {
            code: 'LEGAL_ACCEPTANCE_REQUIRED',
            error: 'Aceite pendente.',
          });
        }
        throw new ApiError(400, { error: 'Título é obrigatório.' });
      }),
      requestWithClosed: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [ItemEditorModalComponent],
      providers: [{ provide: ApiService, useValue: api }],
    });

    const fixture = TestBed.createComponent(ItemEditorModalComponent);
    const editor = TestBed.inject(ItemEditorService);
    const legalGate = TestBed.inject(LegalGateService);
    const interceptSpy = vi.spyOn(legalGate, 'intercept428');

    editor.openCreate('task');
    fixture.detectChanges();
    await fixture.componentInstance.save();
    fixture.detectChanges();

    expect(editor.isOpen()).toBe(true);
    expect(editor.error()).toBe('Título é obrigatório.');
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain(
      'Título é obrigatório.',
    );

    failWith428 = true;
    await fixture.componentInstance.save();
    expect(interceptSpy).toHaveBeenCalled();
    expect(editor.error()).toBe('');

    fixture.destroy();
  });
});
