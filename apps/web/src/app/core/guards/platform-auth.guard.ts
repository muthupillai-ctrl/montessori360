import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { PlatformAuthService } from '../services/platform-auth.service';

export const platformAuthGuard: CanActivateFn = () => {
  const auth   = inject(PlatformAuthService);
  const router = inject(Router);
  if (auth.isLoggedIn()) return true;
  return router.createUrlTree(['/platform/login']);
};
