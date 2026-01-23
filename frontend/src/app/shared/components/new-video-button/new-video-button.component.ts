import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-new-video-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      (click)="navigateToNewVideo()"
      class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium
             bg-purple-600 hover:bg-purple-700 transition-colors"
    >
      + New Video
    </button>
  `
})
export class NewVideoButtonComponent {
  @Input() itemId: string | null = null;
  @Input() itemType: 'breaking-news' | 'rss-feed' | null = null;
  @Input() itemData: any = null;

  constructor(private router: Router) {}

  navigateToNewVideo(): void {
    if (!this.itemId || !this.itemType) {
      console.warn('NewVideoButton: Missing itemId or itemType');
      return;
    }

    this.router.navigate(['/admin/new-video'], {
      queryParams: {
        id: this.itemId,
        type: this.itemType
      },
      state: {
        itemData: this.itemData
      }
    });
  }
}
