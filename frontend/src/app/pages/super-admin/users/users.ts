import { Component, OnInit, signal, inject, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SuperAdminService, OrganizationWithCounts, CreateUserRequest } from '../../../services/super-admin.service';
import { User } from '../../../services/auth.service';
import { LucideAngularModule, Plus, Search, Pencil, Trash2, X, Check, Users as UsersIcon, Shield, Building2 } from 'lucide-angular';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './users.html'
})
export class UsersComponent implements OnInit {
  // Icons
  readonly Plus = Plus;
  readonly Search = Search;
  readonly Pencil = Pencil;
  readonly Trash2 = Trash2;
  readonly X = X;
  readonly Check = Check;
  readonly UsersIcon = UsersIcon;
  readonly Shield = Shield;
  readonly Building2 = Building2;

  // State
  users = signal<User[]>([]);
  organizations = signal<OrganizationWithCounts[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // Pagination
  currentPage = signal(1);
  totalPages = signal(1);
  total = signal(0);

  // Filters
  searchTerm = '';
  selectedOrgId: number | undefined = undefined;
  selectedRole = '';

  // Modal state
  showModal = signal(false);
  editingUser = signal<User | null>(null);
  formData: CreateUserRequest & { password?: string } = {
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    role: 'READER',
    organizationId: null,
    isActive: true,
    isSuperAdmin: false
  };
  saving = signal(false);
  formError = signal<string | null>(null);

  // Delete confirmation
  deletingUser = signal<User | null>(null);
  deleting = signal(false);

  private readonly superAdminService = inject(SuperAdminService);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    this.loadOrganizations();
    this.loadUsers();
  }

  loadOrganizations(): void {
    this.superAdminService
      .listOrganizations({ limit: 1000 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.organizations.set(data.organizations);
        },
        error: (err) => {
          console.error('Failed to load organizations:', err);
        }
      });
  }

  loadUsers(): void {
    this.loading.set(true);
    this.error.set(null);

    this.superAdminService
      .listUsers({
        search: this.searchTerm || undefined,
        organizationId: this.selectedOrgId,
        role: this.selectedRole || undefined,
        page: this.currentPage(),
        limit: 20
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.users.set(data.users);
          this.totalPages.set(data.totalPages);
          this.total.set(data.total);
          this.loading.set(false);
        },
        error: (err) => {
          console.error('Failed to load users:', err);
          this.error.set('Failed to load users');
          this.loading.set(false);
        }
      });
  }

  onSearch(): void {
    this.currentPage.set(1);
    this.loadUsers();
  }

  onFilterChange(): void {
    this.currentPage.set(1);
    this.loadUsers();
  }

  onPageChange(page: number): void {
    if (page < 1 || page > this.totalPages()) return;
    this.currentPage.set(page);
    this.loadUsers();
  }

  // Modal methods
  openCreateModal(): void {
    this.editingUser.set(null);
    this.formData = {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      role: 'READER',
      organizationId: null,
      isActive: true,
      isSuperAdmin: false
    };
    this.formError.set(null);
    this.showModal.set(true);
  }

  openEditModal(user: User): void {
    this.editingUser.set(user);
    this.formData = {
      email: user.email,
      password: '',
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      organizationId: user.organizationId || null,
      isActive: user.isActive,
      isSuperAdmin: user.isSuperAdmin
    };
    this.formError.set(null);
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
    this.editingUser.set(null);
    this.formError.set(null);
  }

  saveUser(): void {
    // Validate
    if (!this.formData.email?.trim()) {
      this.formError.set('Email is required');
      return;
    }
    if (!this.formData.firstName?.trim()) {
      this.formError.set('First name is required');
      return;
    }
    if (!this.formData.lastName?.trim()) {
      this.formError.set('Last name is required');
      return;
    }
    if (!this.editingUser() && !this.formData.password?.trim()) {
      this.formError.set('Password is required for new users');
      return;
    }
    if (this.formData.password && this.formData.password.length < 6) {
      this.formError.set('Password must be at least 6 characters');
      return;
    }

    this.saving.set(true);
    this.formError.set(null);

    const editing = this.editingUser();

    if (editing) {
      // Update - only send password if it was changed
      const updateData: any = {
        email: this.formData.email,
        firstName: this.formData.firstName,
        lastName: this.formData.lastName,
        role: this.formData.role,
        organizationId: this.formData.organizationId,
        isActive: this.formData.isActive,
        isSuperAdmin: this.formData.isSuperAdmin
      };
      if (this.formData.password) {
        updateData.password = this.formData.password;
      }

      this.superAdminService
        .updateUser(editing.id, updateData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.closeModal();
            this.loadUsers();
            this.saving.set(false);
          },
          error: (err) => {
            console.error('Failed to update user:', err);
            this.formError.set(err.error?.error || 'Failed to update user');
            this.saving.set(false);
          }
        });
    } else {
      // Create
      this.superAdminService
        .createUser(this.formData as CreateUserRequest)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.closeModal();
            this.loadUsers();
            this.saving.set(false);
          },
          error: (err) => {
            console.error('Failed to create user:', err);
            this.formError.set(err.error?.error || 'Failed to create user');
            this.saving.set(false);
          }
        });
    }
  }

  // Delete methods
  confirmDelete(user: User): void {
    this.deletingUser.set(user);
  }

  cancelDelete(): void {
    this.deletingUser.set(null);
  }

  deleteUser(): void {
    const user = this.deletingUser();
    if (!user) return;

    this.deleting.set(true);

    this.superAdminService
      .deleteUser(user.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deletingUser.set(null);
          this.deleting.set(false);
          this.loadUsers();
        },
        error: (err) => {
          console.error('Failed to delete user:', err);
          this.error.set(err.error?.error || 'Failed to delete user');
          this.deletingUser.set(null);
          this.deleting.set(false);
        }
      });
  }

  getRoleBadgeClass(role: string): string {
    switch (role) {
      case 'EDITOR':
        return 'bg-purple-500/10 text-purple-400';
      case 'WRITER':
        return 'bg-blue-500/10 text-blue-400';
      default:
        return 'bg-slate-500/10 text-slate-400';
    }
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
