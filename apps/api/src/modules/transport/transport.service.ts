import { tenantQuery, tenantTransaction } from '../../config/database.js';
import { AppError } from '../../middleware/errorHandler.js';
import type { PoolClient } from 'pg';

class TransportService {

  // ── Vehicles ─────────────────────────────────────────────────────────────

  async listVehicles(schema: string): Promise<any[]> {
    return tenantQuery(schema,
      `SELECT v.*,
              STRING_AGG(DISTINCT r.name, ', ') AS route_name,
              STRING_AGG(DISTINCT CONCAT(s.first_name,' ',s.last_name), ', ')
                FILTER (WHERE s.id IS NOT NULL) AS driver_name
       FROM   ${schema}.vehicles v
       LEFT JOIN ${schema}.transport_routes r ON r.vehicle_id = v.id AND r.is_active = true
       LEFT JOIN ${schema}.staff s ON s.id = r.driver_id
       GROUP  BY v.id
       ORDER  BY v.registration_no`, []
    );
  }

  async getVehicle(schema: string, id: string): Promise<any> {
    const [row] = await tenantQuery<any>(schema,
      `SELECT * FROM ${schema}.vehicles WHERE id = $1`, [id]
    );
    if (!row) throw AppError.notFound('Vehicle');
    return row;
  }

  async createVehicle(schema: string, dto: any): Promise<any> {
    const [row] = await tenantQuery<any>(schema,
      `INSERT INTO ${schema}.vehicles
         (registration_no, vehicle_type, make, model, year, color,
          capacity, fitness_expiry, insurance_expiry, gps_device_id, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        dto.registration_no.toUpperCase(), dto.vehicle_type,
        dto.make ?? null, dto.model ?? null, dto.year ?? null, dto.color ?? null,
        dto.capacity ?? 20, dto.fitness_expiry ?? null, dto.insurance_expiry ?? null,
        dto.gps_device_id ?? null, dto.notes ?? null,
      ]
    );
    return row;
  }

  async updateVehicle(schema: string, id: string, dto: any): Promise<any> {
    const fields: string[] = []; const values: any[] = []; let i = 1;
    const updatable = ['registration_no','vehicle_type','make','model','year','color',
                       'capacity','fitness_expiry','insurance_expiry','gps_device_id','is_active','notes'];
    for (const k of updatable) {
      if (dto[k] !== undefined) { fields.push(`${k} = $${i++}`); values.push(dto[k]); }
    }
    if (!fields.length) throw AppError.badRequest('No fields to update');
    fields.push(`updated_at = now()`); values.push(id);
    const [row] = await tenantQuery<any>(schema,
      `UPDATE ${schema}.vehicles SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values
    );
    return row;
  }

  // ── Routes ────────────────────────────────────────────────────────────────

  async listRoutes(schema: string): Promise<any[]> {
    return tenantQuery(schema,
      `SELECT r.*,
              v.registration_no AS vehicle_reg,
              TRIM(COALESCE(v.make,'') || ' ' || COALESCE(v.model,'')) AS vehicle_name,
              CONCAT(s.first_name,' ',s.last_name) AS driver_name,
              COUNT(DISTINCT rsto.id)::int AS stop_count,
              COUNT(DISTINCT rstu.id) FILTER (WHERE rstu.is_active)::int AS student_count
       FROM   ${schema}.transport_routes r
       LEFT JOIN ${schema}.vehicles v ON v.id = r.vehicle_id
       LEFT JOIN ${schema}.staff s ON s.id = r.driver_id
       LEFT JOIN ${schema}.route_stops rsto ON rsto.route_id = r.id
       LEFT JOIN ${schema}.route_students rstu ON rstu.route_id = r.id
       GROUP  BY r.id, v.registration_no, v.make, v.model, s.first_name, s.last_name
       ORDER  BY r.name`, []
    );
  }

