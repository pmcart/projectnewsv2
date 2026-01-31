import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const superAdminGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Check if logged in and is super-admin
  if (authService.isLoggedIn() && authService.isSuperAdmin()) {
    return true;
  }

  // If logged in but not super-admin, redirect to regular admin dashboard
  if (authService.isLoggedIn()) {
    return router.createUrlTree(['/admin/dashboard']);
  }

  // Not logged in, redirect to login
  return router.createUrlTree(['/login']);
};
