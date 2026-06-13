import { Request, Response } from 'express';
import { transportService } from './transport.service.js';
import type {
  CreateVehicleDto, CreateRouteDto, AssignStudentDto,
  StartTripDto, UpdateLocationDto, MarkBoardingDto,
} from './transport.types.js';

// ── Vehicles ──────────────────────────────────────────────────────────────────

export async function listVehicles(req: Request, res: Response): Promise<void> {
  const rows = await transportService.listVehicles(req.user!.tenantSchema);
  res.json({ data: rows });
}

export async function createVehicle(req: Request, res: Response): Promise<void> {
  const row = await transportService.createVehicle(req.user!.tenantSchema, req.body as CreateVehicleDto);
  res.status(201).json({ data: row, message: 'Vehicle registered successfully' });
}

export async function updateVehicle(req: Request, res: Response): Promise<void> {
  const row = await transportService.updateVehicle(req.user!.tenantSchema, req.params.id, req.body);
  res.json({ data: row, message: 'Vehicle updated successfully' });
}

export async function getExpiryAlerts(req: Request, res: Response): Promise<void> {
  const rows = await transportService.getExpiryAlerts(req.user!.tenantSchema);
  res.json({ data: rows });
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function listRoutes(req: Request, res: Response): Promise<void> {
  const rows = await transportService.listRoutes(req.user!.tenantSchema);
  res.json({ data: rows });
}

export async function getRoute(req: Request, res: Response): Promise<void> {
  const row = await transportService.getRoute(req.user!.tenantSchema, req.params.id);
  res.json({ data: row });
}

export async function createRoute(req: Request, res: Response): Promise<void> {
  const row = await transportService.createRoute(
    req.user!.tenantSchema, req.body as CreateRouteDto, req.user!.sub
  );
  res.status(201).json({ data: row, message: 'Route created successfully' });
}

export async function updateRoute(req: Request, res: Response): Promise<void> {
  const row = await transportService.updateRoute(req.user!.tenantSchema, req.params.id, req.body);
  res.json({ data: row, message: 'Route updated successfully' });
}

// ── Route students ────────────────────────────────────────────────────────────

export async function getRouteStudents(req: Request, res: Response): Promise<void> {
  const rows = await transportService.getRouteStudents(req.user!.tenantSchema, req.params.id);
  res.json({ data: rows });
}

export async function assignStudent(req: Request, res: Response): Promise<void> {
  const row = await transportService.assignStudent(
    req.user!.tenantSchema, req.params.id, req.body as AssignStudentDto
  );
  res.status(201).json({ data: row, message: 'Student assigned to route' });
}

export async function removeStudent(req: Request, res: Response): Promise<void> {
  await transportService.removeStudent(req.user!.tenantSchema, req.params.id, req.params.studentId);
  res.json({ message: 'Student removed from route' });
}

// ── Trips ─────────────────────────────────────────────────────────────────────

export async function listTrips(req: Request, res: Response): Promise<void> {
  const { route_id, date } = req.query as { route_id?: string; date?: string };
  const rows = await transportService.listTrips(req.user!.tenantSchema, route_id, date);
  res.json({ data: rows });
}

export async function startTrip(req: Request, res: Response): Promise<void> {
  const row = await transportService.startTrip(
    req.user!.tenantSchema, req.params.routeId, req.body as StartTripDto, req.user!.sub
  );
  res.status(201).json({ data: row, message: 'Trip started' });
}

export async function completeTrip(req: Request, res: Response): Promise<void> {
  const row = await transportService.completeTrip(req.user!.tenantSchema, req.params.id);
  res.json({ data: row, message: 'Trip completed' });
}

export async function cancelTrip(req: Request, res: Response): Promise<void> {
  const row = await transportService.cancelTrip(req.user!.tenantSchema, req.params.id);
  res.json({ data: row, message: 'Trip cancelled' });
}

// ── Live GPS ──────────────────────────────────────────────────────────────────

export async function updateLocation(req: Request, res: Response): Promise<void> {
  const { routeId, tripId } = req.params;
  await transportService.updateLocation(
    req.user!.tenantSchema, routeId, tripId, req.body as UpdateLocationDto
  );
  res.json({ message: 'Location updated' });
}

export async function getLiveLocation(req: Request, res: Response): Promise<void> {
  const location = await transportService.getLiveLocation(req.user!.tenantSchema, req.params.routeId);
  if (!location) {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'No live location available for this route' } });
    return;
  }
  res.json({ data: location });
}

export async function getLocationHistory(req: Request, res: Response): Promise<void> {
  const rows = await transportService.getLocationHistory(req.user!.tenantSchema, req.params.tripId);
  res.json({ data: rows });
}

// ── Boarding ──────────────────────────────────────────────────────────────────

export async function markBoarding(req: Request, res: Response): Promise<void> {
  await transportService.markBoarding(req.user!.tenantSchema, req.params.tripId, req.body as MarkBoardingDto);
  res.json({ message: `Student ${req.body.boarded ? 'boarded' : 'unboarded'}` });
}

export async function getTripBoardings(req: Request, res: Response): Promise<void> {
  const rows = await transportService.getTripBoardings(req.user!.tenantSchema, req.params.tripId);
  res.json({ data: rows });
}
