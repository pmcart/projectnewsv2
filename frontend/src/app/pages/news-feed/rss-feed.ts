import { Component, OnInit, DestroyRef, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  RssFeedService,
  GoogleNewsFeedMeta,
  GoogleNewsItem
} from '../../services/rss-feed.service';
import { WikipediaService, WikipediaSummary } from '../../services/wikipedia.service';
import { NewContentButtonComponent } from '../../shared/components/new-content-button/new-content-button.component';
import { NewVideoButtonComponent } from '../../shared/components/new-video-button/new-video-button.component';

type Category =
  | 'world' | 'nation' | 'business' | 'technology' | 'entertainment'
  | 'science' | 'sports' | 'health' | null;

type EnrichLevel = 'none' | 'light' | 'full';

@Component({
  selector: 'app-rss-feed',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NewContentButtonComponent, NewVideoButtonComponent],
  templateUrl: './rss-feed.html'
})
export class RssFeedComponent implements OnInit {
  feed = signal<GoogleNewsFeedMeta | null>(null);
  items = signal<GoogleNewsItem[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  selectedItem = signal<GoogleNewsItem | null>(null);

  // Related content
  relatedStories = signal<GoogleNewsItem[]>([]);
  loadingRelated = signal(false);
  wikiContext = signal<WikipediaSummary[]>([]);
  loadingWiki = signal(false);

  form = new FormGroup({
    country: new FormControl('US', { nonNullable: true }),
    category: new FormControl<Category>('technology'),
    topic: new FormControl('', { nonNullable: true }),
    limit: new FormControl(25, { nonNullable: true }),

    // NEW
    enrich: new FormControl<EnrichLevel>('light', { nonNullable: true })
  });

  private readonly rssFeedService = inject(RssFeedService);
  private readonly wikipediaService = inject(WikipediaService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Effect to load related content when selected item changes
    effect(() => {
      const item = this.selectedItem();
      if (item) {
        this.loadRelatedContent(item);
      } else {
        this.relatedStories.set([]);
        this.wikiContext.set([]);
      }
    });
  }

  ngOnInit(): void {
    this.loadFeed();
  }

  loadFeed(): void {
    this.loading.set(true);
    this.error.set(null);
    this.selectedItem.set(null);

    const { country, category, topic, limit, enrich } = this.form.getRawValue();
    const trimmedTopic = (topic || '').trim();

    this.rssFeedService.getGoogleNewsFeed({
      country,
      category: trimmedTopic ? null : category,
      topic: trimmedTopic ? trimmedTopic : null,
      limit,
      enrich
    })
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (res) => {
        this.feed.set(res.feed);
        this.items.set(res.items || []);
        this.loading.set(false);

        if (res.items?.length) this.selectItem(res.items[0]);
      },
      error: (err) => {
        console.error('Failed to load RSS feed', err);
        this.error.set('Failed to load RSS feed.');
        this.loading.set(false);
      }
    });
  }

  onSubmit(): void {
    this.loadFeed();
  }

  clearTopic(): void {
    this.form.patchValue({ topic: '' });
    this.loadFeed();
  }

  selectItem(item: GoogleNewsItem): void {
    if (this.selectedItem() === item) return;
    this.selectedItem.set(item);
  }

  private loadRelatedContent(item: GoogleNewsItem): void {
    // Load related stories
    this.loadRelatedStories(item);
    // Load Wikipedia context
    this.loadWikipediaContext(item);
  }

  private loadRelatedStories(item: GoogleNewsItem): void {
    this.loadingRelated.set(true);
    this.relatedStories.set([]);

    // Extract key terms from title for search
    const searchTopic = this.extractSearchTopic(item.title || '');
    if (!searchTopic) {
      this.loadingRelated.set(false);
      return;
    }

    const { country } = this.form.getRawValue();

    this.rssFeedService.getGoogleNewsFeed({
      country,
      topic: searchTopic,
      limit: 5,
      enrich: 'none' // Fast, no enrichment needed for related
    })
    .pipe(takeUntilDestroyed(this.destroyRef))
    .subscribe({
      next: (res) => {
        // Filter out the current item
        const related = (res.items || []).filter(r =>
          r.guid !== item.guid &&
          r.link !== item.link &&
          r.title !== item.title
        ).slice(0, 4);
        this.relatedStories.set(related);
        this.loadingRelated.set(false);
      },
      error: () => {
        this.loadingRelated.set(false);
      }
    });
  }

  private loadWikipediaContext(item: GoogleNewsItem): void {
    this.loadingWiki.set(true);
    this.wikiContext.set([]);

    this.wikipediaService.getContextForArticle(item.title || '', item.description || '', 3)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summaries) => {
          this.wikiContext.set(summaries);
          this.loadingWiki.set(false);
        },
        error: () => {
          this.loadingWiki.set(false);
        }
      });
  }

  private extractSearchTopic(title: string): string {
    // Remove common filler words and extract key terms
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
      'has', 'have', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'it', 'its', 'this', 'that', 'says',
      'said', 'new', 'after', 'before', 'over', 'about', 'into', 'just',
      'how', 'why', 'what', 'when', 'where', 'who', 'which', 'up', 'out'
    ]);

    const words = title
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopWords.has(w.toLowerCase()));

    // Take first 3-4 meaningful words
    return words.slice(0, 4).join(' ');
  }

  trackByItem(index: number, item: GoogleNewsItem): string {
    return (
      item.guid ||
      item.normalizedLink ||
      item.canonicalLink ||
      item.resolvedLink ||
      item.link ||
      String(index)
    );
  }

  /** Prefer the most meaningful date for display */
  getBestDate(item: GoogleNewsItem): Date | null {
    const d = item.publishedAt || item.pubDate || null;
    if (!d) return null;
    const parsed = new Date(d);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  /** Prefer canonical/resolved for domain display */
  getDisplayDomain(item: GoogleNewsItem): string | null {
    const url = item.canonicalLink || item.resolvedLink || item.link;
    if (!url) return null;
    try { return new URL(url).hostname; } catch { return url; }
  }

  /** Prefer canonical for opening */
  getBestLink(item: GoogleNewsItem): string | null {
    return item.canonicalLink || item.resolvedLink || item.link || null;
  }
}
