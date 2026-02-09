import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Only add auth headers to our own API requests, not external APIs like Wikipedia
  const isOwnApi = req.url.startsWith(environment.apiBaseUrl) ||
                   req.url.startsWith('/api') ||
                   req.url.startsWith('http://localhost');

  if (!isOwnApi) {
    return next(req);
  }

  const authService = inject(AuthService);
  const token = authService.getToken();

  // Clone the request and add the authorization header if token exists
  if (token) {
    const clonedRequest = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
    return next(clonedRequest);
  }

  return next(req);
};
