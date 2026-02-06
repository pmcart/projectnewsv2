import { Component, OnInit, OnDestroy, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TimelineService, Timeline, TimelineEvent, TimelineEventCategory } from '../../services/timeline.service';
import { timer, Subscription } from 'rxjs';
import { switchMap, takeWhile } from 'rxjs/operators';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './timeline.html',
  styleUrls: ['./timeline.css']
})
export class TimelineComponent implements OnInit, OnDestroy {
  timeline = signal<Timeline | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  // Note editing state
  activeNoteEventId = signal<string | null>(null);
  noteContent = '';
  noteSubmitting = signal(false);

  // Expanded event cards
  expandedEvents = signal<Set<string>>(new Set());

  // Skeleton placeholders for loading state
  skeletonItems = Array.from({ length: 6 });

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private timelineService = inject(TimelineService);
  private destroyRef = inject(DestroyRef);
  private pollSubscription?: Subscription;

  ngOnInit() {
    const id = this.route.snapshot.params['id'];
    if (id) {
      this.loadTimeline(id);
    }
  }

  ngOnDestroy() {
    this.pollSubscription?.unsubscribe();
  }

  loadTimeline(id: string) {
    this.loading.set(true);
    this.timelineService.getTimelineById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (timeline) => {
          this.timeline.set(timeline);
          this.loading.set(false);

          if (timeline.status === 'GENERATING' || timeline.status === 'DRAFT') {
            this.startPolling(id);
          }
        },
        error: () => {
          this.error.set('Failed to load timeline');
          this.loading.set(false);
        }
      });
  }

  private startPolling(id: string) {
    this.pollSubscription?.unsubscribe();
    this.pollSubscription = timer(2000, 2000).pipe(
      switchMap(() => this.timelineService.getTimelineById(id)),
      takeWhile((t) => t.status === 'GENERATING' || t.status === 'DRAFT', true)
    ).subscribe({
      next: (timeline) => {
        this.timeline.set(timeline);
      }
    });
  }

  toggleEvent(eventId: string) {
    const current = new Set(this.expandedEvents());
    if (current.has(eventId)) {
      current.delete(eventId);
    } else {
      current.add(eventId);
    }
    this.expandedEvents.set(current);
  }

  isExpanded(eventId: string): boolean {
    return this.expandedEvents().has(eventId);
  }

  openNoteForm(eventId: string) {
    this.activeNoteEventId.set(eventId);
    this.noteContent = '';
  }

  closeNoteForm() {
    this.activeNoteEventId.set(null);
    this.noteContent = '';
  }

  submitNote(eventId: string) {
    const tl = this.timeline();
    if (!tl || !this.noteContent.trim()) return;

    this.noteSubmitting.set(true);
    this.timelineService.addNote(tl.id, eventId, this.noteContent.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (note) => {
          // Update the local timeline with the new note
          const updated = { ...tl };
          updated.events = updated.events.map(e => {
            if (e.id === eventId) {
              return { ...e, notes: [note, ...e.notes] };
            }
            return e;
          });
          this.timeline.set(updated);
          this.noteSubmitting.set(false);
          this.closeNoteForm();
        },
        error: () => {
          this.noteSubmitting.set(false);
        }
      });
  }

  deleteNote(timelineId: string, eventId: string, noteId: string) {
    this.timelineService.deleteNote(timelineId, eventId, noteId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const tl = this.timeline();
          if (!tl) return;
          const updated = { ...tl };
          updated.events = updated.events.map(e => {
            if (e.id === eventId) {
              return { ...e, notes: e.notes.filter(n => n.id !== noteId) };
            }
            return e;
          });
          this.timeline.set(updated);
        }
      });
  }

  getCategoryColor(category: TimelineEventCategory): string {
    const colors: Record<string, string> = {
      INCIDENT: 'bg-red-600/20 text-red-400 border-red-600/40',
      SIGNAL: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
      PATTERN: 'bg-purple-600/20 text-purple-400 border-purple-600/40',
      RESPONSE: 'bg-blue-600/20 text-blue-400 border-blue-600/40',
      ESCALATION: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
      CONTEXT: 'bg-slate-500/20 text-slate-400 border-slate-500/40',
    };
    return colors[category] || colors['CONTEXT'];
  }

  getCategoryBorderColor(category: TimelineEventCategory): string {
    const colors: Record<string, string> = {
      INCIDENT: 'border-red-600/40',
      SIGNAL: 'border-amber-500/40',
      PATTERN: 'border-purple-600/40',
      RESPONSE: 'border-blue-600/40',
      ESCALATION: 'border-orange-500/40',
      CONTEXT: 'border-slate-500/40',
    };
    return colors[category] || colors['CONTEXT'];
  }

  getCategoryDotColor(category: TimelineEventCategory): string {
    const colors: Record<string, string> = {
      INCIDENT: 'bg-red-500',
      SIGNAL: 'bg-amber-500',
      PATTERN: 'bg-purple-500',
      RESPONSE: 'bg-blue-500',
      ESCALATION: 'bg-orange-500',
      CONTEXT: 'bg-slate-500',
    };
    return colors[category] || colors['CONTEXT'];
  }

  getCategoryGlowClass(category: TimelineEventCategory): string {
    const classes: Record<string, string> = {
      INCIDENT: 'timeline-card-incident',
      SIGNAL: 'timeline-card-signal',
      PATTERN: 'timeline-card-pattern',
      RESPONSE: 'timeline-card-response',
      ESCALATION: 'timeline-card-escalation',
      CONTEXT: 'timeline-card-context',
    };
    return classes[category] || classes['CONTEXT'];
  }

  getCategoryLabel(category: TimelineEventCategory): string {
    const labels: Record<string, string> = {
      INCIDENT: 'Incident',
      SIGNAL: 'Signal',
      PATTERN: 'Pattern',
      RESPONSE: 'Response',
      ESCALATION: 'Escalation',
      CONTEXT: 'Context',
    };
    return labels[category] || category;
  }

  getSignificanceBorder(significance: number): string {
    const borders: Record<number, string> = {
      1: 'border',
      2: 'border-[1.5px]',
      3: 'border-2',
      4: 'border-[3px]',
      5: 'border-4',
    };
    return borders[significance] || 'border-2';
  }

  significanceArray = [1, 2, 3, 4, 5];

  goBack() {
    this.router.navigate(['/admin/breaking-news']);
  }
}
