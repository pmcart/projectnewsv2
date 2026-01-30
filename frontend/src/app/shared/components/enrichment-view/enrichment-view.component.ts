// src/app/shared/components/enrichment-view/enrichment-view.component.ts
import { Component, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BreakingNewsEnrichment } from '../../../services/breaking-news.service';

type TabType = 'overview' | 'intelligence' | 'entities' | 'sources' | 'metadata';

interface Tab {
  id: TabType;
  label: string;
}

@Component({
  selector: 'app-enrichment-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './enrichment-view.component.html',
  styleUrls: ['./enrichment-view.component.css']
})
export class EnrichmentViewComponent {
  // Inputs
  enrichment = input<BreakingNewsEnrichment | null>();
  loading = input<boolean>(false);
  error = input<string | null>(null);

  // Internal state
  activeTab = signal<TabType>('overview');
  toastMessage = signal<string | null>(null);

  // Tab definitions
  tabs: Tab[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'intelligence', label: 'Intelligence' },
    { id: 'entities', label: 'Entities & Locations' },
    { id: 'sources', label: 'Sources' },
    { id: 'metadata', label: 'Metadata' }
  ];

  // Category color mapping
  getCategoryColor(category?: string): string {
    const colorMap: Record<string, string> = {
      conflict: 'bg-red-600/20 text-red-400 border-red-600/40',
      disaster: 'bg-orange-600/20 text-orange-400 border-orange-600/40',
      politics: 'bg-purple-600/20 text-purple-400 border-purple-600/40',
      economy: 'bg-blue-600/20 text-blue-400 border-blue-600/40',
      crime: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/40',
      cyber: 'bg-pink-600/20 text-pink-400 border-pink-600/40',
      social: 'bg-green-600/20 text-green-400 border-green-600/40',
      sports: 'bg-teal-600/20 text-teal-400 border-teal-600/40',
      other: 'bg-slate-600/20 text-slate-400 border-slate-600/40'
    };
    return category ? (colorMap[category.toLowerCase()] || colorMap['other']) : colorMap['other'];
  }

  // Time window color mapping
  getTimeWindowColor(timeWindow?: string): string {
    const colorMap: Record<string, string> = {
      past_event: 'bg-slate-600/20 text-slate-400 border-slate-600/40',
      ongoing: 'bg-orange-600/20 text-orange-400 border-orange-600/40',
      future_risk: 'bg-red-600/20 text-red-400 border-red-600/40',
      unknown: 'bg-slate-600/20 text-slate-400 border-slate-600/40'
    };
    return timeWindow ? (colorMap[timeWindow] || colorMap['unknown']) : colorMap['unknown'];
  }

  // Score color coding (0-1 range)
  getScoreColor(score?: number): string {
    if (score == null) return 'text-slate-400';
    if (score < 0.3) return 'text-red-500';
    if (score < 0.6) return 'text-yellow-500';
    return 'text-green-500';
  }

  // Score percentage for display
  getScorePercentage(score?: number): number {
    return score != null ? Math.round(score * 100) : 0;
  }

  // Sentiment color (-1 to 1 range)
  getSentimentColor(sentiment?: number): string {
    if (sentiment == null) return 'bg-slate-500';
    if (sentiment < -0.3) return 'bg-red-500';
    if (sentiment > 0.3) return 'bg-green-500';
    return 'bg-slate-500';
  }

  // Sentiment position percentage (convert -1 to 1 into 0% to 100%)
  getSentimentPosition(sentiment?: number): number {
    if (sentiment == null) return 50;
    return ((sentiment + 1) / 2) * 100;
  }

  // Likelihood color coding
  getLikelihoodColor(likelihood?: number): string {
    if (likelihood == null) return 'bg-slate-500';
    if (likelihood < 0.3) return 'bg-slate-500';
    if (likelihood < 0.6) return 'bg-yellow-500';
    return 'bg-orange-600';
  }

  // Tab navigation
  switchTab(tabId: TabType) {
    this.activeTab.set(tabId);
  }

  isActiveTab(tabId: TabType): boolean {
    return this.activeTab() === tabId;
  }

  // Entity click handler (copy to clipboard)
  async copyToClipboard(entity: string) {
    try {
      await navigator.clipboard.writeText(entity);
      this.showToast(`Copied "${entity}" to clipboard`);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      this.showToast('Failed to copy to clipboard');
    }
  }

  // Toast notification
  showToast(message: string) {
    this.toastMessage.set(message);
    setTimeout(() => {
      this.toastMessage.set(null);
    }, 3000);
  }

  // Sort scenarios/effects by likelihood descending
  sortByLikelihood<T extends { likelihood?: number }>(items?: T[]): T[] {
    if (!items) return [];
    return [...items].sort((a, b) => (b.likelihood || 0) - (a.likelihood || 0));
  }

  // Format time window for display
  formatTimeWindow(timeWindow?: string): string {
    const formatMap: Record<string, string> = {
      past_event: 'Past Event',
      ongoing: 'Ongoing',
      future_risk: 'Future Risk',
      unknown: 'Unknown'
    };
    return timeWindow ? (formatMap[timeWindow] || timeWindow) : 'Unknown';
  }

  // Extract domain from URL
  extractDomain(url?: string): string {
    if (!url) return '';
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '');
    } catch {
      return url;
    }
  }

  // Open external link
  openExternal(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  // Format hash (first 8 chars)
  formatHash(hash?: string): string {
    return hash ? hash.substring(0, 8) : 'N/A';
  }

  // Model badge color
  getModelBadgeColor(model?: string): string {
    if (!model) return 'bg-slate-600/20 text-slate-400 border-slate-600/40';
    if (model.includes('o3')) return 'bg-purple-600/20 text-purple-400 border-purple-600/40';
    return 'bg-blue-600/20 text-blue-400 border-blue-600/40';
  }

  // Encode URI component for templates
  encodeURIComponent(value: string): string {
    return encodeURIComponent(value);
  }
}
