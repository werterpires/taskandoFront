import { Pipe, PipeTransform } from '@angular/core';

export type DateBrFormat = 'date' | 'short' | 'datetime' | 'shortDatetime' | 'monthYear';

export function formatDateBr(value: unknown, format: DateBrFormat = 'date'): string {
  if (!value) return '';

  if (typeof value === 'string') {
    const trimmed = value.trim();
    const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (ymdMatch) {
      const [, year, month, day] = ymdMatch;
      if (format === 'short') return `${day}/${month}`;
      if (format === 'monthYear') {
        const d = new Date(Number(year), Number(month) - 1, Number(day));
        const monthName = d.toLocaleDateString('pt-BR', { month: 'long' });
        return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${year}`;
      }
      return `${day}/${month}/${year}`;
    }
  }

  const d = value instanceof Date ? value : new Date(String(value));
  if (isNaN(d.getTime())) return String(value);

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  if (format === 'short') {
    return `${day}/${month}`;
  }

  if (format === 'datetime') {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  if (format === 'shortDatetime') {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month} ${hours}:${minutes}`;
  }

  if (format === 'monthYear') {
    const monthName = d.toLocaleDateString('pt-BR', { month: 'long' });
    const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    return `${capitalized} de ${year}`;
  }

  return `${day}/${month}/${year}`;
}

@Pipe({
  name: 'dateBr',
  standalone: true,
})
export class DateBrPipe implements PipeTransform {
  transform(value: unknown, format: DateBrFormat = 'date'): string {
    return formatDateBr(value, format);
  }
}
