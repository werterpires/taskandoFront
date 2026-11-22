import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { Item } from '../../api.service';
import { ItemDrawerComponent } from './item-drawer.component';

describe('ItemDrawerComponent', () => {
  it('renders item details, breadcrumbs, and manages form signals under OnPush', async () => {
    await TestBed.configureTestingModule({
      imports: [ItemDrawerComponent],
    }).compileComponents();

    const task: Item = {
      id: 'task-1',
      kind: 'task',
      title: 'Revisar entrega',
      description: 'Conferir checklist final',
      status: 'todo',
      taskType: 'simple',
      parentChain: [{ type: 'organization', id: 'org-1', name: 'edubazu' }],
    };

    const fixture = TestBed.createComponent(ItemDrawerComponent);
    fixture.componentRef.setInput('item', task);
    fixture.componentRef.setInput('tab', 'Checklist');
    fixture.componentRef.setInput('detail', {
      items: [{ id: 'chk-1', title: 'Passo 1', completed: false }],
    });
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.drawer h2')?.textContent).toContain('Revisar entrega');
    expect(el.querySelector('.drawer .entity-path')?.textContent).toContain('edubazu');
    expect(el.textContent).toContain('Passo 1');

    const checklistPayloads: { title: string; reset: () => void }[] = [];
    fixture.componentInstance.addChecklistItem.subscribe(payload => checklistPayloads.push(payload));

    fixture.componentInstance.newChecklistText.set('Passo 2');
    fixture.detectChanges();
    fixture.componentInstance.submitChecklist();
    expect(checklistPayloads[0].title).toBe('Passo 2');

    checklistPayloads[0].reset();
    fixture.detectChanges();
    expect(fixture.componentInstance.newChecklistText()).toBe('');

    fixture.componentInstance.newCommentText.set('Rascunho antigo');
    fixture.componentRef.setInput('item', { ...task, id: 'task-2', title: 'Outra tarefa' });
    fixture.detectChanges();
    expect(fixture.componentInstance.newCommentText()).toBe('');
    fixture.destroy();
  });

  it('emits tabChange, close, and inviteAccess from Acessos tab', async () => {
    await TestBed.configureTestingModule({
      imports: [ItemDrawerComponent],
    }).compileComponents();

    const project: Item = {
      id: 'proj-1',
      kind: 'project',
      title: 'Projeto Alpha',
      status: 'in_progress',
    };

    const fixture = TestBed.createComponent(ItemDrawerComponent);
    fixture.componentRef.setInput('item', project);
    fixture.componentRef.setInput('tab', 'Acessos');
    fixture.componentRef.setInput('detail', {
      access: {
        owner: { displayName: 'Ana' },
        assignments: [{ id: 'a-1', displayName: 'Bruno', role: 'editor' }],
        canManage: true,
      },
    });
    fixture.detectChanges();

    const invited: { email: string; role: string }[] = [];
    fixture.componentInstance.inviteAccess.subscribe(value => invited.push({ email: value.email, role: value.role }));

    fixture.componentInstance.inviteEmail.set('carla@example.test');
    fixture.componentInstance.inviteRole.set('executor');
    fixture.detectChanges();
    fixture.componentInstance.submitInvite();

    expect(invited).toEqual([{ email: 'carla@example.test', role: 'executor' }]);
    fixture.destroy();
  });
});
