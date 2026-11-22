import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-22T12:00:00Z'));
    TestBed.configureTestingModule({ providers: [ToastService] });
    service = TestBed.inject(ToastService);
  });

  afterEach(() => {
    service.clear();
    vi.useRealTimers();
  });

  it('starts with an empty toast list', () => {
    expect(service.toasts()).toEqual([]);
  });

  it('creates success, error, and info toasts and ignores blank messages', () => {
    expect(service.show('   ')).toBe('');
    expect(service.toasts()).toHaveLength(0);

    const id1 = service.success('Salvo.');
    const id2 = service.error('Falha ao salvar.');
    const id3 = service.info('Token revogado.');

    expect(service.toasts().map(t => ({ id: t.id, kind: t.kind, message: t.message }))).toEqual([
      { id: id1, kind: 'success', message: 'Salvo.' },
      { id: id2, kind: 'error', message: 'Falha ao salvar.' },
      { id: id3, kind: 'info', message: 'Token revogado.' },
    ]);
  });

  it('dismisses a single toast manually and clears all toasts on clear()', () => {
    const id1 = service.info('Primeiro', 0);
    const id2 = service.success('Segundo', 0);

    service.dismiss(id1);
    expect(service.toasts().map(t => t.id)).toEqual([id2]);

    service.clear();
    expect(service.toasts()).toEqual([]);
  });

  it('auto-dismisses after the configured duration and skips timer when durationMs <= 0', () => {
    service.success('Temporário', 3000);
    service.info('Persistente', 0);

    vi.advanceTimersByTime(2999);
    expect(service.toasts()).toHaveLength(2);

    vi.advanceTimersByTime(1);
    expect(service.toasts().map(t => t.message)).toEqual(['Persistente']);

    vi.advanceTimersByTime(60_000);
    expect(service.toasts().map(t => t.message)).toEqual(['Persistente']);
  });

  it('pauses auto-dismiss timer on pause() and resumes remaining time on resume()', () => {
    const id = service.show('Aviso com pausa', 'info', 4000);

    vi.advanceTimersByTime(1500);
    expect(service.toasts()).toHaveLength(1);

    service.pause(id);
    vi.advanceTimersByTime(10_000);
    expect(service.toasts()).toHaveLength(1);

    service.resume(id);
    vi.advanceTimersByTime(2499);
    expect(service.toasts()).toHaveLength(1);

    vi.advanceTimersByTime(1);
    expect(service.toasts()).toHaveLength(0);
  });

  it('clears active timers when destroyed', () => {
    service.success('Vai limpar', 2000);
    expect(service.toasts()).toHaveLength(1);

    service.ngOnDestroy();
    expect(service.toasts()).toEqual([]);
  });
});
