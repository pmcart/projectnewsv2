import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface JobResponse {
  jobId: string;
}

export interface JobRecord {
  id: string;
  type: string;
  payload: any;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  createdAt?: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  exitCode?: number | null;
  error?: { message?: string | null; stack?: string | null } | null;
  logs?: { at: string; stream: 'system' | 'stdout' | 'stderr'; message: string }[];
}

@Injectable({ providedIn: 'root' })
export class JobsService {
  private baseUrl = `${environment.apiBaseUrl}/jobs`;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({ 'x-api-key': environment.apiKey });
  }

  createTwitterLiveJob(tweetId: string): Observable<JobResponse> {
    return this.http.post<JobResponse>(
      `${this.baseUrl}/twitter-live`,
      { tweetId },
      { headers: this.getHeaders() }
    );
  }

  getJob(jobId: string): Observable<JobRecord> {
    return this.http.get<JobRecord>(`${this.baseUrl}/${jobId}`, {
      headers: this.getHeaders()
    });
  }
}
