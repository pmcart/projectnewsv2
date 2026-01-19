import { Component, OnInit, signal, inject, DestroyRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BreakingNewsService,
  BreakingNews
} from '../../services/breaking-news.service';
import {
  RssFeedService,
  GoogleNewsItem
} from '../../services/rss-feed.service';
import {
  ContentGenerationService,
  Document,
  DocumentType,
  DocumentVersion,
  SourceType,
  DocumentStatus
} from '../../services/content-generation.service';
import { AuthService } from '../../services/auth.service';
import { GenerationControlsComponent, GenerationRequest } from '../../shared/components/generation-controls/generation-controls';
import { HtmlContentEditorComponent } from '../../shared/components/html-content-editor/html-content-editor';
import { ReviewPanelComponent } from '../../shared/components/review-panel/review-panel';
import { VersionHistoryComponent } from '../../shared/components/version-history/version-history';

@Component({
  selector: 'app-new-content',
  standalone: true,
  imports: [
    CommonModule,
    GenerationControlsComponent,
    HtmlContentEditorComponent,
    ReviewPanelComponent,
    VersionHistoryComponent
  ],
  templateUrl: './new-content.html'
})
export class NewContentComponent implements OnInit {
  // Source item params
  itemId = signal<string | null>(null);
  itemType = signal<'breaking-news' | 'rss-feed' | null>(null);
  country = signal<string>('US');
  category = signal<string | null>(null);
  topic = signal<string | null>(null);

  // Source items
  breakingNewsItem = signal<BreakingNews | null>(null);
  rssFeedItem = signal<GoogleNewsItem | null>(null);

  // Document state
  document = signal<Document | null>(null);
  currentVersion = signal<DocumentVersion | null>(null);
  versions = signal<DocumentVersion[]>([]);
  currentHtml = signal<string>('');

  // UI state
  loading = signal(false);
  error = signal<string | null>(null);
  generating = signal(false);
  versionHistoryOpen = signal(false);

  // User state
  currentUser = signal<any>(null);

  // Computed
  sourceText = computed(() => {
    const bn = this.breakingNewsItem();
    const rss = this.rssFeedItem();
    if (bn) {
      return bn.text || '';
    }
    if (rss) {
      return rss.title || '';
    }
    return '';
  });

  sourceType = computed<SourceType>(() => {
    if (this.itemType() === 'breaking-news') {
      return SourceType.TWEET;
    }
    return SourceType.HEADLINE;
  });

  sourceUrl = computed(() => {
    const rss = this.rssFeedItem();
    return rss?.link || undefined;
  });

  isReadonly = computed(() => {
    const doc = this.document();
    const user = this.currentUser();
    if (!doc || !user) return true;

    if (doc.status === DocumentStatus.APPROVED) {
      return user.role !== 'EDITOR';
    }
    if (doc.status === DocumentStatus.IN_REVIEW) {
      return user.role === 'READER';
    }
    return false;
  });

  isOwner = computed(() => {
    const doc = this.document();
    const user = this.currentUser();
    return doc && user && doc.ownerUserId === user.userId;
  });

  private readonly breakingNewsService = inject(BreakingNewsService);
  private readonly rssFeedService = inject(RssFeedService);
  private readonly contentGenService = inject(ContentGenerationService);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    // Get current user from auth service (synchronous)
    const user = this.authService.getCurrentUser();
    if (user) {
      this.currentUser.set(user);
    }

    // Get route params and fetch source item
    this.route.queryParams
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.itemId.set(params['id'] || null);
        this.itemType.set(params['type'] || null);
        this.country.set(params['country'] || 'US');
        this.category.set(params['category'] || null);
        this.topic.set(params['topic'] || null);

        const id = this.itemId();
        const type = this.itemType();

