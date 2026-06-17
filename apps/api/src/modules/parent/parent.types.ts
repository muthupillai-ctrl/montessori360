export interface ParentChild {
  id:           string;
  first_name:   string;
  last_name:    string;
  admission_no: string;
  class_name:   string | null;
  section:      string | null;
  photo_url:    string | null;
}

export interface AttendanceSummary {
  records: { date: string; status: string }[];
  present: number;
  absent:  number;
  late:    number;
}

export interface TransportStatus {
  morning: { boarded: boolean; boarded_at: string | null; route_name: string | null } | null;
  evening: { boarded: boolean; boarded_at: string | null; route_name: string | null } | null;
}

export interface HomeworkTask {
  id:           string;
  title:        string;
  description:  string | null;
  subject:      string | null;
  due_date:     string;
  is_published: boolean;
  published_at: string | null;
  assigned_by:  string | null;
}

export interface ParentDashboardCard {
  student:          ParentChild;
  today_attendance: string | null;
  outstanding_fees: number;
  latest_mood:      string | null;
  transport_morning_boarded: boolean | null;
}
