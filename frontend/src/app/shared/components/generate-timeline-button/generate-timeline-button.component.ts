import { Component, Input, inject, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { TimelineService, Timeline } from '../../../services/timeline.service';

@Component({
  selector: 'app-generate-timeline-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      *ngIf="existingTimeline"
      type="button"
      (click)="viewTimeline()"
      class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium
             bg-emerald-600 hover:bg-emerald-700 transition-colors"
    >
      View Timeline
    </button>
    <button
      *ngIf="!existingTimeline"
      type="button"
      (click)="generateTimeline()"
      [disabled]="loading"
      class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium
             bg-amber-600 hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <span *ngIf="loading" class="inline-block h-3 w-3 mr-1.5 rounded-full border-2 border-white/30 border-t-white animate-spin"></span>
      {{ loading ? 'Creating...' : 'Generate Timeline' }}
    </button>
  `
})
export class GenerateTimelineButtonComponent implements OnChanges, OnDestroy {
  @Input() itemId: string | null | undefined = null;
  @Input() itemText: string | null | undefined = null;
  @Input() itemAccount: string | null | undefined = null;

  loading = false;
  existingTimeline: Timeline | null = null;

  private router = inject(Router);
  private timelineService = inject(TimelineService);
  private checkSub?: Subscription;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['itemId']) {
      this.existingTimeline = null;
      this.checkSub?.unsubscribe();

      if (this.itemId) {
        this.checkSub = this.timelineService.getByTweetId(this.itemId).subscribe({
          next: (timeline) => {
            this.existingTimeline = timeline;
          },
          error: () => {
            this.existingTimeline = null;
          }
        });
      }
    }
  }

  ngOnDestroy(): void {
    this.checkSub?.unsubscribe();
  }

  viewTimeline(): void {
    if (this.existingTimeline) {
      this.router.navigate(['/admin/timeline', this.existingTimeline.id]);
    }
  }

  generateTimeline(): void {
    if (!this.itemId || !this.itemText) {
      return;
    }

    this.loading = true;

    this.timelineService.createTimeline({
      tweetId: this.itemId,
      text: this.itemText,
      account: this.itemAccount || undefined
    }).subscribe({
      next: (timeline) => {
        this.loading = false;
        this.existingTimeline = timeline;
        this.router.navigate(['/admin/timeline', timeline.id]);
      },
      error: (err) => {
        console.error('Failed to create timeline:', err);
        this.loading = false;
      }
    });
  }
}
