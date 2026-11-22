import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastKind, ToastService } from './toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-container" aria-live="polite" aria-relevant="additions text">
      @for (toast of toastService.toasts(); track toast.id) {
        <article
          class="toast"
          [attr.data-kind]="toast.kind"
          [attr.role]="toast.kind === 'error' ? 'alert' : 'status'"
          (mouseenter)="toastService.pause(toast.id)"
          (mouseleave)="toastService.resume(toast.id)"
          (focusin)="toastService.pause(toast.id)"
          (focusout)="toastService.resume(toast.id)"
        >
          <span class="toast-indicator" aria-hidden="true">{{ iconFor(toast.kind) }}</span>
          <p class="toast-message">{{ toast.message }}</p>
          <button
            type="button"
            class="toast-dismiss"
            aria-label="Fechar aviso"
            (click)="toastService.dismiss(toast.id)"
          >×</button>
        </article>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);

  iconFor(kind: ToastKind): string {
    if (kind === 'success') return '✓';
    if (kind === 'error') return '!';
    return '❧';
  }
}
