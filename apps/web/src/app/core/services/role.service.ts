import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';

// ── Role constants ────────────────────────────────────────────────────────────

export type AppRole =
  | 'owner'
  | 'principal'
  | 'teacher'
  | 'assistant_teacher'
  | 'accountant'
  | 'admission_staff'
  | 'driver'
  | 'support'
  | 'parent'
  | 'rfid_admin';

const ADMIN_ROLES:    AppRole[] = ['owner', 'principal'];
const MANAGE_ROLES:   AppRole[] = ['owner', 'principal', 'accountant'];
const ACADEMIC_ROLES: AppRole[] = ['owner', 'principal', 'teacher', 'assistant_teacher'];
const VIEW_ROLES:     AppRole[] = ['owner', 'principal', 'accountant', 'teacher', 'assistant_teacher', 'admission_staff'];
const HR_ROLES:       AppRole[] = ['owner', 'principal', 'accountant'];
const ALL_STAFF:      AppRole[] = ['owner', 'principal', 'teacher', 'assistant_teacher', 'accountant', 'admission_staff', 'driver', 'support'];

// ── Nav item ──────────────────────────────────────────────────────────────────
// icon: Tabler icon NAME only (without "ti ti-" prefix).
// The shell template prepends "ti ti-" so each icon needs only the suffix.
// Full list: https://tabler.io/icons

export interface NavItem {
  label:     string;
  icon:      string;    // e.g. 'home', 'users', 'calendar-check'
  route:     string;
  badgeKey?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

// ── Nav definitions ───────────────────────────────────────────────────────────

function principalNav(): NavGroup[] {
  return [
    {
      label: 'Overview',
      items: [
        { label: 'Dashboard',    icon: 'layout-dashboard',  route: '/dashboard' },
        { label: 'Students',     icon: 'users',             route: '/students' },
        { label: 'Attendance',   icon: 'calendar-check',    route: '/attendance' },
        { label: 'Fees',         icon: 'receipt',           route: '/fees' },
      ],
    },
    {
      label: 'Academics',
      items: [
        { label: 'Classes',        icon: 'door',              route: '/classes' },
        { label: 'Timetable',      icon: 'table-column',      route: '/timetable' },
        { label: 'Journal',        icon: 'notebook',          route: '/journal' },
        { label: 'Homework',       icon: 'writing',           route: '/homework' },
        { label: 'Observations',   icon: 'plant-2',           route: '/observations' },
        { label: 'Reports',        icon: 'chart-bar',         route: '/reports' },
        { label: 'Academic Years', icon: 'school',            route: '/academic-years' },
      ],
    },
    {
      label: 'School',
      items: [
        { label: 'Parents',        icon: 'heart-handshake',   route: '/parents' },
        { label: 'Staff',          icon: 'id-badge-2',        route: '/staff' },
        { label: 'Transport',      icon: 'bus',               route: '/transport' },
        { label: 'Calendar',       icon: 'calendar-month',    route: '/calendar' },
        { label: 'Communication',  icon: 'messages',          route: '/communication', badgeKey: 'unread' },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { label: 'AI Insights', icon: 'brain', route: '/ai-insights' },
      ],
    },
  ];
}

const NAV_BY_ROLE: Record<AppRole, NavGroup[]> = {

  owner:     principalNav(),
  principal: principalNav(),

  teacher: [
    {
      label: 'Today',
      items: [
        { label: 'Dashboard',  icon: 'layout-dashboard', route: '/dashboard' },
        { label: 'Attendance', icon: 'calendar-check',   route: '/attendance' },
        { label: 'Journal',    icon: 'notebook',         route: '/journal' },
      ],
    },
    {
      label: 'Classroom',
      items: [
        { label: 'Students',     icon: 'users',           route: '/students' },
        { label: 'Observations', icon: 'plant-2',         route: '/observations' },
        { label: 'Homework',     icon: 'writing',         route: '/homework' },
        { label: 'Timetable',    icon: 'table-column',    route: '/timetable' },
        { label: 'Reports',      icon: 'chart-bar',       route: '/reports' },
      ],
    },
    {
      label: 'School',
      items: [
        { label: 'Communication', icon: 'messages',        route: '/communication', badgeKey: 'unread' },
        { label: 'Calendar',      icon: 'calendar-month',  route: '/calendar' },
      ],
    },
  ],

  assistant_teacher: [
    {
      label: 'Today',
      items: [
        { label: 'Dashboard',  icon: 'layout-dashboard', route: '/dashboard' },
        { label: 'Attendance', icon: 'calendar-check',   route: '/attendance' },
        { label: 'Journal',    icon: 'notebook',         route: '/journal' },
      ],
    },
    {
      label: 'Classroom',
      items: [
        { label: 'Students',     icon: 'users',        route: '/students' },
        { label: 'Observations', icon: 'plant-2',      route: '/observations' },
        { label: 'Homework',     icon: 'writing',      route: '/homework' },
      ],
    },
    {
      label: 'School',
      items: [
        { label: 'Communication', icon: 'messages',       route: '/communication', badgeKey: 'unread' },
        { label: 'Calendar',      icon: 'calendar-month', route: '/calendar' },
      ],
    },
  ],

  accountant: [
    {
      label: 'Finance',
      items: [
        { label: 'Dashboard', icon: 'layout-dashboard', route: '/dashboard' },
        { label: 'Fees',      icon: 'receipt',          route: '/fees' },
        { label: 'Students',  icon: 'users',            route: '/students' },
      ],
    },
    {
      label: 'HR',
      items: [
        { label: 'Staff', icon: 'id-badge-2', route: '/staff' },
      ],
    },
    {
      label: 'School',
      items: [
        { label: 'Communication', icon: 'messages',       route: '/communication', badgeKey: 'unread' },
        { label: 'Calendar',      icon: 'calendar-month', route: '/calendar' },
      ],
    },
  ],

  admission_staff: [
    {
      label: 'Admissions',
      items: [
        { label: 'Dashboard',      icon: 'layout-dashboard', route: '/dashboard' },
        { label: 'Students',       icon: 'users',            route: '/students' },
        { label: 'Academic Years', icon: 'school',           route: '/academic-years' },
        { label: 'Classes',        icon: 'door',             route: '/classes' },
      ],
    },
    {
      label: 'School',
      items: [
        { label: 'Parents',       icon: 'heart-handshake', route: '/parents' },
        { label: 'Communication', icon: 'messages',       route: '/communication', badgeKey: 'unread' },
        { label: 'Calendar',      icon: 'calendar-month', route: '/calendar' },
      ],
    },
  ],

  driver: [
    {
      label: 'My Portal',
      items: [
        { label: 'My Trips', icon: 'steering-wheel', route: '/driver' },
        { label: 'Calendar', icon: 'calendar-month', route: '/calendar' },
      ],
    },
  ],

  support: [
    {
      label: 'School',
      items: [
        { label: 'Dashboard',     icon: 'layout-dashboard', route: '/dashboard' },
        { label: 'Communication', icon: 'messages',         route: '/communication', badgeKey: 'unread' },
        { label: 'Calendar',      icon: 'calendar-month',   route: '/calendar' },
      ],
    },
  ],

  parent: [],

  rfid_admin: [],
};

// ── RoleService ───────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class RoleService {
  private auth = inject(AuthService);

