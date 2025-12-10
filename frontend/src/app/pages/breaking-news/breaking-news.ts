import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  BreakingNewsService,
  BreakingNews,
  BreakingNewsEnrichment,
  BreakingNewsMedia,          // 👈 import
} from '../../services/breaking-news.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-breaking-news',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './breaking-news.html'
})
export class BreakingNewsComponent implements OnInit {
  breakingNews = signal<BreakingNews[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  enrichment = signal<BreakingNewsEnrichment | null>(null);
  enrichmentLoading = signal(false);
  enrichmentError = signal<string | null>(null);

  // 👇 strongly type media
  media = signal<BreakingNewsMedia | null>(null);
  mediaLoading = signal(false);
  mediaError = signal<string | null>(null);

  private readonly breakingNewsService = inject(BreakingNewsService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.loadBreakingNews();
  }

  loadBreakingNews(): void {
    this.loading.set(true);
    this.error.set(null);

    this.breakingNewsService
      .getAll(50, 0)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          console.log('Breaking news loaded:', res);
          this.breakingNews.set(res);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load breaking news', err);
          this.error.set('Failed to load breaking news.');
          this.loading.set(false);
        }
      });
  }

  openBreakingNewsDetail(tweetId: string) {
    // reset state
    this.enrichment.set(null);
    this.media.set(null);

    this.enrichmentLoading.set(true);
    this.enrichmentError.set(null);

    this.mediaLoading.set(true);
    this.mediaError.set(null);

    // Enrichment
    this.breakingNewsService
      .getEnrichmentById(tweetId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (enrichment) => {
          console.log('Enrichment data for ID', tweetId, ':', enrichment);
          this.enrichment.set(enrichment);
          this.enrichmentLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load enrichment data for ID', tweetId, err);
          this.enrichmentError.set('Failed to load enrichment details.');
          this.enrichmentLoading.set(false);
        }
      });

    // Media
    this.breakingNewsService
      .getMediaById(tweetId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (media) => {
          console.log('Media data for ID', tweetId, ':', media);
          this.media.set(media);
          this.mediaLoading.set(false);
        },
        error: (err) => {
          console.error('Failed to load media data for ID', tweetId, err);
          this.mediaError.set('Failed to load media details.');
          this.mediaLoading.set(false);
        }
      });
  }

  trackById(_index: number, item: BreakingNews) {
    return item._id;
  }

  getDomain(url: string): string {
  try {
    return new URL(url).hostname;  // e.g. "google.news"
  } catch {
    return url; // fallback if it's not a valid URL
  }
}
}
