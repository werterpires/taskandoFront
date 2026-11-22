import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiError, ApiService } from '../api.service';
import { LegalGateService } from './legal-gate.service';
import { LegalMarkdownComponent } from './legal-markdown.component';
import { LegalAcceptResponse, LegalDocument, LegalDocumentType, LegalDocumentsResponse } from './legal.types';

@Component({
  selector: 'app-terms-acceptance-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, LegalMarkdownComponent],
  templateUrl: './terms-acceptance-modal.component.html',
})
export class TermsAcceptanceModalComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly legalGate = inject(LegalGateService);

  readonly accepted = output<void>();
  readonly logoutRequested = output<void>();

  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly submitError = signal('');
  readonly submitting = signal(false);
  readonly documents = signal<LegalDocument[]>([]);
  readonly activeTab = signal<LegalDocumentType>('terms');
  readonly acceptedChecked = signal(false);

  readonly legalStatus = this.legalGate.legalStatus;
  readonly pendingDocuments = computed(() => new Set<LegalDocumentType>(this.legalStatus()?.pendingDocuments ?? ['terms', 'privacy']));
  readonly activeDocument = computed(() => {
    const docs = this.documents();
    if (!docs.length) return null;
    return docs.find(doc => doc.type === this.activeTab()) ?? docs[0];
  });
  readonly canSubmit = computed(() =>
    !this.loading() && !this.submitting() && !this.loadError() && this.documents().length > 0 && this.acceptedChecked(),
  );

  ngOnInit(): void {
    const pending = this.legalStatus()?.pendingDocuments;
    if (pending?.length) {
      this.activeTab.set(pending[0]);
    }
    void this.loadDocuments();
  }

  async loadDocuments(): Promise<void> {
    this.loading.set(true);
    this.loadError.set('');
    try {
      const response = await this.api.request<LegalDocumentsResponse>('legal/documents');
      const docs = response.documents ?? [];
      this.documents.set(docs);
      if (!docs.length) {
        this.loadError.set('Nenhum documento legal disponível para leitura.');
        return;
      }
      if (!docs.some(doc => doc.type === this.activeTab())) {
        this.activeTab.set(docs[0].type);
      }
    } catch (err) {
      this.loadError.set(err instanceof Error ? err.message : 'Não foi possível carregar os documentos legais.');
    } finally {
      this.loading.set(false);
    }
  }

  selectTab(type: LegalDocumentType): void {
    this.activeTab.set(type);
  }

  isPending(type: LegalDocumentType): boolean {
    return this.pendingDocuments().has(type);
  }

  tabLabel(type: LegalDocumentType): string {
    return type === 'privacy' ? 'Política de Privacidade' : 'Termos de Uso';
  }

  async submitAcceptance(): Promise<void> {
    if (!this.canSubmit()) return;
    this.submitting.set(true);
    this.submitError.set('');

    try {
      const docs = this.documents();
      const pending = this.pendingDocuments();
      const targetDocs = pending.size > 0 ? docs.filter(doc => pending.has(doc.type)) : docs;
      const payloadDocs = (targetDocs.length > 0 ? targetDocs : docs).map(doc => ({
        documentType: doc.type,
        version: doc.version,
      }));

      const response = await this.api.request<LegalAcceptResponse>('legal/accept', 'POST', {
        documents: payloadDocs,
        channel: 'web',
      });

      this.legalGate.syncStatus(response.legalStatus);
      if (this.legalGate.requiresAcceptance()) {
        this.acceptedChecked.set(false);
        const nextPending = response.legalStatus.pendingDocuments;
        if (nextPending.length) {
          this.activeTab.set(nextPending[0]);
        }
        this.submitError.set('Ainda há documentos pendentes de aceite para continuar.');
        return;
      }

      this.accepted.emit();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        this.acceptedChecked.set(false);
        this.submitError.set('Os documentos legais foram atualizados. Revise a nova versão antes de aceitar.');
        await this.loadDocuments();
      } else {
        this.submitError.set(err instanceof Error ? err.message : 'Não foi possível registrar o aceite legal.');
      }
    } finally {
      this.submitting.set(false);
    }
  }

  requestLogout(): void {
    if (this.submitting()) return;
    this.logoutRequested.emit();
  }
}