  async getRoute(schema: string, id: string): Promise<any> {
    const [route] = await tenantQuery<any>(schema,
      `SELECT r.*, v.registration_no AS vehicle_reg,
              CONCAT(s.first_name,' ',s.last_name) AS driver_name
       FROM   ${schema}.transport_routes r
       LEFT JOIN ${schema}.vehicles v ON v.id = r.vehicle_id
       LEFT JOIN ${schema}.staff s ON s.id = r.driver_id
       WHERE  r.id = $1`, [id]
    );
    if (!route) throw AppError.notFound('Route');
    const stops = await tenantQuery<any>(schema,
      `SELECT rs.*, COUNT(rstu.id)::int AS student_count
       FROM   ${schema}.route_stops rs
       LEFT JOIN ${schema}.route_students rstu
         ON (rstu.pickup_stop_id = rs.id OR rstu.drop_stop_id = rs.id) AND rstu.is_active = true
       WHERE  rs.route_id = $1
       GROUP  BY rs.id ORDER BY rs.stop_order`, [id]
    );
    const students = await tenantQuery<any>(schema,
      `SELECT rstu.*, CONCAT(s.first_name,' ',s.last_name) AS student_name,
              s.admission_no, c.name AS class_name,
              ps.name AS pickup_stop_name, ps.stop_order AS pickup_order,
              ds.name AS drop_stop_name
       FROM   ${schema}.route_students rstu
       JOIN   ${schema}.students s ON s.id = rstu.student_id
       LEFT JOIN ${schema}.classes c ON c.id = s.class_id
       LEFT JOIN ${schema}.route_stops ps ON ps.id = rstu.pickup_stop_id
       LEFT JOIN ${schema}.route_stops ds ON ds.id = rstu.drop_stop_id
       WHERE  rstu.route_id = $1 AND rstu.is_active = true
       ORDER  BY ps.stop_order, s.first_name`, [id]
    );
    return { ...route, stops, students };
  }

  async createRoute(schema: string, dto: any): Promise<any> {
    const [row] = await tenantQuery<any>(schema,
      `INSERT INTO ${schema}.transport_routes
         (name, route_code, description, vehicle_id, driver_id,
          morning_start, afternoon_start, active_days, monthly_fee, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [dto.name, dto.route_code ?? null, dto.description ?? null,
       dto.vehicle_id ?? null, dto.driver_id ?? null,
       dto.morning_start ?? null, dto.afternoon_start ?? null,
       dto.active_days ?? 'MTWTF', dto.monthly_fee ?? null, dto.notes ?? null]
    );
    return row;
  }

  async updateRoute(schema: string, id: string, dto: any): Promise<any> {
    const fields: string[] = []; const values: any[] = []; let i = 1;
    const updatable = ['name','route_code','description','vehicle_id','driver_id',
                       'morning_start','afternoon_start','active_days','monthly_fee','is_active','notes'];
    for (const k of updatable) {
      if (dto[k] !== undefined) { fields.push(`${k} = $${i++}`); values.push(dto[k]); }
    }
    if (!fields.length) throw AppError.badRequest('No fields to update');
    fields.push(`updated_at = now()`); values.push(id);
    const [row] = await tenantQuery<any>(schema,
      `UPDATE ${schema}.transport_routes SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`, values
    );
    return row;
  }

  // ── Stops ─────────────────────────────────────────────────────────────────

  async upsertStop(schema: string, routeId: string, dto: any, stopId?: string): Promise<any> {
    if (stopId) {
      const [row] = await tenantQuery<any>(schema,
        `UPDATE ${schema}.route_stops SET
           stop_order=$1,name=$2,address=$3,lat=$4,lng=$5,morning_eta=$6,evening_eta=$7
         WHERE id=$8 AND route_id=$9 RETURNING *`,
        [dto.stop_order, dto.name, dto.address ?? null, dto.lat ?? null, dto.lng ?? null,
         dto.morning_eta ?? null, dto.evening_eta ?? null, stopId, routeId]
      );
      return row;
    }
    const [row] = await tenantQuery<any>(schema,
      `INSERT INTO ${schema}.route_stops
         (route_id,stop_order,name,address,lat,lng,morning_eta,evening_eta)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [routeId, dto.stop_order, dto.name, dto.address ?? null,
       dto.lat ?? null, dto.lng ?? null, dto.morning_eta ?? null, dto.evening_eta ?? null]
    );
    return row;
  }

