import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ItemEditorService } from './item-editor.service';

describe('ItemEditorService', () => {
  it('initializes creation draft for task, ignoring list as parentType', () => {
    const service = TestBed.inject(ItemEditorService);

    service.openCreate('task', { id: 'list-1', kind: 'list', name: 'Compras' });

    expect(service.isOpen()).toBe(true);
    expect(service.kind()).toBe('task');
    expect(service.itemId()).toBeNull();
    expect(service.draft()['parentType']).toBeNull();
    expect(service.draft()['parentId']).toBeNull();
    expect(service.draft()['status']).toBe('todo');
    expect(service.draft()['taskType']).toBe('simple');
  });

  it('populates parent context and organizationId for container/organization creation', () => {
    const service = TestBed.inject(ItemEditorService);

    service.openCreate('department', { id: 'org-1', kind: 'organization', name: 'Org' });

    expect(service.isOpen()).toBe(true);
    expect(service.kind()).toBe('department');
    expect(service.draft()['parentType']).toBe('organization');
    expect(service.draft()['parentId']).toBe('org-1');
    expect(service.contextOrganizationId()).toBe('org-1');
  });

  it('populates edit draft with formatted timestamps, tags, characteristics, and name fallback', () => {
    const service = TestBed.inject(ItemEditorService);

    service.openEdit({
      id: 'prod-1',
      kind: 'product',
      title: 'Manual',
      tags: [{ name: 'docs' }, { name: 'v1' }],
      characteristics: [
        { key: 'Formato', value: 'PDF' },
        { key: 'Idioma', value: 'PT-BR' },
      ],
    });

    expect(service.isOpen()).toBe(true);
    expect(service.itemId()).toBe('prod-1');
    expect(service.draft()['title']).toBe('Manual');
    expect(service.draft()['tags']).toBe('docs, v1');
    expect(service.characteristics()).toBe('Formato: PDF\nIdioma: PT-BR');

    service.openEdit({
      id: 'list-2',
      kind: 'list',
      name: 'Mercado',
    });
    expect(service.draft()['title']).toBe('Mercado');
  });

  it('closes when not saving and refuses close while saving', () => {
    const service = TestBed.inject(ItemEditorService);
    service.openCreate('reminder');
    service.saving.set(true);
    service.close();
    expect(service.isOpen()).toBe(true);

    service.saving.set(false);
    service.close();
    expect(service.isOpen()).toBe(false);
  });
});
