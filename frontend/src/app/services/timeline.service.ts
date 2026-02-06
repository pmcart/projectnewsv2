import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type TimelineStatus = 'DRAFT' | 'GENERATING' | 'GENERATED' | 'FAILED';
export type TimelineEventCategory = 'INCIDENT' | 'SIGNAL' | 'PATTERN' | 'RESPONSE' | 'ESCALATION' | 'CONTEXT';

export interface TimelineNote {
  id: string;
  timelineEventId: string;
  content: string;
  createdByUserId: number;
  createdAt: string;
  updatedAt: string;
  createdBy: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
}

export interface TimelineEvent {
  id: string;
  timelineId: string;
  sortOrder: number;
  eventDate: string;
  title: string;
  description: string;
  category: TimelineEventCategory;
  significance: number;
  sources?: { title: string; url?: string }[];
  notes: TimelineNote[];
  createdAt: string;
  updatedAt: string;
}

export interface Timeline {
  id: string;
  title: string;
  status: TimelineStatus;
  ownerUserId: number;
  organizationId: number;
  sourceTweetId: string;
  sourceText: string;
  sourceAccount?: string;
  llmMetadata?: any;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  owner: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  events: TimelineEvent[];
}

export interface CreateTimelineRequest {
  tweetId: string;
  text: string;
  account?: string;
}

@Injectable({ providedIn: 'root' })
export class TimelineService {
  private apiUrl = `${environment.apiBaseUrl}/timelines`;

  /** In-memory cache: tweetId → Timeline for recently created/fetched timelines */
  private tweetTimelineCache = new Map<string, Timeline>();

  constructor(private http: HttpClient) {}

  getByTweetId(tweetId: string): Observable<Timeline | null> {
    // Check local cache first (handles the navigate-back-after-create scenario)
    const cached = this.tweetTimelineCache.get(tweetId);
    if (cached) {
      return of(cached);
    }

    return this.http.get<Timeline | null>(
      `${this.apiUrl}/by-tweet/${tweetId}`,
      { headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' } }
    ).pipe(
      map(timeline => timeline ?? null),
      tap(timeline => {
        if (timeline) {
          this.tweetTimelineCache.set(tweetId, timeline);
        }
      })
    );
  }

  createTimeline(request: CreateTimelineRequest): Observable<Timeline> {
    return this.http.post<Timeline>(this.apiUrl, request).pipe(
      tap(timeline => {
        // Cache the association so getByTweetId finds it immediately
        if (timeline && request.tweetId) {
          this.tweetTimelineCache.set(request.tweetId, timeline);
        }
      })
    );
  }

  getTimelineById(id: string): Observable<Timeline> {
    return this.http.get<Timeline>(`${this.apiUrl}/${id}`);
  }

  deleteTimeline(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  addNote(timelineId: string, eventId: string, content: string): Observable<TimelineNote> {
    return this.http.post<TimelineNote>(
      `${this.apiUrl}/${timelineId}/events/${eventId}/notes`,
      { content }
    );
  }

  updateNote(timelineId: string, eventId: string, noteId: string, content: string): Observable<TimelineNote> {
    return this.http.put<TimelineNote>(
      `${this.apiUrl}/${timelineId}/events/${eventId}/notes/${noteId}`,
      { content }
    );
  }

  deleteNote(timelineId: string, eventId: string, noteId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.apiUrl}/${timelineId}/events/${eventId}/notes/${noteId}`
    );
  }
}
