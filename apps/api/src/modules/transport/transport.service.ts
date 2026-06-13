import { tenantQuery, tenantTransaction } from '../../config/database.js';
import { cacheSet, cacheGet, cacheDel, cacheDelPattern } from '../../config/redis.js';
import { AppError } from '../../middleware/errorHandler.js';
import type {
  VehicleRow, RouteRow, RouteStudentRow, TripRow, LiveLocationRow,
  CreateVehicleDto, CreateRouteDto, AssignStudentDto,
  StartTripDto, UpdateLocationDto, MarkBoardingDto,
} from './transport.types.js';

const CACHE_TTL     = 300;
const LOCATION_TTL  = 30; // 30 seconds for live location

class TransportService {

  // ── Vehicles ──────────────────────────────────────────────────────────────

  async listVehicles(schema: string): Promise<VehicleRow[]> {
    const cacheKey = `${schema}:transport:vehicles`;
    const cached = await cacheGet<VehicleRow[]>(cacheKey);
    if (cached) return cached;

    const rows = await tenantQuery<VehicleRow>(
      schema,
      `SELECT *, fitness_expiry::text, insurance_expiry::text
       FROM ${schema}.vehicles WHERE is_active = true
       ORDER BY registration_no`
    );
    await cacheSet(cacheKey, rows, CACHE_TTL);
    return rows;
  }

  async createVehicle(schema: string, dto: CreateVehicleDto): Promise<VehicleRow> {
    const [existing] = await tenantQuery(
      schema, `SELECT id FROM ${schema}.vehicles WHERE registration_no = $1`, [dto.registration_no.toUpperCase()]
    );
    if (existing) throw AppError.conflict(`Vehicle ${dto.registration_no} already registered`);

    const [row] = await tenantQuery<VehicleRow>(
      schema,
      `INSERT INTO ${schema}.vehicles
         (registration_no, vehicle_type, make, model, capacity, fitness_expiry, insurance_expiry)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *, fitness_expiry::text, insurance_expiry::text`,
      [
        dto.registration_no.toUpperCase(), dto.vehicle_type,
        dto.make ?? null, dto.model ?? null, dto.capacity,
        dto.fitness_expiry ?? null, dto.insurance_expiry ?? null,
      ]
    );
    await cacheDel(`${schema}:transport:vehicles`);
    return row;
  }

  async updateVehicle(schema: string, id: string, dto: Partial<CreateVehicleDto>): Promise<VehicleRow> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    const cols = ['vehicle_type','make','model','capacity','fitness_expiry','insurance_expiry'];
    for (const col of cols) {
      if ((dto as any)[col] !== undefined) {
        fields.push(`${col} = $${i++}`);
        values.push((dto as any)[col]);
      }
    }
    if (!fields.length) throw AppError.badRequest('No fields to update');
    fields.push(`updated_at = now()`);
    values.push(id);

