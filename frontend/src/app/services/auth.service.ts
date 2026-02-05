import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface Organization {
  id: number;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: 'READER' | 'WRITER' | 'EDITOR';
  isSuperAdmin: boolean;
  isActive: boolean;
  organizationId?: number;
  organization?: Organization;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  message: string;
  user: User;
  token: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: 'READER' | 'WRITER' | 'EDITOR';
  organizationId?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly API_URL = `${environment.apiBaseUrl}/auth`;
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'auth_user';

  private currentUserSubject = new BehaviorSubject<User | null>(this.getUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient, private router: Router) {}

  /**
   * Login with email and password
   */
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/login`, {
      email,
      password
    }).pipe(
      tap(response => {
        this.setSession(response.token, response.user);
      })
    );
  }

  /**
   * Register a new user
   */
  register(data: RegisterData): Observable<{ message: string; user: User }> {
    return this.http.post<{ message: string; user: User }>(`${this.API_URL}/register`, data);
  }

  /**
   * Logout user
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
    this.router.navigate(['/login']);
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Check if user is logged in (token exists and is not expired)
   */
  isLoggedIn(): boolean {
    const token = this.getToken();
    if (!token) return false;
    return !this.isTokenExpired(token);
  }

  /**
   * Get stored token
   */
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  /**
   * Get authorization headers
   */
  getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  /**
   * Verify token is still valid
   */
  verifyToken(): Observable<{ valid: boolean; user: any }> {
    return this.http.get<{ valid: boolean; user: any }>(
      `${this.API_URL}/verify`,
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Get user profile
   */
  getProfile(): Observable<{ user: User }> {
    return this.http.get<{ user: User }>(
      `${this.API_URL}/me`,
      { headers: this.getAuthHeaders() }
    );
  }

  /**
   * Check if user has required role
   */
  hasRole(role: 'READER' | 'WRITER' | 'EDITOR'): boolean {
    const user = this.getCurrentUser();
    if (!user) return false;

    const roleHierarchy = { READER: 1, WRITER: 2, EDITOR: 3 };
    return roleHierarchy[user.role] >= roleHierarchy[role];
  }

  /**
   * Check if user is a super-admin using JWT claims (not the editable localStorage user object)
   */
  isSuperAdmin(): boolean {
    const token = this.getToken();
    if (!token) return false;
    const claims = this.decodeToken(token);
    return claims?.isSuperAdmin === true;
  }

  /**
   * Private: Set session data
   */
  private setSession(token: string, user: User): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    this.currentUserSubject.next(user);
  }

  /**
   * Decode JWT payload without verification (verification is done server-side)
   */
  private decodeToken(token: string): any {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload));
    } catch {
      return null;
    }
  }

  /**
   * Check if a JWT token is expired
   */
  private isTokenExpired(token: string): boolean {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) return true;
    return decoded.exp * 1000 < Date.now();
  }

  /**
   * Private: Get user from localStorage
   */
  private getUserFromStorage(): User | null {
    const userJson = localStorage.getItem(this.USER_KEY);
    if (!userJson) return null;

    try {
      return JSON.parse(userJson);
    } catch {
      return null;
    }
  }
}
