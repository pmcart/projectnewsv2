import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface RecentJob {
  id: string;
  type: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface RecentBreakingNews {
  id: string;
  tweetId: string;
  account: string;
  text: string;
  timestamp: string;
}

export interface DashboardStats {
  jobs: {
    total: number;
    running: number;
    queued: number;
    failedLast24h: number;
    byType: Record<string, number>;
    recent: RecentJob[];
  };
  breakingNews: {
    total: number;
    last24h: number;
    recent: RecentBreakingNews[];
  };
  enrichments: {
    total: number;
    avgRiskScore: number | null;
    highRiskCount: number;
    byCategory: Record<string, number>;
  };
  documents: {
    total: number;
    byStatus: Record<string, number>;
    inReview: number;
  };
  videos: {
    total: number;
    byStatus: Record<string, number>;
    inReview: number;
  };
  timestamp: string;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardService {
  private baseUrl = `${environment.apiBaseUrl}/stats`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'x-api-key': environment.apiKey
    });
  }

  getDashboardStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(
      `${this.baseUrl}/dashboard`,
      { headers: this.getHeaders() }
    );
  }
}
