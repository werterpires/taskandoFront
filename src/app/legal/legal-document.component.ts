import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiService } from '../api.service';
import { LegalMarkdownComponent } from './legal-markdown.component';
import { LegalDocument, LegalDocumentType, LegalDocumentsResponse } from './legal.types';

@Component({
  selector: 'app-legal-document',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, LegalMarkdownComponent],
  templateUrl: './legal-document.component.html',
})
export class LegalDocumentComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private routeSubscription?: Subscription;

  readonly documentType = signal<LegalDocumentType>('terms');
  readonly documents = signal<LegalDocument[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');

  readonly activeDocument = computed(() => {
    const type = this.documentType();
    return this.documents().find(doc => doc.type === type) ?? null;
  });

  ngOnInit(): void {
    this.syncDocumentType();
    this.routeSubscription = this.route.data.subscribe(() => this.syncDocumentType());
    void this.loadDocuments();
  }

  ngOnDestroy(): void {
    this.routeSubscription?.unsubscribe();
  }

  private syncDocumentType(): void {
    const dataType = this.route.snapshot?.data?.['documentType'];
    if (dataType === 'terms' || dataType === 'privacy') {
      this.documentType.set(dataType);
      return;
    }
    const path = this.route.snapshot?.url?.[0]?.path ?? '';
    if (path === 'privacidade' || this.router.url.startsWith('/privacidade')) {
      this.documentType.set('privacy');
      return;
    }
    this.documentType.set('terms');
  }

  async loadDocuments(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const response = await this.api.request<LegalDocumentsResponse>('legal/documents');
      this.documents.set(response.documents ?? []);
      if (!this.activeDocument()) {
        this.error.set('Documento legal não encontrado.');
      }
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Não foi possível carregar os documentos legais.');
    } finally {
      this.loading.set(false);
    }
  }

  switchDocument(event: Event, target: LegalDocumentType): void {
    event.preventDefault();
    this.documentType.set(target);
    void this.router.navigate([target === 'privacy' ? '/privacidade' : '/termos']);
  }

  goBack(): void {
    void this.router.navigate(['/inicio']);
  }
}

