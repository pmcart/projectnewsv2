import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Organization, User } from './auth.service';
import { environment } from '../../environments/environment';

// ==================== INTERFACES ====================

export interface OrganizationWithCounts extends Organization {
  _count: {
    users: number;
    documents: number;
    videos: number;
  };
}

export interface OrganizationWithUsers extends OrganizationWithCounts {
  users: User[];
}

export interface PaginatedOrganizations {
  organizations: OrganizationWithCounts[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedUsers {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateOrganizationRequest {
  name: string;
  slug: string;
  isActive?: boolean;
}

export interface UpdateOrganizationRequest {
  name?: string;
  slug?: string;
  isActive?: boolean;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'READER' | 'WRITER' | 'EDITOR';
  organizationId?: number | null;
  isActive?: boolean;
  isSuperAdmin?: boolean;
}

export interface UpdateUserRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: 'READER' | 'WRITER' | 'EDITOR';
  organizationId?: number | null;
  isActive?: boolean;
  isSuperAdmin?: boolean;
  password?: string;
}

export interface SuperAdminStats {
  organizations: {
    total: number;
    active: number;
    inactive: number;
  };
  users: {
    total: number;
    active: number;
    inactive: number;
    superAdmins: number;
    byRole: Record<string, number>;
  };
  recent: {
    organizations: Array<{
      id: number;
      name: string;
      slug: string;
      createdAt: string;
    }>;
    users: Array<{
      id: number;
      email: string;
      firstName: string;
      lastName: string;
      createdAt: string;
      organization?: { name: string };
    }>;
  };
}

export interface OrganizationFilters {
  search?: string;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

export interface UserFilters {
  search?: string;
  organizationId?: number;
  role?: string;
  isActive?: boolean;
  isSuperAdmin?: boolean;
  page?: number;
  limit?: number;
}

// ==================== SERVICE ====================

@Injectable({
  providedIn: 'root'
})
export class SuperAdminService {
  private readonly API_URL = `${environment.apiBaseUrl}/super-admin`;
  private readonly http = inject(HttpClient);

  // ==================== ORGANIZATION METHODS ====================

  /**
   * List all organizations with pagination and filters
   */
  listOrganizations(filters?: OrganizationFilters): Observable<PaginatedOrganizations> {
    const params: Record<string, string> = {};

    if (filters?.search) params['search'] = filters.search;
    if (filters?.isActive !== undefined) params['isActive'] = String(filters.isActive);
    if (filters?.page) params['page'] = String(filters.page);
    if (filters?.limit) params['limit'] = String(filters.limit);

    return this.http.get<PaginatedOrganizations>(`${this.API_URL}/organizations`, { params });
  }

  /**
   * Get a single organization with users
   */
  getOrganization(id: number): Observable<OrganizationWithUsers> {
    return this.http.get<OrganizationWithUsers>(`${this.API_URL}/organizations/${id}`);
  }

  /**
   * Create a new organization
   */
  createOrganization(data: CreateOrganizationRequest): Observable<OrganizationWithCounts> {
    return this.http.post<OrganizationWithCounts>(`${this.API_URL}/organizations`, data);
  }

  /**
   * Update an organization
   */
  updateOrganization(id: number, data: UpdateOrganizationRequest): Observable<OrganizationWithCounts> {
    return this.http.put<OrganizationWithCounts>(`${this.API_URL}/organizations/${id}`, data);
  }

  /**
   * Delete an organization
   */
  deleteOrganization(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/organizations/${id}`);
  }

  // ==================== USER METHODS ====================

  /**
   * List all users with pagination and filters
   */
  listUsers(filters?: UserFilters): Observable<PaginatedUsers> {
    const params: Record<string, string> = {};

    if (filters?.search) params['search'] = filters.search;
    if (filters?.organizationId !== undefined) params['organizationId'] = String(filters.organizationId);
    if (filters?.role) params['role'] = filters.role;
    if (filters?.isActive !== undefined) params['isActive'] = String(filters.isActive);
    if (filters?.isSuperAdmin !== undefined) params['isSuperAdmin'] = String(filters.isSuperAdmin);
    if (filters?.page) params['page'] = String(filters.page);
    if (filters?.limit) params['limit'] = String(filters.limit);

    return this.http.get<PaginatedUsers>(`${this.API_URL}/users`, { params });
  }

  /**
   * Get a single user
   */
  getUser(id: number): Observable<User> {
    return this.http.get<User>(`${this.API_URL}/users/${id}`);
  }

  /**
   * Create a new user
   */
  createUser(data: CreateUserRequest): Observable<User> {
    return this.http.post<User>(`${this.API_URL}/users`, data);
  }

  /**
   * Update a user
   */
  updateUser(id: number, data: UpdateUserRequest): Observable<User> {
    return this.http.put<User>(`${this.API_URL}/users/${id}`, data);
  }

  /**
   * Delete a user
   */
  deleteUser(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(`${this.API_URL}/users/${id}`);
  }

  // ==================== STATS METHOD ====================

  /**
   * Get system-wide statistics
   */
  getStats(): Observable<SuperAdminStats> {
    return this.http.get<SuperAdminStats>(`${this.API_URL}/stats`);
  }
}
