import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  it('emits email and password on form submit', async () => {
    const router = { navigate: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [{ provide: Router, useValue: router }],
    }).compileComponents();

    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    const submitted: { email: string; password: string }[] = [];
    component.login.subscribe(value => submitted.push(value));

    component.email.set('pessoa@example.test');
    component.password.set('secret123');
    fixture.detectChanges();

    const form = (fixture.nativeElement as HTMLElement).querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(submitted).toEqual([{ email: 'pessoa@example.test', password: 'secret123' }]);
    fixture.destroy();
  });

  it('displays error message and disables submit when saving is true', async () => {
    const router = { navigate: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [{ provide: Router, useValue: router }],
    }).compileComponents();

    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentRef.setInput('saving', true);
    fixture.componentRef.setInput('error', 'Credenciais inválidas.');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const button = el.querySelector('button.primary') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('Aguarde…');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Credenciais inválidas.');
    fixture.destroy();
  });

  it('navigates to legal routes when legal links are clicked', async () => {
    const router = { navigate: vi.fn(async () => true) };
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [{ provide: Router, useValue: router }],
    }).compileComponents();

    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();

    const links = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('[data-testid="login-legal-links"] a'));
    expect(links).toHaveLength(2);
    (links[0] as HTMLAnchorElement).click();
    (links[1] as HTMLAnchorElement).click();

    expect(router.navigate).toHaveBeenNthCalledWith(1, ['/termos']);
    expect(router.navigate).toHaveBeenNthCalledWith(2, ['/privacidade']);
    fixture.destroy();
  });
});
