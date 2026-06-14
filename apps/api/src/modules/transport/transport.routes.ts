import { Router } from 'express';
import { authenticate, authorize } from '../../middleware/auth.js';
import {
  listVehicles, createVehicle, updateVehicle,
  listRoutes, getRoute, createRoute, updateRoute,
  createStop, updateStop, deleteStop,
  assignStudent, removeStudent, getUnassigned,
  listTrips, getTripDetail, startTrip, markBoarding, markDropped, completeTrip,
  getTransportDashboard, getStudentTransport, updateTripDriver,
  getTripReport, getStudentTransportReport, getDriverSchedule,
} from './transport.controller.js';

export const transportRouter = Router();
transportRouter.use(authenticate);

const ADMIN       = ['owner', 'principal'];
const ADMIN_ADMISSION = ['owner', 'principal', 'admission_staff'];
const BOARD_ROLES = ['owner', 'principal', 'driver', 'support'];
const ALL_STAFF   = ['owner', 'principal', 'teacher', 'assistant_teacher', 'accountant', 'admission_staff', 'driver', 'support'];

// Driver schedule
transportRouter.get('/driver/schedule', authorize(...BOARD_ROLES), getDriverSchedule);

// Reports
transportRouter.get('/reports/trips',    authorize(...ALL_STAFF), getTripReport);
transportRouter.get('/reports/students', authorize(...ALL_STAFF), getStudentTransportReport);

// Dashboard
transportRouter.get('/dashboard', authorize(...ALL_STAFF), getTransportDashboard);

// Vehicles — admin manage, all staff view
transportRouter.get('/vehicles',     authorize(...ALL_STAFF), listVehicles);
transportRouter.post('/vehicles',    authorize(...ADMIN),     createVehicle);
transportRouter.put('/vehicles/:id', authorize(...ADMIN),     updateVehicle);

// Routes — admin manage, all staff view
transportRouter.get('/routes',         authorize(...ALL_STAFF), listRoutes);
transportRouter.get('/routes/:id',     authorize(...ALL_STAFF), getRoute);
transportRouter.post('/routes',        authorize(...ADMIN),     createRoute);
transportRouter.put('/routes/:id',     authorize(...ADMIN),     updateRoute);

// Stops — admin manage
transportRouter.post('/routes/:routeId/stops',           authorize(...ADMIN), createStop);
transportRouter.put('/routes/:routeId/stops/:stopId',    authorize(...ADMIN), updateStop);
transportRouter.delete('/routes/:routeId/stops/:stopId', authorize(...ADMIN), deleteStop);

// Student assignments — admin + admission_staff can assign
transportRouter.get('/students/unassigned',        authorize(...ADMIN_ADMISSION), getUnassigned);
transportRouter.get('/students/:studentId',        authorize(...ALL_STAFF),       getStudentTransport);
transportRouter.post('/students/assign',           authorize(...ADMIN_ADMISSION), assignStudent);
transportRouter.delete('/students/:studentId',     authorize(...ADMIN_ADMISSION), removeStudent);

// Trips — admin starts/completes, driver + all staff can mark boarding
transportRouter.get('/trips',               authorize(...ALL_STAFF), listTrips);
transportRouter.get('/trips/:id',           authorize(...ALL_STAFF), getTripDetail);
transportRouter.post('/trips',              authorize(...ADMIN),     startTrip);
transportRouter.post('/trips/:id/board',     authorize(...BOARD_ROLES), markBoarding);
transportRouter.post('/trips/:id/drop',      authorize(...BOARD_ROLES), markDropped);
transportRouter.patch('/trips/:id/driver',   authorize(...ADMIN),       updateTripDriver);
transportRouter.patch('/trips/:id/complete', authorize(...BOARD_ROLES), completeTrip);
