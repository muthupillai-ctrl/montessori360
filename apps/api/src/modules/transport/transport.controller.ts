import type { Request, Response } from 'express';
import { transportService } from './transport.service.js';

// Vehicles
export async function listVehicles(req: Request, res: Response)  { res.json({ data: await transportService.listVehicles(req.user!.tenantSchema) }); }
export async function createVehicle(req: Request, res: Response) { res.status(201).json({ data: await transportService.createVehicle(req.user!.tenantSchema, req.body) }); }
export async function updateVehicle(req: Request, res: Response) { res.json({ data: await transportService.updateVehicle(req.user!.tenantSchema, String(req.params.id), req.body) }); }

// Routes
export async function listRoutes(req: Request, res: Response)   { res.json({ data: await transportService.listRoutes(req.user!.tenantSchema) }); }
export async function getRoute(req: Request, res: Response)     { res.json({ data: await transportService.getRoute(req.user!.tenantSchema, String(req.params.id)) }); }
export async function createRoute(req: Request, res: Response)  { res.status(201).json({ data: await transportService.createRoute(req.user!.tenantSchema, req.body) }); }
export async function updateRoute(req: Request, res: Response)  { res.json({ data: await transportService.updateRoute(req.user!.tenantSchema, String(req.params.id), req.body) }); }

// Stops
export async function createStop(req: Request, res: Response)   { res.status(201).json({ data: await transportService.upsertStop(req.user!.tenantSchema, String(req.params.routeId), req.body) }); }
export async function updateStop(req: Request, res: Response)   { res.json({ data: await transportService.upsertStop(req.user!.tenantSchema, String(req.params.routeId), req.body, String(req.params.stopId)) }); }
export async function deleteStop(req: Request, res: Response)   { await transportService.deleteStop(req.user!.tenantSchema, String(req.params.routeId), String(req.params.stopId)); res.json({ message: 'Stop deleted' }); }

// Students
export async function assignStudent(req: Request, res: Response)  { res.status(201).json({ data: await transportService.assignStudent(req.user!.tenantSchema, req.body) }); }
export async function removeStudent(req: Request, res: Response)  { await transportService.removeStudent(req.user!.tenantSchema, String(req.params.studentId)); res.json({ message: 'Student removed from route' }); }
export async function getUnassigned(req: Request, res: Response)  { res.json({ data: await transportService.getUnassignedStudents(req.user!.tenantSchema) }); }

// Trips
export async function listTrips(req: Request, res: Response)   { res.json({ data: await transportService.listTrips(req.user!.tenantSchema, req.query) }); }
export async function getTripDetail(req: Request, res: Response){ res.json({ data: await transportService.getTripDetail(req.user!.tenantSchema, String(req.params.id)) }); }
export async function startTrip(req: Request, res: Response)   { res.status(201).json({ data: await transportService.startTrip(req.user!.tenantSchema, req.body) }); }
export async function markBoarding(req: Request, res: Response) {
  const { student_id, boarded } = req.body;
  res.json({ data: await transportService.markBoarding(req.user!.tenantSchema, String(req.params.id), student_id, boarded) });
}
export async function completeTrip(req: Request, res: Response){ res.json({ data: await transportService.completeTrip(req.user!.tenantSchema, String(req.params.id)) }); }

// Dashboard
export async function getTransportDashboard(req: Request, res: Response) { res.json({ data: await transportService.getDashboard(req.user!.tenantSchema) }); }

export async function getStudentTransport(req: Request, res: Response): Promise<void> {
  const schema = req.user!.tenantSchema;
  const { studentId } = req.params;
  const data = await transportService.getStudentTransport(schema, String(studentId));
  res.json({ data });
}

export async function updateTripDriver(req: Request, res: Response): Promise<void> {
  const { driver_id } = req.body;
  const data = await transportService.updateTripDriver(
    req.user!.tenantSchema, String(req.params.id), driver_id ?? null
  );
  res.json({ data });
}

export async function markDropped(req: Request, res: Response): Promise<void> {
  const { student_id, dropped } = req.body;
  const data = await transportService.markDropped(
    req.user!.tenantSchema, String(req.params.id), student_id, dropped
  );
  res.json({ data });
}

export async function getTripReport(req: Request, res: Response): Promise<void> {
  const data = await transportService.getTripReport(req.user!.tenantSchema, req.query);
  res.json({ data });
}

export async function getStudentTransportReport(req: Request, res: Response): Promise<void> {
  const data = await transportService.getStudentTransportReport(req.user!.tenantSchema);
  res.json({ data });
}

export async function getDriverSchedule(req: Request, res: Response): Promise<void> {
  const driverId = req.user!.sub;
  const date     = (req.query.date as string) || new Date().toISOString().slice(0, 10);
  const data = await transportService.getDriverSchedule(req.user!.tenantSchema, driverId, date);
  res.json({ data });
}
