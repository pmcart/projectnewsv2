import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

export interface MediaLink {
  link: string;
  text?: string;
  title?: string;
  snippet?: string;
  displayLink?: string;
}

// Matches what the backend is returning in `videos[]`
export interface BackendVideo {
  url: string;
  provider?: string;       // "youtube", "tiktok", "instagram", "twitter", ...
  embeddable?: boolean;
  title?: string;
  snippet?: string;
  displayLink?: string;
  source?: string;         // "tweet" | "search" | ...
}

type Provider =
  | 'youtube'
  | 'tiktok'
  | 'instagram'
  | 'x'
  | 'facebook'
  | 'reddit'
  | 'vimeo'
  | 'dailymotion'
  | 'unknown'

interface EmbedItem {
  provider: Provider;
  originalUrl: string;
  displayText?: string;
  title?: string;
  snippet?: string;
  domain: string;
  embedUrl?: SafeResourceUrl;
  embeddable: boolean; // final decision for iframe vs plain link
}

type InputItem = MediaLink | string | BackendVideo;

@Component({
  selector: 'app-media-embed',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div *ngIf="embedItems.length" class="space-y-3">
      <div
        *ngFor="let item of embedItems"
        class="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2"
      >
        <!-- Provider label + domain -->
        <div class="flex items-center justify-between text-[10px] text-slate-400">
          <span class="uppercase tracking-wide">
            {{ item.provider === 'unknown' ? 'Link' : (item.provider | titlecase) }}
          </span>
          <span class="text-slate-500">
            {{ item.domain }}
          </span>
        </div>

        <!-- Embed iframe (for supported providers) -->
        <div *ngIf="item.embedUrl && item.embeddable; else plainLink" class="w-full">
          <div class="relative w-full overflow-hidden rounded-lg" style="padding-top: 56.25%;">
            <iframe
              class="absolute top-0 left-0 w-full h-full"
              [src]="item.embedUrl"
              frameborder="0"
              allowfullscreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            ></iframe>
          </div>
        </div>

        <!-- Fallback: plain link/card with rich metadata -->
        <ng-template #plainLink>
          <div class="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2">
            <!-- Title (if available) -->
            <div *ngIf="item.title" class="text-xs font-medium text-slate-200 mb-2 line-clamp-2">
              {{ item.title }}
            </div>

            <!-- Snippet/Description (if available) -->
            <p *ngIf="item.snippet" class="text-[11px] text-slate-400 mb-2 line-clamp-3">
              {{ item.snippet }}
            </p>

            <!-- Embedding disabled notice for YouTube -->
            <div *ngIf="item.provider === 'youtube' && !item.embeddable" class="flex items-center gap-1 mb-2 px-2 py-1 rounded bg-yellow-900/20 border border-yellow-800/40">
              <span class="text-[10px] text-yellow-400">⚠️ Embedding disabled by uploader</span>
            </div>

            <!-- Link -->
            <a
              [href]="item.originalUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 hover:underline transition-colors"
            >
              <span>Watch on {{ item.provider === 'youtube' ? 'YouTube' : (item.provider | titlecase) }}</span>
              <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>

            <!-- Domain (subtle) -->
            <div class="text-[10px] text-slate-500 mt-1">
              {{ item.domain }}
            </div>
          </div>
        </ng-template>
      </div>
    </div>
  `
})
export class MediaEmbedComponent {
  
  embedItems: EmbedItem[] = [];

  // Accept:
  // - new backend shape: BackendVideo[]
  // - old shape: MediaLink[]
  // - or plain string[]
  @Input() set links(value: InputItem[] | null | undefined) {
    const rawArray = value || [];
    this.embedItems = rawArray.map((raw) => this.toEmbedItem(raw));
  }

  constructor(private sanitizer: DomSanitizer) {}

  private toEmbedItem(raw: InputItem): EmbedItem {
    // ---- Normalise input: url + displayText + backend metadata ----
    let url: string;
    let displayText: string | undefined;
    let title: string | undefined;
    let snippet: string | undefined;
    let backendProvider: string | undefined;
    let backendEmbeddable: boolean | undefined;

    if (typeof raw === 'string') {
      url = raw;
    } else if ('url' in raw) {
      // BackendVideo
      url = raw.url;
      backendProvider = raw.provider;
      backendEmbeddable = raw.embeddable;
      title = raw.title;
      snippet = raw.snippet;
      displayText = raw.title || raw.snippet || undefined;
    } else {
      // MediaLink or BreakingNewsMediaLink
      url = raw.link;
      displayText = raw.text;
      // Check if it has title/snippet fields (BreakingNewsMediaLink structure)
      if ('title' in raw) title = raw.title;
      if ('snippet' in raw) snippet = raw.snippet;
    }

    const domain = this.getDomain(url).toLowerCase();

    // ---- Provider detection ----
    let provider: Provider = 'unknown';

    // Prefer backend's provider string if present
    if (backendProvider) {
      const p = backendProvider.toLowerCase();
      if (p === 'twitter') provider = 'x';
      else if (p === 'youtube') provider = 'youtube';
      else if (p === 'tiktok') provider = 'tiktok';
      else if (p === 'instagram') provider = 'instagram';
      else if (p === 'facebook') provider = 'facebook';
      else if (p === 'reddit') provider = 'reddit';
      else if (p === 'vimeo') provider = 'vimeo';
      else if (p === 'dailymotion') provider = 'dailymotion';
    } else {
      // Fallback provider detection from domain (old behaviour)
      if (domain.includes('youtube.com') || domain.includes('youtu.be')) {
        provider = 'youtube';
      } else if (domain.includes('tiktok.com')) {
        provider = 'tiktok';
      } else if (domain.includes('instagram.com')) {
        provider = 'instagram';
      } else if (domain.includes('twitter.com') || domain.includes('x.com')) {
        provider = 'x';
      } else if (
        domain.includes('facebook.com') ||
        domain === 'fb.watch' ||
        domain.endsWith('.facebook.com')
      ) {
        provider = 'facebook';
      } else if (domain.includes('reddit.com') || domain === 'redd.it') {
        provider = 'reddit';
      } else if (domain.includes('vimeo.com')) {
        provider = 'vimeo';
      } else if (domain.includes('dailymotion.com')) {
        provider = 'dailymotion';
      }
    }

    // ---- Build embed URL (if supported) ----
    let embedUrl: SafeResourceUrl | undefined;

    if (provider === 'youtube') {
      const id = this.extractYouTubeId(url);
      if (id) {
        embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
          `https://www.youtube.com/embed/${id}`
        );
      }
    } else if (provider === 'tiktok') {
      const id = this.extractTikTokId(url);
      if (id) {
        embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
          `https://www.tiktok.com/embed/v2/${id}`
        );
      }
    } else if (provider === 'instagram') {
      const shortcode = this.extractInstagramShortcode(url);
      if (shortcode) {
        embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
          `https://www.instagram.com/p/${shortcode}/embed`
        );
      }
    } else if (provider === 'x') {
      // twitframe provides an embeddable wrapper around tweet/X URLs
      embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
        `https://twitframe.com/show?url=${encodeURIComponent(url)}`
      );
    } else if (provider === 'facebook') {
      const pluginUrl = `https://www.facebook.com/plugins/post.php?href=${encodeURIComponent(
        url
      )}&show_text=true&width=500`;
      embedUrl = this.sanitizer.bypassSecurityTrustResourceUrl(pluginUrl);
    }
    // For now we keep reddit/vimeo/dailymotion/others as plain links unless you add more iframe patterns.

    // Final decision: should we embed?
    const embeddable =
      backendEmbeddable === false
        ? false
        : !!embedUrl; // if backend says "not embeddable", force plain link

    return {
      provider,
      originalUrl: url,
      displayText,
      title,
      snippet,
      domain,
      embedUrl,
      embeddable
    };
  }

  private getDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  // ---------- YOUTUBE ----------
  private extractYouTubeId(url: string): string | null {
    try {
      const u = new URL(url);

      // https://youtu.be/VIDEOID
      if (u.hostname === 'youtu.be') {
        return u.pathname.replace('/', '') || null;
      }

      if (u.hostname.includes('youtube.com')) {
        // https://www.youtube.com/watch?v=VIDEOID
        const vParam = u.searchParams.get('v');
        if (vParam) return vParam;

        // https://www.youtube.com/shorts/VIDEOID
        if (u.pathname.startsWith('/shorts/')) {
          const parts = u.pathname.split('/');
          return parts[2] || null;
        }

        // https://www.youtube.com/embed/VIDEOID
        if (u.pathname.startsWith('/embed/')) {
          const parts = u.pathname.split('/');
          return parts[2] || null;
        }
      }

      // final fallback: regex match v=VIDEOID
      const match = url.match(/[?&]v=([^&#]+)/);
      return match ? match[1] : null;
    } catch {
      const match = url.match(/[?&]v=([^&#]+)/);
      return match ? match[1] : null;
    }
  }

  // ---------- TIKTOK ----------
  private extractTikTokId(url: string): string | null {
    // Typical: https://www.tiktok.com/@user/video/1234567890123456789
    const match = url.match(/\/video\/(\d+)/);
    return match ? match[1] : null;
  }

  // ---------- INSTAGRAM ----------
  private extractInstagramShortcode(url: string): string | null {
    // /p/{shortcode}/, /reel/{shortcode}/, /tv/{shortcode}/
    const match = url.match(/\/(p|reel|tv)\/([^/?#&]+)/);
    return match ? match[2] : null;
  }
}
