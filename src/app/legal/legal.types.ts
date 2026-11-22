export type LegalDocumentType = 'terms' | 'privacy';

export type LegalAcceptanceChannel = 'web' | 'mobile';

export type LegalDocument = {
  type: LegalDocumentType;
  title: string;
  version: string;
  content: string;
};

export type LegalDocumentsResponse = {
  activeVersions: Record<LegalDocumentType, string>;
  documents: LegalDocument[];
};

export type LegalStatus = {
  requiresAcceptance: boolean;
  activeVersions: Record<LegalDocumentType, string>;
  acceptedVersions: Record<LegalDocumentType, string | null>;
  pendingDocuments: LegalDocumentType[];
};

export type LegalAcceptResponse = {
  legalStatus: LegalStatus;
};

