import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ApiError, ApiService, withIncludeClosed } from './api.service';
import { LegalGateService } from './legal/legal-gate.service';

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

describe('ApiService 428 interception', () => {
  it('activates LegalGateService when API responds with HTTP 428 LEGAL_ACCEPTANCE_REQUIRED', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    const api = TestBed.inject(ApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    const legalGate = TestBed.inject(LegalGateService);
    legalGate.clear();

    const pendingRequest = api.request('tasks');
    const req = httpTesting.expectOne(r => r.url.endsWith('/api/tasks'));
    req.flush(
      {
        error: 'É necessário aceitar os Termos de Uso e a Política de Privacidade vigentes para continuar.',
        code: 'LEGAL_ACCEPTANCE_REQUIRED',
        legalStatus: {
          requiresAcceptance: true,
          activeVersions: { terms: '1.0', privacy: '1.0' },
          acceptedVersions: { terms: null, privacy: null },
          pendingDocuments: ['terms', 'privacy'],
        },
      },
      { status: 428, statusText: 'Precondition Required' },
    );

    await expect(pendingRequest).rejects.toBeInstanceOf(ApiError);
    expect(legalGate.requiresAcceptance()).toBe(true);
    expect(legalGate.legalStatus()?.pendingDocuments).toEqual(['terms', 'privacy']);
    httpTesting.verify();
  });
});
