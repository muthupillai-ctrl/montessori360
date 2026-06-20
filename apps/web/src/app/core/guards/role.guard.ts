import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { RoleService, AppRole } from '../services/role.service';

/**
 * Usage in routes:
 *   canActivate: [roleGuard],
 *   data: { roles: ['owner', 'principal'] as AppRole[] }
 */
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const roles  = inject(RoleService);
  const router = inject(Router);

  const allowed = (route.data?.['roles'] ?? []) as AppRole[];

  if (allowed.length === 0) return true;          // no restriction defined

  if (roles.hasPermission(allowed)) return true;

  // Redirect to default route for their role rather than a generic 403 page
  router.navigate([roles.defaultRoute()]);
  return false;
};