  async deleteStop(schema: string, routeId: string, stopId: string): Promise<void> {
    await tenantQuery(schema,
      `DELETE FROM ${schema}.route_stops WHERE id=$1 AND route_id=$2`, [stopId, routeId]
    );
  }

  // ── Student assignments ───────────────────────────────────────────────────

  async assignStudent(schema: string, dto: any): Promise<any> {
    const [row] = await tenantQuery<any>(schema,
      `INSERT INTO ${schema}.route_students
         (route_id,student_id,stop_no,pickup_stop_id,drop_stop_id,rfid_card_no,notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (student_id) DO UPDATE SET
         route_id=$1, stop_no=$3, pickup_stop_id=$4, drop_stop_id=$5,
         rfid_card_no=$6, notes=$7, is_active=true, updated_at=now()
       RETURNING *`,
      [dto.route_id, dto.student_id, dto.stop_no ?? 1,
       dto.pickup_stop_id ?? null, dto.drop_stop_id ?? null,
       dto.rfid_card_no ?? null, dto.notes ?? null]
    );
    return row;
  }


  async removeStudent(schema: string, studentId: string): Promise<void> {
    await tenantQuery(schema,
      `UPDATE ${schema}.route_students SET is_active=false, updated_at=now()
       WHERE student_id=$1`, [studentId]
    );
  }

  async getUnassignedStudents(schema: string): Promise<any[]> {
    return tenantQuery(schema,
      `SELECT s.id, s.first_name, s.last_name, s.admission_no, c.name AS class_name
       FROM   ${schema}.students s
       LEFT JOIN ${schema}.classes c ON c.id = s.class_id
       WHERE  s.is_active = true
         AND  s.id NOT IN (
           SELECT student_id FROM ${schema}.route_students WHERE is_active=true
         )
       ORDER  BY s.first_name`, []
    );
  }

  // ── Trips ─────────────────────────────────────────────────────────────────

