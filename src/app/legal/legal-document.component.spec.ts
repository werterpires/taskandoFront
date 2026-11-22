import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ApiService } from '../api.service';
import { LegalDocumentComponent } from './legal-document.component';

const SAMPLE_DOCUMENTS = {
  activeVersions: { terms: '1.0', privacy: '1.0' },
  documents: [
    {
      type: 'terms',
      title: 'Termos de Uso — Taskando',
      version: '1.0',
      content: [
        '# Termos de Uso — Taskando',
        '',
        '> **Minuta de trabalho (versão `1.0`).** Revisão pendente.',
        '',
        '## 1. Aceitação e Escopo',
        '',
        'Consulte a [Política de Privacidade](./POLITICA-PRIVACIDADE.md).',
        '',
        '- Item um',
        '- Item dois',
      ].join('\n'),
    },
    {
      type: 'privacy',
      title: 'Política de Privacidade — Taskando',
      version: '1.0',
      content: [
        '# Política de Privacidade — Taskando',
        '',
        '## 3. Finalidades e Bases Legais',
        '',
        '| Finalidade | Base legal |',
        '| --- | --- |',
        '| Autenticação | Execução de contrato |',
      ].join('\n'),
    },
  ],
};

async function flushAsync() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('LegalDocumentComponent', () => {
  it('fetches GET /api/legal/documents and renders Termos de Uso on #/termos', async () => {
    const api = {
      request: vi.fn(async () => SAMPLE_DOCUMENTS),
    };
    const router = {
      url: '/termos',
      navigate: vi.fn(async () => true),
    };

    await TestBed.configureTestingModule({
      imports: [LegalDocumentComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { documentType: 'terms' }, url: [{ path: 'termos' }] },
            data: of({ documentType: 'terms' }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LegalDocumentComponent);
    fixture.detectChanges();
    await flushAsync();
    fixture.detectChanges();

    expect(api.request).toHaveBeenCalledWith('legal/documents');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="legal-document-card"]')?.textContent).toContain('Termos de Uso — Taskando');
    expect(el.querySelector('[data-testid="legal-document-version"]')?.textContent).toContain('Versão 1.0');
    expect(el.querySelector('.legal-markdown blockquote')?.textContent).toContain('Minuta de trabalho');
    expect(el.querySelector('.legal-markdown a')?.getAttribute('href')).toBe('#/privacidade');
    expect(el.querySelectorAll('.legal-markdown li')).toHaveLength(2);
    fixture.destroy();
  });

  it('renders Política de Privacidade on #/privacidade including markdown tables', async () => {
    const api = {
      request: vi.fn(async () => SAMPLE_DOCUMENTS),
    };
    const router = {
      url: '/privacidade',
      navigate: vi.fn(async () => true),
    };

    await TestBed.configureTestingModule({
      imports: [LegalDocumentComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { documentType: 'privacy' }, url: [{ path: 'privacidade' }] },
            data: of({ documentType: 'privacy' }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LegalDocumentComponent);
    fixture.detectChanges();
    await flushAsync();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="legal-document-card"]')?.textContent).toContain('Política de Privacidade — Taskando');
    expect(el.querySelector('.legal-markdown table')?.textContent).toContain('Execução de contrato');
    fixture.destroy();
  });

  it('shows error state and retries loading when GET /api/legal/documents fails', async () => {
    let calls = 0;
    const api = {
      request: vi.fn(async () => {
        calls += 1;
        if (calls === 1) throw new Error('Falha temporária.');
        return SAMPLE_DOCUMENTS;
      }),
    };
    const router = {
      url: '/termos',
      navigate: vi.fn(async () => true),
    };

    await TestBed.configureTestingModule({
      imports: [LegalDocumentComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: Router, useValue: router },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { data: { documentType: 'terms' }, url: [{ path: 'termos' }] },
            data: of({ documentType: 'terms' }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(LegalDocumentComponent);
    fixture.detectChanges();
    await flushAsync();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Falha temporária.');
    const retryButton = el.querySelector('button.primary') as HTMLButtonElement;
    retryButton.click();
    await flushAsync();
    fixture.detectChanges();

    expect(calls).toBe(2);
    expect(el.querySelector('[data-testid="legal-document-card"]')).toBeTruthy();
    fixture.destroy();
  });
});

