import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SuperAdminService, OrganizationWithCounts, CreateOrganizationRequest } from '../../../services/super-admin.service';
import { LucideAngularModule, Plus, Search, Pencil, Trash2, X, Check, Building2, Users, FileText, Video } from 'lucide-angular';

@Component({
  selector: 'app-organizations',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './organizations.html'
})
export class OrganizationsComponent implements OnInit {
  // Icons
  readonly Plus = Plus;
  readonly Search = Search;
  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;
  readonly X = X;
  readonly Check = Check;
  readonly Building2 = Building2;
  readonly Users = Users;
  readonly FileText = FileText;
  readonly Video = Video;

  // State
  organizations = signal<OrganizationWithCounts[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // Pagination
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);

  // Search
  searchTerm = '';

  // Modal state
  showModal = signal(false);
  editingOrg = signal<OrganizationWithCounts | null>(null);
  formData = { name: '', slug: '', isActive: true };
  saving = signal(false);
  formError = signal<string | null>(null);

  // Delete confirmation
  deletingOrg = signal<OrganizationWithCounts | null>(null);
  deleting = signal(false);

  private readonly superAdminService = inject(SuperAdminService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.loadOrganizations();
  }

  loadOrganizations(): void {
    this.loading.set(true);
    this.error.set(null);

    this.superAdminService
      .listOrganizations({
        search: this.searchTerm || undefined,
        page: this.currentPage(),
        limit: 20
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.organizations.set(data.organizations);
          this.totalPages.set(data.totalPages);
          this.total.set(data.total);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load organizations:', err);
          this.error.set('Failed to load organizations');
          this.loading.set(false);
        }
      });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadOrganizations();
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadOrganizations();
  }

  // Modal methods
  openCreateModal(): void {
    this.editingOrg.set(null);
    this.formData = { name: '', slug: '', isActive: true };
    this.formError.set(null);
    this.showModal.set(true);
  }

  openEditModal(org: OrganizationWithCounts): void {
    this.editingOrg.set(org);
    this.formData = { name: org.name, slug: org.slug, isActive: org.isActive };
    this.formError.set(null);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingOrg.set(null);
    this.formError.set(null);
  }

  generateSlug(): void {
    this.formData.slug = this.formData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  saveOrganization(): void {
    // Validate
    if (!this.formData.name.trim()) {
      this.formError.set('Name is required');
      return;
    }
    if (!this.formData.slug.trim()) {
      this.formError.set('Slug is required');
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    const editing = this.editingOrg();
    const operation = editing
      ? this.superAdminService.updateOrganization(editing.id, this.formData)
      : this.superAdminService.createOrganization(this.formData);

    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.closeModal();
        this.loadOrganizations();
        this.saving.set(false);
      },
      error: (err) => {
        console.error('Failed to save organization:', err);
        this.formError.set(err.error?.error || 'Failed to save organization');
        this.saving.set(false);
      }
    });
  }

  // Delete methods
  confirmDelete(org: OrganizationWithCounts): void {
    this.deletingOrg.set(org);
  }

  cancelDelete(): void {
    this.deletingOrg.set(null);
  }

  deleteOrganization(): void {
    const org = this.deletingOrg();
    if (!org) return;

    this.deleting.set(true);

    this.superAdminService
      .deleteOrganization(org.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletingOrg.set(null);
          this.deleting.set(false);
          this.loadOrganizations();
        },
        error: (err) => {
          console.error('Failed to delete organization:', err);
          this.error.set(err.error?.error || 'Failed to delete organization');
          this.deletingOrg.set(null);
          this.deleting.set(false);
        }
      });
  }

  getPageNumbers(): number[] {
    const pages: number[] = [];
    const total = this.totalPages();
    const current = this.currentPage();

    let start = Math.max(1, current - 2);
    let end = Math.min(total, current + 2);

    if (end - start < 4) {
      if (start === 1) {
        end = Math.min(5, total);
      } else {
        start = Math.max(1, total - 4);
      }
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }
}
