import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DocumentVersion } from '../../../services/content-generation.service';

@Component({
  selector: 'app-version-history',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './version-history.html',
  styleUrls: ['./version-history.css']
})
export class VersionHistoryComponent {
  // Inputs
  versions = input.required<DocumentVersion[]>();
  currentVersionId = input<string>();
  isOpen = input.required<boolean>();

  // Outputs
  close = output<void>();
  selectVersion = output<string>();

  onClose() {
    this.close.emit();
  }

  onSelectVersion(versionId: string) {
    this.selectVersion.emit(versionId);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  isCurrentVersion(versionId: string): boolean {
    return versionId === this.currentVersionId();
  }
}
