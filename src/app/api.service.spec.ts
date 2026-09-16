import { describe, expect, it } from 'vitest';
import { withIncludeClosed } from './api.service';

describe('withIncludeClosed', () => {
  it('keeps the backend canonical order and removes duplicates', () => {
    expect(withIncludeClosed('tasks', ['archived', 'completed', 'completed']))
      .toBe('tasks?includeClosed=completed,archived');
  });

  it('preserves existing query parameters', () => {
    expect(withIncludeClosed('context?parentType=root', ['cancelled']))
      .toBe('context?parentType=root&includeClosed=cancelled');
  });

  it('does not add an empty filter', () => {
    expect(withIncludeClosed('tasks', [])).toBe('tasks');
  });
});
