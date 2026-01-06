import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login';
import { AdminLayoutComponent } from './pages/admin-layout/admin-layout';
import { BreakingNewsComponent } from './pages/breaking-news/breaking-news';
import { RssFeedComponent } from './pages/news-feed/rss-feed';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: 'login', component: LoginComponent },

  {
    path: 'admin',
    component: AdminLayoutComponent,
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
      }

      // later:
      // { path: 'articles', component: ArticlesComponent, data: { ... } },
      // { path: 'users', component: UsersComponent, data: { ... } },
      // { path: 'settings', component: SettingsComponent, data: { ... } }
    ]
  },

  { path: '**', redirectTo: 'login' }
];
