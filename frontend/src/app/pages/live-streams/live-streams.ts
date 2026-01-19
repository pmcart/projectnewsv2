import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Tv, Search, Grid3x3, Grid2x2, Square, Star, Volume2, VolumeX, ExternalLink, Play, Pause } from 'lucide-angular';
import { SanitizeUrlPipe } from '../../pipes/sanitize-url.pipe';

export interface NewsChannel {
  id: string;
  name: string;
  provider: 'youtube';
  channelId: string;
  country: string;
  language: string;
  tags: string[];
  category: 'international' | 'us' | 'business' | 'other';
  tier: 'A' | 'B' | 'C'; // A = 24/7 reliable, B = often live, C = event-driven
  note?: string;
  defaultMuted: boolean;
}

export type LayoutMode = '1' | '4' | '6' | '9';

@Component({
  selector: 'app-live-streams',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, SanitizeUrlPipe],
  templateUrl: './live-streams.html'
})
export class LiveStreamsComponent {
  // Icons
  readonly Tv = Tv;
  readonly Search = Search;
  readonly Grid3x3 = Grid3x3;
  readonly Grid2x2 = Grid2x2;
  readonly Square = Square;
  readonly Star = Star;
  readonly Volume2 = Volume2;
  readonly VolumeX = VolumeX;
  readonly ExternalLink = ExternalLink;
  readonly Play = Play;
  readonly Pause = Pause;

  // All available channels organized by reliability tier
  allChannels: NewsChannel[] = [
    // TIER A - Most Reliable (24/7 or near-24/7)
    {
      id: 'aljazeera_en',
      name: 'Al Jazeera English',
      provider: 'youtube',
      channelId: 'UCNye-wNBqNL5ZzHSJj3l8Bg',
      country: 'QA',
      language: 'en',
      tags: ['world', 'politics', 'breaking'],
      category: 'international',
      tier: 'A',
      defaultMuted: true
    },
    {
      id: 'france24_en',
      name: 'France 24 English',
      provider: 'youtube',
      channelId: 'UCQfwfsi5VrQ8yKZ-UWmAEFg',
      country: 'FR',
      language: 'en',
      tags: ['world', 'europe', 'politics'],
      category: 'international',
      tier: 'A',
      defaultMuted: true
    },
    {
      id: 'dw_news',
      name: 'DW News',
      provider: 'youtube',
      channelId: 'UCknLrEdhRCp1aegoMqRaCZg',
      country: 'DE',
      language: 'en',
      tags: ['world', 'europe', 'analysis'],
      category: 'international',
      tier: 'A',
      defaultMuted: true
    },
    {
      id: 'euronews',
      name: 'euronews',
      provider: 'youtube',
      channelId: 'UCSrZ3UV4jOidv8ppoVuvW9Q',
      country: 'FR',
      language: 'en',
      tags: ['europe', 'world', 'politics'],
      category: 'international',
      tier: 'A',
      defaultMuted: true
    },
    {
      id: 'nhk_world',
      name: 'NHK World Japan',
      provider: 'youtube',
      channelId: 'UCSPEjw8F2nQDtmUKPFNF7_A',
      country: 'JP',
      language: 'en',
      tags: ['asia', 'japan', 'world'],
      category: 'international',
      tier: 'A',
      defaultMuted: true
    },
    {
      id: 'bloomberg',
      name: 'Bloomberg Television',
      provider: 'youtube',
      channelId: 'UCIALMKvObZNtJ6AmdCLP7Lg',
      country: 'US',
      language: 'en',
      tags: ['business', 'markets', 'finance'],
      category: 'business',
      tier: 'A',
      defaultMuted: true
    },
    {
      id: 'reuters',
      name: 'Reuters',
      provider: 'youtube',
      channelId: 'UChqUTb7kYRX8-EiaN3XFrSQ',
      country: 'US',
      language: 'en',
      tags: ['world', 'business', 'breaking'],
      category: 'international',
      tier: 'A',
      defaultMuted: true
    },
    {
      id: 'trt_world',
      name: 'TRT World',
      provider: 'youtube',
      channelId: 'UC7fWeaHhqgM4Ry-RMpM2YYw',
      country: 'TR',
      language: 'en',
      tags: ['world', 'middle-east', 'politics'],
      category: 'international',
      tier: 'A',
      defaultMuted: true
    },
    {
      id: 'cna',
      name: 'Channel NewsAsia',
      provider: 'youtube',
      channelId: 'UC83jt4dlz1Gjl58fzQrrKZg',
      country: 'SG',
      language: 'en',
      tags: ['asia', 'world', 'breaking'],
      category: 'international',
      tier: 'A',
      defaultMuted: true
    },

    // TIER B - Very Often Live (US-focused, free streams)
    {
      id: 'abc_news',
      name: 'ABC News Live',
      provider: 'youtube',
      channelId: 'UCBi2mrWuNuyYy4gbM6fU18Q',
      country: 'US',
      language: 'en',
      tags: ['us', 'breaking', 'politics'],
      category: 'us',
      tier: 'B',
      defaultMuted: true
    },
    {
      id: 'nbc_news',
      name: 'NBC News NOW',
      provider: 'youtube',
      channelId: 'UCeY0bbntWzzVIaj2z3QigXg',
      country: 'US',
      language: 'en',
      tags: ['us', 'breaking', 'politics'],
      category: 'us',
      tier: 'B',
      defaultMuted: true
    },
    {
      id: 'livenow_fox',
      name: 'LiveNOW from FOX',
      provider: 'youtube',
      channelId: 'UCJg9wBPyKMNA5sRDnvzmkdg',
      country: 'US',
      language: 'en',
      tags: ['us', 'breaking', 'live'],
      category: 'us',
      tier: 'B',
      defaultMuted: true
    },
    {
      id: 'scripps_news',
      name: 'Scripps News',
      provider: 'youtube',
      channelId: 'UCTln5ss6h6L_xNfMeujfPbg',
      country: 'US',
      language: 'en',
      tags: ['us', 'politics', 'analysis'],
      category: 'us',
      tier: 'B',
      defaultMuted: true
    },

    // TIER C - Event-driven / Fallback (BBC, Sky, etc.)
    {
      id: 'bbc_news',
      name: 'BBC News',
      provider: 'youtube',
      channelId: 'UC16niRr50-MSBwiO3YDb3RA',
      country: 'GB',
      language: 'en',
      tags: ['world', 'uk', 'breaking'],
      category: 'international',
      tier: 'C',
      note: 'Not continuously live; event-driven',
      defaultMuted: true
    },
    {
      id: 'sky_news',
      name: 'Sky News',
      provider: 'youtube',
      channelId: 'UCoMdktPbSTixAyNGwb-UYkQ',
      country: 'GB',
      language: 'en',
      tags: ['world', 'uk', 'breaking'],
      category: 'international',
      tier: 'C',
      note: 'Often live, but not guaranteed',
      defaultMuted: true
    },
    {
      id: 'cbc_news',
      name: 'CBC News',
      provider: 'youtube',
      channelId: 'UCuFFtHWoLl5fauMMD5Ww2jA',
      country: 'CA',
      language: 'en',
      tags: ['canada', 'world'],
      category: 'international',
      tier: 'C',
      defaultMuted: true
    },
    {
      id: 'itv_news',
      name: 'ITV News',
      provider: 'youtube',
      channelId: 'UCbbv7TzZp9G56nREJzVQ0-A',
      country: 'GB',
      language: 'en',
      tags: ['uk', 'breaking'],
      category: 'international',
      tier: 'C',
      defaultMuted: true
    },
    {
      id: 'wion',
      name: 'WION',
      provider: 'youtube',
      channelId: 'UC_gUM8rL-Lrg6O3adPW9K1g',
      country: 'IN',
      language: 'en',
      tags: ['india', 'asia', 'world'],
      category: 'international',
      tier: 'C',
      defaultMuted: true
    },
    {
      id: 'i24news',
      name: 'i24NEWS English',
      provider: 'youtube',
      channelId: 'UCvHDpsWKADrDia0c99X37vg',
      country: 'IL',
      language: 'en',
      tags: ['middle-east', 'world'],
      category: 'international',
      tier: 'C',
      defaultMuted: true
    }
  ];

