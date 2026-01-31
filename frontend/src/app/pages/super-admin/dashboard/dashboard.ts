import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SuperAdminService, SuperAdminStats } from '../../../services/super-admin.service';
import { LucideAngularModule, Building2, Users, UserCheck, Shield, TrendingUp, Clock } from 'lucide-angular';

@Component({
  selector: 'app-super-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  templateUrl: './dashboard.html'
})
export class SuperAdminDashboardComponent implements OnInit {
  // Icons
  readonly Building2 = Building2;
  readonly Users = Users;
  readonly UserCheck = UserCheck;
  readonly Shield = Shield;
  readonly TrendingUp = TrendingUp;
  readonly Clock = Clock;

  // State
  stats = signal<SuperAdminStats | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  private readonly superAdminService = inject(SuperAdminService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading.set(true);
    this.error.set(null);

    this.superAdminService
      .getStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.stats.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load stats:', err);
          this.error.set('Failed to load dashboard statistics');
          this.loading.set(false);
        }
      });
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }
}
