import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { AuthService, User } from '../../services/auth.service';

type MenuItem = {
  label: string;
  icon: string;
  link: string;
};

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './admin-layout.html'
})
export class AdminLayoutComponent {
  menuItems: MenuItem[] = [
    { label: 'Overview', icon: '', link: '/admin/dashboard' },
    { label: 'Breaking news', icon: '', link: '/admin/breaking-news' },
    // add more when you have components:
     { label: 'News Feed', icon: '', link: '/admin/news-feed' }
    // add more when you have components:
    // { label: 'Articles', icon: '📰', link: '/admin/articles' },
    // { label: 'Users', icon: '👥', link: '/admin/users' },
    // { label: 'Settings', icon: '⚙️', link: '/admin/settings' }
  ];

  currentTitle = 'Overview';
  currentSubtitle = 'High-level summary and quick actions.';
  currentUser: User | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authService: AuthService
  ) {
    this.currentUser = this.authService.getCurrentUser();
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
        this.currentTitle = r.snapshot.data['title'] ?? 'Admin';
        this.currentSubtitle =
          r.snapshot.data['subtitle'] ?? 'High-level summary and quick actions.';
      });
  }

  logout() {
    this.authService.logout();
  }
}