  async getDriverSchedule(schema: string, driverId: string, date: string): Promise<any[]> {
    const routes = await tenantQuery<any>(schema,
      `SELECT DISTINCT ON (r.id)
              r.id AS route_id, r.name AS route_name, r.route_code,
              r.morning_start, r.afternoon_start,
              v.registration_no AS vehicle_reg,
              mt.id AS morning_trip_id, mt.status AS morning_status,
              mt.start_time AS morning_trip_start,
              et.id AS evening_trip_id, et.status AS evening_status,
              et.start_time AS evening_trip_start
       FROM   ${schema}.transport_routes r
       LEFT JOIN ${schema}.vehicles v ON v.id = r.vehicle_id
       LEFT JOIN LATERAL (
         SELECT id, status, start_time FROM ${schema}.trips
         WHERE route_id = r.id AND trip_date = $2 AND trip_type = 'morning'
           AND (COALESCE(driver_id, r.driver_id) = $1)
         ORDER BY created_at DESC LIMIT 1
       ) mt ON true
       LEFT JOIN LATERAL (
         SELECT id, status, start_time FROM ${schema}.trips
         WHERE route_id = r.id AND trip_date = $2 AND trip_type = 'evening'
           AND (COALESCE(driver_id, r.driver_id) = $1)
         ORDER BY created_at DESC LIMIT 1
       ) et ON true
       WHERE  r.driver_id = $1 AND r.is_active = true
       ORDER  BY r.id, r.name`,
      [driverId, date]
    );

    // Also check for trips where driver was assigned at trip-level but route has different driver
    const tripLevelRoutes = await tenantQuery<any>(schema,
      `SELECT DISTINCT r.id AS route_id, r.name AS route_name, r.route_code,
              r.morning_start, r.afternoon_start,
              v.registration_no AS vehicle_reg
       FROM   ${schema}.trips t
       JOIN   ${schema}.transport_routes r ON r.id = t.route_id
       LEFT JOIN ${schema}.vehicles v ON v.id = r.vehicle_id
       WHERE  t.trip_date = $2 AND t.driver_id = $1
         AND  r.id NOT IN (SELECT id FROM ${schema}.transport_routes WHERE driver_id = $1)`,
      [driverId, date]
    );

    // Merge trip-level routes
    for (const r of tripLevelRoutes) {
      const mt = await tenantQuery<any>(schema,
        `SELECT id, status, start_time FROM ${schema}.trips
         WHERE route_id = $1 AND trip_date = $2 AND trip_type = 'morning' AND driver_id = $3
         ORDER BY created_at DESC LIMIT 1`,
        [r.route_id, date, driverId]
      );
      const et = await tenantQuery<any>(schema,
        `SELECT id, status, start_time FROM ${schema}.trips
         WHERE route_id = $1 AND trip_date = $2 AND trip_type = 'evening' AND driver_id = $3
         ORDER BY created_at DESC LIMIT 1`,
        [r.route_id, date, driverId]
      );
      routes.push({
        ...r,
        morning_trip_id: mt[0]?.id, morning_status: mt[0]?.status, morning_trip_start: mt[0]?.start_time,
        evening_trip_id: et[0]?.id, evening_status: et[0]?.status, evening_trip_start: et[0]?.start_time,
      });
    }

    const slots: any[] = [];
    for (const r of routes) {
      if (r.morning_trip_id || r.morning_start) {
        slots.push({
          id:            r.morning_trip_id ?? `scheduled-${r.route_id}-morning`,
          route_id:      r.route_id,
          route_name:    r.route_name,
          route_code:    r.route_code,
          trip_type:     'morning',
          direction:     'pickup',
          status:        r.morning_status ?? 'scheduled',
          start_time:    r.morning_trip_start,
          morning_start: r.morning_start,
          vehicle_reg:   r.vehicle_reg,
          is_real:       !!r.morning_trip_id,
        });
      }
      if (r.evening_trip_id || r.afternoon_start) {
        slots.push({
          id:              r.evening_trip_id ?? `scheduled-${r.route_id}-evening`,
          route_id:        r.route_id,
          route_name:      r.route_name,
          route_code:      r.route_code,
          trip_type:       'evening',
          direction:       'dropoff',
          status:          r.evening_status ?? 'scheduled',
          start_time:      r.evening_trip_start,
          afternoon_start: r.afternoon_start,
          vehicle_reg:     r.vehicle_reg,
          is_real:         !!r.evening_trip_id,
        });
      }
    }

    // Sort: in_progress first, then scheduled
    return slots.sort((a, b) => {
      const order = (s: string) => s === 'in_progress' ? 0 : s === 'scheduled' ? 1 : 2;
      return order(a.status) - order(b.status);
    });
  }

  async listTrips(schema: string, filters: any): Promise<any[]> {
    const conditions: string[] = ['1=1']; const params: any[] = []; let i = 1;
    if (filters.date)      { conditions.push(`(t.trip_date = $${i++} OR t.status = 'in_progress')`);     params.push(filters.date); }
    if (filters.route_id)  { conditions.push(`t.route_id = $${i++}`);                                    params.push(filters.route_id); }
    if (filters.driver_id) { conditions.push(`COALESCE(t.driver_id, r.driver_id) = $${i++}`);           params.push(filters.driver_id); }
    return tenantQuery(schema,
      `SELECT t.*, to_char(t.trip_date, 'YYYY-MM-DD') AS trip_date,
              r.name AS route_name,
              COALESCE(tv.registration_no, rv.registration_no) AS vehicle_reg,
              CONCAT(td.first_name,' ',td.last_name) AS driver_name,
              COUNT(tb.id)::int AS total_students,
              COUNT(tb.id) FILTER (WHERE tb.boarded)::int AS boarded_count
       FROM   ${schema}.trips t
       JOIN   ${schema}.transport_routes r ON r.id = t.route_id
       LEFT JOIN ${schema}.vehicles rv ON rv.id = r.vehicle_id
       LEFT JOIN ${schema}.vehicles tv ON tv.id = t.vehicle_id
       LEFT JOIN ${schema}.staff td ON td.id = COALESCE(t.driver_id, r.driver_id)
       LEFT JOIN ${schema}.trip_boardings tb ON tb.trip_id = t.id
       WHERE  ${conditions.join(' AND ')}
       GROUP  BY t.id,r.name,rv.registration_no,tv.registration_no,td.first_name,td.last_name
       ORDER  BY t.trip_date DESC, t.created_at DESC`, params
    );
  }

