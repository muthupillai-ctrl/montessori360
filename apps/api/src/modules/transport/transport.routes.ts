import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import {
  validateCreateVehicle, validateCreateRoute, validateAssignStudent,
  validateStartTrip, validateUpdateLocation, validateMarkBoarding,
} from './transport.validators.js';
import {
  listVehicles, createVehicle, updateVehicle, getExpiryAlerts,
  listRoutes, getRoute, createRoute, updateRoute,
  getRouteStudents, assignStudent, removeStudent,
  listTrips, startTrip, completeTrip, cancelTrip,
  updateLocation, getLiveLocation, getLocationHistory,
  markBoarding, getTripBoardings,
} from './transport.controller.js';

export const transportRouter = Router();
transportRouter.use(authenticate);

const ADMIN_ROLES  = ['owner', 'principal'];
const MANAGE_ROLES = ['owner', 'principal', 'driver'];
const VIEW_ROLES   = ['owner', 'principal', 'teacher', 'assistant_teacher', 'parent', 'driver'];

// ── Vehicles ───────────────────────────────────────────────────────────────────
transportRouter.get( '/vehicles',               authorize(...ADMIN_ROLES),  listVehicles);
transportRouter.post('/vehicles',               authorize(...ADMIN_ROLES),  validateCreateVehicle, createVehicle);
transportRouter.put( '/vehicles/:id',           authorize(...ADMIN_ROLES),  updateVehicle);
transportRouter.get( '/vehicles/expiry-alerts', authorize(...ADMIN_ROLES),  getExpiryAlerts);

// ── Routes ─────────────────────────────────────────────────────────────────────
transportRouter.get( '/routes',                 authorize(...VIEW_ROLES),   listRoutes);
transportRouter.post('/routes',                 authorize(...ADMIN_ROLES),  validateCreateRoute, createRoute);
transportRouter.get( '/routes/:id',             authorize(...VIEW_ROLES),   getRoute);
transportRouter.put( '/routes/:id',             authorize(...ADMIN_ROLES),  updateRoute);

// ── Route students ─────────────────────────────────────────────────────────────
transportRouter.get(   '/routes/:id/students',              authorize(...VIEW_ROLES),   getRouteStudents);
transportRouter.post(  '/routes/:id/students',              authorize(...ADMIN_ROLES),  validateAssignStudent, assignStudent);
transportRouter.delete('/routes/:id/students/:studentId',   authorize(...ADMIN_ROLES),  removeStudent);

// ── Trips ──────────────────────────────────────────────────────────────────────
transportRouter.get(   '/trips',                authorize(...VIEW_ROLES),   listTrips);
transportRouter.post(  '/routes/:routeId/trips',authorize(...MANAGE_ROLES), validateStartTrip, startTrip);
transportRouter.patch( '/trips/:id/complete',   authorize(...MANAGE_ROLES), completeTrip);
transportRouter.patch( '/trips/:id/cancel',     authorize(...ADMIN_ROLES),  cancelTrip);

// ── GPS Location ───────────────────────────────────────────────────────────────
transportRouter.post('/routes/:routeId/trips/:tripId/location', authorize(...MANAGE_ROLES), validateUpdateLocation, updateLocation);
transportRouter.get( '/routes/:routeId/location',               authorize(...VIEW_ROLES),   getLiveLocation);
transportRouter.get( '/trips/:tripId/location-history',         authorize(...ADMIN_ROLES),  getLocationHistory);

// ── Boarding ───────────────────────────────────────────────────────────────────
transportRouter.post('/trips/:tripId/boarding',  authorize(...MANAGE_ROLES), validateMarkBoarding, markBoarding);
transportRouter.get( '/trips/:tripId/boarding',  authorize(...VIEW_ROLES),   getTripBoardings);
