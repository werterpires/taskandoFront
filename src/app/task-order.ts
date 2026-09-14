type TaskOrderRow = {
  id: string;
  startAt?: unknown;
  dueDate?: unknown;
  dateAt?: unknown;
  createdAt?: unknown;
};

function dateKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(?:Z|[+-](\d{2}):(\d{2}))?)?$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return null;
  if (match[4] && (Number(match[4]) > 23 || Number(match[5]) > 59 || (match[6] && Number(match[6]) > 59))) return null;
  if (match[7] && (Number(match[7]) > 23 || Number(match[8]) > 59)) return null;
  return value.slice(0, 10);
}

function effectiveDate(task: TaskOrderRow): string | null {
  return dateKey(task.startAt) ?? dateKey(task.dueDate) ?? dateKey(task.dateAt);
}

export function orderTasks<T extends TaskOrderRow>(tasks: readonly T[]): T[] {
  const dated: { task: T; date: string }[] = [];
  const undated: T[] = [];
  for (const task of tasks) {
    const date = effectiveDate(task);
    if (date) dated.push({ task, date });
    else undated.push(task);
  }

  if (!dated.length) return [...tasks];
  dated.sort((a, b) => a.date.localeCompare(b.date)
    || String(a.task.createdAt ?? '').localeCompare(String(b.task.createdAt ?? ''))
    || a.task.id.localeCompare(b.task.id));
  if (dated.length === 1) return [dated[0].task, ...undated];

  const gaps: T[][] = Array.from({ length: dated.length - 1 }, () => []);
  undated.forEach((task, index) => {
    const gap = Math.min(Math.floor(((index + 0.5) * gaps.length) / undated.length), gaps.length - 1);
    gaps[gap].push(task);
  });
  return dated.flatMap(({ task }, index) => index < gaps.length ? [task, ...gaps[index]] : [task]);
}
