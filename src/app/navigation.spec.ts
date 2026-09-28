import { describe, expect, it } from 'vitest';
import { fixedRoute, routeScope, scopedRoute, sectionForRoute } from './navigation';

describe('navigation', () => {
  it('maps fixed screens to stable routes', () => {
    expect(fixedRoute('Minhas tarefas')).toBe('minhas-tarefas');
    expect(sectionForRoute(['configuracoes'])).toBe('Configurações');
    expect(sectionForRoute(['desconhecida'])).toBeNull();
  });

  it('maps dynamic contexts without relying on menu data', () => {
    expect(routeScope(['listas', 'list-1'])).toEqual({ kind: 'list', id: 'list-1' });
    expect(routeScope(['estrutura', 'departamento', 'department-1'])).toEqual({ kind: 'department', id: 'department-1' });
    expect(scopedRoute({ kind: 'organization', id: 'org-1' })).toEqual(['estrutura', 'organizacao', 'org-1']);
  });
});
