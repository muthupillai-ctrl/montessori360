import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

const isoDate  = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');
const timeHHMM = z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM');

const waypointSchema = z.object({
  stop_no:      z.number().int().min(1),
  name:         z.string().min(1).max(100),
  lat:          z.number().min(-90).max(90).optional().nullable(),
  lng:          z.number().min(-180).max(180).optional().nullable(),
  pickup_time:  timeHHMM.optional().nullable(),
  dropoff_time: timeHHMM.optional().nullable(),
});

export const createVehicleSchema = z.object({
  registration_no:   z.string().min(1).max(20),
  vehicle_type:      z.enum(['bus','van','auto','car','other']),
  make:              z.string().max(50).optional(),
  model:             z.string().max(50).optional(),
  capacity:          z.number().int().min(1).max(100),
  fitness_expiry:    isoDate.optional(),
  insurance_expiry:  isoDate.optional(),
});

export const createRouteSchema = z.object({
  name:             z.string().min(1).max(100),
  description:      z.string().max(500).optional(),
  vehicle_id:       z.string().uuid().optional(),
  driver_id:        z.string().uuid().optional(),
  waypoints:        z.array(waypointSchema).min(1, 'At least one waypoint required'),
  morning_start:    timeHHMM.optional(),
  afternoon_start:  timeHHMM.optional(),
});

export const assignStudentSchema = z.object({
  student_id: z.string().uuid(),
  stop_no:    z.number().int().min(1),
});

export const startTripSchema = z.object({
  direction:   z.enum(['pickup','dropoff']),
  vehicle_id:  z.string().uuid().optional(),
  driver_id:   z.string().uuid().optional(),
  notes:       z.string().max(300).optional(),
});

export const updateLocationSchema = z.object({
  lat:     z.number().min(-90).max(90),
  lng:     z.number().min(-180).max(180),
  speed:   z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
});

export const markBoardingSchema = z.object({
  student_id: z.string().uuid(),
  boarded:    z.boolean(),
});

function validateBody(schema: z.ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: result.error.flatten().fieldErrors },
      });
      return;
    }
    req.body = result.data;
    next();
  };
}

export const validateCreateVehicle  = validateBody(createVehicleSchema);
export const validateCreateRoute    = validateBody(createRouteSchema);
export const validateAssignStudent  = validateBody(assignStudentSchema);
export const validateStartTrip      = validateBody(startTripSchema);
export const validateUpdateLocation = validateBody(updateLocationSchema);
export const validateMarkBoarding   = validateBody(markBoardingSchema);
