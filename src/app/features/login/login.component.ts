import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

export interface LoginCredentials {
  email: string;
  password: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly router = inject(Router);

  readonly saving = input<boolean>(false);
  readonly error = input<string>('');
  readonly login = output<LoginCredentials>();

  readonly email = signal('');
  readonly password = signal('');

  submit(): void {
    this.login.emit({ email: this.email(), password: this.password() });
  }

  openLegalRoute(event: Event, path: '/termos' | '/privacidade'): void {
    event.preventDefault();
    void this.router.navigate([path]);
  }
}
