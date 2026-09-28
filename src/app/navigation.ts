export type NavigationItem = {
  section: string;
  path: string;
  icon: string;
};

export type RouteScope = {
  kind: 'list' | 'organization' | 'department' | 'team';
  id: string;
};

export const navigation: readonly NavigationItem[] = [
  { section: 'Início', path: 'inicio', icon: '⌂' },
  { section: 'Minhas tarefas', path: 'minhas-tarefas', icon: '✓' },
  { section: 'Cíclicas', path: 'ciclicas', icon: '↻' },
  { section: 'Lembretes', path: 'lembretes', icon: '♧' },
  { section: 'Calendário', path: 'calendario', icon: '▦' },
  { section: 'Quadrante', path: 'quadrante', icon: '⊞' },
  { section: 'Painel', path: 'painel', icon: '◷' },
  { section: 'Relatórios', path: 'relatorios', icon: '▤' },
  { section: 'Listas', path: 'listas', icon: '☷' },
  { section: 'Projetos', path: 'projetos', icon: '◇' },
  { section: 'Produtos', path: 'produtos', icon: '◈' },
  { section: 'Processos', path: 'processos', icon: '⇢' },
  { section: 'Séries', path: 'series', icon: '⟳' },
  { section: 'Templates', path: 'templates', icon: '▧' },
  { section: 'Estrutura', path: 'estrutura', icon: '⌘' },
  { section: 'Lixeira', path: 'lixeira', icon: '♲' },
  { section: 'Configurações', path: 'configuracoes', icon: '⚙' },
];

const fixedByPath = new Map(navigation.map(item => [item.path, item]));

export function fixedRoute(section: string): string {
  return navigation.find(item => item.section === section)?.path ?? 'inicio';
}

export function routeScope(segments: readonly string[]): RouteScope | null {
  if (segments[0] === 'listas' && segments.length === 2) return { kind: 'list', id: segments[1] };
  if (segments[0] === 'estrutura' && segments.length === 3 && ['organizacao', 'departamento', 'time'].includes(segments[1])) {
    return { kind: ({ organizacao: 'organization', departamento: 'department', time: 'team' } as const)[segments[1] as 'organizacao' | 'departamento' | 'time'], id: segments[2] };
  }
  return null;
}

export function sectionForRoute(segments: readonly string[]): string | null {
  const scope = routeScope(segments);
  if (scope) return scope.kind === 'list' ? 'Listas' : 'Estrutura';
  return segments.length === 1 ? fixedByPath.get(segments[0])?.section ?? null : null;
}


export function scopedRoute(scope: RouteScope): string[] {
  if (scope.kind === 'list') return ['listas', scope.id];
  const segment = ({ organization: 'organizacao', department: 'departamento', team: 'time' } as const)[scope.kind];
  return ['estrutura', segment, scope.id];
}
