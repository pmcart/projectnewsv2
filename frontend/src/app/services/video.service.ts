import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export enum VideoStatus {
  DRAFT = 'DRAFT',
  GENERATING = 'GENERATING',
  GENERATED = 'GENERATED',
  IN_REVIEW = 'IN_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  FAILED = 'FAILED'
}

export enum AssetGenerationStatus {
  PENDING = 'PENDING',
  GENERATING = 'GENERATING',
  COMPLETED = 'COMPLETED',
  PARTIAL = 'PARTIAL',
  FAILED = 'FAILED'
}

export interface VideoImage {
  id: string;
  videoId: string;
  sceneNumber: number;
  imagePrompt: string;
  s3Key: string;
  s3Url: string;
  signedUrl?: string;
  width?: number;
  height?: number;
  fileSize?: number;
  mimeType?: string;
  model?: string;
  revisedPrompt?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VideoAudio {
  id: string;
  videoId: string;
  sceneNumber: number;
  narrationText: string;
  s3Key: string;
  s3Url: string;
  signedUrl?: string;
  duration?: number;
  fileSize?: number;
  mimeType?: string;
  voice?: string;
  model?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetProgress {
  totalScenes: number;
  imagesCompleted: number;
  audioCompleted: number;
  imagesFailed: number;
  audioFailed: number;
}

export interface RenderProgress {
  stage: 'PREPARING' | 'RENDERING_SCENES' | 'CONCATENATING' | 'GENERATING_THUMBNAIL' | 'UPLOADING' | 'COMPLETED' | 'FAILED';
  currentScene?: number;
  totalScenes?: number;
  progress: number;
  error?: string;
}

export interface Video {
  id: string;
  title: string;
  status: VideoStatus;
  ownerUserId: number;
  sourceType: string;
  sourceText: string;
  sourceUrl?: string;
  generationInputs: any;
  videoPlan?: any;
  llmMetadata?: any;
  videoUrl?: string;
  videoS3Key?: string;
  videoSignedUrl?: string;
  thumbnailUrl?: string;
  thumbnailS3Key?: string;
  thumbnailSignedUrl?: string;
  duration?: number;
  errorMessage?: string;
  assetStatus: AssetGenerationStatus;
  assetProgress?: AssetProgress;
  assetError?: string;
  renderProgress?: RenderProgress;
  images?: VideoImage[];
  audio?: VideoAudio[];
  createdAt: string;
  updatedAt: string;
  owner: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  reviewEvents?: VideoReviewEvent[];
}

export interface VideoReviewEvent {
  id: string;
  videoId: string;
  eventType: string;
  notes?: string;
  createdByUserId: number;
  createdAt: string;
  createdBy: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
}

export interface CreateVideoRequest {
  title: string;
  sourceType: string;
  sourceText: string;
  sourceUrl?: string;
}

export interface GenerateVideoPlanRequest {
  sourceType: string;
  sourceText: string;
  sourceUrl?: string;
  generationInputs: any;
}

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private apiUrl = `${environment.apiBaseUrl}/videos`;

  constructor(private http: HttpClient) {}

  /**
   * List videos with optional filters
   */
  listVideos(filters?: { status?: string; userId?: string }): Observable<Video[]> {
    let params = new HttpParams();

    if (filters?.status) {
      params = params.set('status', filters.status);
    }
    if (filters?.userId) {
      params = params.set('userId', filters.userId);
    }

    return this.http.get<Video[]>(this.apiUrl, { params });
  }

  /**
   * Create a new video
   */
  createVideo(request: CreateVideoRequest): Observable<Video> {
    return this.http.post<Video>(this.apiUrl, request);
  }

  /**
   * Get video by ID
   */
  getVideoById(id: string): Observable<Video> {
    return this.http.get<Video>(`${this.apiUrl}/${id}`);
  }

  /**
   * Generate video plan using OpenAI
   */
  generateVideoPlan(videoId: string, request: GenerateVideoPlanRequest): Observable<Video> {
    return this.http.post<Video>(`${this.apiUrl}/${videoId}/generate`, request);
  }

  /**
   * Submit video for review
   */
  submitForReview(videoId: string): Observable<Video> {
    return this.http.post<Video>(`${this.apiUrl}/${videoId}/submit`, {});
  }

  /**
   * Approve video
   */
  approveVideo(videoId: string, notes?: string): Observable<Video> {
    return this.http.post<Video>(`${this.apiUrl}/${videoId}/approve`, { notes });
  }

  /**
   * Reject video
   */
  rejectVideo(videoId: string, data: { notes: string }): Observable<Video> {
    return this.http.post<Video>(`${this.apiUrl}/${videoId}/reject`, data);
  }

  /**
   * Add review note
   */
  addReviewNote(videoId: string, notes: string): Observable<VideoReviewEvent> {
    return this.http.post<VideoReviewEvent>(`${this.apiUrl}/${videoId}/review-note`, { notes });
  }

  /**
   * Get review events
   */
  getReviewEvents(videoId: string): Observable<VideoReviewEvent[]> {
    return this.http.get<VideoReviewEvent[]>(`${this.apiUrl}/${videoId}/review-events`);
  }

  /**
   * Update video assets
   */
  updateVideoAssets(videoId: string, data: { videoUrl?: string; thumbnailUrl?: string; duration?: number }): Observable<Video> {
    return this.http.put<Video>(`${this.apiUrl}/${videoId}/assets`, data);
  }

  /**
   * Render video using FFmpeg
   */
  renderVideo(videoId: string): Observable<{ message: string; video: Video }> {
    return this.http.post<{ message: string; video: Video }>(`${this.apiUrl}/${videoId}/render`, {});
  }
}
