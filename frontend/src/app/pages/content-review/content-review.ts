import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import {
  ContentGenerationService,
  Document,
  DocumentStatus
} from '../../services/content-generation.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-content-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './content-review.html',
  styleUrls: ['./content-review.css']
})
export class ContentReviewComponent implements OnInit {
  documents = signal<Document[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Filters
  statusFilter = signal<string>('all');

  // User
  currentUser = signal<any>(null);

  // For quick actions
  processingDocId = signal<string | null>(null);

  private readonly contentGenService = inject(ContentGenerationService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.currentUser.set(user);
    }

    this.loadDocuments();
  }

  loadDocuments(): void {
    this.loading.set(true);
    this.error.set(null);

    const filters: any = {};
    const status = this.statusFilter();

    if (status !== 'all') {
      filters.status = status;
    }

    this.contentGenService
      .listDocuments(filters)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (docs) => {
          this.documents.set(docs);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load documents', err);
          this.error.set('Failed to load documents.');
          this.loading.set(false);
        }
      });
  }

  onFilterChange(): void {
    this.loadDocuments();
  }

  getStatusColor(status: DocumentStatus): string {
    switch (status) {
      case DocumentStatus.DRAFT:
        return 'bg-slate-600 text-slate-200';
      case DocumentStatus.IN_REVIEW:
        return 'bg-amber-600 text-white';
      case DocumentStatus.APPROVED:
        return 'bg-green-600 text-white';
      default:
        return 'bg-slate-600 text-slate-200';
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  canApproveOrReject(doc: Document): boolean {
    const user = this.currentUser();
    if (!user) return false;

    return doc.status === DocumentStatus.IN_REVIEW &&
           (user.role === 'EDITOR' || user.role === 'WRITER');
  }

  onViewDocument(doc: Document): void {
    // Navigate to the document editor
    // We need to determine the source item ID and type from the document
    // For now, we'll navigate to a generic edit route
    this.router.navigate(['/admin/content-edit', doc.id]);
  }

  onQuickApprove(doc: Document, event: Event): void {
    event.stopPropagation();

    if (!this.canApproveOrReject(doc)) return;

    if (!confirm(`Are you sure you want to approve "${doc.title}"?`)) {
      return;
    }

    this.processingDocId.set(doc.id);

    this.contentGenService
      .approveDocument(doc.id, 'Quick approved from review list')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.processingDocId.set(null);
          this.loadDocuments();
        },
        error: (err) => {
          console.error('Failed to approve document', err);
          alert('Failed to approve document.');
          this.processingDocId.set(null);
        }
      });
  }

  onQuickReject(doc: Document, event: Event): void {
    event.stopPropagation();

    if (!this.canApproveOrReject(doc)) return;

    const notes = prompt('Enter rejection notes (min 10 characters):');
    if (!notes || notes.trim().length < 10) {
      alert('Rejection notes must be at least 10 characters.');
      return;
    }

    this.processingDocId.set(doc.id);

    this.contentGenService
      .rejectDocument(doc.id, { notes })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.processingDocId.set(null);
          this.loadDocuments();
        },
        error: (err) => {
          console.error('Failed to reject document', err);
          alert('Failed to reject document.');
          this.processingDocId.set(null);
        }
      });
  }
}