  // UI State
  searchQuery = signal('');
  layoutMode = signal<LayoutMode>('4');
  muteAll = signal(true);
  showSidebar = signal(true);
  selectedCategory = signal<string>('all');
  favorites = signal<string[]>([]);

  // Currently displayed channels in the grid
  displayedChannels = signal<NewsChannel[]>([]);

  constructor() {
    // Load favorites from localStorage
    const savedFavorites = localStorage.getItem('liveStreamFavorites');
    if (savedFavorites) {
      try {
        this.favorites.set(JSON.parse(savedFavorites));
      } catch (e) {
        console.error('Failed to parse favorites', e);
      }
    }

    // Initialize with Tier A channels (most reliable 24/7 streams)
    // This ensures users see working streams by default
    const tierAChannels = this.allChannels.filter(c => c.tier === 'A');
    this.displayedChannels.set(tierAChannels.slice(0, this.channelLimit));
  }

  // Filter channels based on search and category
  get filteredChannels(): NewsChannel[] {
    let channels = this.allChannels;

    // Filter by category
    if (this.selectedCategory() !== 'all') {
      channels = channels.filter(c => c.category === this.selectedCategory());
    }

    // Filter by search query
    const query = this.searchQuery().toLowerCase().trim();
    if (query) {
      channels = channels.filter(c =>
        c.name.toLowerCase().includes(query) ||
        c.tags.some(tag => tag.toLowerCase().includes(query)) ||
        c.country.toLowerCase().includes(query)
      );
    }

    return channels;
  }

