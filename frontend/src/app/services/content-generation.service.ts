import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// Enums matching backend
export enum DocumentType {
  ARTICLE = 'ARTICLE',
  PRESS_RELEASE = 'PRESS_RELEASE',
  PRESS_BRIEFING = 'PRESS_BRIEFING',
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  SOCIAL_THREAD = 'SOCIAL_THREAD',
  OTHER = 'OTHER'
}

export enum DocumentStatus {
  DRAFT = 'DRAFT',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED'
}

export enum SourceType {
  TWEET = 'TWEET',
  HEADLINE = 'HEADLINE',
  URL = 'URL',
  FREE_TEXT = 'FREE_TEXT'
}

export enum ReviewEventType {
  SUBMITTED = 'SUBMITTED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  NOTE = 'NOTE',
  INLINE_EDIT = 'INLINE_EDIT'
}

// Interfaces
export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  parentVersionId?: string;
  htmlContent: string;
  sourceType: SourceType;
  sourceText: string;
  sourceUrl?: string;
  generationInputs?: GenerationInputs;
  llmMetadata?: LLMMetadata;
  createdByUserId: number;
  createdAt: string;
  createdBy: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

export interface Document {
  id: string;
  title: string;
  type: DocumentType;
  status: DocumentStatus;
  ownerUserId: number;
  latestVersionId?: string;
  createdAt: string;
  updatedAt: string;
  owner: User;
  latestVersion?: DocumentVersion;
}

export interface GenerationInputs {
  persona?: {
    name?: string;
    details?: string;
  };
  tone?: string;
  style?: string;
  audience?: string;
  format?: {
    length?: 'short' | 'medium' | 'long';
    template?: string;
    includeSections?: {
      background?: boolean;
      whatWeKnow?: boolean;
      risks?: boolean;
      callToAction?: boolean;
    };
    citations?: 'none' | 'placeholders' | 'explicit';
  };
  constraints?: {
    mustInclude?: string[];
    mustAvoid?: string[];
    bannedPhrases?: string[];
    legalSafety?: {
      noDefamation?: boolean;
      noPersonalData?: boolean;
      noOperationalDetails?: boolean;
    };
  };
  model?: string;
  temperature?: number;
}

export interface LLMMetadata {
  model: string;
  temperature: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  requestId?: string;
  duration?: number;
  finishReason?: string;
  isRevision?: boolean;
}

export interface ReviewEvent {
  id: string;
  documentId: string;
  versionId?: string;
  eventType: ReviewEventType;
  notes?: string;
  createdByUserId: number;
  createdAt: string;
  createdBy: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

export interface AuditLog {
  id: string;
  documentId?: string;
  versionId?: string;
  action: string;
  actorUserId: number;
  metadata?: any;
  createdAt: string;
  actor: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ContentGenerationService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiBaseUrl}/documents`;

  /**
   * List all documents with optional filters
   */
  listDocuments(filters?: { status?: string; userId?: number }): Observable<Document[]> {
    let params: any = {};
    if (filters?.status) params.status = filters.status;
    if (filters?.userId) params.userId = filters.userId.toString();

    return this.http.get<Document[]>(this.apiUrl, { params });
  }

  /**
   * Create a new document
   */
  createDocument(data: { title: string; type: DocumentType }): Observable<Document> {
    return this.http.post<Document>(this.apiUrl, data);
  }

  /**
   * Get document by ID
   */
  getDocument(documentId: string): Observable<Document> {
    return this.http.get<Document>(`${this.apiUrl}/${documentId}`);
  }

  /**
   * Get all versions of a document
   */
  getVersions(documentId: string): Observable<DocumentVersion[]> {
    return this.http.get<DocumentVersion[]>(`${this.apiUrl}/${documentId}/versions`);
  }

  /**
   * Get specific version
   */
  getVersion(documentId: string, versionId: string): Observable<DocumentVersion> {
    return this.http.get<DocumentVersion>(`${this.apiUrl}/${documentId}/versions/${versionId}`);
  }

  /**
   * Create a new version (manual save)
   */
  createVersion(
    documentId: string,
    data: {
      htmlContent: string;
      sourceType?: SourceType;
      sourceText?: string;
      sourceUrl?: string;
      generationInputs?: GenerationInputs;
    }
  ): Observable<DocumentVersion> {
    return this.http.post<DocumentVersion>(`${this.apiUrl}/${documentId}/versions`, data);
  }

  /**
   * Generate content using OpenAI
   */
  generateContent(
    documentId: string,
    data: {
      sourceType: SourceType;
      sourceText: string;
      sourceUrl?: string;
      generationInputs: GenerationInputs;
      mode?: 'new' | 'revise_current';
      revisionInstructions?: string;
    }
  ): Observable<DocumentVersion> {
    return this.http.post<DocumentVersion>(`${this.apiUrl}/${documentId}/generate`, data);
  }

  /**
   * Submit document for review
   */
  submitForReview(documentId: string): Observable<Document> {
    return this.http.post<Document>(`${this.apiUrl}/${documentId}/submit`, {});
  }

  /**
   * Approve document
   */
  approveDocument(documentId: string, notes?: string): Observable<Document> {
    return this.http.post<Document>(`${this.apiUrl}/${documentId}/approve`, { notes });
  }

  /**
   * Reject document
   */
  rejectDocument(
    documentId: string,
    data: {
      notes: string;
      htmlContent?: string;
    }
  ): Observable<{ document: Document; newVersion: DocumentVersion }> {
    return this.http.post<{ document: Document; newVersion: DocumentVersion }>(
      `${this.apiUrl}/${documentId}/reject`,
      data
    );
  }

  /**
   * Add review note
   */
  addReviewNote(
    documentId: string,
    data: {
      versionId: string;
      notes: string;
    }
  ): Observable<ReviewEvent> {
    return this.http.post<ReviewEvent>(`${this.apiUrl}/${documentId}/review-note`, data);
  }

  /**
   * Get review events
   */
  getReviewEvents(documentId: string): Observable<ReviewEvent[]> {
    return this.http.get<ReviewEvent[]>(`${this.apiUrl}/${documentId}/review-events`);
  }

  /**
   * Get audit log
   */
  getAuditLog(documentId: string): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(`${this.apiUrl}/${documentId}/audit-log`);
  }
}
