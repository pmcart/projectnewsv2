import { Component, OnInit, OnDestroy, signal, inject, DestroyRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, Subscription } from 'rxjs';
import {
  BreakingNewsService,
  BreakingNews
} from '../../services/breaking-news.service';
import {
  RssFeedService,
  GoogleNewsItem
} from '../../services/rss-feed.service';
import { AuthService } from '../../services/auth.service';
import { VideoService, Video, AssetGenerationStatus, VideoImage, VideoAudio } from '../../services/video.service';
import { VideoGenerationControlsComponent, VideoGenerationRequest } from '../../shared/components/video-generation-controls/video-generation-controls';

@Component({
  selector: 'app-new-video',
  standalone: true,
  imports: [
    CommonModule,
    VideoGenerationControlsComponent
  ],
  templateUrl: './new-video.html'
})
export class NewVideoComponent implements OnInit, OnDestroy {
  // Source item params
  itemId = signal<string | null>(null);
  itemType = signal<'breaking-news' | 'rss-feed' | null>(null);
  country = signal<string>('US');
  category = signal<string | null>(null);
  topic = signal<string | null>(null);

  // Source items
  breakingNewsItem = signal<BreakingNews | null>(null);
  rssFeedItem = signal<GoogleNewsItem | null>(null);

  // Video state
  video = signal<Video | null>(null);
  videoUrl = signal<string | null>(null);
  thumbnailUrl = signal<string | null>(null);
  videoPlan = signal<any>(null);
  lastGenerationRequest = signal<VideoGenerationRequest | null>(null);

  // Asset generation state
  images = signal<VideoImage[]>([]);
  audioClips = signal<VideoAudio[]>([]);
  assetStatus = signal<AssetGenerationStatus>(AssetGenerationStatus.PENDING);
  assetProgress = signal<{ totalScenes: number; imagesCompleted: number; audioCompleted: number } | null>(null);

  // UI state
  loading = signal(false);
  error = signal<string | null>(null);
  generating = signal(false);
  rendering = signal(false);
  renderProgress = signal<{ stage: string; progress: number; currentScene?: number; totalScenes?: number } | null>(null);

  // User state
  currentUser = signal<any>(null);

  // Polling
  private pollingSubscription: Subscription | null = null;

  // Computed
  sourceText = computed(() => {
    const bn = this.breakingNewsItem();
    const rss = this.rssFeedItem();
    if (bn) {
      return bn.text || '';
    }
    if (rss) {
      return rss.title || '';
    }
    return '';
  });

  sourceUrl = computed(() => {
    const rss = this.rssFeedItem();
    return rss?.link || undefined;
  });

