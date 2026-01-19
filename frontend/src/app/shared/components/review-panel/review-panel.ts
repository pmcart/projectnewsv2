import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DocumentStatus } from '../../../services/content-generation.service';

@Component({
  selector: 'app-review-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './review-panel.html',
  styleUrls: ['./review-panel.css']
})
export class ReviewPanelComponent {
  // Inputs
  status = input.required<DocumentStatus>();
  userRole = input.required<string>();
  isOwner = input.required<boolean>();

  // Outputs
  submit = output<void>();
  approve = output<string | undefined>();
  reject = output<{ notes: string }>();

  // State
  notes = signal('');
  showNotesInput = signal(false);
  actionType = signal<'approve' | 'reject' | null>(null);

  // Computed
  get canSubmit(): boolean {
    return this.status() === DocumentStatus.DRAFT &&
           (this.isOwner() || this.userRole() !== 'READER');
  }

  get canApproveOrReject(): boolean {
    return this.status() === DocumentStatus.IN_REVIEW &&
           (this.userRole() === 'EDITOR' || this.userRole() === 'WRITER');
  }

  get canEdit(): boolean {
    if (this.status() === DocumentStatus.APPROVED) {
      return this.userRole() === 'EDITOR';
    }
    if (this.status() === DocumentStatus.IN_REVIEW) {
      return this.userRole() !== 'READER';
    }
    return true;
  }

  get statusColor(): string {
    switch (this.status()) {
      case DocumentStatus.DRAFT:
        return 'bg-slate-600 text-slate-200';
      case DocumentStatus.IN_REVIEW:
        return 'bg-amber-600 text-white';
      case DocumentStatus.APPROVED:
        return 'bg-green-600 text-white';
      default:
        return 'bg-slate-600 text-slate-200';
    }
  }

  onSubmitForReview() {
    if (this.canSubmit) {
      this.submit.emit();
    }
  }

  startApprove() {
    this.actionType.set('approve');
    this.showNotesInput.set(true);
    this.notes.set('');
  }

  startReject() {
    this.actionType.set('reject');
    this.showNotesInput.set(true);
    this.notes.set('');
  }

  cancelAction() {
    this.showNotesInput.set(false);
    this.actionType.set(null);
    this.notes.set('');
  }

  confirmAction() {
    if (this.actionType() === 'approve') {
      this.approve.emit(this.notes() || undefined);
      this.showNotesInput.set(false);
      this.actionType.set(null);
      this.notes.set('');
    } else if (this.actionType() === 'reject') {
      const notesValue = this.notes().trim();
      if (notesValue.length < 10) {
        alert('Rejection notes must be at least 10 characters');
        return;
      }
      this.reject.emit({ notes: notesValue });
      this.showNotesInput.set(false);
      this.actionType.set(null);
      this.notes.set('');
    }
  }
}
