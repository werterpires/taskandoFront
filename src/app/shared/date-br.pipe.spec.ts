import { describe, expect, it } from 'vitest';
import { DateBrPipe, formatDateBr } from './date-br.pipe';

describe('DateBrPipe and formatDateBr', () => {
  const pipe = new DateBrPipe();

  it('formats YYYY-MM-DD as dd/MM/yyyy without timezone shift', () => {
    expect(pipe.transform('2026-10-13')).toBe('13/10/2026');
    expect(pipe.transform('2026-01-05')).toBe('05/01/2026');
  });

  it('formats YYYY-MM-DD as short dd/MM', () => {
    expect(pipe.transform('2026-10-13', 'short')).toBe('13/10');
  });

  it('formats month and year in Portuguese with initial capital letter', () => {
    const d = new Date(2026, 9, 1);
    expect(pipe.transform(d, 'monthYear')).toContain('2026');
    expect(pipe.transform('2026-10-13', 'monthYear')).toContain('2026');
  });

  it('formats datetime strings', () => {
    const res = pipe.transform('2026-10-13T14:30:00Z', 'datetime');
    expect(res).toMatch(/^\d{2}\/\d{2}\/2026 \d{2}:\d{2}$/);
  });

  it('handles null, undefined and empty values gracefully', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });
});
