import { Item } from '../api.service';

export interface BreadcrumbCrumb {
  label: string;
  type?: string;
  id?: string;
  route?: string[];
  isCurrent?: boolean;
}

export function entityBreadcrumbs(item: Item | null, currentTitle?: string): BreadcrumbCrumb[] {
  if (!item) return [];

  const crumbs: BreadcrumbCrumb[] = [
    { label: 'pessoal', route: ['/inicio'] },
  ];

  const chain = (item['parentChain'] ?? []) as { type?: string; id?: string; name?: string; title?: string }[];
  for (const parent of chain) {
    const label = parent.name ?? parent.title ?? '';
    if (!label) continue;
    const type = parent.type;
    const id = parent.id;
    let route: string[] | undefined;
    if (id) {
      if (type === 'organization') route = ['/estrutura', 'organizacao', id];
      else if (type === 'department') route = ['/estrutura', 'departamento', id];
      else if (type === 'team') route = ['/estrutura', 'time', id];
      else if (type === 'process') route = ['/processos', id];
      else if (type === 'phase') route = ['/fases', id];
      else if (type === 'task') route = ['/tarefas', id];
      else if (type === 'list') route = ['/listas', id];
    }
    crumbs.push({ label, type, id, route });
  }

  const currentLabel = currentTitle || item.title || item.name || '';
  if (currentLabel) {
    crumbs.push({
      label: currentLabel,
      type: item.kind,
      id: item.id,
      isCurrent: true,
    });
  }

  return crumbs;
}

export function entityPathString(item: Item | null, currentTitle?: string): string {
  return entityBreadcrumbs(item, currentTitle).map(c => c.label).filter(Boolean).join(' → ');
}
