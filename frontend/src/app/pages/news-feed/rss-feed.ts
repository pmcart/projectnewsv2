import { Component, OnInit, DestroyRef, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import {
  RssFeedService,
  GoogleNewsFeedMeta,
  GoogleNewsItem
} from '../../services/rss-feed.service';
import { NewContentButtonComponent } from '../../shared/components/new-content-button/new-content-button.component';

type Category =
  | 'world' | 'nation' | 'business' | 'technology' | 'entertainment'
  | 'science' | 'sports' | 'health' | null;

type EnrichLevel = 'none' | 'light' | 'full';

@Component({
  selector: 'app-rss-feed',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, NewContentButtonComponent],
  templateUrl: './rss-feed.html'
})
export class RssFeedComponent implements OnInit {
  feed = signal<GoogleNewsFeedMeta | null>(null);
  items = signal<GoogleNewsItem[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  selectedItem = signal<GoogleNewsItem | null>(null);

  form = new FormGroup({
    country: new FormControl('US', { nonNullable: true }),
    category: new FormControl<Category>('technology'),
    topic: new FormControl('', { nonNullable: true }),
    limit: new FormControl(25, { nonNullable: true }),

    // NEW
    enrich: new FormControl<EnrichLevel>('light', { nonNullable: true })
  });

  private readonly rssFeedService = inject(RssFeedService);
  private readonly destroyRef = inject(DestroyRef);

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
    this.selectedItem.set(item);
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