  private readonly breakingNewsService = inject(BreakingNewsService);
  private readonly rssFeedService = inject(RssFeedService);
  private readonly videoService = inject(VideoService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    // Get current user from auth service (synchronous)
    const user = this.authService.getCurrentUser();
    if (user) {
      this.currentUser.set(user);
    }

    // Check for navigation state data first
    const navigation = this.router.getCurrentNavigation();
    const stateData = navigation?.extras?.state?.['itemData'] || history.state?.['itemData'];

    // Get route params and fetch source item
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.itemId.set(params['id'] || null);
        this.itemType.set(params['type'] || null);
        this.country.set(params['country'] || 'US');
        this.category.set(params['category'] || null);
        this.topic.set(params['topic'] || null);

        const id = this.itemId();
        const type = this.itemType();

        if (id && type) {
          // If we have navigation state data, use it directly
          if (stateData && type === 'rss-feed') {
            this.rssFeedItem.set(stateData);
            this.createVideo();
          } else {
            // Otherwise fetch from API
            this.fetchItem(id, type);
          }
        }
      });
  }

  private createVideo(): void {
    const sourceTextValue = this.sourceText();
    if (!sourceTextValue) return;

    const title = sourceTextValue.substring(0, 100) + (sourceTextValue.length > 100 ? '...' : '');
    const sourceType = this.itemType() === 'breaking-news' ? 'TWEET' : 'HEADLINE';

    this.videoService
      .createVideo({
        title,
        sourceType,
        sourceText: sourceTextValue,
        sourceUrl: this.sourceUrl()
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (video) => {
          this.video.set(video);
        },
        error: (err) => {
          console.error('Failed to create video', err);
          this.error.set('Failed to create video.');
        }
      });
  }

  private fetchItem(id: string, type: 'breaking-news' | 'rss-feed'): void {
    this.loading.set(true);
    this.error.set(null);

    if (type === 'breaking-news') {
      this.breakingNewsService
        .getById(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (item) => {
            this.breakingNewsItem.set(item);
            this.loading.set(false);
            this.createVideo();
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
            this.createVideo();
          },
          error: (err) => {
            console.error('Failed to load RSS feed item', err);
            this.error.set('Failed to load RSS feed item.');
            this.loading.set(false);
          }
        });
    }
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  onGenerate(request: VideoGenerationRequest): void {
    const vid = this.video();
    if (!vid || this.generating()) return;

    // Store the last request for re-generation
    this.lastGenerationRequest.set(request);

    this.generating.set(true);
    this.error.set(null);

    // Reset asset state
    this.images.set([]);
    this.audioClips.set([]);
    this.assetStatus.set(AssetGenerationStatus.PENDING);
    this.assetProgress.set(null);

    this.videoService
      .generateVideoPlan(vid.id, {
        sourceType: request.sourceText ? (this.itemType() === 'breaking-news' ? 'TWEET' : 'HEADLINE') : 'FREE_TEXT',
        sourceText: request.sourceText,
        sourceUrl: request.sourceUrl,
        generationInputs: request.generationInputs
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedVideo) => {
          this.updateVideoState(updatedVideo);
          this.generating.set(false);

          // Start polling for asset generation progress
          this.startPolling();
        },
        error: (err) => {
          console.error('Failed to generate video plan', err);
          this.error.set('Failed to generate video plan. Please check your OpenAI API key.');
          this.generating.set(false);
        }
      });
  }

  onGenerateFromCurrentSettings(): void {
    const lastRequest = this.lastGenerationRequest();
    if (lastRequest) {
      // Re-use the last generation request
      this.onGenerate(lastRequest);
    }
  }

  private updateVideoState(video: Video): void {
    this.video.set(video);

    // Set video plan for display
    if (video.videoPlan) {
      this.videoPlan.set(video.videoPlan);
    }

    // Set video URL if available
    if (video.videoUrl) {
      this.videoUrl.set(video.videoUrl);
    }

    // Set thumbnail if available
    if (video.thumbnailUrl) {
      this.thumbnailUrl.set(video.thumbnailUrl);
    }

    // Update asset generation state
    this.assetStatus.set(video.assetStatus);
    if (video.assetProgress) {
      this.assetProgress.set(video.assetProgress);
    }

    // Update images and audio
    if (video.images) {
      this.images.set(video.images);
    }
    if (video.audio) {
      this.audioClips.set(video.audio);
    }

    // Update render progress
    if (video.renderProgress) {
      this.renderProgress.set(video.renderProgress);
    }

    // Update video URL from signed URL if available
    if (video.videoSignedUrl) {
      this.videoUrl.set(video.videoSignedUrl);
    }

    // Update thumbnail URL from signed URL if available
    if (video.thumbnailSignedUrl) {
      this.thumbnailUrl.set(video.thumbnailSignedUrl);
    }
  }

  private startPolling(): void {
    this.stopPolling();

    // Poll every 3 seconds
    this.pollingSubscription = interval(3000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.pollVideoStatus();
      });
  }

  private stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = null;
    }
  }

  private pollVideoStatus(): void {
    const vid = this.video();
    if (!vid) return;

    this.videoService.getVideoById(vid.id).subscribe({
      next: (updatedVideo) => {
        this.updateVideoState(updatedVideo);

        // Check if rendering is complete
        if (this.rendering()) {
          const renderStage = updatedVideo.renderProgress?.stage;
          if (renderStage === 'COMPLETED' || renderStage === 'FAILED' || updatedVideo.videoSignedUrl) {
            this.rendering.set(false);
            this.stopPolling();
            return;
          }
        }

        // Stop polling if asset generation is complete (and not rendering)
        if (!this.rendering()) {
          const status = updatedVideo.assetStatus;
          if (status === AssetGenerationStatus.COMPLETED ||
              status === AssetGenerationStatus.PARTIAL ||
              status === AssetGenerationStatus.FAILED) {
            this.stopPolling();
          }
        }
      },
      error: (err) => {
        console.error('Failed to poll video status', err);
      }
    });
  }

  getAudioForScene(sceneNumber: number): VideoAudio | undefined {
    return this.audioClips().find(a => a.sceneNumber === sceneNumber);
  }

  playAudio(url: string): void {
    const audio = new Audio(url);
    audio.play().catch(err => {
      console.error('Failed to play audio', err);
    });
  }

  onRenderVideo(): void {
    const vid = this.video();
    if (!vid || this.rendering()) return;

    // Check if assets are ready
    const status = this.assetStatus();
    if (status !== AssetGenerationStatus.COMPLETED && status !== AssetGenerationStatus.PARTIAL) {
      this.error.set('Assets must be generated before rendering the video.');
      return;
    }

    this.rendering.set(true);
    this.error.set(null);
    this.renderProgress.set({ stage: 'PREPARING', progress: 0 });

    this.videoService
      .renderVideo(vid.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.updateVideoState(response.video);
          // Start polling for render progress
          this.startPolling();
        },
        error: (err) => {
          console.error('Failed to start video render', err);
          this.error.set('Failed to start video render. ' + (err.error?.error || err.message));
          this.rendering.set(false);
          this.renderProgress.set(null);
        }
      });
  }

  isRenderReady(): boolean {
    const status = this.assetStatus();
    return (status === AssetGenerationStatus.COMPLETED || status === AssetGenerationStatus.PARTIAL) && !this.videoUrl();
  }
}
