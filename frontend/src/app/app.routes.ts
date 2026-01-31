import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { AdminLayoutComponent } from './pages/admin-layout/admin-layout';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard';
import { BreakingNewsComponent } from './pages/breaking-news/breaking-news';
import { RssFeedComponent } from './pages/news-feed/rss-feed';
import { NewContentComponent } from './pages/new-content/new-content';
import { NewVideoComponent } from './pages/new-video/new-video';
import { ContentReviewComponent } from './pages/content-review/content-review';
import { LiveStreamsComponent } from './pages/live-streams/live-streams';
import { AlertsComponent } from './pages/alerts/alerts';
import { authGuard } from './guards/auth.guard';
import { superAdminGuard } from './guards/super-admin.guard';
import { SuperAdminLayoutComponent } from './pages/super-admin/super-admin-layout/super-admin-layout';
import { SuperAdminDashboardComponent } from './pages/super-admin/dashboard/dashboard';
import { OrganizationsComponent } from './pages/super-admin/organizations/organizations';
import { UsersComponent } from './pages/super-admin/users/users';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },

  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

      {
        path: 'dashboard',
        component: AdminDashboardComponent,
        data: {
          title: 'Overview',
          subtitle: 'High-level summary and quick actions.'
        }
      },
      {
        path: 'breaking-news',
        component: BreakingNewsComponent,
        data: {
          title: 'Breaking news',
          subtitle: 'Manage live breaking stories.'
        }
      },
      {
        path: 'news-feed',
        component: RssFeedComponent,
        data: {
          title: 'News feeds',
          subtitle: 'Browse News feeds by country, category, or topic.'
        }
      },
      {
        path: 'new-content',
        component: NewContentComponent,
        data: {
          title: 'New Content',
          subtitle: 'Create new content from selected items.'
        }
      },
      {
        path: 'new-video',
        component: NewVideoComponent,
        data: {
          title: 'New Video',
          subtitle: 'Generate videos from news items.'
        }
      },
      {
        path: 'content-review',
        component: ContentReviewComponent,
        data: {
          title: 'Content Review',
          subtitle: 'Review and manage submitted content.'
        }
      },
      {
        path: 'live-streams',
        component: LiveStreamsComponent,
        data: {
          title: 'Live News Streams',
          subtitle: 'Watch live news from multiple sources around the world.'
        }
      },
      {
        path: 'alerts',
        component: AlertsComponent,
        data: {
          title: 'Alerts',
          subtitle: 'Configure keyword alerts for breaking news notifications.'
        }
      }

      // later:
      // { path: 'articles', component: ArticlesComponent, data: { ... } },
      // { path: 'users', component: UsersComponent, data: { ... } },
      // { path: 'settings', component: SettingsComponent, data: { ... } }
    ]
  },

  {
    path: 'super-admin',
    component: SuperAdminLayoutComponent,
    canActivate: [superAdminGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        component: SuperAdminDashboardComponent,
        data: {
          title: 'Dashboard',
          subtitle: 'System-wide overview and statistics'
        }
      },
      {
        path: 'organizations',
        component: OrganizationsComponent,
        data: {
          title: 'Organizations',
          subtitle: 'Manage all organizations in the system'
        }
      },
      {
        path: 'users',
        component: UsersComponent,
        data: {
          title: 'Users',
          subtitle: 'Manage all users across organizations'
        }
      }
    ]
  },

  { path: '**', redirectTo: 'login' }
];
