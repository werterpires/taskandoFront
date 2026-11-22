export const WORK_STATUSES = [
  'planned',
  'todo',
  'in_progress',
  'awaiting_approval',
  'completed',
  'cancelled',
  'archived',
] as const;

export const STATUS_LABELS: Record<string, string> = {
  planned: 'Planejado',
  todo: 'A fazer',
  in_progress: 'Em execução',
  awaiting_approval: 'Aguardando aprovação',
  completed: 'Concluído',
  cancelled: 'Cancelado',
  archived: 'Arquivado',
  active: 'Ativo',
  inactive: 'Inativo',
};

export const TASK_TYPE_LABELS: Record<string, string> = {
  simple: 'Simples',
  recurring: 'Recorrente',
  commitment: 'Compromisso',
  scheduled: 'Agendada',
  date: 'Data',
  event: 'Evento',
  cyclic: 'Cíclica',
  periodic: 'Periódica',
};

export const ITEM_KIND_LABELS: Record<string, string> = {
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

export const PRIORITY_LEVELS = ['high', 'medium', 'low'] as const;

export const PRIORITY_LEVEL_LABELS: Record<string, string> = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
};

export function localDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export interface CalendarDay {
  key: string;
  day: number;
  current: boolean;
}

export function computeCalendarDays(month: Date): CalendarDay[] {
  const start = new Date(month);
  start.setDate(1 - ((start.getDay() + 6) % 7));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return {
      key: localDateString(d),
      day: d.getDate(),
      current: d.getMonth() === month.getMonth(),
    };
  });
}
