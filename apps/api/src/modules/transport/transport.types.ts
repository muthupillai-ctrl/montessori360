export type VehicleType   = 'bus' | 'van' | 'auto' | 'car' | 'other';
export type TripStatus    = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type TripDirection = 'pickup' | 'dropoff';

export interface VehicleRow {
  id:               string;
  registration_no:  string;
  vehicle_type:     VehicleType;
  make:             string | null;
  model:            string | null;
  capacity:         number;
  fitness_expiry:   string | null;
  insurance_expiry: string | null;
  is_active:        boolean;
  created_at:       Date;
  updated_at:       Date;
}

export interface Waypoint {
  stop_no:      number;
  name:         string;
  lat:          number | null;
  lng:          number | null;
  pickup_time:  string | null;
  dropoff_time: string | null;
}

export interface RouteRow {
  id:               string;
  name:             string;
  description:      string | null;
  vehicle_id:       string | null;
  driver_id:        string | null;
  waypoints:        Waypoint[];
  morning_start:    string | null;
  afternoon_start:  string | null;
  is_active:        boolean;
  created_at:       Date;
  updated_at:       Date;
  vehicle_reg?:     string;
  driver_name?:     string;
  driver_phone?:    string;
  student_count?:   number;
}

export interface RouteStudentRow {
  id:           string;
  route_id:     string;
  student_id:   string;
  stop_no:      number;
  created_at:   Date;
  student_name?: string;
  admission_no?: string;
  stop_name?:    string;
  pickup_time?:  string;
  dropoff_time?: string;
}

export interface TripRow {
  id:           string;
  route_id:     string;
  trip_date:    string;
  direction:    TripDirection;
  status:       TripStatus;
  started_at:   Date | null;
  completed_at: Date | null;
  driver_id:    string | null;
  vehicle_id:   string | null;
  notes:        string | null;
  created_at:   Date;
  route_name?:  string;
  driver_name?: string;
  vehicle_reg?: string;
}

export interface LiveLocationRow {
  route_id:    string;
  trip_id:     string;
  lat:         number;
  lng:         number;
  speed:       number | null;
  heading:     number | null;
  recorded_at: Date;
}

export interface CreateVehicleDto {
  registration_no:   string;
  vehicle_type:      VehicleType;
  make?:             string;
  model?:            string;
  capacity:          number;
  fitness_expiry?:   string;
  insurance_expiry?: string;
}

export interface CreateRouteDto {
  name:             string;
  description?:     string;
  vehicle_id?:      string;
  driver_id?:       string;
  waypoints:        Waypoint[];
  morning_start?:   string;
  afternoon_start?: string;
}

export interface AssignStudentDto {
  student_id: string;
  stop_no:    number;
}

export interface StartTripDto {
  direction:   TripDirection;
  vehicle_id?: string;
  driver_id?:  string;
  notes?:      string;
}

export interface UpdateLocationDto {
  lat:      number;
  lng:      number;
  speed?:   number;
  heading?: number;
}

export interface MarkBoardingDto {
  student_id: string;
  boarded:    boolean;
}
