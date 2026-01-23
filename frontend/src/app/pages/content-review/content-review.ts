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
import { VideoService, Video, VideoStatus } from '../../services/video.service';

@Component({
  selector: 'app-content-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './content-review.html',
  styleUrls: ['./content-review.css']
})
export class ContentReviewComponent implements OnInit {
  documents = signal<Document[]>([]);
  videos = signal<Video[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Tab management
  activeTab = signal<'documents' | 'videos'>('documents');

  // Filters
  statusFilter = signal<string>('all');

  // User
  currentUser = signal<any>(null);

  // For quick actions
  processingDocId = signal<string | null>(null);
  processingVideoId = signal<string | null>(null);

  private readonly contentGenService = inject(ContentGenerationService);
  private readonly videoService = inject(VideoService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    if (user) {
      this.currentUser.set(user);
    }

    this.loadContent();
  }

  loadContent(): void {
    if (this.activeTab() === 'documents') {
      this.loadDocuments();
    } else {
      this.loadVideos();
    }
  }

  onTabChange(tab: 'documents' | 'videos'): void {
    this.activeTab.set(tab);
    this.statusFilter.set('all');
    this.loadContent();
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
    this.loadContent();
  }

  loadVideos(): void {
    this.loading.set(true);
    this.error.set(null);

    const filters: any = {};
    const status = this.statusFilter();

    if (status !== 'all') {
      filters.status = status;
    }

    this.videoService
      .listVideos(filters)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (videos) => {
          this.videos.set(videos);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load videos', err);
          this.error.set('Failed to load videos.');
          this.loading.set(false);
        }
      });
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

  getVideoStatusColor(status: VideoStatus): string {
    switch (status) {
      case VideoStatus.DRAFT:
        return 'bg-slate-600 text-slate-200';
      case VideoStatus.GENERATING:
        return 'bg-blue-600 text-white';
      case VideoStatus.GENERATED:
        return 'bg-cyan-600 text-white';
      case VideoStatus.IN_REVIEW:
        return 'bg-amber-600 text-white';
      case VideoStatus.APPROVED:
        return 'bg-green-600 text-white';
      case VideoStatus.REJECTED:
        return 'bg-red-600 text-white';
      case VideoStatus.FAILED:
        return 'bg-red-800 text-white';
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

  // Video actions
  canApproveOrRejectVideo(video: Video): boolean {
    const user = this.currentUser();
    if (!user) return false;

    return video.status === VideoStatus.IN_REVIEW &&
           (user.role === 'EDITOR' || user.role === 'WRITER');
  }

  onViewVideo(video: Video): void {
    // Navigate to the video page
    this.router.navigate(['/admin/new-video'], {
      queryParams: { videoId: video.id }
    });
  }

  onQuickApproveVideo(video: Video, event: Event): void {
    event.stopPropagation();

    if (!this.canApproveOrRejectVideo(video)) return;

    if (!confirm(`Are you sure you want to approve "${video.title}"?`)) {
      return;
    }

    this.processingVideoId.set(video.id);

    const videoService = this.videoService;
    videoService
      .approveVideo(video.id, 'Quick approved from review list')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.processingVideoId.set(null);
          this.loadVideos();
        },
        error: (err: any) => {
          console.error('Failed to approve video', err);
          alert('Failed to approve video.');
          this.processingVideoId.set(null);
        }
      });
  }

  onQuickRejectVideo(video: Video, event: Event): void {
    event.stopPropagation();

    if (!this.canApproveOrRejectVideo(video)) return;

    const notes = prompt('Enter rejection notes (min 10 characters):');
    if (!notes || notes.trim().length < 10) {
      alert('Rejection notes must be at least 10 characters.');
      return;
    }

    this.processingVideoId.set(video.id);

    const videoService = this.videoService;
    videoService
      .rejectVideo(video.id, { notes })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.processingVideoId.set(null);
          this.loadVideos();
        },
        error: (err: any) => {
          console.error('Failed to reject video', err);
          alert('Failed to reject video.');
          this.processingVideoId.set(null);
        }
      });
  }
}
