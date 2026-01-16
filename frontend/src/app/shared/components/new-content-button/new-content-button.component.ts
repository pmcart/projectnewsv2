import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-new-content-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      type="button"
      (click)="navigateToNewContent()"
      class="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium
             bg-blue-600 hover:bg-blue-700 transition-colors"
    >
      + New Content
    </button>
  `
})
export class NewContentButtonComponent {
  @Input() itemId: string | null = null;
  @Input() itemType: 'breaking-news' | 'rss-feed' | null = null;

  constructor(private router: Router) {}

  navigateToNewContent(): void {
    if (!this.itemId || !this.itemType) {
      console.warn('NewContentButton: Missing itemId or itemType');
      return;
    }

    this.router.navigate(['/admin/new-content'], {
      queryParams: {
        id: this.itemId,
        type: this.itemType
      }
    });
  }
}
