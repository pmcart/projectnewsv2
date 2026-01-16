import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BreakingNewsService,
  BreakingNews
} from '../../services/breaking-news.service';
import {
  RssFeedService,
  GoogleNewsItem
} from '../../services/rss-feed.service';

@Component({
  selector: 'app-new-content',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './new-content.html'
})
export class NewContentComponent implements OnInit {
  itemId = signal<string | null>(null);
  itemType = signal<'breaking-news' | 'rss-feed' | null>(null);

  // For RSS feed items, we need these params to fetch the item
  country = signal<string>('US');
  category = signal<string | null>(null);
  topic = signal<string | null>(null);

  // The fetched item
  breakingNewsItem = signal<BreakingNews | null>(null);
  rssFeedItem = signal<GoogleNewsItem | null>(null);

  loading = signal(false);
  error = signal<string | null>(null);

  private readonly breakingNewsService = inject(BreakingNewsService);
  private readonly rssFeedService = inject(RssFeedService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.itemId.set(params['id'] || null);
        this.itemType.set(params['type'] || null);

        // For RSS feed items
        this.country.set(params['country'] || 'US');
        this.category.set(params['category'] || null);
        this.topic.set(params['topic'] || null);

        // Fetch the item when params are available
        const id = this.itemId();
        const type = this.itemType();

        if (id && type) {
          this.fetchItem(id, type);
        }
      });
  }

  private fetchItem(id: string, type: 'breaking-news' | 'rss-feed'): void {
    this.loading.set(true);
    this.error.set(null);
    this.breakingNewsItem.set(null);
    this.rssFeedItem.set(null);

    if (type === 'breaking-news') {
      this.breakingNewsService
        .getById(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (item) => {
            this.breakingNewsItem.set(item);
            this.loading.set(false);
          },
          error: (err) => {
            console.error('Failed to load breaking news item', err);
            this.error.set('Failed to load breaking news item.');
            this.loading.set(false);
          }
        });
    } else if (type === 'rss-feed') {
      this.rssFeedService
        .getItemById({
          id,
          country: this.country(),
          category: this.category(),
          topic: this.topic(),
          enrich: 'light'
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (item) => {
            this.rssFeedItem.set(item);
            this.loading.set(false);
          },
          error: (err) => {
            console.error('Failed to load RSS feed item', err);
            this.error.set('Failed to load RSS feed item.');
            this.loading.set(false);
          }
        });
    }
  }
}