  async startTrip(schema: string, dto: any): Promise<any> {
    return tenantTransaction(schema, async (client: PoolClient) => {

      // Prevent duplicate active trip for same route + date + type
      const { rows: [existing] } = await client.query(
        `SELECT id FROM ${schema}.trips
         WHERE route_id = $1 AND trip_date = $2 AND trip_type = $3
           AND status IN ('scheduled','in_progress') LIMIT 1`,
        [dto.route_id, dto.trip_date ?? dto.date, dto.trip_type ?? 'morning']
      );
      if (existing) throw AppError.conflict('A trip already exists for this route, date and type');

      // Resolve driver: use override if provided, else route's driver
      const { rows: [route] } = await client.query(
        `SELECT driver_id, vehicle_id FROM ${schema}.transport_routes WHERE id = $1`,
        [dto.route_id]
      );
      const driverId  = dto.driver_id || route?.driver_id || null;
      const vehicleId = dto.vehicle_id || route?.vehicle_id || null;

      // Driver is mandatory
      if (!driverId) {
        throw AppError.badRequest('A driver must be assigned before starting a trip. Assign a driver to the route or select one when starting the trip.');
      }

      // Prevent same driver on two active trips simultaneously
      const { rows: [driverConflict] } = await client.query(
        `SELECT t.id, r.name AS route_name FROM ${schema}.trips t
         JOIN ${schema}.transport_routes r ON r.id = t.route_id
         WHERE t.driver_id = $1 AND t.trip_date = $2
           AND t.status = 'in_progress' LIMIT 1`,
        [driverId, dto.trip_date ?? dto.date]
      );
      if (driverConflict) {
        const driver = await client.query(
          `SELECT first_name, last_name FROM ${schema}.staff WHERE id = $1`,
          [driverId]
        );
        const name = driver.rows[0]
          ? `${driver.rows[0].first_name} ${driver.rows[0].last_name}`
          : 'This driver';
        throw AppError.conflict(
          `${name} is already on an active trip for route "${driverConflict.route_name}". Complete that trip first.`
        );
      }
      const tripType  = dto.trip_type ?? 'morning';
      const direction = tripType === 'evening' ? 'dropoff' : 'pickup';
      const { rows: [trip] } = await client.query(
        `INSERT INTO ${schema}.trips
           (route_id, trip_date, trip_type, direction, status, start_time, driver_id, vehicle_id)
         VALUES ($1,$2,$3,$4,'in_progress',now(),$5,$6) RETURNING *`,
        [dto.route_id, dto.trip_date ?? dto.date, tripType, direction, driverId, vehicleId]
      );
      await client.query(
        `INSERT INTO ${schema}.trip_boardings (trip_id,student_id,boarded)
         SELECT $1,student_id,false FROM ${schema}.route_students
         WHERE route_id=$2 AND is_active=true ON CONFLICT DO NOTHING`,
        [trip.id, dto.route_id]
      );
      return trip;
    });
  }

  async markBoarding(schema: string, tripId: string, studentId: string, boarded: boolean): Promise<any> {
    const [row] = await tenantQuery<any>(schema,
      `UPDATE ${schema}.trip_boardings
       SET boarded = $1, boarded_at = CASE WHEN $1 THEN now() ELSE NULL END
       WHERE trip_id = $2 AND student_id = $3 RETURNING *`,
      [boarded, tripId, studentId]
    );
    return row;
  }

