// src/app/pages/breaking-news/breaking-news.ts (or wherever your component lives)
import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  BreakingNewsService,
  BreakingNews,
  BreakingNewsEnrichment,
  BreakingNewsLiveItem,
  SearchResultItem,
} from '../../services/breaking-news.service';
import { MediaEmbedComponent } from '../../shared/components/media-embed/media-embed.component';
import { NewContentButtonComponent } from '../../shared/components/new-content-button/new-content-button.component';
import { NewVideoButtonComponent } from '../../shared/components/new-video-button/new-video-button.component';
import { GenerateTimelineButtonComponent } from '../../shared/components/generate-timeline-button/generate-timeline-button.component';
import { EnrichmentViewComponent } from '../../shared/components/enrichment-view/enrichment-view.component';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { JobsService, JobRecord } from '../../services/jobs.service';
import { timer, of, Subscription } from 'rxjs';
import { catchError, switchMap, tap, takeWhile } from 'rxjs/operators';

@Component({
  selector: 'app-breaking-news',
  standalone: true,
  imports: [CommonModule, FormsModule, MediaEmbedComponent, NewContentButtonComponent, NewVideoButtonComponent, GenerateTimelineButtonComponent, EnrichmentViewComponent],
  templateUrl: './breaking-news.html'
})
export class BreakingNewsComponent implements OnInit {
  breakingNews = signal<BreakingNews[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Category filter
  selectedCategory = signal<string>('');
  readonly categories = [
    'General Breaking News (Global)',
    'Geopolitics',
    'Europe & EU Politics',
    'Business & Markets',
    'Technology (Big Tech & Platforms)',
    'Artificial Intelligence & Data Policy',
    'Cybersecurity & Hacking Incidents',
    'Climate, Energy',
    'Sport',
  ];

  enrichment = signal<BreakingNewsEnrichment | null>(null);
  enrichmentLoading = signal(false);
  enrichmentError = signal<string | null>(null);

  // Selected breaking news item (for accessing videos directly)
  selectedItem = signal<BreakingNews | null>(null);

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

  // Search state (inline, not modal)
  searchMode = signal(false);
  searchStage = signal<'idle' | 'starting' | 'running' | 'done' | 'failed'>('idle');
  searchMessage = signal<string>('');
  searchJobId = signal<string | null>(null);
  searchError = signal<string | null>(null);
  searchTerm = '';

  // Search results
  searchResults = signal<SearchResultItem[]>([]);

  // Selected search result
  selectedSearchResult = signal<SearchResultItem | null>(null);

  // Job polling subscriptions (so we can stop them)
  private searchResultsPolling$?: Subscription;
  private searchJobPolling$?: Subscription;
  private enrichmentJobPolling$?: Subscription;

  private readonly breakingNewsService = inject(BreakingNewsService);
  private readonly jobsService = inject(JobsService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.loadBreakingNews();
  }

  onCategoryChange(category: string): void {
    this.selectedCategory.set(category);
    this.selectedId.set(null);
    this.selectedItem.set(null);
    this.enrichment.set(null);
    this.loadBreakingNews();
  }

  loadBreakingNews(): void {
    this.loading.set(true);
    this.error.set(null);

    const category = this.selectedCategory() || undefined;
    this.breakingNewsService
      .getAll(50, 0, category)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          // Sort by datetime descending (most recent first)
          const sorted = [...res].sort((a, b) => {
            const dateA = a.datetime ? new Date(a.datetime).getTime() : 0;
            const dateB = b.datetime ? new Date(b.datetime).getTime() : 0;
            return dateB - dateA;
          });
          this.breakingNews.set(sorted);
          this.loading.set(false);

          // Auto-select first item if none selected
          if (!this.selectedId() && sorted.length > 0 && sorted[0].tweetId) {
            this.openBreakingNewsDetail(sorted[0].tweetId!);
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

    // Find and set the selected item from the breaking news list
    const item = this.breakingNews().find(bn => bn.tweetId === tweetId) || null;
    this.selectedItem.set(item);

    this.enrichment.set(null);
    this.enrichmentLoading.set(true);
    this.enrichmentError.set(null);

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

  // ---------- Search (inline mode) ----------

  clearSearch(): void {
    this.searchMode.set(false);
    this.searchError.set(null);
    this.searchJobId.set(null);
    this.searchStage.set('idle');
    this.searchMessage.set('');
    this.searchResults.set([]);
    this.searchTerm = '';
    this.selectedSearchResult.set(null);
    this.selectedId.set(null);
    this.selectedItem.set(null);

    // Clear enrichment panel
    this.enrichment.set(null);
    this.enrichmentLoading.set(false);
    this.enrichmentError.set(null);

    // Stop any running polling
    this.stopSearchPolling();

    // Reload breaking news and auto-select first
    this.loadBreakingNews();
  }

  private stopSearchPolling(): void {
    this.searchResultsPolling$?.unsubscribe();
    this.searchJobPolling$?.unsubscribe();
    this.enrichmentJobPolling$?.unsubscribe();
  }

  executeSearch(): void {
    const term = this.searchTerm.trim();
    if (!term) {
      this.searchError.set('Please enter a search term');
      return;
    }

    // Enter search mode
    this.searchMode.set(true);
    this.searchError.set(null);
    this.searchJobId.set(null);
    this.searchResults.set([]);
    this.selectedSearchResult.set(null);
    this.selectedId.set(null);

    // Clear enrichment - show placeholder
    this.enrichment.set(null);
    this.enrichmentLoading.set(false);
    this.enrichmentError.set(null);

    this.searchStage.set('starting');
    this.searchMessage.set('Starting search...');

    this.jobsService
      .createTwitterSearchJob(term)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ jobId }) => {
          this.searchJobId.set(jobId);
          this.searchStage.set('running');
          this.searchMessage.set('Searching X...');

          // Start polling search results
          this.startPollingSearchResults(jobId);

          // Poll job status
          this.pollSearchJob(jobId);
        },
        error: (err) => {
          console.error('Failed to create search job', err);
          this.searchError.set('Failed to start search.');
          this.searchStage.set('failed');
        }
      });
  }

  private startPollingSearchResults(jobId: string): void {
    this.searchResultsPolling$ = timer(0, 1500)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(() =>
          this.breakingNewsService.getSearchResultsByJobId(jobId, 50, 0).pipe(
            catchError((err) => {
              console.error('Search results poll failed', err);
              return of([] as SearchResultItem[]);
            })
          )
        ),
        tap((items) => {
          this.searchResults.set(items);
        })
      )
      .subscribe();
  }

  private pollSearchJob(jobId: string): void {
    let completed = false;

    this.searchJobPolling$ = timer(0, 1500)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        takeWhile(() => !completed),
        switchMap(() =>
          this.jobsService.getJob(jobId).pipe(
            catchError((err) => {
              console.error('Search job poll failed', err);
              return of(null as unknown as JobRecord);
            })
          )
        ),
        tap((job) => {
          if (!job) return;
          const msg =
            job.status === 'queued'
              ? 'Queued...'
              : job.status === 'running'
              ? 'Searching X...'
              : job.status === 'succeeded'
              ? 'Search complete.'
              : 'Search failed.';
          this.searchMessage.set(msg);

          if (job.status === 'failed') {
            this.searchError.set(job.error?.message || 'Search failed.');
            this.searchStage.set('failed');
            completed = true;
          } else if (job.status === 'succeeded') {
            this.searchStage.set('done');
            completed = true;
          }
        })
      )
      .subscribe();
  }

  selectSearchResult(item: SearchResultItem): void {
    this.selectedSearchResult.set(item);
    this.selectedId.set(item.tweetId);

    // Reset enrichment state
    this.enrichment.set(null);
    this.enrichmentLoading.set(true);
    this.enrichmentError.set(null);

    // Stop any previous polling
    this.enrichmentJobPolling$?.unsubscribe();

    const tweetId = item.tweetId;
    const tweetText = item.text || '';

    // First, try to fetch existing enrichment
    this.breakingNewsService
      .getEnrichmentById(tweetId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (enrichment) => {
          this.enrichment.set(enrichment);
          this.enrichmentLoading.set(false);
        },
        error: () => {
          // Enrichment doesn't exist, trigger on-demand job
          this.triggerEnrichmentJob(tweetId, tweetText);
        }
      });
    // Videos are displayed directly from the search result item (item.videos)
  }

  private triggerEnrichmentJob(tweetId: string, tweetText: string): void {
    this.jobsService
      .createSingleEnrichmentJob(tweetId, tweetText)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ jobId }) => {
          this.pollEnrichmentJob(jobId, tweetId);
        },
        error: (err) => {
          console.error('Failed to trigger enrichment job', err);
          this.enrichmentError.set('Failed to load enrichment.');
          this.enrichmentLoading.set(false);
        }
      });
  }

  private pollEnrichmentJob(jobId: string, tweetId: string): void {
    let completed = false;

    this.enrichmentJobPolling$ = timer(0, 1500)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        takeWhile(() => !completed),
        switchMap(() =>
          this.jobsService.getJob(jobId).pipe(
            catchError(() => of(null as unknown as JobRecord))
          )
        )
      )
      .subscribe((job) => {
        if (!job) return;

        if (job.status === 'succeeded') {
          completed = true;
          // Fetch the enrichment data
          this.breakingNewsService
            .getEnrichmentById(tweetId)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
              next: (enrichment) => {
                this.enrichment.set(enrichment);
                this.enrichmentLoading.set(false);
              },
              error: () => {
                this.enrichmentError.set('Failed to load enrichment.');
                this.enrichmentLoading.set(false);
              }
            });
        } else if (job.status === 'failed') {
          completed = true;
          this.enrichmentError.set('Enrichment job failed.');
          this.enrichmentLoading.set(false);
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

  trackSearchById(_index: number, item: SearchResultItem) {
    return item._id;
  }

  getDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  // Helper to format locations for display
  formatLocations(locations?: { place?: string; country?: string }[]): string {
    if (!locations || locations.length === 0) return '';
    return locations.map(l => l.place || l.country || '').filter(Boolean).join(', ');
  }

  // Optional: open item search url
  openExternal(url?: string | null): void {
    if (!url) return;
    window.open(url, '_blank', 'noreferrer');
  }
}
