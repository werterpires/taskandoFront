import { Injectable, OnDestroy, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  kind: ToastKind;
  durationMs: number;
  createdAt: number;
}

interface TimerEntry {
  timeoutId: ReturnType<typeof setTimeout> | null;
  remainingMs: number;
  startedAt: number;
  paused: boolean;
}

const DEFAULT_DURATION_MS = 4500;
const DEFAULT_ERROR_DURATION_MS = 6000;

@Injectable({ providedIn: 'root' })
export class ToastService implements OnDestroy {
  private readonly _toasts = signal<ToastItem[]>([]);
  readonly toasts = this._toasts.asReadonly();

  private readonly timers = new Map<string, TimerEntry>();
  private nextId = 0;

  show(message: string, kind: ToastKind = 'info', durationMs?: number): string {
    const text = message.trim();
    if (!text) return '';

    const resolvedDuration =
      durationMs ?? (kind === 'error' ? DEFAULT_ERROR_DURATION_MS : DEFAULT_DURATION_MS);
    const id = `toast-${++this.nextId}`;
    const item: ToastItem = {
      id,
      message: text,
      kind,
      durationMs: resolvedDuration,
      createdAt: Date.now(),
    };

    this._toasts.update(list => [...list, item]);

    if (resolvedDuration > 0) {
      this.scheduleTimer(id, resolvedDuration);
    }

    return id;
  }

  success(message: string, durationMs?: number): string {
    return this.show(message, 'success', durationMs);
  }

  error(message: string, durationMs?: number): string {
    return this.show(message, 'error', durationMs);
  }

  info(message: string, durationMs?: number): string {
    return this.show(message, 'info', durationMs);
  }

  dismiss(id: string): void {
    this.clearTimer(id);
    this._toasts.update(list => list.filter(toast => toast.id !== id));
  }

  pause(id: string): void {
    const entry = this.timers.get(id);
    if (!entry || entry.paused || entry.timeoutId === null) return;

    clearTimeout(entry.timeoutId);
    entry.timeoutId = null;
    const elapsed = Math.max(0, Date.now() - entry.startedAt);
    entry.remainingMs = Math.max(0, entry.remainingMs - elapsed);
    entry.paused = true;
  }

  resume(id: string): void {
    const entry = this.timers.get(id);
    if (!entry || !entry.paused) return;

    entry.paused = false;
    if (entry.remainingMs <= 0) {
      this.dismiss(id);
      return;
    }

    entry.startedAt = Date.now();
    entry.timeoutId = setTimeout(() => this.dismiss(id), entry.remainingMs);
  }

  clear(): void {
    for (const id of [...this.timers.keys()]) {
      this.clearTimer(id);
    }
    this._toasts.set([]);
  }

  ngOnDestroy(): void {
    this.clear();
  }

  private scheduleTimer(id: string, durationMs: number): void {
    const timeoutId = setTimeout(() => this.dismiss(id), durationMs);
    this.timers.set(id, {
      timeoutId,
      remainingMs: durationMs,
      startedAt: Date.now(),
      paused: false,
    });
  }

  private clearTimer(id: string): void {
    const entry = this.timers.get(id);
    if (!entry) return;
    if (entry.timeoutId !== null) {
      clearTimeout(entry.timeoutId);
    }
    this.timers.delete(id);
  }
}
