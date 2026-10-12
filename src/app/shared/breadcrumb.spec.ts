import { describe, expect, it } from 'vitest';
import { entityBreadcrumbs, entityPathString } from './breadcrumb';
import { Item } from '../api.service';

describe('breadcrumb utility', () => {
  it('returns empty array when item is null', () => {
    expect(entityBreadcrumbs(null)).toEqual([]);
    expect(entityPathString(null)).toBe('');
  });

  it('generates path for personal item with no parentChain', () => {
    const item: Item = { id: 'task-1', title: 'Comprar café', kind: 'task' };
    const crumbs = entityBreadcrumbs(item);
    expect(crumbs).toEqual([
      { label: 'pessoal', route: ['/inicio'] },
      { label: 'Comprar café', type: 'task', id: 'task-1', isCurrent: true },
    ]);
    expect(entityPathString(item)).toBe('pessoal → Comprar café');
  });

  it('generates path for organization', () => {
    const item: Item = { id: 'org-1', name: 'edubazu', kind: 'organization', parentChain: [] };
    const crumbs = entityBreadcrumbs(item);
    expect(crumbs).toEqual([
      { label: 'pessoal', route: ['/inicio'] },
      { label: 'edubazu', type: 'organization', id: 'org-1', isCurrent: true },
    ]);
    expect(entityPathString(item)).toBe('pessoal → edubazu');
  });

  it('generates full path for department inside organization', () => {
    const item: Item = {
      id: 'dept-1',
      name: 'Desenvolvimento',
      kind: 'department',
      parentChain: [{ type: 'organization', id: 'org-1', name: 'edubazu' }],
    };
    expect(entityPathString(item)).toBe('pessoal → edubazu → Desenvolvimento');
  });

  it('generates complete path down to task with full hierarchy', () => {
    const item: Item = {
      id: 'task-99',
      title: 'Telas Completas',
      kind: 'task',
      parentChain: [
        { type: 'organization', id: 'org-1', name: 'edubazu' },
        { type: 'department', id: 'dept-1', name: 'Desenvolvimento' },
        { type: 'team', id: 'team-1', name: 'Taskando' },
        { type: 'process', id: 'proc-1', name: 'Processo Core' },
        { type: 'phase', id: 'phase-1', name: 'Fase Frontend' },
      ],
    };
    expect(entityPathString(item)).toBe('pessoal → edubazu → Desenvolvimento → Taskando → Processo Core → Fase Frontend → Telas Completas');
  });
});
