import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { ApiError, ApiService } from '../api.service';
import { LegalGateService } from './legal-gate.service';
import { TermsAcceptanceModalComponent } from './terms-acceptance-modal.component';

const LEGAL_DOCS = {
  activeVersions: { terms: '1.0', privacy: '1.0' },
  documents: [
    {
      type: 'terms' as const,
      title: 'Termos de Uso — Taskando',
      version: '1.0',
      content: '# Termos de Uso — Taskando\n\nTexto integral dos Termos.',
    },
    {
      type: 'privacy' as const,
      title: 'Política de Privacidade — Taskando',
      version: '1.0',
      content: '# Política de Privacidade — Taskando\n\nTexto integral da Privacidade.',
    },
  ],
};

async function flushAsync() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('TermsAcceptanceModalComponent', () => {
  it('loads documents for full reading, switches tabs, and submits POST /api/legal/accept with channel web', async () => {
    const api = {
      request: vi.fn(async (path: string, method = 'GET') => {
        if (path === 'legal/documents' && method === 'GET') return LEGAL_DOCS;
        if (path === 'legal/accept' && method === 'POST') {
          return {
            legalStatus: {
              requiresAcceptance: false,
              activeVersions: { terms: '1.0', privacy: '1.0' },
              acceptedVersions: { terms: '1.0', privacy: '1.0' },
              pendingDocuments: [],
            },
          };
        }
        throw new Error(`Unexpected request: ${method} ${path}`);
      }),
    };

    await TestBed.configureTestingModule({
      imports: [TermsAcceptanceModalComponent],
      providers: [{ provide: ApiService, useValue: api }],
    }).compileComponents();

    const legalGate = TestBed.inject(LegalGateService);
    legalGate.syncStatus({
      requiresAcceptance: true,
      activeVersions: { terms: '1.0', privacy: '1.0' },
      acceptedVersions: { terms: null, privacy: null },
      pendingDocuments: ['terms', 'privacy'],
    });

    const fixture = TestBed.createComponent(TermsAcceptanceModalComponent);
    const acceptedSpy = vi.fn();
    fixture.componentInstance.accepted.subscribe(acceptedSpy);
    fixture.detectChanges();
    await flushAsync();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="legal-acceptance-body"]')?.textContent).toContain('Texto integral dos Termos.');

    const privacyTab = el.querySelector('[data-testid="legal-tab-privacy"]') as HTMLButtonElement;
    privacyTab.click();
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="legal-acceptance-body"]')?.textContent).toContain('Texto integral da Privacidade.');

    const submitBtn = el.querySelector('[data-testid="legal-acceptance-submit"]') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(true);

    const checkbox = el.querySelector('[data-testid="legal-acceptance-checkbox"]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(submitBtn.disabled).toBe(false);

    submitBtn.click();
    await flushAsync();
    fixture.detectChanges();

    expect(api.request).toHaveBeenCalledWith('legal/accept', 'POST', {
      documents: [
        { documentType: 'terms', version: '1.0' },
        { documentType: 'privacy', version: '1.0' },
      ],
      channel: 'web',
    });
    expect(legalGate.requiresAcceptance()).toBe(false);
    expect(acceptedSpy).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });

  it('reloads documents and unchecks confirmation when POST /api/legal/accept returns 409', async () => {
    let docsCalls = 0;
    const api = {
      request: vi.fn(async (path: string, method = 'GET') => {
        if (path === 'legal/documents') {
          docsCalls += 1;
          return LEGAL_DOCS;
        }
        if (path === 'legal/accept' && method === 'POST') {
          throw new ApiError(409, { error: 'Versão desatualizada.' });
        }
        throw new Error(`Unexpected request: ${method} ${path}`);
      }),
    };

    await TestBed.configureTestingModule({
      imports: [TermsAcceptanceModalComponent],
      providers: [{ provide: ApiService, useValue: api }],
    }).compileComponents();

    const legalGate = TestBed.inject(LegalGateService);
    legalGate.syncStatus({
      requiresAcceptance: true,
      activeVersions: { terms: '1.0', privacy: '1.0' },
      acceptedVersions: { terms: null, privacy: null },
      pendingDocuments: ['terms', 'privacy'],
    });

    const fixture = TestBed.createComponent(TermsAcceptanceModalComponent);
    fixture.detectChanges();
    await flushAsync();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const checkbox = el.querySelector('[data-testid="legal-acceptance-checkbox"]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const submitBtn = el.querySelector('[data-testid="legal-acceptance-submit"]') as HTMLButtonElement;
    submitBtn.click();
    await flushAsync();
    fixture.detectChanges();

    expect(docsCalls).toBe(2);
    expect(fixture.componentInstance.acceptedChecked()).toBe(false);
    expect(el.querySelector('[data-testid="legal-acceptance-error"]')?.textContent).toContain('Os documentos legais foram atualizados');
    fixture.destroy();
  });

  it('emits logoutRequested when clicking Sair', async () => {
    const api = {
      request: vi.fn(async () => LEGAL_DOCS),
    };

    await TestBed.configureTestingModule({
      imports: [TermsAcceptanceModalComponent],
      providers: [{ provide: ApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(TermsAcceptanceModalComponent);
    const logoutSpy = vi.fn();
    fixture.componentInstance.logoutRequested.subscribe(logoutSpy);
    fixture.detectChanges();
    await flushAsync();
    fixture.detectChanges();

    const logoutBtn = fixture.nativeElement.querySelector('[data-testid="legal-acceptance-logout"]') as HTMLButtonElement;
    logoutBtn.click();
    expect(logoutSpy).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });
});

