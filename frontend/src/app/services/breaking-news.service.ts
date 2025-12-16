// src/app/services/breaking-news.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface BreakingNews {
  _id: string;
  account: string;
  text?: string;
  datetime?: string;
  images?: string[];
  videos?: string[];
  tweetId: string;
}

// 👇 new: enrichment interface (only fields we actually use)
export interface BreakingNewsEnrichment {
  tweetId: string;
  account?: string;
  category?: string;
  confidence?: number;
  context?: string;
  credibility?: number;
  entities?: {
    people?: string[];
    organizations?: string[];
    equipment?: string[];
  };
  event_type?: string;
  additional_links? : { text?: string; link: string }[];
  future_scenarios?: { scenario: string; likelihood: number }[];
  hash?: string;
  knock_on_effects?: { effect: string; likelihood: number }[];
  locations?: { place?: string; country?: string; lat?: number | null; lon?: number | null }[];
  model_used?: string;
  needs_higher_model?: boolean;
  notes?: string | null;
  risk_score?: number;
  sentiment?: number;
  sources_to_verify?: string[];
  time_window?: string;
  tweet_datetime?: string;   // assuming API returns ISO string
  tweet_url?: string;
  updatedAt?: string;
}

// src/app/services/breaking-news.service.ts

export interface BreakingNewsMediaImage {
  title?: string;
  link: string;
  thumbnail?: string | null;
  mime?: string | null;
  contextLink?: string | null;
}

export interface BreakingNewsMediaLink {
  title?: string;
  link: string;
  displayLink?: string;
  snippet?: string;
  mime?: string | null;
}

export interface BreakingNewsMedia {
  _id?: string;
  source_tweet_id: string;
  entities?: any;
  event_type?: string | null;
  hash?: string | null;
  images?: BreakingNewsMediaImage[];
  locations?: { place?: string; country?: string; lat?: number | null; lon?: number | null }[];
  video_links?: BreakingNewsMediaLink[];
  media_query?: string;
  searchedAt?: string;
  text?: string;
}


@Injectable({
  providedIn: 'root'
})
export class BreakingNewsService {
  private baseUrl = `${environment.apiBaseUrl}/breaking-news`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'x-api-key': environment.apiKey
    });
  }

  getAll(limit = 50, offset = 0): Observable<BreakingNews[]> {
    return this.http.get<BreakingNews[]>(
      `${this.baseUrl}?limit=${limit}&offset=${offset}`,
      { headers: this.getHeaders() }
    );
  }

  getById(id: string): Observable<BreakingNews> {
    return this.http.get<BreakingNews>(
      `${this.baseUrl}/${id}`,
      { headers: this.getHeaders() }
    );
  }

  // 👇 updated typing here
  getEnrichmentById(tweetId: string): Observable<BreakingNewsEnrichment> {
    return this.http.get<BreakingNewsEnrichment>(
      `${this.baseUrl}/${tweetId}/enrichment`,
      { headers: this.getHeaders() }
    );
  }

 getMediaById(tweetId: string): Observable<BreakingNewsMedia | null> {
    return this.http.get<BreakingNewsMedia | null>(
      `${this.baseUrl}/${tweetId}/media`,
      { headers: this.getHeaders() }
    );
  }
}
