import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContainerComponent } from './toast-container.component';
import { ToastService } from './toast.service';

describe('ToastContainerComponent', () => {
  let toastService: ToastService;

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-22T12:00:00Z'));

    await TestBed.configureTestingModule({
      imports: [ToastContainerComponent],
    }).compileComponents();

    toastService = TestBed.inject(ToastService);
  });

  afterEach(() => {
    toastService.clear();
    vi.useRealTimers();
  });

  it('renders an aria-live="polite" region and displays toasts by kind', () => {
    const fixture = TestBed.createComponent(ToastContainerComponent);
    fixture.detectChanges();

    const container = (fixture.nativeElement as HTMLElement).querySelector('.toast-container');
    expect(container?.getAttribute('aria-live')).toBe('polite');
    expect(container?.querySelectorAll('.toast')).toHaveLength(0);

    toastService.success('Salvo com sucesso.', 0);
    toastService.error('Erro inesperado.', 0);
    toastService.info('Informação útil.', 0);
    fixture.detectChanges();

    const toasts = Array.from(container?.querySelectorAll('.toast') ?? []);
    expect(toasts).toHaveLength(3);
    expect(toasts[0].getAttribute('data-kind')).toBe('success');
    expect(toasts[0].getAttribute('role')).toBe('status');
    expect(toasts[0].textContent).toContain('Salvo com sucesso.');

    expect(toasts[1].getAttribute('data-kind')).toBe('error');
    expect(toasts[1].getAttribute('role')).toBe('alert');
    expect(toasts[1].textContent).toContain('Erro inesperado.');

    expect(toasts[2].getAttribute('data-kind')).toBe('info');
    expect(toasts[2].getAttribute('role')).toBe('status');
    expect(toasts[2].textContent).toContain('Informação útil.');
    fixture.destroy();
  });

  it('dismisses a toast when its close button is clicked', () => {
    const fixture = TestBed.createComponent(ToastContainerComponent);
    toastService.success('Preferências salvas.', 0);
    fixture.detectChanges();

    const closeBtn = (fixture.nativeElement as HTMLElement).querySelector(
      'button[aria-label="Fechar aviso"]',
    ) as HTMLButtonElement | null;
    expect(closeBtn).toBeTruthy();

    closeBtn?.click();
    fixture.detectChanges();

    expect(toastService.toasts()).toHaveLength(0);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.toast')).toHaveLength(0);
    fixture.destroy();
  });

  it('pauses auto-dismiss on mouseenter and resumes on mouseleave', () => {
    const fixture = TestBed.createComponent(ToastContainerComponent);
    toastService.info('Passe o mouse', 3000);
    fixture.detectChanges();

    const toastEl = (fixture.nativeElement as HTMLElement).querySelector('.toast') as HTMLElement;
    expect(toastEl).toBeTruthy();

    vi.advanceTimersByTime(1000);
    toastEl.dispatchEvent(new Event('mouseenter'));
    vi.advanceTimersByTime(5000);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.toast')).toHaveLength(1);

    toastEl.dispatchEvent(new Event('mouseleave'));
    vi.advanceTimersByTime(1999);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.toast')).toHaveLength(1);

    vi.advanceTimersByTime(1);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.toast')).toHaveLength(0);
    fixture.destroy();
  });
});
