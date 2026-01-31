import { Component, OnInit, OnDestroy, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { DashboardService, DashboardStats, RecentJob, RecentBreakingNews } from '../../services/dashboard.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-dashboard.html',
  styleUrls: ['./admin-dashboard.css']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  stats = signal<DashboardStats | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);
  lastUpdated = signal<Date | null>(null);

  private readonly dashboardService = inject(DashboardService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private refreshInterval: any;

  ngOnInit(): void {
    this.loadStats();

    // Auto-refresh every 30 seconds
    interval(30000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadStats(true);
      });
  }

  ngOnDestroy(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }

  loadStats(silent = false): void {
    if (!silent) {
      this.loading.set(true);
    }
    this.error.set(null);

    this.dashboardService
      .getDashboardStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.stats.set(data);
          this.loading.set(false);
          this.lastUpdated.set(new Date());
        },
        error: (err) => {
          console.error('Failed to load dashboard stats', err);
          this.error.set('Failed to load dashboard statistics.');
          this.loading.set(false);
        }
      });
  }

  onRefresh(): void {
    this.loadStats();
  }

  // Navigation helpers
  navigateToBreakingNews(): void {
    this.router.navigate(['/admin/breaking-news']);
  }

  navigateToContentReview(): void {
    this.router.navigate(['/admin/content-review']);
  }

  navigateToNewContent(): void {
    this.router.navigate(['/admin/new-content']);
  }

  navigateToNewVideo(): void {
    this.router.navigate(['/admin/new-video']);
  }

  // Formatting helpers
  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  getJobStatusColor(status: string): string {
    switch (status) {
      case 'running':
        return 'bg-blue-500 text-white';
      case 'queued':
        return 'bg-amber-500 text-white';
      case 'succeeded':
        return 'bg-green-500 text-white';
      case 'failed':
        return 'bg-red-500 text-white';
      default:
        return 'bg-slate-500 text-white';
    }
  }

  getJobTypeLabel(type: string): string {
    switch (type) {
      case 'twitterlivescraper':
        return 'Twitter Live';
      case 'twittersearchscraper':
        return 'Twitter Search';
      case 'singleenrichment':
        return 'Enrichment';
      case 'singlemedia':
        return 'Media';
      default:
        return type;
    }
  }

  getJobTypeColor(type: string): string {
    switch (type) {
      case 'twitterlivescraper':
        return 'text-cyan-400';
      case 'twittersearchscraper':
        return 'text-purple-400';
      case 'singleenrichment':
        return 'text-amber-400';
      case 'singlemedia':
        return 'text-green-400';
      default:
        return 'text-slate-400';
    }
  }

  getRiskScoreColor(score: number | null): string {
    if (score === null) return 'text-slate-400';
    if (score >= 0.7) return 'text-red-400';
    if (score >= 0.4) return 'text-amber-400';
    return 'text-green-400';
  }

  formatRiskScore(score: number | null): string {
    if (score === null) return 'N/A';
    return (score * 100).toFixed(0) + '%';
  }

  getCategoryEntries(): { name: string; count: number }[] {
    const stats = this.stats();
    if (!stats?.enrichments?.byCategory) return [];

    return Object.entries(stats.enrichments.byCategory)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }

  getDocumentStatusEntries(): { status: string; count: number; color: string }[] {
    const stats = this.stats();
    if (!stats?.documents?.byStatus) return [];

    const statusColors: Record<string, string> = {
      'DRAFT': 'bg-slate-500',
      'IN_REVIEW': 'bg-amber-500',
      'APPROVED': 'bg-green-500'
    };

    return Object.entries(stats.documents.byStatus)
      .map(([status, count]) => ({
        status,
        count,
        color: statusColors[status] || 'bg-slate-500'
      }));
  }

  getVideoStatusEntries(): { status: string; count: number; color: string }[] {
    const stats = this.stats();
    if (!stats?.videos?.byStatus) return [];

    const statusColors: Record<string, string> = {
      'DRAFT': 'bg-slate-500',
      'GENERATING': 'bg-blue-500',
      'GENERATED': 'bg-cyan-500',
      'IN_REVIEW': 'bg-amber-500',
      'APPROVED': 'bg-green-500',
      'REJECTED': 'bg-red-500',
      'FAILED': 'bg-red-700'
    };

    return Object.entries(stats.videos.byStatus)
      .map(([status, count]) => ({
        status,
        count,
        color: statusColors[status] || 'bg-slate-500'
      }));
  }
}