        if (id && type) {
          this.fetchItem(id, type);
        }
      });
  }

  private fetchItem(id: string, type: 'breaking-news' | 'rss-feed'): void {
    this.loading.set(true);
    this.error.set(null);

    if (type === 'breaking-news') {
      this.breakingNewsService
        .getById(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (item) => {
            this.breakingNewsItem.set(item);
            this.loading.set(false);
            this.createDocument();
          },
          error: (err) => {
            console.error('Failed to load breaking news item', err);
            this.error.set('Failed to load breaking news item.');
            this.loading.set(false);
          }
        });
    } else if (type === 'rss-feed') {
      this.rssFeedService
        .getItemById({
          id,
          country: this.country(),
          category: this.category(),
          topic: this.topic(),
          enrich: 'light'
        })
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (item) => {
            this.rssFeedItem.set(item);
            this.loading.set(false);
            this.createDocument();
          },
          error: (err) => {
            console.error('Failed to load RSS feed item', err);
            this.error.set('Failed to load RSS feed item.');
            this.loading.set(false);
          }
        });
    }
  }

  private createDocument(): void {
    const sourceTextValue = this.sourceText();
    if (!sourceTextValue) return;

    // Create a document for this content
    const title = sourceTextValue.substring(0, 100) + (sourceTextValue.length > 100 ? '...' : '');

    this.contentGenService
      .createDocument({
        title,
        type: DocumentType.ARTICLE
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (doc) => {
          this.document.set(doc);
          this.loadVersions();
        },
        error: (err) => {
          console.error('Failed to create document', err);
          this.error.set('Failed to create document.');
        }
      });
  }

  private loadVersions(): void {
    const doc = this.document();
    if (!doc) return;

    this.contentGenService
      .getVersions(doc.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (versions) => {
          this.versions.set(versions);
          if (versions.length > 0) {
            this.currentVersion.set(versions[0]);
            this.currentHtml.set(versions[0].htmlContent);
          }
        },
        error: (err) => {
          console.error('Failed to load versions', err);
        }
      });
  }

  onGenerate(request: GenerationRequest): void {
    const doc = this.document();
    if (!doc || this.generating()) return;

    this.generating.set(true);
    this.error.set(null);

    this.contentGenService
      .generateContent(doc.id, {
        sourceType: request.sourceType as SourceType,
        sourceText: request.sourceText,
        sourceUrl: request.sourceUrl,
        generationInputs: request.generationInputs,
        mode: request.mode
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (version) => {
          this.currentVersion.set(version);
          this.currentHtml.set(version.htmlContent);
          this.generating.set(false);
          this.loadVersions(); // Refresh versions list
        },
        error: (err) => {
          console.error('Failed to generate content', err);
          this.error.set('Failed to generate content. Please check your OpenAI API key.');
          this.generating.set(false);
        }
      });
  }

  onContentChange(html: string): void {
    this.currentHtml.set(html);
  }

  onSave(html: string): void {
    const doc = this.document();
    const version = this.currentVersion();
    if (!doc) return;

    this.contentGenService
      .createVersion(doc.id, {
        htmlContent: html,
        sourceType: version?.sourceType,
        sourceText: version?.sourceText,
        sourceUrl: version?.sourceUrl,
        generationInputs: version?.generationInputs || undefined
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (newVersion) => {
          this.currentVersion.set(newVersion);
          this.loadVersions();
          alert('Content saved successfully!');
        },
        error: (err) => {
          console.error('Failed to save content', err);
          alert('Failed to save content.');
        }
      });
  }

  onSubmitForReview(): void {
    const doc = this.document();
    if (!doc) return;

    this.contentGenService
      .submitForReview(doc.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedDoc) => {
          this.document.set(updatedDoc);
          alert('Document submitted for review!');
        },
        error: (err) => {
          console.error('Failed to submit for review', err);
          alert('Failed to submit for review.');
        }
      });
  }

  onApprove(notes?: string): void {
    const doc = this.document();
    if (!doc) return;

    this.contentGenService
      .approveDocument(doc.id, notes)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedDoc) => {
          this.document.set(updatedDoc);
          alert('Document approved!');
        },
        error: (err) => {
          console.error('Failed to approve document', err);
          alert('Failed to approve document.');
        }
      });
  }

  onReject(data: { notes: string }): void {
    const doc = this.document();
    if (!doc) return;

    this.contentGenService
      .rejectDocument(doc.id, {
        notes: data.notes,
        htmlContent: this.currentHtml()
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.document.set(result.document);
          this.currentVersion.set(result.newVersion);
          this.currentHtml.set(result.newVersion.htmlContent);
          this.loadVersions();
          alert('Document rejected. A new version has been created for revisions.');
        },
        error: (err) => {
          console.error('Failed to reject document', err);
          alert('Failed to reject document.');
        }
      });
  }

  onSelectVersion(versionId: string): void {
    const doc = this.document();
    if (!doc) return;

    this.contentGenService
      .getVersion(doc.id, versionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (version) => {
          this.currentVersion.set(version);
          this.currentHtml.set(version.htmlContent);
          this.versionHistoryOpen.set(false);
        },
        error: (err) => {
          console.error('Failed to load version', err);
          alert('Failed to load version.');
        }
      });
  }

  toggleVersionHistory(): void {
    this.versionHistoryOpen.set(!this.versionHistoryOpen());
  }
}