    const [row] = await tenantQuery<VehicleRow>(
      schema,
      `UPDATE ${schema}.vehicles SET ${fields.join(', ')} WHERE id = $${i}
       RETURNING *, fitness_expiry::text, insurance_expiry::text`,
      values
    );
    if (!row) throw AppError.notFound('Vehicle');
    await cacheDel(`${schema}:transport:vehicles`);
    return row;
  }

  // ── Routes ────────────────────────────────────────────────────────────────

  async listRoutes(schema: string): Promise<RouteRow[]> {
    const cacheKey = `${schema}:transport:routes`;
    const cached = await cacheGet<RouteRow[]>(cacheKey);
    if (cached) return cached;

    const rows = await tenantQuery<RouteRow>(
      schema,
      `SELECT r.*,
              v.registration_no                                      AS vehicle_reg,
              CONCAT(s.first_name, ' ', s.last_name)                AS driver_name,
              s.phone                                                AS driver_phone,
              COUNT(rs.id)::int                                      AS student_count
       FROM   ${schema}.transport_routes r
       LEFT JOIN ${schema}.vehicles v ON v.id = r.vehicle_id
       LEFT JOIN ${schema}.staff s    ON s.id = r.driver_id
       LEFT JOIN ${schema}.route_students rs ON rs.route_id = r.id
       WHERE  r.is_active = true
       GROUP  BY r.id, v.registration_no, s.first_name, s.last_name, s.phone
       ORDER  BY r.name`
    );
    await cacheSet(cacheKey, rows, CACHE_TTL);
    return rows;
  }

  async getRoute(schema: string, id: string): Promise<RouteRow> {
    const [row] = await tenantQuery<RouteRow>(
      schema,
      `SELECT r.*,
              v.registration_no AS vehicle_reg,
              CONCAT(s.first_name, ' ', s.last_name) AS driver_name,
              s.phone AS driver_phone,
              COUNT(rs.id)::int AS student_count
       FROM   ${schema}.transport_routes r
       LEFT JOIN ${schema}.vehicles v ON v.id = r.vehicle_id
       LEFT JOIN ${schema}.staff s    ON s.id = r.driver_id
       LEFT JOIN ${schema}.route_students rs ON rs.route_id = r.id
       WHERE  r.id = $1
       GROUP  BY r.id, v.registration_no, s.first_name, s.last_name, s.phone`,
      [id]
    );
    if (!row) throw AppError.notFound('Route');
    return row;
  }

  async createRoute(schema: string, dto: CreateRouteDto, createdBy: string): Promise<RouteRow> {
    // Validate waypoints have sequential stop numbers
    const sorted = [...dto.waypoints].sort((a, b) => a.stop_no - b.stop_no);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].stop_no !== i + 1) {
        throw AppError.badRequest('Waypoint stop_no must be sequential starting from 1');
      }
    }

    const [row] = await tenantQuery<RouteRow>(
      schema,
      `INSERT INTO ${schema}.transport_routes
         (name, description, vehicle_id, driver_id, waypoints, morning_start, afternoon_start)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [
        dto.name, dto.description ?? null,
        dto.vehicle_id ?? null, dto.driver_id ?? null,
        JSON.stringify(dto.waypoints),
        dto.morning_start ?? null, dto.afternoon_start ?? null,
      ]
    );
    await cacheDel(`${schema}:transport:routes`);
    return row;
  }

  async updateRoute(schema: string, id: string, dto: Partial<CreateRouteDto>): Promise<RouteRow> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    const scalarCols = ['name','description','vehicle_id','driver_id','morning_start','afternoon_start'];
    for (const col of scalarCols) {
      if ((dto as any)[col] !== undefined) {
        fields.push(`${col} = $${i++}`);
        values.push((dto as any)[col]);
      }
    }
    if (dto.waypoints !== undefined) {
      fields.push(`waypoints = $${i++}`);
      values.push(JSON.stringify(dto.waypoints));
    }
    if (!fields.length) throw AppError.badRequest('No fields to update');
    fields.push(`updated_at = now()`);
    values.push(id);

    const [row] = await tenantQuery<RouteRow>(
      schema,
      `UPDATE ${schema}.transport_routes SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (!row) throw AppError.notFound('Route');
    await cacheDel(`${schema}:transport:routes`);
    return row;
  }

  // ── Route students ────────────────────────────────────────────────────────

  async getRouteStudents(schema: string, routeId: string): Promise<RouteStudentRow[]> {
    const route = await this.getRoute(schema, routeId);

    return tenantQuery<RouteStudentRow>(
      schema,
      `SELECT rs.*,
              CONCAT(s.first_name, ' ', s.last_name) AS student_name,
              s.admission_no
       FROM   ${schema}.route_students rs
       JOIN   ${schema}.students s ON s.id = rs.student_id
       WHERE  rs.route_id = $1
       ORDER  BY rs.stop_no, s.first_name`,
      [routeId]
    );
  }

  async assignStudent(schema: string, routeId: string, dto: AssignStudentDto): Promise<RouteStudentRow> {
    await this.getRoute(schema, routeId);

    // Validate stop exists on route
    const route = await this.getRoute(schema, routeId);
    const stopExists = (route.waypoints as any[]).some(w => w.stop_no === dto.stop_no);
    if (!stopExists) throw AppError.badRequest(`Stop ${dto.stop_no} does not exist on this route`);

    // Check student not already on a route
    const [existing] = await tenantQuery(
      schema,
      `SELECT id FROM ${schema}.route_students WHERE student_id = $1`,
      [dto.student_id]
    );
    if (existing) throw AppError.conflict('Student is already assigned to a route. Remove them first.');

    const [row] = await tenantQuery<RouteStudentRow>(
      schema,
      `INSERT INTO ${schema}.route_students (route_id, student_id, stop_no)
       VALUES ($1,$2,$3) RETURNING *`,
      [routeId, dto.student_id, dto.stop_no]
    );

    // Update student transport_route_id
    await tenantQuery(
      schema,
      `UPDATE ${schema}.students SET transport_route_id = $1 WHERE id = $2`,
      [routeId, dto.student_id]
    );

    await cacheDel(`${schema}:transport:routes`);
    return row;
  }

  async removeStudent(schema: string, routeId: string, studentId: string): Promise<void> {
    const rows = await tenantQuery(
      schema,
      `DELETE FROM ${schema}.route_students WHERE route_id = $1 AND student_id = $2 RETURNING id`,
      [routeId, studentId]
    );
    if (!rows.length) throw AppError.notFound('Student not found on this route');

    await tenantQuery(
      schema,
      `UPDATE ${schema}.students SET transport_route_id = NULL WHERE id = $1`,
      [studentId]
    );
    await cacheDel(`${schema}:transport:routes`);
  }

  // ── Trips ─────────────────────────────────────────────────────────────────

  async listTrips(schema: string, routeId?: string, date?: string): Promise<TripRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let i = 1;

    if (routeId) { conditions.push(`t.route_id = $${i++}`); params.push(routeId); }
    if (date)    { conditions.push(`t.trip_date = $${i++}`); params.push(date); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    return tenantQuery<TripRow>(
      schema,
      `SELECT t.*, t.trip_date::text,
              r.name AS route_name,
              CONCAT(s.first_name, ' ', s.last_name) AS driver_name,
              v.registration_no AS vehicle_reg
       FROM   ${schema}.trips t
       JOIN   ${schema}.transport_routes r ON r.id = t.route_id
       LEFT JOIN ${schema}.staff s ON s.id = t.driver_id
       LEFT JOIN ${schema}.vehicles v ON v.id = t.vehicle_id
       ${where}
       ORDER  BY t.trip_date DESC, t.created_at DESC`,
      params
    );
  }

  async startTrip(schema: string, routeId: string, dto: StartTripDto, driverId: string): Promise<TripRow> {
    const route = await this.getRoute(schema, routeId);

    // Check no active trip for this route + direction today
    const today = new Date().toISOString().slice(0, 10);
    const [active] = await tenantQuery(
      schema,
      `SELECT id FROM ${schema}.trips
       WHERE route_id = $1 AND trip_date = $2 AND direction = $3 AND status = 'in_progress'`,
      [routeId, today, dto.direction]
    );
    if (active) throw AppError.conflict(`A ${dto.direction} trip is already in progress for this route today`);

    return tenantTransaction(schema, async (client) => {
      const { rows } = await client.query(
        `INSERT INTO ${schema}.trips
           (route_id, trip_date, direction, status, started_at, driver_id, vehicle_id, notes)
         VALUES ($1,$2,$3,'in_progress',now(),$4,$5,$6)
         RETURNING *, trip_date::text`,
        [
          routeId, today, dto.direction,
          dto.driver_id ?? route.driver_id ?? driverId,
          dto.vehicle_id ?? route.vehicle_id ?? null,
          dto.notes ?? null,
        ]
      );
      return rows[0] as TripRow;
    });
  }

  async completeTrip(schema: string, tripId: string): Promise<TripRow> {
    const [row] = await tenantQuery<TripRow>(
      schema,
      `UPDATE ${schema}.trips
       SET status = 'completed', completed_at = now()
       WHERE id = $1 AND status = 'in_progress'
       RETURNING *, trip_date::text`,
      [tripId]
    );
    if (!row) throw AppError.badRequest('Trip not found or not in progress');
    return row;
  }

  async cancelTrip(schema: string, tripId: string): Promise<TripRow> {
    const [row] = await tenantQuery<TripRow>(
      schema,
      `UPDATE ${schema}.trips
       SET status = 'cancelled'
       WHERE id = $1 AND status IN ('scheduled','in_progress')
       RETURNING *, trip_date::text`,
      [tripId]
    );
    if (!row) throw AppError.badRequest('Trip not found or cannot be cancelled');
    return row;
  }

  // ── Live GPS location ─────────────────────────────────────────────────────

  async updateLocation(schema: string, routeId: string, tripId: string, dto: UpdateLocationDto): Promise<void> {
    // Store in Redis for instant reads (30s TTL)
    const liveKey = `${schema}:transport:live:${routeId}`;
    await cacheSet(liveKey, {
      route_id: routeId, trip_id: tripId,
      lat: dto.lat, lng: dto.lng,
      speed: dto.speed ?? null, heading: dto.heading ?? null,
      recorded_at: new Date().toISOString(),
    }, LOCATION_TTL);

    // Also persist to DB for history
    await tenantQuery(
      schema,
      `INSERT INTO ${schema}.trip_locations (trip_id, route_id, lat, lng, speed, heading)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [tripId, routeId, dto.lat, dto.lng, dto.speed ?? null, dto.heading ?? null]
    );
  }

  async getLiveLocation(schema: string, routeId: string): Promise<LiveLocationRow | null> {
    const liveKey = `${schema}:transport:live:${routeId}`;
    return cacheGet<LiveLocationRow>(liveKey);
  }

  async getLocationHistory(schema: string, tripId: string): Promise<LiveLocationRow[]> {
    return tenantQuery<LiveLocationRow>(
      schema,
      `SELECT * FROM ${schema}.trip_locations
       WHERE trip_id = $1 ORDER BY recorded_at ASC`,
      [tripId]
    );
  }

  // ── Student boarding ──────────────────────────────────────────────────────

  async markBoarding(schema: string, tripId: string, dto: MarkBoardingDto): Promise<void> {
    await tenantQuery(
      schema,
      `INSERT INTO ${schema}.trip_boardings (trip_id, student_id, boarded, boarded_at)
       VALUES ($1,$2,$3, CASE WHEN $3 THEN now() ELSE NULL END)
       ON CONFLICT (trip_id, student_id)
       DO UPDATE SET boarded = $3, boarded_at = CASE WHEN $3 THEN now() ELSE NULL END`,
      [tripId, dto.student_id, dto.boarded]
    );
  }

  async getTripBoardings(schema: string, tripId: string): Promise<any[]> {
    return tenantQuery(
      schema,
      `SELECT tb.*, CONCAT(s.first_name, ' ', s.last_name) AS student_name, s.admission_no
       FROM ${schema}.trip_boardings tb
       JOIN ${schema}.students s ON s.id = tb.student_id
       WHERE tb.trip_id = $1
       ORDER BY s.first_name`,
      [tripId]
    );
  }

  // ── Expiry alerts ─────────────────────────────────────────────────────────

  async getExpiryAlerts(schema: string): Promise<any[]> {
    return tenantQuery(
      schema,
      `SELECT id, registration_no, vehicle_type,
              fitness_expiry::text,
              insurance_expiry::text,
              CASE WHEN fitness_expiry  < CURRENT_DATE + 30 THEN 'fitness_due'   ELSE NULL END AS fitness_alert,
              CASE WHEN insurance_expiry < CURRENT_DATE + 30 THEN 'insurance_due' ELSE NULL END AS insurance_alert
       FROM ${schema}.vehicles
       WHERE is_active = true
         AND (fitness_expiry < CURRENT_DATE + 30 OR insurance_expiry < CURRENT_DATE + 30)
       ORDER BY LEAST(fitness_expiry, insurance_expiry)`,
      []
    );
  }
}

export const transportService = new TransportService();