  readonly role = computed(() => (this.auth.userRole() as AppRole) || null);

  readonly navGroups = computed<NavGroup[]>(() => {
    const r = this.role();
    return r ? (NAV_BY_ROLE[r] ?? []) : [];
  });

  readonly defaultRoute = computed<string>(() => {
    const r = this.role();
    if (!r) return '/login';
    if (r === 'driver') return '/driver';
    if (r === 'parent') return '/parent/dashboard';
    return '/dashboard';
  });

  readonly isAdmin          = computed(() => this.hasRole(ADMIN_ROLES));
  readonly canManageFees    = computed(() => this.hasRole(MANAGE_ROLES));
  readonly canViewStudents  = computed(() => this.hasRole(VIEW_ROLES));
  readonly canManageStudents= computed(() => this.hasRole(['owner', 'principal', 'admission_staff']));
  readonly canDoAcademics   = computed(() => this.hasRole(ACADEMIC_ROLES));
  readonly canManageHR      = computed(() => this.hasRole(HR_ROLES));
  readonly isStaffMember    = computed(() => this.hasRole(ALL_STAFF));
  readonly isParent         = computed(() => this.role() === 'parent');
  readonly isDriver         = computed(() => this.role() === 'driver');

  private hasRole(allowed: AppRole[]): boolean {
    const r = this.role();
    return r ? allowed.includes(r) : false;
  }

  hasPermission(allowed: AppRole[]): boolean {
    return this.hasRole(allowed);
  }

  readonly roleLabel = computed<string>(() => {
    const labels: Record<AppRole, string> = {
      owner:             'Owner',
      principal:         'Principal',
      teacher:           'Teacher',
      assistant_teacher: 'Asst. Teacher',
      accountant:        'Accountant',
      admission_staff:   'Admissions',
      driver:            'Driver',
      support:           'Support',
      parent:            'Parent',
      rfid_admin:        'RFID Admin',
    };
    const r = this.role();
    return r ? (labels[r] ?? r) : '';
  });
}
