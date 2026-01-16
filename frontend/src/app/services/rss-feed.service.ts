import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface GoogleNewsFeedMeta {
  title: string | null;
  link: string | null;
  description?: string | null;
  region: string;
  category: string | null;
  topic: string | null;
  enrich?: 'none' | 'light' | 'full';
  fetchedAt: string; // ISO string
}

export interface GoogleNewsItem {
  title: string | null;

  link: string | null;                 // Google News redirect URL
  resolvedLink?: string | null;        // Publisher URL (resolved)
  canonicalLink?: string | null;       // Canonical URL (from <link rel="canonical">)
  normalizedLink?: string | null;      // Normalized canonical/resolved

  description?: string | null;
  rawDescriptionHtml?: string | null;

  imageURL?: string | null;
  favicon?: string | null;
  siteName?: string | null;

  pubDate?: string | null;             // RSS date (ISO)
  publishedAt?: string | null;         // JSON-LD datePublished (ISO)
  modifiedAt?: string | null;          // JSON-LD dateModified (ISO)

  authors?: string[];                  // JSON-LD
  section?: string | null;             // JSON-LD
  keywords?: string[];                 // JSON-LD

  guid?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;

  region: string;
  category: string | null;
  topic: string | null;
  fetchedAt: string;                   // ISO string
}

export interface GoogleNewsResponse {
  feed: GoogleNewsFeedMeta;
  total: number;
  count: number;
  items: GoogleNewsItem[];
}

@Injectable({ providedIn: 'root' })
export class RssFeedService {
  private baseUrl = `${environment.apiBaseUrl}/rss`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({ 'x-api-key': environment.apiKey });
  }

  getGoogleNewsFeed(options: {
    country?: string;
    region?: string;
    category?: string | null;
    topic?: string | null;
    limit?: number;
    enrich?: 'none' | 'light' | 'full';
  } = {}): Observable<GoogleNewsResponse> {
    let params = new HttpParams();

    if (options.country) params = params.set('country', options.country);
    else if (options.region) params = params.set('region', options.region);

    if (options.category) params = params.set('category', options.category);
    if (options.topic) params = params.set('topic', options.topic);

    if (options.limit && options.limit > 0) {
      params = params.set('limit', options.limit.toString());
    }

    // NEW: enrichment level
    if (options.enrich) {
      params = params.set('enrich', options.enrich);
    }

    return this.http.get<GoogleNewsResponse>(`${this.baseUrl}/`, {
      headers: this.getHeaders(),
      params
    });
  }

  getItemById(options: {
    id: string;
    country?: string;
    region?: string;
    category?: string | null;
    topic?: string | null;
    enrich?: 'none' | 'light' | 'full';
  }): Observable<GoogleNewsItem> {
    let params = new HttpParams();

    if (options.country) params = params.set('country', options.country);
    else if (options.region) params = params.set('region', options.region);

    if (options.category) params = params.set('category', options.category);
    if (options.topic) params = params.set('topic', options.topic);

    if (options.enrich) {
      params = params.set('enrich', options.enrich);
    }

    return this.http.get<GoogleNewsItem>(`${this.baseUrl}/item/${options.id}`, {
      headers: this.getHeaders(),
      params
    });
  }
}
