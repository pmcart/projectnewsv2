import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { AuthService, User } from '../../../services/auth.service';
import { LucideAngularModule, Building2, Users, LayoutDashboard, ArrowLeft, Shield, LogOut } from 'lucide-angular';

interface MenuItem {
  label: string;
  icon: 'dashboard' | 'building' | 'users';
  link: string;
}

@Component({
  selector: 'app-super-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  templateUrl: './super-admin-layout.html'
})
export class SuperAdminLayoutComponent {
  // Icons
  readonly Building2 = Building2;
  readonly Users = Users;
  readonly LayoutDashboard = LayoutDashboard;
  readonly ArrowLeft = ArrowLeft;
  readonly Shield = Shield;
  readonly LogOut = LogOut;

  menuItems: MenuItem[] = [
    { label: 'Dashboard', icon: 'dashboard', link: '/super-admin/dashboard' },
    { label: 'Organizations', icon: 'building', link: '/super-admin/organizations' },
    { label: 'Users', icon: 'users', link: '/super-admin/users' }
  ];

  currentTitle = 'Super Admin';
  currentSubtitle = 'System-wide management';
  currentUser: User | null = null;

  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  constructor() {
    this.currentUser = this.authService.getCurrentUser();

    // Subscribe to route changes to update title/subtitle
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        map(() => {
          let child = this.route.firstChild;
          while (child?.firstChild) {
            child = child.firstChild;
          }
          return child;
        }),
        filter((r): r is ActivatedRoute => !!r)
      )
      .subscribe((r) => {
        this.currentTitle = r.snapshot.data['title'] ?? 'Super Admin';
        this.currentSubtitle = r.snapshot.data['subtitle'] ?? 'System-wide management';
      });
  }

  goBackToAdmin(): void {
    this.router.navigate(['/admin/dashboard']);
  }

  logout(): void {
    this.authService.logout();
  }
}
