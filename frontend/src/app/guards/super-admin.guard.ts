import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const superAdminGuard = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    authService.logout();
    return router.createUrlTree(['/login']);
  }

  // isSuperAdmin() now reads from signed JWT claims, not the editable localStorage user object
  if (authService.isSuperAdmin()) {
    return true;
  }

  // Logged in but not super-admin
  return router.createUrlTree(['/admin/dashboard']);
};
