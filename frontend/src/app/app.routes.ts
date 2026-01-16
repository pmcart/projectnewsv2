import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { AdminLayoutComponent } from './pages/admin-layout/admin-layout';
import { BreakingNewsComponent } from './pages/breaking-news/breaking-news';
import { RssFeedComponent } from './pages/news-feed/rss-feed';
import { NewContentComponent } from './pages/new-content/new-content';
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
      }

      // later:
      // { path: 'articles', component: ArticlesComponent, data: { ... } },
      // { path: 'users', component: UsersComponent, data: { ... } },
      // { path: 'settings', component: SettingsComponent, data: { ... } }
    ]
  },

  { path: '**', redirectTo: 'login' }
];
