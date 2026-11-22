import { Injectable, computed, signal } from '@angular/core';
import { LegalDocumentType, LegalStatus } from './legal.types';

function isLegalDocumentType(value: unknown): value is LegalDocumentType {
  return value === 'terms' || value === 'privacy';
}

function normalizeLegalStatus(raw: unknown): LegalStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  if (typeof record['requiresAcceptance'] !== 'boolean') return null;

  const rawActive = (record['activeVersions'] ?? {}) as Record<string, unknown>;
  const rawAccepted = (record['acceptedVersions'] ?? {}) as Record<string, unknown>;
  const rawPending = Array.isArray(record['pendingDocuments']) ? record['pendingDocuments'] : [];

  return {
    requiresAcceptance: record['requiresAcceptance'],
    activeVersions: {
      terms: typeof rawActive['terms'] === 'string' ? rawActive['terms'] : '',
      privacy: typeof rawActive['privacy'] === 'string' ? rawActive['privacy'] : '',
    },
    acceptedVersions: {
      terms: typeof rawAccepted['terms'] === 'string' ? rawAccepted['terms'] : null,
      privacy: typeof rawAccepted['privacy'] === 'string' ? rawAccepted['privacy'] : null,
    },
    pendingDocuments: rawPending.filter(isLegalDocumentType),
  };
}

@Injectable({ providedIn: 'root' })
export class LegalGateService {
  readonly legalStatus = signal<LegalStatus | null>(null);
  readonly requiresAcceptance = computed(() => Boolean(this.legalStatus()?.requiresAcceptance));
  readonly recovered = signal(0);

  syncStatus(status: LegalStatus | null | undefined): void {
    this.legalStatus.set(normalizeLegalStatus(status));
  }

  intercept428(details?: Record<string, unknown> | null): void {
    const parsed = normalizeLegalStatus(details?.['legalStatus']);
    if (parsed) {
      this.legalStatus.set({ ...parsed, requiresAcceptance: true });
      return;
    }
    const previous = this.legalStatus();
    this.legalStatus.set({
      requiresAcceptance: true,
      activeVersions: previous?.activeVersions ?? { terms: '', privacy: '' },
      acceptedVersions: previous?.acceptedVersions ?? { terms: null, privacy: null },
      pendingDocuments: previous?.pendingDocuments.length ? previous.pendingDocuments : ['terms', 'privacy'],
    });
  }

  notifyRecovered(): void {
    this.recovered.update(count => count + 1);
  }

  clear(): void {
    this.legalStatus.set(null);
  }
}

