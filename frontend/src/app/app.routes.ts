import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { AdminLayoutComponent } from './pages/admin-layout/admin-layout';
import { BreakingNewsComponent } from './pages/breaking-news/breaking-news';
import { RssFeedComponent } from './pages/news-feed/rss-feed';
import { NewContentComponent } from './pages/new-content/new-content';
import { ContentReviewComponent } from './pages/content-review/content-review';
import { LiveStreamsComponent } from './pages/live-streams/live-streams';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },

  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },

      // {
      //   path: 'dashboard',
      //   component: AdminDashboardComponent,
      //   data: {
      //     title: 'Overview',
      //     subtitle: 'High-level summary and quick actions.'
      //   }
      // },
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
      }

      // later:
      // { path: 'articles', component: ArticlesComponent, data: { ... } },
      // { path: 'users', component: UsersComponent, data: { ... } },
      // { path: 'settings', component: SettingsComponent, data: { ... } }
    ]
  },

  { path: '**', redirectTo: 'login' }
];