  async markDropped(schema: string, tripId: string, studentId: string, dropped: boolean): Promise<any> {
    const [row] = await tenantQuery<any>(schema,
      `UPDATE ${schema}.trip_boardings
       SET dropped = $1, dropped_at = CASE WHEN $1 THEN now() ELSE NULL END
       WHERE trip_id = $2 AND student_id = $3 RETURNING *`,
      [dropped, tripId, studentId]
    );
    return row;
  }

  async completeTrip(schema: string, tripId: string): Promise<any> {
    const [row] = await tenantQuery<any>(schema,
      `UPDATE ${schema}.trips
       SET status='completed', end_time=now()
       WHERE id=$1 RETURNING *`, [tripId]
    );
    return row;
  }

  async updateTripDriver(schema: string, tripId: string, driverId: string | null): Promise<any> {
    const [row] = await tenantQuery<any>(schema,
      `UPDATE ${schema}.trips SET driver_id = $1 WHERE id = $2 RETURNING *`,
      [driverId, tripId]
    );
    if (!row) throw AppError.notFound('Trip');
    return row;
  }

  async getTripDetail(schema: string, tripId: string): Promise<any> {
    const [trip] = await tenantQuery<any>(schema,
      `SELECT t.*, r.name AS route_name,
              COALESCE(tv.registration_no, rv.registration_no) AS vehicle_reg,
              CONCAT(td.first_name,' ',td.last_name) AS driver_name
       FROM   ${schema}.trips t
       JOIN   ${schema}.transport_routes r ON r.id = t.route_id
       LEFT JOIN ${schema}.vehicles rv ON rv.id = r.vehicle_id
       LEFT JOIN ${schema}.vehicles tv ON tv.id = t.vehicle_id
       LEFT JOIN ${schema}.staff td ON td.id = COALESCE(t.driver_id, r.driver_id)
       WHERE  t.id=$1`, [tripId]
    );
    if (!trip) throw AppError.notFound('Trip');
    const boardings = await tenantQuery<any>(schema,
      `SELECT tb.*, CONCAT(s.first_name,' ',s.last_name) AS student_name,
              s.admission_no, ps.name AS pickup_stop, ps.stop_order
       FROM   ${schema}.trip_boardings tb
       JOIN   ${schema}.students s ON s.id = tb.student_id
       LEFT JOIN ${schema}.route_students rs ON rs.student_id = tb.student_id AND rs.is_active=true
       LEFT JOIN ${schema}.route_stops ps ON ps.id = rs.pickup_stop_id
       WHERE  tb.trip_id = $1
       ORDER  BY ps.stop_order, s.first_name`, [tripId]
    );
    return { ...trip, boardings };
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  async getStudentTransport(schema: string, studentId: string): Promise<any> {
    const [row] = await tenantQuery<any>(schema,
      `SELECT rs.*, r.name AS route_name, r.route_code,
              r.morning_start, r.afternoon_start,
              v.registration_no AS vehicle_reg,
              CONCAT(d.first_name,' ',d.last_name) AS driver_name,
              d.phone AS driver_phone,
              ps.name AS pickup_stop_name, ps.morning_eta,
              ds.name AS drop_stop_name, ds.evening_eta,
              r.monthly_fee
       FROM   ${schema}.route_students rs
       JOIN   ${schema}.transport_routes r ON r.id = rs.route_id
       LEFT JOIN ${schema}.vehicles v ON v.id = r.vehicle_id
       LEFT JOIN ${schema}.staff d ON d.id = r.driver_id
       LEFT JOIN ${schema}.route_stops ps ON ps.id = rs.pickup_stop_id
       LEFT JOIN ${schema}.route_stops ds ON ds.id = rs.drop_stop_id

       WHERE  rs.student_id = $1 AND rs.is_active = true`,
      [studentId]
    );
    return row ?? null;
  }

  async getTripReport(schema: string, filters: any): Promise<any> {
    const conditions: string[] = ['1=1'];
    const params: any[] = [];
    let i = 1;
    if (filters.from_date) { conditions.push(`t.trip_date >= $${i++}`); params.push(filters.from_date); }
    if (filters.to_date)   { conditions.push(`t.trip_date <= $${i++}`); params.push(filters.to_date); }
    if (filters.route_id)  { conditions.push(`t.route_id = $${i++}`);   params.push(filters.route_id); }
    if (filters.trip_type) { conditions.push(`t.trip_type = $${i++}`);  params.push(filters.trip_type); }

    const trips = await tenantQuery<any>(schema,
      `SELECT t.id, t.route_id, t.trip_date, t.trip_type, t.direction, t.status,
              t.start_time, t.end_time,
              r.name AS route_name, r.route_code,
              r.morning_start, r.afternoon_start,
              COALESCE(tv.registration_no, rv.registration_no) AS vehicle_reg,
              CONCAT(td.first_name,' ',td.last_name) AS driver_name,
              COUNT(tb.id)::int AS total_students,
              COUNT(tb.id) FILTER (WHERE tb.boarded)::int AS boarded_count,
              COUNT(tb.id) FILTER (WHERE tb.dropped)::int AS dropped_count,
              COUNT(tb.id) FILTER (WHERE NOT tb.boarded)::int AS absent_count,
              EXTRACT(EPOCH FROM (t.end_time - t.start_time))/60 AS duration_mins
       FROM   ${schema}.trips t
       JOIN   ${schema}.transport_routes r ON r.id = t.route_id
       LEFT JOIN ${schema}.vehicles rv ON rv.id = r.vehicle_id
       LEFT JOIN ${schema}.vehicles tv ON tv.id = t.vehicle_id
       LEFT JOIN ${schema}.staff td ON td.id = COALESCE(t.driver_id, r.driver_id)
       LEFT JOIN ${schema}.trip_boardings tb ON tb.trip_id = t.id
       WHERE  ${conditions.join(' AND ')}
       GROUP  BY t.id, t.route_id, r.name, r.route_code, r.morning_start, r.afternoon_start,
                 rv.registration_no, tv.registration_no,
                 td.first_name, td.last_name
       ORDER  BY t.trip_date DESC, r.name`, params
    );

    // Summary stats
    const summary = {
      total_trips:     trips.length,
      completed_trips: trips.filter((t: any) => t.status === 'completed').length,
      total_students:  trips.reduce((s: number, t: any) => s + t.total_students, 0),
      total_boarded:   trips.reduce((s: number, t: any) => s + t.boarded_count, 0),
      total_absent:    trips.reduce((s: number, t: any) => s + t.absent_count, 0),
    };

    return { trips, summary };
  }

  async getStudentTransportReport(schema: string): Promise<any> {
    const students = await tenantQuery<any>(schema,
      `SELECT s.admission_no, s.first_name, s.last_name,
              c.name AS class_name,
              r.name AS route_name, r.route_code, r.monthly_fee,
              r.morning_start, r.afternoon_start,
              ps.name AS pickup_stop, ps.morning_eta,
              ds.name AS drop_stop, ds.evening_eta,
              COALESCE(rv.registration_no,'—') AS vehicle_reg,
              CONCAT(d.first_name,' ',d.last_name) AS driver_name,
              rs.created_at AS enrolled_on
       FROM   ${schema}.route_students rs
       JOIN   ${schema}.students s ON s.id = rs.student_id
       JOIN   ${schema}.transport_routes r ON r.id = rs.route_id
       LEFT JOIN ${schema}.classes c ON c.id = s.class_id
       LEFT JOIN ${schema}.route_stops ps ON ps.id = rs.pickup_stop_id
       LEFT JOIN ${schema}.route_stops ds ON ds.id = rs.drop_stop_id
       LEFT JOIN ${schema}.vehicles rv ON rv.id = r.vehicle_id
       LEFT JOIN ${schema}.staff d ON d.id = r.driver_id
       WHERE  rs.is_active = true AND s.is_active = true
       ORDER  BY r.name, ps.stop_order, s.first_name`, []
    );

    const summary = {
      total_enrolled:   students.length,
      routes_used:      new Set(students.map((s: any) => s.route_name)).size,
      monthly_revenue:  students.reduce((sum: number, s: any) => sum + (+s.monthly_fee || 0), 0),
    };

    return { students, summary };
  }

  async getDashboard(schema: string): Promise<any> {
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);

    const [counts] = await tenantQuery<any>(schema,
      `SELECT
         (SELECT COUNT(*) FROM ${schema}.vehicles WHERE is_active)::int AS active_vehicles,
         (SELECT COUNT(*) FROM ${schema}.transport_routes WHERE is_active)::int AS active_routes,
         (SELECT COUNT(*) FROM ${schema}.route_students WHERE is_active)::int AS students_enrolled,
         (SELECT COUNT(*) FROM ${schema}.trips WHERE trip_date=$1)::int AS trips_today,
         (SELECT COUNT(*) FROM ${schema}.trips WHERE trip_date=$1 AND status='in_progress')::int AS trips_in_progress`,
      [today]
    );

    // Route occupancy + revenue
    const routeOccupancy = await tenantQuery<any>(schema,
      `SELECT r.id, r.name, r.route_code, r.monthly_fee,
              MAX(v.capacity) AS vehicle_capacity,
              COUNT(DISTINCT rs.student_id)::int AS student_count,
              COALESCE(r.monthly_fee,0) * COUNT(DISTINCT rs.student_id) AS monthly_revenue
       FROM   ${schema}.transport_routes r
       LEFT JOIN ${schema}.vehicles v ON v.id = r.vehicle_id
       LEFT JOIN ${schema}.route_students rs ON rs.route_id = r.id AND rs.is_active = true
       WHERE  r.is_active = true
       GROUP  BY r.id, r.name, r.route_code, r.monthly_fee
       ORDER  BY r.name`, []
    );

    // Today's trips with boarding progress
    const todayTrips = await tenantQuery<any>(schema,
      `SELECT t.id, t.trip_type, t.direction, t.status, t.start_time,
              r.name AS route_name, r.route_code,
              COALESCE(tv.registration_no, rv.registration_no) AS vehicle_reg,
              CONCAT(td.first_name,' ',td.last_name) AS driver_name,
              COUNT(tb.id)::int AS total,
              COUNT(tb.id) FILTER (WHERE tb.boarded)::int AS boarded
       FROM   ${schema}.trips t
       JOIN   ${schema}.transport_routes r ON r.id = t.route_id
       LEFT JOIN ${schema}.vehicles rv ON rv.id = r.vehicle_id
       LEFT JOIN ${schema}.vehicles tv ON tv.id = t.vehicle_id
       LEFT JOIN ${schema}.staff td ON td.id = COALESCE(t.driver_id, r.driver_id)
       LEFT JOIN ${schema}.trip_boardings tb ON tb.trip_id = t.id
       WHERE  t.trip_date = $1
       GROUP  BY t.id, r.name, r.route_code, rv.registration_no, tv.registration_no, td.first_name, td.last_name
       ORDER  BY CASE t.status WHEN 'in_progress' THEN 0 WHEN 'scheduled' THEN 1 ELSE 2 END,
                 t.trip_type, r.name`, [today]
    );

    // Expiring vehicles
    const expiringVehicles = await tenantQuery<any>(schema,
      `SELECT id, registration_no, fitness_expiry, insurance_expiry
       FROM   ${schema}.vehicles
       WHERE  is_active = true
         AND  (fitness_expiry <= CURRENT_DATE+30 OR insurance_expiry <= CURRENT_DATE+30)
       ORDER  BY LEAST(fitness_expiry, insurance_expiry)`, []
    );

    // Monthly revenue summary
    const totalRevenue = routeOccupancy.reduce((s: number, r: any) => s + (+r.monthly_revenue || 0), 0);

    return {
      stats: { ...counts, total_monthly_revenue: totalRevenue },
      route_occupancy: routeOccupancy,
      today_trips: todayTrips,
      expiring_vehicles: expiringVehicles,
    };
  }
}

export const transportService = new TransportService();
