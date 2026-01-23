// src/app/pages/breaking-news/breaking-news.ts (or wherever your component lives)
import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  BreakingNewsService,
  BreakingNews,
  BreakingNewsEnrichment,
  BreakingNewsMedia,
  BreakingNewsLiveItem,
} from '../../services/breaking-news.service';
import { MediaEmbedComponent } from '../../shared/components/media-embed/media-embed.component';
import { NewContentButtonComponent } from '../../shared/components/new-content-button/new-content-button.component';
import { NewVideoButtonComponent } from '../../shared/components/new-video-button/new-video-button.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { JobsService, JobRecord } from '../../services/jobs.service';
import { timer, of } from 'rxjs';
import { catchError, switchMap, tap } from 'rxjs/operators';

@Component({
  selector: 'app-breaking-news',
  standalone: true,
  imports: [CommonModule, MediaEmbedComponent, NewContentButtonComponent, NewVideoButtonComponent],
  templateUrl: './breaking-news.html'
})
export class BreakingNewsComponent implements OnInit {
  breakingNews = signal<BreakingNews[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  enrichment = signal<BreakingNewsEnrichment | null>(null);
  enrichmentLoading = signal(false);
  enrichmentError = signal<string | null>(null);

  media = signal<BreakingNewsMedia | null>(null);
  mediaLoading = signal(false);
  mediaError = signal<string | null>(null);

  selectedId = signal<string | null>(null);

  // Live feed modal state
  liveModalOpen = signal(false);
  liveModalStage = signal<'idle' | 'starting' | 'running' | 'done' | 'failed'>('idle');
  liveModalMessage = signal<string>('Ready');
  liveJobId = signal<string | null>(null);
  liveError = signal<string | null>(null);

  // Live feed data
  liveItems = signal<BreakingNewsLiveItem[]>([]);
  liveSinceIso = signal<string | null>(null);

  private readonly breakingNewsService = inject(BreakingNewsService);
  private readonly jobsService = inject(JobsService);
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
          this.breakingNews.set(res);
          this.loading.set(false);

          // Auto-select first item if none selected
          if (!this.selectedId() && res.length > 0 && res[0].tweetId) {
            this.openBreakingNewsDetail(res[0].tweetId!);
          }
        },
        error: (err) => {
          console.error('Failed to load breaking news', err);
          this.error.set('Failed to load breaking news.');
          this.loading.set(false);
        }
      });
  }

  openBreakingNewsDetail(tweetId: string) {
    this.selectedId.set(tweetId);

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

  // ---------- Live feed modal ----------

  openLiveFeedModal(): void {
    this.liveModalOpen.set(true);
    this.liveError.set(null);
    this.liveJobId.set(null);
    this.liveModalStage.set('idle');
    this.liveModalMessage.set('Ready');
    this.liveItems.set([]);
    this.liveSinceIso.set(null);
  }

  closeLiveFeedModal(): void {
    this.liveModalOpen.set(false);
  }

  startLiveFeed(): void {
    // Seed job with currently selected tweet, fallback to first list item
    const seedTweetId = this.selectedId() || this.breakingNews()?.[0]?.tweetId;

    if (!seedTweetId) {
      this.liveError.set('No tweet selected (and no breaking news items available).');
      this.liveModalStage.set('failed');
      return;
    }

    // Reset modal state
    this.liveError.set(null);
    this.liveJobId.set(null);
    this.liveItems.set([]);

    this.liveModalStage.set('starting');
    this.liveModalMessage.set('Triggering live feed job…');

    const sinceIso = new Date().toISOString();
    this.liveSinceIso.set(sinceIso);

    this.jobsService
      .createTwitterLiveJob(seedTweetId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ jobId }) => {
          this.liveJobId.set(jobId);
          this.liveModalStage.set('running');
          this.liveModalMessage.set('Job started. Streaming live results…');

          // Start polling live items immediately
          this.startPollingLiveItems(jobId,sinceIso);

          // Poll job to completion/failure
          this.pollJob(jobId);
        },
        error: (err) => {
          console.error('Failed to create job', err);
          this.liveError.set('Failed to start job.');
          this.liveModalStage.set('failed');
        }
      });
  }

  private startPollingLiveItems(jobId: string, sinceIso: string): void {
    timer(0, 1500)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(() =>
          this.breakingNewsService.getLiveById(jobId,50, 0, sinceIso).pipe(
            catchError((err) => {
              console.error('Live poll failed', err);
              return of([] as BreakingNewsLiveItem[]);
            })
          )
        ),
        tap((items) => {
          this.liveItems.set(items);
        })
      )
      .subscribe();
  }

  private pollJob(jobId: string): void {
    timer(0, 1500)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(() =>
          this.jobsService.getJob(jobId).pipe(
            catchError((err) => {
              console.error('Job poll failed', err);
              return of(null as unknown as JobRecord);
            })
          )
        ),
        tap((job) => {
          if (!job) return;
          const msg =
            job.status === 'queued'
              ? 'Queued…'
              : job.status === 'running'
              ? 'Streaming live results…'
              : job.status === 'succeeded'
              ? 'Job finished.'
              : 'Job failed.';
          this.liveModalMessage.set(`Job status: ${job.status}. ${msg}`);
        })
      )
      .subscribe((job) => {
        if (!job) return;

        if (job.status === 'failed') {
          this.liveError.set(job.error?.message || 'Job failed.');
          this.liveModalStage.set('failed');
        } else if (job.status === 'succeeded') {
          this.liveModalStage.set('done');
        }
      });
  }

  // ---------- helpers ----------

  trackById(_index: number, item: BreakingNews) {
    return item._id;
  }

  trackLiveById(_index: number, item: BreakingNewsLiveItem) {
    return item._id;
  }

  getDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  // Optional: open item search url
  openExternal(url?: string | null): void {
    if (!url) return;
    window.open(url, '_blank', 'noreferrer');
  }
}