  // Get grid columns class based on layout
  get gridClass(): string {
    switch (this.layoutMode()) {
      case '1': return 'grid-cols-1';
      case '4': return 'grid-cols-1 md:grid-cols-2';
      case '6': return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      case '9': return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      default: return 'grid-cols-1 md:grid-cols-2';
    }
  }

  // Get number of channels to display based on layout
  get channelLimit(): number {
    switch (this.layoutMode()) {
      case '1': return 1;
      case '4': return 4;
      case '6': return 6;
      case '9': return 9;
      default: return 4;
    }
  }

  // Update displayed channels
  updateDisplayedChannels() {
    const filtered = this.filteredChannels;
    const limit = this.channelLimit;
    this.displayedChannels.set(filtered.slice(0, limit));
  }

  // Layout actions
  setLayout(mode: LayoutMode) {
    this.layoutMode.set(mode);
    this.updateDisplayedChannels();
  }

  toggleMuteAll() {
    this.muteAll.update(val => !val);
  }

  toggleSidebar() {
    this.showSidebar.update(val => !val);
  }

  // Search
  onSearchChange() {
    this.updateDisplayedChannels();
  }

  // Category filter
  selectCategory(category: string) {
    this.selectedCategory.set(category);
    this.updateDisplayedChannels();
  }

  // Favorites
  toggleFavorite(channelId: string) {
    this.favorites.update(favs => {
      const newFavs = favs.includes(channelId)
        ? favs.filter(id => id !== channelId)
        : [...favs, channelId];

      // Save to localStorage
      localStorage.setItem('liveStreamFavorites', JSON.stringify(newFavs));
      return newFavs;
    });
  }

  isFavorite(channelId: string): boolean {
    return this.favorites().includes(channelId);
  }

  // Replace channel in specific slot
  replaceChannel(index: number, newChannel: NewsChannel) {
    this.displayedChannels.update(channels => {
      const updated = [...channels];
      updated[index] = newChannel;
      return updated;
    });
  }

  // Add channel to displayed channels
  addChannelToView(channel: NewsChannel) {
    // Check if channel is already displayed
    const isAlreadyDisplayed = this.displayedChannels().some(c => c.id === channel.id);
    if (isAlreadyDisplayed) {
      return;
    }

    this.displayedChannels.update(channels => {
      const updated = [...channels];

      // If we're at the limit, replace the last channel
      if (updated.length >= this.channelLimit) {
        updated[updated.length - 1] = channel;
      } else {
        // Otherwise, add to the end
        updated.push(channel);
      }

      return updated;
    });
  }

  // Open on YouTube
  openOnYoutube(channelId: string) {
    window.open(`https://www.youtube.com/channel/${channelId}/live`, '_blank', 'noreferrer');
  }

  // Get embed URL for channel
  getEmbedUrl(channel: NewsChannel, muted: boolean): string {
    const muteParam = muted ? '1' : '0';

    // For Tier C channels (event-driven), use videoseries to show latest uploads
    // This prevents broken embeds when they're not live
    if (channel.tier === 'C') {
      // Embed their channel's latest content instead of live stream
      // Users can see recent news even when not broadcasting live
      return `https://www.youtube.com/embed/videoseries?list=UU${channel.channelId.substring(2)}&autoplay=0&mute=${muteParam}&playsinline=1&modestbranding=1&controls=1`;
    }

    // For Tier A/B channels, use live_stream embed (most reliable)
    return `https://www.youtube.com/embed/live_stream?channel=${channel.channelId}&autoplay=1&mute=${muteParam}&playsinline=1&modestbranding=1&controls=1`;
  }

  // Track by function for ngFor
  trackByChannelId(_index: number, channel: NewsChannel) {
    return channel.id;
  }

  // Get category badge color
  getCategoryColor(category: string): string {
    switch (category) {
      case 'international': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'us': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'business': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  }

  // Get country flag emoji
  getCountryFlag(countryCode: string): string {
    const flags: Record<string, string> = {
      'US': '🇺🇸', 'GB': '🇬🇧', 'FR': '🇫🇷', 'DE': '🇩🇪', 'QA': '🇶🇦',
      'TR': '🇹🇷', 'SG': '🇸🇬', 'JP': '🇯🇵', 'IN': '🇮🇳', 'IL': '🇮🇱',
      'CA': '🇨🇦'
    };
    return flags[countryCode] || '🌍';
  }

  // Get channel by ID
  getChannelById(channelId: string): NewsChannel | undefined {
    return this.allChannels.find(c => c.id === channelId);
  }

  // Get channel name by ID
  getChannelName(channelId: string): string {
    return this.getChannelById(channelId)?.name || 'Unknown';
  }

  // Get channel country by ID
  getChannelCountry(channelId: string): string {
    return this.getChannelById(channelId)?.country || '';
  }
}
