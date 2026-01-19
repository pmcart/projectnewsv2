import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter, map } from 'rxjs/operators';
import { AuthService, User } from '../../services/auth.service';
import { LucideAngularModule, TrendingUp, Bell, Newspaper, ClipboardCheck, Building2, Tv } from 'lucide-angular';

type MenuItem = {
  label: string;
  icon: string;
  link: string;
};

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  templateUrl: './admin-layout.html'
})
export class AdminLayoutComponent {
  readonly TrendingUp = TrendingUp;
  readonly Bell = Bell;
  readonly Newspaper = Newspaper;
  readonly ClipboardCheck = ClipboardCheck;
  readonly Building2 = Building2;
  readonly Tv = Tv;

  menuItems: MenuItem[] = [
    { label: 'Overview', icon: 'trending-up', link: '/admin/dashboard' },
    { label: 'Breaking news', icon: 'bell', link: '/admin/breaking-news' },
    { label: 'News Feed', icon: 'newspaper', link: '/admin/news-feed' },
    { label: 'Live Streams', icon: 'tv', link: '/admin/live-streams' },
    { label: 'Content Review', icon: 'clipboard-check', link: '/admin/content-review' }
    // add more when you have components:
    // { label: 'Articles', icon: 'file-lines', link: '/admin/articles' },
    // { label: 'Users', icon: 'users', link: '/admin/users' },
    // { label: 'Settings', icon: 'settings', link: '/admin/settings' }
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
