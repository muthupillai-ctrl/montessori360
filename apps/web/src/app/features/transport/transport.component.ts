import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

type Tab = 'dashboard' | 'vehicles' | 'routes' | 'trips';

const VEHICLE_TYPES = [
  { value: 'bus',   label: 'Bus'   },
  { value: 'van',   label: 'Van'   },
  { value: 'auto',  label: 'Auto'  },
  { value: 'car',   label: 'Car'   },
  { value: 'other', label: 'Other' },
];

@Component({
  selector: 'app-transport',
  standalone: true,
  imports: [ ReactiveFormsModule, FormsModule, MatIconModule, MatProgressSpinnerModule, DatePipe, DecimalPipe ],
  template: `
    <div class="transport-page">

      <!-- Page header -->
      <div class="page-header">
        <div>
          <h1>Transport</h1>
          <div class="subtitle">Manage fleet, routes and trips</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="tab-bar">
        @for (t of tabs; track t.key) {
          <button class="tab-btn" [class.active]="activeTab() === t.key"
                  (click)="activeTab.set(t.key)">
            <mat-icon style="font-size:15px;width:15px;height:15px">{{ t.icon }}</mat-icon>
            {{ t.label }}
          </button>
        }
      </div>

      <!-- ── Dashboard ───────────────────────────────────────── -->
      @if (activeTab() === 'dashboard') {
        @if (dashLoading()) {
          <div class="loading-state"><mat-progress-spinner diameter="28" mode="indeterminate"/></div>
        } @else if (dash()) {

          <!-- Stat cards -->
          <div class="stats-grid">
            <div class="stat-card">
              <div class="sc-icon" style="background:#EFF6FF;color:#2563EB">
                <mat-icon style="font-size:20px;width:20px;height:20px">directions_bus</mat-icon>
              </div>
              <div><div class="sc-val">{{ dash()!.stats.active_vehicles }}</div><div class="sc-lbl">Vehicles</div></div>
            </div>
            <div class="stat-card">
              <div class="sc-icon" style="background:#F5F3FF;color:#7C3AED">
                <mat-icon style="font-size:20px;width:20px;height:20px">route</mat-icon>
              </div>
              <div><div class="sc-val">{{ dash()!.stats.active_routes }}</div><div class="sc-lbl">Routes</div></div>
            </div>
            <div class="stat-card">
              <div class="sc-icon" style="background:#ECFDF5;color:#059669">
                <mat-icon style="font-size:20px;width:20px;height:20px">people</mat-icon>
              </div>
              <div><div class="sc-val">{{ dash()!.stats.students_enrolled }}</div><div class="sc-lbl">Students Enrolled</div></div>
            </div>
            <div class="stat-card">
              <div class="sc-icon" style="background:#FFFBEB;color:#D97706">
                <mat-icon style="font-size:20px;width:20px;height:20px">payments</mat-icon>
              </div>
              <div><div class="sc-val">₹{{ dash()!.stats.total_monthly_revenue | number:'1.0-0' }}</div><div class="sc-lbl">Monthly Revenue</div></div>
            </div>
          </div>

          <!-- Route occupancy + Today's trips -->
          <div class="dash-grid-2">

            <!-- Route occupancy -->
            <div class="dash-card">
              <div class="dc-head">
                <mat-icon style="font-size:15px;width:15px;height:15px;color:var(--blue)">bar_chart</mat-icon>
                Route Occupancy
              </div>
              <div class="dc-body">
                @if (!dash()!.route_occupancy.length) {
                  <div class="dc-empty">No active routes</div>
                } @else {
                  @for (r of dash()!.route_occupancy; track r.id) {
                    <div class="occ-row">
                      <div class="occ-av" [style.background]="getColor(r.name)">
                        {{ r.route_code || r.name.slice(0,2).toUpperCase() }}
                      </div>
                      <div class="occ-info">
                        <div class="occ-name">{{ r.name }}</div>
                        <div class="occ-meta">
                          {{ r.student_count }} students
                          @if (r.monthly_fee) {
                            · <span style="color:var(--green);font-weight:600">₹{{ r.monthly_fee | number:'1.0-0' }}/month</span>
                          }
                        </div>
                      </div>
                      <div class="occ-bar-wrap">
                        <div class="occ-bar">
                          <div class="occ-fill"
                               [style.width.%]="r.vehicle_capacity > 0 ? (r.student_count/r.vehicle_capacity*100) : 100"
                               [style.background]="getColor(r.name)"></div>
                        </div>
                        <span class="occ-count">{{ r.student_count }}/{{ r.vehicle_capacity ?? '—' }}</span>
                      </div>
                    </div>
                  }
                }
              </div>
            </div>

            <!-- Today's trips -->
            <div class="dash-card">
              <div class="dc-head">
                <mat-icon style="font-size:15px;width:15px;height:15px;color:var(--amber)">today</mat-icon>
                Today's Trips
                @if (dash()!.stats.trips_in_progress > 0) {
                  <span class="live-badge">{{ dash()!.stats.trips_in_progress }} Live</span>
                }
              </div>
              <div class="dc-body">
                @if (!dash()!.today_trips.length) {
                  <div class="dc-empty">No trips today</div>
                } @else {
                  @for (t of dash()!.today_trips; track t.id) {
                    <div class="trip-row" [class.clickable]="t.status==='in_progress'"
                         (click)="t.status==='in_progress' && openTripDetail(t)">
                      <div class="tr-info">
                        <div class="tr-name">
                          {{ t.route_name }}
                          <span class="type-tag" style="margin-left:4px"
                                [class.pickup]="t.trip_type==='morning'"
                                [class.dropoff]="t.trip_type==='evening'">
                            {{ t.trip_type === 'morning' ? '🏫 Pickup' :
                               t.trip_type === 'evening' ? '🏠 Drop' : '⭐ Special' }}
                          </span>
                        </div>
                        <div class="tr-meta">{{ t.vehicle_reg ?? '—' }} · {{ t.driver_name ?? 'No driver' }}</div>
                      </div>
                      <div class="tr-board">
                        <div class="board-bar sm">
                          <div class="board-fill"
                               [style.width.%]="t.total > 0 ? (t.boarded/t.total*100) : 0"></div>
                        </div>
                        <span style="font-size:11px;color:var(--text-3)">{{ t.boarded }}/{{ t.total }}</span>
                      </div>
                      <span class="trip-status"
                            [class.live]="t.status==='in_progress'"
                            [class.done]="t.status==='completed'">
                        {{ t.status === 'in_progress' ? '🔴 Live' : t.status === 'completed' ? '✓ Done' : 'Pending' }}
                      </span>
                      @if (t.status === 'in_progress') {
                        <mat-icon style="font-size:14px;width:14px;height:14px;color:var(--text-3)">chevron_right</mat-icon>
                      }
                    </div>
                  }
                }
                @if (dash()!.expiring_vehicles.length) {
                  <div class="expiry-warn-bar">
                    <mat-icon style="font-size:13px;width:13px;height:13px">warning</mat-icon>
                    {{ dash()!.expiring_vehicles.length }} vehicle document(s) expiring within 30 days
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- Monthly revenue per route -->
          <div class="dash-card">
            <div class="dc-head">
              <mat-icon style="font-size:15px;width:15px;height:15px;color:var(--green)">payments</mat-icon>
              Monthly Transport Revenue
            </div>
            <div class="rev-grid">
              @for (r of dash()!.route_occupancy; track r.id) {
                <div class="rev-card">
                  <div class="rev-name">{{ r.name }}</div>
                  <div class="rev-amt" [style.color]="getColor(r.name)">
                    ₹{{ (r.monthly_revenue || 0) | number:'1.0-0' }}
                  </div>
                  <div class="rev-calc">
                    {{ r.student_count }} × ₹{{ (r.monthly_fee || 0) | number:'1.0-0' }}
                  </div>
                </div>
              }
              <div class="rev-card total">
                <div class="rev-name">Total</div>
                <div class="rev-amt" style="color:var(--green)">
                  ₹{{ dash()!.stats.total_monthly_revenue | number:'1.0-0' }}
                </div>
                <div class="rev-calc">{{ dash()!.stats.students_enrolled }} students</div>
              </div>
            </div>
          </div>

          <!-- Expiring documents detail -->
          @if (dash()!.expiring_vehicles.length) {
            <div class="expiry-list">
              @for (v of dash()!.expiring_vehicles; track v.id) {
                <div class="expiry-row">
                  <mat-icon style="font-size:16px;width:16px;height:16px;color:var(--amber)">warning</mat-icon>
                  <span class="er-reg">{{ v.registration_no }}</span>
                  @if (v.fitness_expiry) { <span class="er-tag amber">Fitness: {{ v.fitness_expiry | date:'d MMM yyyy' }}</span> }
                  @if (v.insurance_expiry) { <span class="er-tag red">Insurance: {{ v.insurance_expiry | date:'d MMM yyyy' }}</span> }
                </div>
              }
            </div>
          }
        }
      }

      <!-- ── Vehicles ─────────────────────────────────────────── -->
      @if (activeTab() === 'vehicles') {
        <div class="tab-header">
          <div class="search-wrap">
            <mat-icon class="si">search</mat-icon>
            <input class="si-input" [(ngModel)]="vehicleSearch" placeholder="Search registration, make…">
          </div>
          @if (isAdmin()) {
            <button class="btn-primary" (click)="openVehicleForm(null)">
              <mat-icon style="font-size:15px;width:15px;height:15px">add</mat-icon>
              Add Vehicle
            </button>
          }
        </div>

        @if (vehicleLoading()) {
          <div class="loading-state"><mat-progress-spinner diameter="24" mode="indeterminate"/></div>
        } @else {
          <div class="data-table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Registration</th><th>Type</th><th>Make / Model</th>
                  <th>Capacity</th><th>Route</th><th>Driver</th>
                  <th>Fitness</th><th>Insurance</th><th>Status</th>
                  @if (isAdmin()) { <th></th> }
                </tr>
              </thead>
              <tbody>
                @for (v of filteredVehicles(); track v.id) {
                  <tr class="tr">
                    <td class="fw">{{ v.registration_no }}</td>
                    <td><span class="type-tag">{{ v.vehicle_type }}</span></td>
                    <td>{{ v.make }} {{ v.model }}
                      @if (v.year) { <span class="text-muted">({{ v.year }})</span> }
                    </td>
                    <td class="tc">{{ v.capacity }}</td>
                    <td>{{ v.route_name ?? '—' }}</td>
                    <td>{{ v.driver_name ?? '—' }}</td>
                    <td [class.expiry-warn]="isExpiringSoon(v.fitness_expiry)">
                      {{ v.fitness_expiry ? (v.fitness_expiry | date:'d MMM yy') : '—' }}
                    </td>
                    <td [class.expiry-warn]="isExpiringSoon(v.insurance_expiry)">
                      {{ v.insurance_expiry ? (v.insurance_expiry | date:'d MMM yy') : '—' }}
                    </td>
                    <td>
                      <span class="status-pill" [class.active]="v.is_active" [class.inactive]="!v.is_active">
                        {{ v.is_active ? 'Active' : 'Inactive' }}
                      </span>
                    </td>
                    @if (isAdmin()) {
                      <td>
                        <button class="icon-btn" (click)="openVehicleForm(v)">
                          <mat-icon style="font-size:15px;width:15px;height:15px">edit</mat-icon>
                        </button>
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      }

      <!-- ── Routes ──────────────────────────────────────────── -->
      @if (activeTab() === 'routes') {
        <div class="tab-header">
          @if (selectedRoute()) {
            <button class="btn-back" (click)="selectedRoute.set(null)">
              <mat-icon style="font-size:16px;width:16px;height:16px">chevron_left</mat-icon>
              All Routes
            </button>
          } @else {
            <div class="th-title">{{ routes().length }} routes</div>
          }
          @if (isAdmin() && !selectedRoute()) {
            <button class="btn-primary" (click)="openRouteForm(null)">
              <mat-icon style="font-size:15px;width:15px;height:15px">add</mat-icon>
              New Route
            </button>
          }
        </div>

        @if (!selectedRoute()) {
          <!-- Route list -->
          @if (routeLoading()) {
            <div class="loading-state"><mat-progress-spinner diameter="24" mode="indeterminate"/></div>
          } @else {
            <div class="route-grid">
              @for (r of routes(); track r.id) {
                <div class="route-card" (click)="openRoute(r)">
                  <div class="rc-header">
                    <div class="rc-av" [style.background]="getColor(r.name)">
                      {{ r.route_code || r.name.slice(0,2).toUpperCase() }}
                    </div>
                    <div class="rc-info">
                      <div class="rc-name">{{ r.name }}</div>
                      @if (r.route_code) { <div class="rc-code">{{ r.route_code }}</div> }
                    </div>
                    @if (isAdmin()) {
                      <button class="icon-btn" (click)="$event.stopPropagation(); openRouteForm(r)">
                        <mat-icon style="font-size:14px;width:14px;height:14px">edit</mat-icon>
                      </button>
                    }
                  </div>
                  <div class="rc-stats">
                    <div class="rcs">
                      <mat-icon style="font-size:13px;width:13px;height:13px;color:var(--text-4)">directions_bus</mat-icon>
                      {{ r.vehicle_reg ?? 'No vehicle' }}
                    </div>
                    <div class="rcs">
                      <mat-icon style="font-size:13px;width:13px;height:13px;color:var(--text-4)">person</mat-icon>
                      {{ r.driver_name ?? 'No driver' }}
                    </div>
                    <div class="rcs">
                      <mat-icon style="font-size:13px;width:13px;height:13px;color:var(--text-4)">place</mat-icon>
                      {{ r.stop_count }} stops
                    </div>
                    <div class="rcs">
                      <mat-icon style="font-size:13px;width:13px;height:13px;color:var(--text-4)">people</mat-icon>
                      {{ r.student_count }} students
                    </div>
                    @if (r.monthly_fee) {
                      <div class="rcs">
                        <mat-icon style="font-size:13px;width:13px;height:13px;color:var(--green)">payments</mat-icon>
                        <span style="color:var(--green);font-weight:600">₹{{ r.monthly_fee }}/month</span>
                      </div>
                    }
                  </div>
                  <div class="rc-times">
                    @if (r.morning_start) {
                      <span class="time-chip blue">🌅 {{ r.morning_start }}</span>
                    }
                    @if (r.afternoon_start) {
                      <span class="time-chip amber">🌆 {{ r.afternoon_start }}</span>
                    }
                  </div>
                </div>
              }
            </div>
          }
        } @else {
          <!-- Route detail -->
          <div class="route-detail">
            <div class="rd-split">

              <!-- Stops panel -->
              <div class="rd-panel">
                <div class="rdp-head">
                  <span>Stops ({{ selectedRoute()!.stops?.length ?? 0 }})</span>
                  @if (isAdmin()) {
                    <button class="btn-sm" (click)="openStopForm(null)">+ Add Stop</button>
                  }
                </div>
                <div class="stops-list">
                  @for (s of selectedRoute()!.stops; track s.id; let i = $index) {
                    <div class="stop-row">
                      <div class="stop-num">{{ s.stop_order }}</div>
                      <div class="stop-connector" [class.last]="i === selectedRoute()!.stops.length - 1"></div>
                      <div class="stop-info">
                        <div class="stop-name">{{ s.name }}</div>
                        @if (s.address) { <div class="stop-addr">{{ s.address }}</div> }
                        <div class="stop-times">
                          @if (s.morning_eta) { <span class="time-chip blue">🌅 {{ s.morning_eta }}</span> }
                          @if (s.evening_eta) { <span class="time-chip amber">🌆 {{ s.evening_eta }}</span> }
                          @if (s.student_count) { <span class="time-chip grey">{{ s.student_count }} students</span> }
                        </div>
                      </div>
                      @if (isAdmin()) {
                        <div class="stop-actions">
                          <button class="icon-btn" (click)="openStopForm(s)">
                            <mat-icon style="font-size:13px;width:13px;height:13px">edit</mat-icon>
                          </button>
                          <button class="icon-btn danger" (click)="deleteStop(s)">
                            <mat-icon style="font-size:13px;width:13px;height:13px">delete</mat-icon>
                          </button>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Students panel -->
              <div class="rd-panel">
                <div class="rdp-head">
                  <span>Students ({{ selectedRoute()!.students?.length ?? 0 }})</span>
                  @if (isAdmin()) {
                    <button class="btn-sm" (click)="openAssignStudent()">+ Assign Student</button>
                  }
                </div>
                <div class="students-list">
                  @for (s of selectedRoute()!.students; track s.student_id) {
                    <div class="stu-row">
                      <div class="stu-av" [style.background]="getColor(s.student_name)">
                        {{ getInitials(s.student_name) }}
                      </div>
                      <div class="stu-info">
                        <div class="stu-name">{{ s.student_name }}</div>
                        <div class="stu-meta">
                          {{ s.admission_no }}
                          @if (s.class_name) { · {{ s.class_name }} }
                        </div>
                        @if (s.pickup_stop_name) {
                          <div class="stu-stop">
                            📍 {{ s.pickup_stop_name }}
                          </div>
                        }
                      </div>
                      @if (isAdmin()) {
                        <button class="icon-btn danger" (click)="unassignStudent(s)" title="Remove">
                          <mat-icon style="font-size:14px;width:14px;height:14px">person_remove</mat-icon>
                        </button>
                      }
                    </div>
                  }
                  @if (!selectedRoute()!.students?.length) {
                    <div class="empty-panel">No students assigned to this route</div>
                  }
                </div>
              </div>

            </div>
          </div>
        }
      }

      <!-- ── Trips ───────────────────────────────────────────── -->
      @if (activeTab() === 'trips') {
        <div class="tab-header">
          <div class="date-nav">
            <button class="nav-btn" (click)="changeTripDate(-1)">
              <mat-icon style="font-size:17px;width:17px;height:17px">chevron_left</mat-icon>
            </button>
            <input type="date" class="date-input" [value]="tripDate()"
                   (change)="onTripDateChange($event)">
            <button class="nav-btn" (click)="changeTripDate(1)">
              <mat-icon style="font-size:17px;width:17px;height:17px">chevron_right</mat-icon>
            </button>
          </div>
          @if (isAdmin()) {
            <button class="btn-primary" (click)="openStartTrip()">
              <mat-icon style="font-size:15px;width:15px;height:15px">play_arrow</mat-icon>
              Start Trip
            </button>
          }
        </div>

        @if (tripLoading()) {
          <div class="loading-state"><mat-progress-spinner diameter="24" mode="indeterminate"/></div>
        } @else {

          @if (liveStaleTrips().length) {
            <div class="stale-live-banner">
              <mat-icon style="font-size:16px;width:16px;height:16px">warning</mat-icon>
              {{ liveStaleTrips().length }} trip{{ liveStaleTrips().length > 1 ? 's' : '' }} still live from a previous date
            </div>
            <div class="trips-table-wrap" style="margin-bottom:16px">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Date</th><th>Route</th><th>Type</th><th>Vehicle</th>
                    <th>Driver</th><th>Boarded</th><th>Status</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  @for (t of liveStaleTrips(); track t.id) {
                    <tr class="tr stale-live-row">
                      <td>{{ t.trip_date | date:'d MMM' }}</td>
                      <td class="fw">{{ t.route_name }}</td>
                      <td>
                        <span class="type-tag" [class.pickup]="t.trip_type==='morning'" [class.dropoff]="t.trip_type==='evening'">
                          {{ t.trip_type === 'morning' ? '🏫 Pickup' :
                             t.trip_type === 'evening' ? '🏠 Drop' : '⭐ Special' }}
                        </span>
                      </td>
                      <td>{{ t.vehicle_reg ?? '—' }}</td>
                      <td>{{ t.driver_name ?? '—' }}</td>
                      <td>
                        <div class="board-inline">
                          <div class="board-bar sm">
                            <div class="board-fill"
                                 [style.width.%]="t.total_students > 0 ? (t.boarded_count/t.total_students*100) : 0">
                            </div>
                          </div>
                          {{ t.boarded_count }}/{{ t.total_students }}
                        </div>
                      </td>
                      <td><span class="status-pill active">live</span></td>
                      <td>
                        <button class="btn-sm" (click)="openTripDetail(t)">
                          <mat-icon style="font-size:13px;width:13px;height:13px">open_in_new</mat-icon>
                          View
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          @if (!dateTrips().length) {
          <div class="empty-state">
            <mat-icon style="font-size:36px;width:36px;height:36px;color:var(--text-4)">directions_bus</mat-icon>
            <div>No trips on {{ tripDate() | date:'d MMM yyyy' }}</div>
          </div>
          } @else {
          <div class="trips-table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Route</th><th>Type</th><th>Vehicle</th>
                  <th>Driver</th><th>Boarded</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                @for (t of dateTrips(); track t.id) {
                  <tr class="tr">
                    <td class="fw">{{ t.route_name }}</td>
                    <td>
                      <span class="type-tag" [class.pickup]="t.trip_type==='morning'" [class.dropoff]="t.trip_type==='evening'">
                        {{ t.trip_type === 'morning' ? '🏫 Pickup' :
                           t.trip_type === 'evening' ? '🏠 Drop' : '⭐ Special' }}
                      </span>
                    </td>
                    <td>{{ t.vehicle_reg ?? '—' }}</td>
                    <td>{{ t.driver_name ?? '—' }}</td>
                    <td>
                      <div class="board-inline">
                        <div class="board-bar sm">
                          <div class="board-fill"
                               [style.width.%]="t.total_students > 0 ? (t.boarded_count/t.total_students*100) : 0">
                          </div>
                        </div>
                        {{ t.boarded_count }}/{{ t.total_students }}
                      </div>
                    </td>
                    <td>
                      <span class="status-pill"
                            [class.active]="t.status === 'in_progress'"
                            [class.done]="t.status === 'completed'">
                        {{ t.status }}
                      </span>
                    </td>
                    <td>
                      <button class="btn-sm" (click)="openTripDetail(t)">
                        <mat-icon style="font-size:13px;width:13px;height:13px">open_in_new</mat-icon>
                        View
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          }

        }

      }

    <!-- Trip slide panel -->
    @if (activeTripDetail()) {
      <div class="trip-backdrop" (click)="activeTripDetail.set(null)"></div>
      <div class="trip-panel open">

        <!-- Banner -->
        <div class="tp-banner" [class]="'status-' + activeTripDetail()!.status">
          <button class="tp-close" (click)="activeTripDetail.set(null)">
            <mat-icon style="font-size:18px;width:18px;height:18px">close</mat-icon>
          </button>
          <div class="tp-route">{{ activeTripDetail()!.route_name }}</div>
          <div class="tp-meta-row">
            <span class="tp-type-pill">
              {{ activeTripDetail()!.trip_type === 'morning' ? '🏫 Pickup — Home → School' :
                 activeTripDetail()!.trip_type === 'evening' ? '🏠 Drop — School → Home' :
                 activeTripDetail()!.direction === 'pickup'  ? '🏫 Pickup — Home → School' :
                 activeTripDetail()!.direction === 'dropoff' ? '🏠 Drop — School → Home' : '⭐ Special' }}
            </span>
            <span class="tp-status-pill" [class]="activeTripDetail()!.status">
              {{ activeTripDetail()!.status === 'in_progress' ? '🔴 Live' :
                 activeTripDetail()!.status === 'completed'   ? '✓ Completed' : 'Scheduled' }}
            </span>
          </div>
          <!-- Stats -->
          <div class="tp-stats">
            <div class="tp-stat">
              <div class="tp-stat-val">{{ isPickupTrip() ? boardedCount() : droppedCount() }}</div>
              <div class="tp-stat-lbl">{{ isPickupTrip() ? 'Boarded' : 'Dropped' }}</div>
            </div>
            <div class="tp-stat-div"></div>
            <div class="tp-stat">
              <div class="tp-stat-val">{{ activeTripDetail()!.boardings?.length - (isPickupTrip() ? boardedCount() : droppedCount()) }}</div>
              <div class="tp-stat-lbl">{{ isPickupTrip() ? 'Absent' : 'Pending' }}</div>
            </div>
            <div class="tp-stat-div"></div>
            <div class="tp-stat">
              <div class="tp-stat-val">{{ activeTripDetail()!.boardings?.length }}</div>
              <div class="tp-stat-lbl">Total</div>
            </div>
          </div>
          <!-- Progress bar -->
          <div class="tp-progress">
            <div class="tp-progress-fill"
                 [style.width.%]="activeTripDetail()!.boardings?.length > 0
                   ? (boardedCount() / activeTripDetail()!.boardings?.length * 100) : 0">
            </div>
          </div>
        </div>

        <!-- Trip info -->
        <div class="tp-info-row">
          @if (activeTripDetail()!.vehicle_reg) {
            <div class="tp-info-item">
              <mat-icon style="font-size:14px;width:14px;height:14px;color:var(--text-4)">directions_bus</mat-icon>
              {{ activeTripDetail()!.vehicle_reg }}
            </div>
          }
          @if (activeTripDetail()!.driver_name) {
            <div class="tp-info-item">
              <mat-icon style="font-size:14px;width:14px;height:14px;color:var(--text-4)">person</mat-icon>
              {{ activeTripDetail()!.driver_name }}
            </div>
          }
          @if (activeTripDetail()!.start_time) {
            <div class="tp-info-item">
              <mat-icon style="font-size:14px;width:14px;height:14px;color:var(--text-4)">schedule</mat-icon>
              Started {{ activeTripDetail()!.start_time | date:'h:mm a' }}
            </div>
          }
          @if (activeTripDetail()!.end_time) {
            <div class="tp-info-item">
              <mat-icon style="font-size:14px;width:14px;height:14px;color:var(--text-4)">flag</mat-icon>
              Ended {{ activeTripDetail()!.end_time | date:'h:mm a' }}
            </div>
          }
        </div>

        <!-- Assign / Change Driver (in_progress trips) -->
        @if (activeTripDetail()!.status === 'in_progress' && isAdmin()) {
          <div class="tp-driver-row">
            <mat-icon style="font-size:15px;width:15px;height:15px;color:var(--text-3)">person</mat-icon>
            <span class="tp-driver-label">Driver:</span>
            @if (!editingDriver()) {
              <span class="tp-driver-name">{{ activeTripDetail()!.driver_name ?? 'Not assigned' }}</span>
              <button class="tp-driver-edit" (click)="editingDriver.set(true)">
                <mat-icon style="font-size:13px;width:13px;height:13px">edit</mat-icon>
                Change
              </button>
            } @else {
              <select class="tp-driver-select" [(ngModel)]="selectedDriverId">
                <option value="">— Select driver —</option>
                @for (d of drivers(); track d.id) {
                  <option [value]="d.id">{{ d.first_name }} {{ d.last_name }}</option>
                }
              </select>
              <button class="tp-driver-save" (click)="saveDriver()">Save</button>
              <button class="tp-driver-cancel" (click)="editingDriver.set(false)">Cancel</button>
            }
          </div>
        }

        <!-- Boarding list grouped by stop -->
        <div class="tp-body">
          @for (stop of boardingsByStop(); track stop.name) {
            <div class="tp-stop-header">
              <mat-icon style="font-size:13px;width:13px;height:13px;color:var(--blue)">place</mat-icon>
              {{ stop.name }}
              <span class="tp-stop-count">{{ stop.boardings.length }}</span>
            </div>
            @for (b of stop.boardings; track b.student_id) {
              <div class="tp-boarding-row" [class.boarded]="b.boarded" [class.absent]="!b.boarded && activeTripDetail()!.status === 'completed'">
                <div class="tp-av" [style.background]="getColor(b.student_name)">
                  {{ getInitials(b.student_name) }}
                </div>
                <div class="tp-stu-info">
                  <div class="tp-stu-name">{{ b.student_name }}</div>
                  <div class="tp-stu-meta">{{ b.admission_no }}</div>
                </div>
                @if (activeTripDetail()!.status === 'in_progress' && canMarkBoarding()) {
                  @if (isPickupTrip()) {
                    <!-- Pickup: board only -->
                    <button class="tp-board-btn" [class.boarded]="b.boarded"
                            (click)="toggleBoarding(b)">
                      {{ b.boarded ? '✓ Boarded' : 'Board' }}
                    </button>
                  } @else {
                    <!-- Drop trip: board at school + drop at stop -->
                    <div class="tp-action-pair">
                      <button class="tp-board-btn sm" [class.boarded]="b.boarded"
                              (click)="toggleBoarding(b)" title="Boarded at school">
                        {{ b.boarded ? '✓ On' : 'Board' }}
                      </button>
                      <button class="tp-board-btn sm drop" [class.dropped]="b.dropped"
                              [disabled]="!b.boarded"
                              (click)="toggleDropped(b)" title="Dropped at stop">
                        {{ b.dropped ? '✓ Off' : 'Drop' }}
                      </button>
                    </div>
                  }
                } @else {
                  @if (isPickupTrip()) {
                    <span class="tp-board-status" [class.boarded]="b.boarded">
                      {{ b.boarded ? '✓ Boarded' : '✗ Absent' }}
                    </span>
                  } @else {
                    <div class="tp-status-pair">
                      <span class="tp-board-status sm" [class.boarded]="b.boarded">
                        {{ b.boarded ? '✓ On' : '✗' }}
                      </span>
                      <span class="tp-board-status sm" [class.boarded]="b.dropped">
                        {{ b.dropped ? '✓ Off' : '✗' }}
                      </span>
                    </div>
                  }
                }
              </div>
            }
          }
        </div>

        <!-- Footer actions -->
        @if (activeTripDetail()!.status === 'in_progress' && canMarkBoarding()) {
          <div class="tp-footer">
            @if (isPickupTrip()) {
              <button class="btn-mark-all" (click)="markAllBoarded()">
                <mat-icon style="font-size:15px;width:15px;height:15px">done_all</mat-icon>
                Mark All Boarded
              </button>
            } @else {
              <button class="btn-mark-all" (click)="markAllBoarded()">
                <mat-icon style="font-size:15px;width:15px;height:15px">directions_bus</mat-icon>
                All Boarded
              </button>
              <button class="btn-mark-all amber" (click)="markAllDropped()">
                <mat-icon style="font-size:15px;width:15px;height:15px">done_all</mat-icon>
                All Dropped
              </button>
            }
            <button class="btn-complete-trip" (click)="completeTripFromPanel()">
              <mat-icon style="font-size:15px;width:15px;height:15px">flag</mat-icon>
              Complete
            </button>
          </div>
        }

      </div>
    }

    </div>

    <!-- ── Modals ────────────────────────────────────────────── -->

    <!-- Vehicle form -->
    @if (showVehicleForm()) {
      <div class="modal-backdrop" (click)="closeVehicleForm()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div class="mh-icon blue"><mat-icon>directions_bus</mat-icon></div>
            <div>
              <div class="mh-title">{{ editVehicle() ? 'Edit Vehicle' : 'Add Vehicle' }}</div>
            </div>
            <button class="modal-close" (click)="closeVehicleForm()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <div class="modal-body">
            <form [formGroup]="vehicleForm" class="mform">
              <div class="form-row">
                <div class="field-group fill">
                  <label class="fl">Registration No <span class="req">*</span></label>
                  <input class="fi" formControlName="registration_no" placeholder="KA01AB1234">
                </div>
                <div class="field-group fill">
                  <label class="fl">Type <span class="req">*</span></label>
                  <select class="fi" formControlName="vehicle_type">
                    @for (t of vehicleTypes; track t.value) {
                      <option [value]="t.value">{{ t.label }}</option>
                    }
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="field-group fill">
                  <label class="fl">Make</label>
                  <input class="fi" formControlName="make" placeholder="e.g. Tata, Ashok Leyland">
                </div>
                <div class="field-group fill">
                  <label class="fl">Model</label>
                  <input class="fi" formControlName="model" placeholder="e.g. Winger, Dost">
                </div>
              </div>
              <div class="form-row">
                <div class="field-group fill">
                  <label class="fl">Year</label>
                  <input class="fi" type="number" formControlName="year" placeholder="2020">
                </div>
                <div class="field-group fill">
                  <label class="fl">Color</label>
                  <input class="fi" formControlName="color" placeholder="e.g. Yellow">
                </div>
                <div class="field-group fill">
                  <label class="fl">Capacity <span class="req">*</span></label>
                  <input class="fi" type="number" formControlName="capacity" placeholder="20">
                </div>
              </div>
              <div class="form-row">
                <div class="field-group fill">
                  <label class="fl">Fitness Expiry</label>
                  <input class="fi" type="date" formControlName="fitness_expiry">
                </div>
                <div class="field-group fill">
                  <label class="fl">Insurance Expiry</label>
                  <input class="fi" type="date" formControlName="insurance_expiry">
                </div>
              </div>
              <div class="field-group">
                <label class="fl">GPS Device ID</label>
                <input class="fi" formControlName="gps_device_id" placeholder="Device serial / IMEI">
              </div>
              <div class="field-group">
                <label class="fl">Notes</label>
                <input class="fi" formControlName="notes" placeholder="Any notes…">
              </div>
            </form>
          </div>
          @if (formError()) { <div class="form-err"><mat-icon style="font-size:13px;width:13px;height:13px;flex-shrink:0">error_outline</mat-icon>{{ formError() }}</div> }
          <div class="modal-footer">
            <button class="btn-ghost" (click)="closeVehicleForm()">Cancel</button>
            <button class="btn-primary" (click)="saveVehicle()" [disabled]="vehicleForm.invalid || saving()">
              @if (saving()) { <mat-progress-spinner diameter="14" mode="indeterminate" style="--mdc-circular-progress-active-indicator-color:#fff"/> }
              @else { <mat-icon style="font-size:14px;width:14px;height:14px">save</mat-icon> }
              {{ editVehicle() ? 'Save' : 'Add Vehicle' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Route form -->
    @if (showRouteForm()) {
      <div class="modal-backdrop" (click)="closeRouteForm()">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div class="mh-icon purple"><mat-icon>route</mat-icon></div>
            <div><div class="mh-title">{{ editRoute() ? 'Edit Route' : 'New Route' }}</div></div>
            <button class="modal-close" (click)="closeRouteForm()"><mat-icon>close</mat-icon></button>
          </div>
          <div class="modal-body">
            <form [formGroup]="routeForm" class="mform">
              <div class="form-row">
                <div class="field-group fill">
                  <label class="fl">Route Name <span class="req">*</span></label>
                  <input class="fi" formControlName="name" placeholder="e.g. Koramangala Route">
                </div>
                <div class="field-group w120">
                  <label class="fl">Code</label>
                  <input class="fi" formControlName="route_code" placeholder="R1">
                </div>
              </div>
              <div class="field-group">
                <label class="fl">Description</label>
                <input class="fi" formControlName="description" placeholder="Route description">
              </div>
              <div class="form-row">
                <div class="field-group fill">
                  <label class="fl">Vehicle</label>
                  <select class="fi" formControlName="vehicle_id">
                    <option value="">— None —</option>
                    @for (v of vehicles(); track v.id) {
                      <option [value]="v.id">{{ v.registration_no }} ({{ v.vehicle_type }})</option>
                    }
                  </select>
                </div>
                <div class="field-group fill">
                  <label class="fl">Driver</label>
                  <select class="fi" formControlName="driver_id">
                    <option value="">— None —</option>
                    @for (d of drivers(); track d.id) {
                      <option [value]="d.id">{{ d.first_name }} {{ d.last_name }}</option>
                    }
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="field-group fill">
                  <label class="fl">Morning Start</label>
                  <input class="fi" type="time" formControlName="morning_start">
                </div>
                <div class="field-group fill">
                  <label class="fl">Afternoon Start</label>
                  <input class="fi" type="time" formControlName="afternoon_start">
                </div>
              </div>
              <div class="field-group">
                <label class="fl">Monthly Fee (₹)
                  <span style="font-size:10px;color:var(--text-4);font-weight:400">— charged to all students on this route</span>
                </label>
                <input class="fi" type="number" formControlName="monthly_fee" placeholder="e.g. 1500">
              </div>
            </form>
          </div>
          @if (formError()) { <div class="form-err"><mat-icon style="font-size:13px;width:13px;height:13px;flex-shrink:0">error_outline</mat-icon>{{ formError() }}</div> }
          <div class="modal-footer">
            <button class="btn-ghost" (click)="closeRouteForm()">Cancel</button>
            <button class="btn-primary" (click)="saveRoute()" [disabled]="routeForm.invalid || saving()">
              @if (saving()) { <mat-progress-spinner diameter="14" mode="indeterminate" style="--mdc-circular-progress-active-indicator-color:#fff"/> }
              @else { <mat-icon style="font-size:14px;width:14px;height:14px">save</mat-icon> }
              {{ editRoute() ? 'Save' : 'Create Route' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Stop form -->
    @if (showStopForm()) {
      <div class="modal-backdrop" (click)="showStopForm.set(false)">
        <div class="modal sm-modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div class="mh-icon green"><mat-icon>place</mat-icon></div>
            <div><div class="mh-title">{{ editStop() ? 'Edit Stop' : 'Add Stop' }}</div></div>
            <button class="modal-close" (click)="showStopForm.set(false)"><mat-icon>close</mat-icon></button>
          </div>
          <div class="modal-body">
            <form [formGroup]="stopForm" class="mform">
              <div class="form-row">
                <div class="field-group w80">
                  <label class="fl">Order <span class="req">*</span></label>
                  <input class="fi" type="number" formControlName="stop_order" min="1">
                </div>
                <div class="field-group fill">
                  <label class="fl">Stop Name <span class="req">*</span></label>
                  <input class="fi" formControlName="name" placeholder="e.g. Koramangala 5th Block">
                </div>
              </div>
              <div class="field-group">
                <label class="fl">Address</label>
                <input class="fi" formControlName="address" placeholder="Full address or landmark">
              </div>
              <div class="form-row">
                <div class="field-group fill">
                  <label class="fl">Morning ETA</label>
                  <input class="fi" type="time" formControlName="morning_eta">
                </div>
                <div class="field-group fill">
                  <label class="fl">Evening ETA</label>
                  <input class="fi" type="time" formControlName="evening_eta">
                </div>
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn-ghost" (click)="showStopForm.set(false)">Cancel</button>
            <button class="btn-primary" (click)="saveStop()" [disabled]="stopForm.invalid || saving()">
              @if (saving()) { <mat-progress-spinner diameter="14" mode="indeterminate" style="--mdc-circular-progress-active-indicator-color:#fff"/> }
              @else { <mat-icon style="font-size:14px;width:14px;height:14px">save</mat-icon> }
              {{ editStop() ? 'Save' : 'Add Stop' }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Assign student modal -->
    @if (showAssignStudent()) {
      <div class="modal-backdrop" (click)="showAssignStudent.set(false)">
        <div class="modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div class="mh-icon green"><mat-icon>person_add</mat-icon></div>
            <div><div class="mh-title">Assign Student to {{ selectedRoute()?.name }}</div></div>
            <button class="modal-close" (click)="showAssignStudent.set(false)"><mat-icon>close</mat-icon></button>
          </div>
          <div class="modal-body">
            <form [formGroup]="assignForm" class="mform">
              <div class="field-group">
                <label class="fl">Student <span class="req">*</span></label>
                <select class="fi" formControlName="student_id">
                  <option value="">Select student…</option>
                  @for (s of unassignedStudents(); track s.id) {
                    <option [value]="s.id">{{ s.first_name }} {{ s.last_name }} ({{ s.admission_no }}){{ s.class_name ? ' — ' + s.class_name : '' }}</option>
                  }
                </select>
              </div>
              <div class="form-row">
                <div class="field-group fill">
                  <label class="fl">Pickup Stop</label>
                  <select class="fi" formControlName="pickup_stop_id">
                    <option value="">— Select —</option>
                    @for (s of selectedRoute()?.stops ?? []; track s.id) {
                      <option [value]="s.id">{{ s.stop_order }}. {{ s.name }}</option>
                    }
                  </select>
                </div>
                <div class="field-group fill">
                  <label class="fl">Drop Stop</label>
                  <select class="fi" formControlName="drop_stop_id">
                    <option value="">— Same as pickup —</option>
                    @for (s of selectedRoute()?.stops ?? []; track s.id) {
                      <option [value]="s.id">{{ s.stop_order }}. {{ s.name }}</option>
                    }
                  </select>
                </div>
              </div>
              <div class="fee-note">
                <mat-icon style="font-size:13px;width:13px;height:13px;color:var(--green)">payments</mat-icon>
                Transport fee is set on the route (₹{{ getRouteFee() }}/month)
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn-ghost" (click)="showAssignStudent.set(false)">Cancel</button>
            <button class="btn-primary" (click)="saveAssignStudent()" [disabled]="assignForm.invalid || saving()">
              @if (saving()) { <mat-progress-spinner diameter="14" mode="indeterminate" style="--mdc-circular-progress-active-indicator-color:#fff"/> }
              @else { <mat-icon style="font-size:14px;width:14px;height:14px">person_add</mat-icon> }
              Assign Student
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Start trip modal -->
    @if (showStartTrip()) {
      <div class="modal-backdrop" (click)="showStartTrip.set(false)">
        <div class="modal sm-modal" (click)="$event.stopPropagation()">
          <div class="modal-head">
            <div class="mh-icon blue"><mat-icon>play_arrow</mat-icon></div>
            <div><div class="mh-title">Start Trip</div></div>
            <button class="modal-close" (click)="showStartTrip.set(false)"><mat-icon>close</mat-icon></button>
          </div>
          <div class="modal-body">
            <form [formGroup]="tripForm" class="mform">
              <div class="field-group">
                <label class="fl">Route <span class="req">*</span></label>
                <select class="fi" formControlName="route_id"
                        (change)="onTripRouteChange($any($event.target).value)">
                  <option value="">Select route…</option>
                  @for (r of routes(); track r.id) {
                    <option [value]="r.id">{{ r.name }}</option>
                  }
                </select>
              </div>
              <div class="form-row">
                <div class="field-group fill">
                  <label class="fl">Date <span class="req">*</span></label>
                  <input class="fi" type="date" formControlName="trip_date">
                </div>
                <div class="field-group fill">
                  <label class="fl">Direction <span class="req">*</span></label>
                  <select class="fi" formControlName="trip_type">
                    <option value="morning">🏫 Pickup — Home → School</option>
                    <option value="evening">🏠 Drop — School → Home</option>
                    <option value="special">⭐ Special</option>
                  </select>
                </div>
              </div>
              <div class="field-group">
                <label class="fl">Driver
                  <span style="font-size:10px;color:var(--text-4);font-weight:400"> — auto-filled from route, can override</span>
                </label>
                <select class="fi" formControlName="driver_id">
                  <option value="">— No driver assigned —</option>
                  @for (d of drivers(); track d.id) {
                    <option [value]="d.id">{{ d.first_name }} {{ d.last_name }}</option>
                  }
                </select>
                @if (!tripForm.value.driver_id) {
                  <div style="font-size:11px;color:var(--amber);margin-top:3px;display:flex;align-items:center;gap:4px">
                    <mat-icon style="font-size:12px;width:12px;height:12px">warning</mat-icon>
                    No driver — trip can still be started but assign one soon
                  </div>
                }
              </div>
            </form>
          </div>
          <div class="modal-footer">
            <button class="btn-ghost" (click)="showStartTrip.set(false)">Cancel</button>
            <button class="btn-primary" (click)="doStartTrip()" [disabled]="tripForm.invalid || saving()">
              @if (saving()) { <mat-progress-spinner diameter="14" mode="indeterminate" style="--mdc-circular-progress-active-indicator-color:#fff"/> }
              @else { <mat-icon style="font-size:14px;width:14px;height:14px">play_arrow</mat-icon> }
              Start Trip
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .transport-page { display: flex; flex-direction: column; gap: 14px; }

    /* Tabs */
    .tab-bar { display: flex; gap: 4px; border-bottom: 1px solid var(--border); padding-bottom: 0; }
    .tab-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 16px; border: none; background: none; cursor: pointer;
      font-size: 13px; font-weight: 500; color: var(--text-3); border-radius: 7px 7px 0 0;
      border-bottom: 2px solid transparent; margin-bottom: -1px;
      &:hover { color: var(--text-2); background: var(--bg); }
      &.active { color: var(--blue); border-bottom-color: var(--blue); background: var(--blue-light); }
    }

    /* Tab header */
    .tab-header { display: flex; align-items: center; gap: 10px; }
    .th-title { font-size: 13px; color: var(--text-3); flex: 1; }

    /* Stats */
    .stats-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 10px; }
    .stat-card { display: flex; align-items: center; gap: 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
    .sc-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .sc-val { font-size: 22px; font-weight: 700; color: var(--text); }
    .sc-lbl { font-size: 11px; color: var(--text-3); margin-top: 2px; }

    /* Section head */
    .section-head { font-size: 13px; font-weight: 600; color: var(--text); margin-top: 4px; }

    /* Dashboard grid */
    .dash-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .dash-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .dc-head { display: flex; align-items: center; gap: 7px; padding: 10px 14px; background: var(--bg); border-bottom: 1px solid var(--border); font-size: 12.5px; font-weight: 600; color: var(--text); }
    .dc-body { padding: 6px 0; }
    .dc-empty { padding: 20px; text-align: center; font-size: 12px; color: var(--text-3); }
    .live-badge { margin-left: auto; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; background: var(--red-light); color: var(--red); animation: pulse 1.5s infinite; }

    /* Route occupancy */
    .occ-row { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid var(--border-light); &:last-child { border-bottom: none; } }
    .occ-av  { width: 28px; height: 28px; border-radius: 7px; color: #fff; font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .occ-info { flex: 1; min-width: 0; }
    .occ-name { font-size: 12.5px; font-weight: 500; color: var(--text); }
    .occ-meta { font-size: 11px; color: var(--text-3); }
    .occ-bar-wrap { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .occ-bar  { width: 60px; height: 5px; background: var(--border); border-radius: 3px; overflow: hidden; }
    .occ-fill { height: 100%; border-radius: 3px; }
    .occ-count { font-size: 11px; font-weight: 600; color: var(--text-2); white-space: nowrap; }

    /* Today trips */
    .trip-row { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid var(--border-light); &:last-child { border-bottom: none; } &.clickable { cursor: pointer; &:hover { background: var(--bg); } } }
    .tr-info  { flex: 1; }
    .tr-name  { font-size: 12.5px; font-weight: 500; color: var(--text); display: flex; align-items: center; }
    .tr-meta  { font-size: 11px; color: var(--text-3); }
    .tr-board { display: flex; align-items: center; gap: 5px; }
    .trip-status { font-size: 10.5px; font-weight: 600; padding: 2px 8px; border-radius: 10px; background: var(--bg); color: var(--text-3); white-space: nowrap; &.live { background: var(--red-light); color: var(--red); } &.done { background: var(--green-light); color: #065F46; } }
    .expiry-warn-bar { display: flex; align-items: center; gap: 6px; padding: 8px 14px; background: var(--amber-light); color: #92400E; font-size: 12px; font-weight: 500; border-top: 1px solid var(--border); }

    /* Revenue */
    .rev-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px,1fr)); gap: 8px; padding: 12px; }
    .rev-card { background: var(--bg); border-radius: 8px; padding: 10px 12px; text-align: center; &.total { background: var(--green-light); border: 1px solid var(--green); } }
    .rev-name { font-size: 11px; color: var(--text-3); margin-bottom: 4px; }
    .rev-amt  { font-size: 17px; font-weight: 700; }
    .rev-calc { font-size: 10px; color: var(--text-4); margin-top: 2px; }

    /* Live trips */
    .trips-live { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px,1fr)); gap: 10px; }
    .live-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .lc-header { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--bg); border-bottom: 1px solid var(--border-light); }
    .live-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--red); animation: pulse 1.5s infinite; flex-shrink: 0; }
    @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.4; } }
    .lc-route { font-size: 13px; font-weight: 600; color: var(--text); flex: 1; }
    .lc-type  { font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 10px; background: var(--blue-light); color: var(--blue); }
    .lc-reg   { font-size: 11px; color: var(--text-3); font-family: monospace; }
    .lc-body  { padding: 10px 14px; display: flex; flex-direction: column; gap: 8px; }
    .lc-driver { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-2); }
    .lc-board { display: flex; align-items: center; gap: 8px; }
    .board-bar { flex: 1; height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; }
    .board-bar.sm { width: 60px; flex: none; }
    .board-fill { height: 100%; background: var(--green); border-radius: 3px; transition: width .3s; }
    .board-label { font-size: 12px; font-weight: 600; color: var(--green); white-space: nowrap; }
    .board-inline { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-2); }

    /* Expiry */
    .expiry-list { display: flex; flex-direction: column; gap: 6px; }
    .expiry-row { display: flex; align-items: center; gap: 10px; background: var(--amber-light); border: 1px solid var(--amber); border-radius: 8px; padding: 8px 12px; }
    .er-reg { font-size: 13px; font-weight: 600; color: var(--text); flex: 1; }
    .er-tag { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }
    .er-tag.amber { background: var(--amber); color: #fff; }
    .er-tag.red   { background: var(--red);   color: #fff; }

    /* Search */
    .search-wrap { display: flex; align-items: center; gap: 6px; flex: 1; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0 10px; height: 34px; &:focus-within { border-color: var(--blue); } }
    .si { font-size: 16px; width: 16px; height: 16px; color: var(--text-4); flex-shrink: 0; }
    .si-input { flex: 1; border: none; background: none; outline: none; font-size: 13px; color: var(--text); }

    /* Table */
    .data-table-wrap, .trips-table-wrap { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .stale-live-banner { display: flex; align-items: center; gap: 6px; padding: 8px 12px; background: var(--red-light); color: var(--red); border-radius: 8px; font-size: 12px; font-weight: 600; margin-bottom: 8px; }
    .stale-live-row { background: color-mix(in srgb, var(--red-light) 30%, transparent); }
    .data-table { width: 100%; border-collapse: collapse; }
    .data-table thead th { padding: 9px 14px; text-align: left; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: .4px; color: var(--text-4); background: var(--bg); border-bottom: 1px solid var(--border); }
    .data-table .tr { border-bottom: 1px solid var(--border-light); &:last-child { border-bottom: none; } &:hover { background: var(--bg); } }
    .data-table td { padding: 9px 14px; font-size: 13px; color: var(--text-2); vertical-align: middle; }
    .fw { font-weight: 600; color: var(--text) !important; }
    .tc { text-align: center; }
    .text-muted { color: var(--text-4); }
    .expiry-warn { color: var(--red) !important; font-weight: 500; }

    /* Pills */
    .type-tag { font-size: 10.5px; font-weight: 600; padding: 2px 8px; border-radius: 5px; background: var(--bg); color: var(--text-2);
      &.pickup  { background: var(--blue-light); color: var(--blue); }
      &.dropoff { background: var(--amber-light); color: #92400E; }
    }
    .status-pill { font-size: 11px; font-weight: 600; padding: 3px 9px; border-radius: 20px; background: var(--bg); color: var(--text-3); &.active { background: var(--green-light); color: #065F46; } &.done { background: var(--blue-light); color: var(--blue); } &.inactive { background: var(--border-light); color: var(--text-4); } }

    /* Route grid */
    .route-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px,1fr)); gap: 12px; }
    .route-card { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; padding: 14px; cursor: pointer; &:hover { box-shadow: 0 4px 12px rgba(0,0,0,.08); } }
    .rc-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .rc-av { width: 36px; height: 36px; border-radius: 9px; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .rc-name { font-size: 14px; font-weight: 600; color: var(--text); }
    .rc-code { font-size: 11px; color: var(--text-3); }
    .rc-stats { display: flex; flex-direction: column; gap: 4px; margin-bottom: 10px; }
    .rcs { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-2); }
    .rc-times { display: flex; gap: 6px; }
    .time-chip { font-size: 10.5px; font-weight: 600; padding: 2px 8px; border-radius: 10px; }
    .time-chip.blue  { background: var(--blue-light);  color: var(--blue); }
    .time-chip.amber { background: var(--amber-light); color: #92400E; }
    .time-chip.grey  { background: var(--bg); color: var(--text-3); }

    /* Route detail */
    .route-detail { display: flex; flex-direction: column; gap: 12px; }
    .rd-split { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .rd-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .rdp-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; background: var(--bg); border-bottom: 1px solid var(--border); font-size: 13px; font-weight: 600; color: var(--text); }

    /* Stops */
    .stops-list { padding: 10px 14px; display: flex; flex-direction: column; gap: 0; }
    .stop-row { display: flex; align-items: flex-start; gap: 10px; padding: 8px 0; position: relative; }
    .stop-num { width: 22px; height: 22px; border-radius: 50%; background: var(--blue); color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
    .stop-connector { position: absolute; left: 10px; top: 26px; bottom: 0; width: 2px; background: var(--border); &.last { display: none; } }
    .stop-info { flex: 1; }
    .stop-name { font-size: 13px; font-weight: 500; color: var(--text); }
    .stop-addr { font-size: 11px; color: var(--text-3); margin-top: 2px; }
    .stop-times { display: flex; gap: 5px; margin-top: 4px; flex-wrap: wrap; }
    .stop-actions { display: flex; gap: 3px; }

    /* Students in route */
    .students-list { max-height: 400px; overflow-y: auto; }
    .stu-row { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid var(--border-light); &:last-child { border-bottom: none; } }
    .stu-av { width: 28px; height: 28px; border-radius: 7px; color: #fff; font-size: 9px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; &.sm { width: 24px; height: 24px; font-size: 8px; } }
    .stu-info { flex: 1; }
    .stu-name { font-size: 12.5px; font-weight: 500; color: var(--text); }
    .stu-meta { font-size: 10.5px; color: var(--text-3); }
    .stu-stop { font-size: 10.5px; color: var(--blue); margin-top: 1px; }
    .fee-note { display:flex; align-items:center; gap:6px; background:var(--green-light); border:1px solid var(--green); border-radius:8px; padding:10px 12px; font-size:12.5px; color:#065F46; font-weight:500; }
    .empty-panel { padding: 24px; text-align: center; font-size: 12px; color: var(--text-3); }

    /* Trip detail */
    .trip-detail-panel { background: var(--surface); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
    .tdp-head { display: flex; align-items: center; gap: 8px; padding: 10px 14px; background: var(--bg); border-bottom: 1px solid var(--border); }
    .tdp-title { font-size: 13px; font-weight: 600; color: var(--text); flex: 1; display: flex; align-items: center; gap: 8px; }
    .tdp-body { display: flex; flex-direction: column; }
    .boarding-row { display: flex; align-items: center; gap: 10px; padding: 8px 14px; border-bottom: 1px solid var(--border-light); &:last-child { border-bottom: none; } &.boarded { background: #F0FDF4; } }
    .br-info { flex: 1; }
    .board-btn { padding: 4px 12px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg); font-size: 11.5px; cursor: pointer; font-weight: 500; color: var(--text-2); &.boarded { background: var(--green); color: #fff; border-color: var(--green); } &:hover:not(.boarded) { background: var(--green-light); } }
    .board-status { font-size: 11.5px; font-weight: 600; &.boarded { color: var(--green); } &:not(.boarded) { color: var(--red); } }

    /* Buttons */
    .btn-primary { display: inline-flex; align-items: center; gap: 5px; background: var(--blue); color: #fff; border: none; border-radius: 8px; height: 34px; padding: 0 14px; font-size: 12.5px; font-weight: 500; cursor: pointer; &:hover:not(:disabled) { background: #1D4ED8; } &:disabled { opacity: .6; cursor: not-allowed; } }
    .btn-ghost { background: none; border: none; cursor: pointer; font-size: 13px; color: var(--text-3); padding: 0 10px; height: 34px; border-radius: 7px; &:hover { background: var(--border-light); } }
    .btn-back { display: flex; align-items: center; gap: 4px; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; height: 32px; padding: 0 12px; font-size: 12.5px; color: var(--text-2); cursor: pointer; &:hover { background: var(--bg); } }
    .btn-sm { padding: 3px 10px; border-radius: 6px; border: 1px solid var(--border); background: var(--surface); font-size: 11.5px; cursor: pointer; color: var(--text-2); &:hover { background: var(--bg); } &.danger { color: var(--red); &:hover { background: var(--red-light); border-color: var(--red); } } }
    .icon-btn { width: 28px; height: 28px; border-radius: 6px; background: none; border: none; cursor: pointer; color: var(--text-3); display: flex; align-items: center; justify-content: center; &:hover { background: var(--blue-light); color: var(--blue); } &.danger:hover { background: var(--red-light); color: var(--red); } }
    .nav-btn { width: 30px; height: 30px; border-radius: 7px; background: var(--surface); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-2); &:hover { background: var(--bg); } }
    .date-input { height: 30px; padding: 0 10px; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; font-size: 12.5px; color: var(--text); outline: none; }
    .date-nav { display: flex; align-items: center; gap: 4px; flex: 1; }

    /* Modal */
    .modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.4); display: flex; align-items: center; justify-content: center; z-index: 1000; }
    .modal { background: var(--surface); border-radius: 12px; width: 95vw; max-width: 520px; display: flex; flex-direction: column; max-height: 90vh; overflow: hidden; }
    .modal.sm-modal { max-width: 400px; }
    .modal-head { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
    .mh-icon { width: 36px; height: 36px; border-radius: 9px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; mat-icon { font-size: 18px; width: 18px; height: 18px; } &.blue { background: var(--blue-light); color: var(--blue); } &.purple { background: var(--purple-light); color: var(--purple); } &.green { background: var(--green-light); color: var(--green); } }
    .mh-title { font-size: 15px; font-weight: 600; color: var(--text); }
    .modal-close { margin-left: auto; background: none; border: none; cursor: pointer; color: var(--text-3); width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; mat-icon { font-size: 18px; } &:hover { background: var(--bg); } }
    .modal-body { flex: 1; overflow-y: auto; padding: 16px 20px; background: var(--bg); }
    .modal-footer { display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px; border-top: 1px solid var(--border); background: var(--surface); flex-shrink: 0; }
    .mform { display: flex; flex-direction: column; gap: 12px; }
    .form-row { display: flex; gap: 10px; }
    .fill  { flex: 1; min-width: 0; }
    .w80   { width: 80px; flex-shrink: 0; }
    .w120  { width: 120px; flex-shrink: 0; }
    .field-group { display: flex; flex-direction: column; gap: 4px; }
    .fl { font-size: 12px; font-weight: 500; color: var(--text-2); .req { color: var(--red); } }
    .fi { height: 34px; padding: 0 10px; width: 100%; background: var(--surface); border: 1px solid var(--border); border-radius: 7px; font-size: 13px; color: var(--text); outline: none; font-family: inherit; &:focus { border-color: var(--blue); } }
    select.fi { cursor: pointer; }
    .form-err { display: flex; align-items: center; gap: 7px; padding: 10px 20px; background: var(--red-light); font-size: 12.5px; color: #991B1B; flex-shrink: 0; }

    /* Trip slide panel */
    .trip-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.3); z-index: 900; backdrop-filter: blur(2px); }
    .trip-panel {
      position: fixed; top: 0; right: 0; bottom: 0; width: 420px; max-width: 95vw;
      background: var(--bg); z-index: 901; display: flex; flex-direction: column;
      box-shadow: -8px 0 32px rgba(0,0,0,.15);
      transform: translateX(100%); transition: transform .28s cubic-bezier(.4,0,.2,1);
      &.open { transform: translateX(0); }
    }
    .tp-close {
      position: absolute; top: 10px; right: 10px;
      background: rgba(255,255,255,.2); border: none; cursor: pointer;
      color: #fff; width: 30px; height: 30px; border-radius: 7px;
      display: flex; align-items: center; justify-content: center;
      &:hover { background: rgba(255,255,255,.3); }
    }
    .tp-banner {
      padding: 14px 20px 16px; flex-shrink: 0; position: relative;
      background: #1E3A8A;
      &.status-in_progress { background: #064E3B; }
      &.status-completed   { background: #1E3A8A; }
      &.status-scheduled   { background: #374151; }
    }
    .tp-route    { font-size: 20px; font-weight: 700; color: #fff; margin-top: 8px; }
    .tp-meta-row { display: flex; gap: 8px; margin-top: 6px; }
    .tp-type-pill { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; background: rgba(255,255,255,.2); color: #fff; text-transform: capitalize; }
    .tp-status-pill { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 20px; background: rgba(255,255,255,.15); color: rgba(255,255,255,.9); }
    .tp-stats { display: flex; align-items: center; margin-top: 12px; }
    .tp-stat { flex: 1; text-align: center; }
    .tp-stat-val { font-size: 22px; font-weight: 700; color: #fff; }
    .tp-stat-lbl { font-size: 10px; color: rgba(255,255,255,.6); margin-top: 2px; }
    .tp-stat-div { width: 1px; height: 32px; background: rgba(255,255,255,.2); }
    .tp-progress { height: 4px; background: rgba(255,255,255,.2); border-radius: 2px; margin-top: 12px; overflow: hidden; }
    .tp-progress-fill { height: 100%; background: #10B981; border-radius: 2px; transition: width .3s; }
    .tp-info-row { display: flex; flex-wrap: wrap; gap: 12px; padding: 10px 16px; background: var(--surface); border-bottom: 1px solid var(--border); flex-shrink: 0; }
    .tp-info-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: var(--text-2); }
    .tp-body { flex: 1; overflow-y: auto; }
    .tp-driver-row {
      display: flex; align-items: center; gap: 8px; padding: 8px 16px;
      background: var(--amber-light); border-bottom: 1px solid var(--border);
      font-size: 12.5px; flex-shrink: 0;
    }
    .tp-driver-label { font-weight: 600; color: var(--text-2); }
    .tp-driver-name  { color: var(--text); flex: 1; }
    .tp-driver-edit  { display:flex;align-items:center;gap:3px;background:none;border:none;cursor:pointer;font-size:11.5px;color:var(--blue);font-weight:500;padding:3px 6px;border-radius:5px;&:hover{background:var(--blue-light)}; mat-icon{} }
    .tp-driver-select { flex:1;height:28px;padding:0 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--surface);color:var(--text);outline:none; }
    .tp-driver-save   { height:28px;padding:0 10px;border-radius:6px;border:none;background:var(--green);color:#fff;font-size:11.5px;font-weight:600;cursor:pointer; }
    .tp-driver-cancel { height:28px;padding:0 10px;border-radius:6px;border:1px solid var(--border);background:none;font-size:11.5px;color:var(--text-3);cursor:pointer; }

    .tp-stop-header {
      display: flex; align-items: center; gap: 6px; padding: 8px 16px;
      font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px;
      color: var(--text-3); background: var(--bg); border-bottom: 1px solid var(--border-light);
      position: sticky; top: 0; z-index: 1;
    }
    .tp-stop-count { margin-left: auto; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 10px; background: var(--border); color: var(--text-3); }
    .tp-boarding-row {
      display: flex; align-items: center; gap: 10px; padding: 9px 16px;
      border-bottom: 1px solid var(--border-light);
      &:last-child { border-bottom: none; }
      &.boarded { background: #F0FDF4; }
      &.absent  { background: #FEF2F2; }
    }
    .tp-av { width: 30px; height: 30px; border-radius: 8px; color: #fff; font-size: 10px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .tp-stu-info { flex: 1; }
    .tp-stu-name { font-size: 13px; font-weight: 500; color: var(--text); }
    .tp-stu-meta { font-size: 10.5px; color: var(--text-3); }
    .tp-action-pair  { display: flex; gap: 4px; }
    .tp-status-pair  { display: flex; gap: 4px; }
    .tp-board-btn {
      padding: 5px 12px; border-radius: 6px; border: 1.5px solid var(--border);
      background: var(--bg); font-size: 11.5px; font-weight: 600; cursor: pointer;
      color: var(--text-2); transition: all .1s;
      &.sm { padding: 4px 8px; font-size: 10.5px; }
      &:disabled { opacity: .4; cursor: not-allowed; }
      &.boarded  { background: #10B981; color: #fff; border-color: #10B981; }
      &.dropped  { background: #F59E0B; color: #fff; border-color: #F59E0B; }
      &.drop:hover:not(.dropped) { background: var(--amber-light); border-color: var(--amber); }
      &:hover:not(.boarded):not(.dropped):not(.drop) { background: var(--green-light); border-color: var(--green); }
    }
    .tp-board-status { font-size: 16px; font-weight: 700; &.boarded { color: var(--green); } &:not(.boarded) { color: var(--red); } }
    .tp-footer { display: flex; gap: 8px; padding: 12px 16px; border-top: 1px solid var(--border); background: var(--surface); flex-shrink: 0; }
    .btn-mark-all { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; height: 36px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); font-size: 13px; font-weight: 500; color: var(--text-2); cursor: pointer;
      &:hover { background: var(--green-light); border-color: var(--green); color: #065F46; }
      &.amber { &:hover { background: var(--amber-light); border-color: var(--amber); color: #92400E; } }
    }
    .btn-complete-trip { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; height: 36px; border: none; border-radius: 8px; background: #064E3B; color: #fff; font-size: 13px; font-weight: 600; cursor: pointer; &:hover { background: #065F46; } }

    /* States */
    .loading-state { display: flex; align-items: center; gap: 12px; justify-content: center; padding: 60px; color: var(--text-3); font-size: 13px; }
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 60px; color: var(--text-3); font-size: 13px; }
  `],
})
export class TransportComponent implements OnInit {
  private api   = inject(ApiService);
  private snack = inject(MatSnackBar);
  private auth  = inject(AuthService);
  private fb    = inject(FormBuilder);

  activeTab  = signal<Tab>('dashboard');
  tabs = [
    { key: 'dashboard' as Tab, label: 'Dashboard', icon: 'dashboard'      },
    { key: 'vehicles'  as Tab, label: 'Vehicles',  icon: 'directions_bus' },
    { key: 'routes'    as Tab, label: 'Routes',    icon: 'route'          },
    { key: 'trips'     as Tab, label: 'Trips',     icon: 'calendar_today' },
  ];

  // Data signals
  dash               = signal<any | null>(null);
  vehicles           = signal<any[]>([]);
  routes             = signal<any[]>([]);
  trips              = signal<any[]>([]);
  drivers            = signal<any[]>([]);
  unassignedStudents = signal<any[]>([]);
  selectedRoute      = signal<any | null>(null);
  activeTripDetail   = signal<any | null>(null);
  editingDriver      = signal(false);
  selectedDriverId   = '';

  // Loading
  dashLoading    = signal(true);
  vehicleLoading = signal(false);
  routeLoading   = signal(false);
  tripLoading    = signal(false);
  saving         = signal(false);

  // Modals
  showVehicleForm   = signal(false);
  showRouteForm     = signal(false);
  showStopForm      = signal(false);
  showAssignStudent = signal(false);
  showStartTrip     = signal(false);
  editVehicle       = signal<any | null>(null);
  editRoute         = signal<any | null>(null);
  editStop          = signal<any | null>(null);
  formError         = signal('');

  // Search / filters
  vehicleSearch = '';
  tripDate      = signal(new Date().toISOString().slice(0, 10));

  // Trips for the selected date
  dateTrips     = computed(() => this.trips().filter(t => String(t.trip_date).slice(0, 10) === this.tripDate()));
  // Live trips stuck from a previous date
  liveStaleTrips = computed(() => this.trips().filter(t => t.status === 'in_progress' && String(t.trip_date).slice(0, 10) !== this.tripDate()));

  vehicleTypes = VEHICLE_TYPES;
  isAdmin       = () => ['owner', 'principal'].includes(this.auth.user()?.role ?? '');
  canMarkBoarding = () => ['owner', 'principal', 'driver', 'support'].includes(this.auth.user()?.role ?? '');

  filteredVehicles = computed(() => {
    const q = this.vehicleSearch.toLowerCase();
    if (!q) return this.vehicles();
    return this.vehicles().filter(v =>
      v.registration_no?.toLowerCase().includes(q) ||
      v.make?.toLowerCase().includes(q) ||
      v.model?.toLowerCase().includes(q)
    );
  });

  // Forms
  vehicleForm = this.fb.group({
    registration_no:  ['', Validators.required],
    vehicle_type:     ['bus', Validators.required],
    make:             [''],
    model:            [''],
    year:             [null as number | null],
    color:            [''],
    capacity:         [20, [Validators.required, Validators.min(1)]],
    fitness_expiry:   [''],
    insurance_expiry: [''],
    gps_device_id:    [''],
    notes:            [''],
  });

  routeForm = this.fb.group({
    name:             ['', Validators.required],
    route_code:       [''],
    description:      [''],
    vehicle_id:       [''],
    driver_id:        [''],
    morning_start:    [''],
    afternoon_start:  [''],
    monthly_fee:      [null as number | null],
  });

  stopForm = this.fb.group({
    stop_order:  [1, Validators.required],
    name:        ['', Validators.required],
    address:     [''],
    morning_eta: [''],
    evening_eta: [''],
  });

  assignForm = this.fb.group({
    student_id:     ['', Validators.required],
    pickup_stop_id: [''],
    drop_stop_id:   [''],
  });

  tripForm = this.fb.group({
    route_id:  ['', Validators.required],
    trip_date: [new Date().toISOString().slice(0, 10), Validators.required],
    trip_type: ['morning'],
    driver_id: [''],
  });

  ngOnInit() {
    this.loadDashboard();
    this.loadVehicles();
    this.loadRoutes();
    this.loadDrivers();
    this.loadTrips();
  }

  loadDashboard() {
    this.dashLoading.set(true);
    this.api.get<any>('/transport/dashboard').subscribe({
      next: (res: any) => { this.dash.set(res.data); this.dashLoading.set(false); },
      error: () => this.dashLoading.set(false),
    });
  }

  loadVehicles() {
    this.vehicleLoading.set(true);
    this.api.get<any>('/transport/vehicles').subscribe({
      next: (res: any) => { this.vehicles.set(res.data ?? []); this.vehicleLoading.set(false); },
      error: () => this.vehicleLoading.set(false),
    });
  }

  loadRoutes() {
    this.routeLoading.set(true);
    this.api.get<any>('/transport/routes').subscribe({
      next: (res: any) => { this.routes.set(res.data ?? []); this.routeLoading.set(false); },
      error: () => this.routeLoading.set(false),
    });
  }

  loadDrivers() {
    this.api.get<any>('/staff', { role: 'driver', limit: '100' }).subscribe({
      next: (res: any) => this.drivers.set(res.data?.items ?? res.data ?? []),
      error: () => {},
    });
  }

  loadTrips() {
    this.tripLoading.set(true);
    this.api.get<any>('/transport/trips', { date: this.tripDate() }).subscribe({
      next: (res: any) => { this.trips.set(res.data ?? []); this.tripLoading.set(false); },
      error: () => this.tripLoading.set(false),
    });
  }

  // Vehicles
  openVehicleForm(v: any | null) {
    this.editVehicle.set(v); this.formError.set('');
    if (v) this.vehicleForm.patchValue({ ...v, fitness_expiry: v.fitness_expiry?.slice(0,10) ?? '', insurance_expiry: v.insurance_expiry?.slice(0,10) ?? '' });
    else this.vehicleForm.reset({ vehicle_type: 'bus', capacity: 20 });
    this.showVehicleForm.set(true);
  }
  closeVehicleForm() { this.showVehicleForm.set(false); this.editVehicle.set(null); }
  saveVehicle() {
    if (this.vehicleForm.invalid) return;
    this.saving.set(true); this.formError.set('');
    const v = this.vehicleForm.value;
    const req = this.editVehicle()
      ? this.api.put<any>('/transport/vehicles/' + this.editVehicle()!.id, v)
      : this.api.post<any>('/transport/vehicles', v);
    req.subscribe({
      next: () => { this.saving.set(false); this.closeVehicleForm(); this.snack.open('Vehicle saved', 'OK', { duration: 2500 }); this.loadVehicles(); this.loadDashboard(); },
      error: (err: any) => { this.saving.set(false); this.formError.set(err.error?.error?.message ?? 'Error'); },
    });
  }

  // Routes
  openRouteForm(r: any | null) {
    this.editRoute.set(r); this.formError.set('');
    if (r) this.routeForm.patchValue({ ...r, monthly_fee: r.monthly_fee ?? null });
    else this.routeForm.reset();
    this.showRouteForm.set(true);
  }
  closeRouteForm() { this.showRouteForm.set(false); this.editRoute.set(null); }
  saveRoute() {
    if (this.routeForm.invalid) return;
    this.saving.set(true); this.formError.set('');
    const v = this.routeForm.value;
    const req = this.editRoute()
      ? this.api.put<any>('/transport/routes/' + this.editRoute()!.id, v)
      : this.api.post<any>('/transport/routes', v);
    req.subscribe({
      next: () => { this.saving.set(false); this.closeRouteForm(); this.snack.open('Route saved', 'OK', { duration: 2500 }); this.loadRoutes(); },
      error: (err: any) => { this.saving.set(false); this.formError.set(err.error?.error?.message ?? 'Error'); },
    });
  }

  openRoute(r: any) {
    this.api.get<any>('/transport/routes/' + r.id).subscribe({
      next: (res: any) => this.selectedRoute.set(res.data),
      error: () => {},
    });
  }

  // Stops
  openStopForm(s: any | null) {
    this.editStop.set(s);
    if (s) this.stopForm.patchValue(s);
    else this.stopForm.reset({ stop_order: (this.selectedRoute()?.stops?.length ?? 0) + 1 });
    this.showStopForm.set(true);
  }
  saveStop() {
    if (this.stopForm.invalid || !this.selectedRoute()) return;
    this.saving.set(true);
    const routeId = this.selectedRoute()!.id;
    const stopId  = this.editStop()?.id;
    const req = stopId
      ? this.api.put<any>(`/transport/routes/${routeId}/stops/${stopId}`, this.stopForm.value)
      : this.api.post<any>(`/transport/routes/${routeId}/stops`, this.stopForm.value);
    req.subscribe({
      next: () => { this.saving.set(false); this.showStopForm.set(false); this.snack.open('Stop saved', 'OK', { duration: 2500 }); this.openRoute(this.selectedRoute()); },
      error: (err: any) => { this.saving.set(false); this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }); },
    });
  }
  deleteStop(s: any) {
    if (!confirm('Delete stop "' + s.name + '"?')) return;
    this.api.delete<any>(`/transport/routes/${this.selectedRoute()!.id}/stops/${s.id}`).subscribe({
      next: () => { this.snack.open('Stop deleted', 'OK', { duration: 2000 }); this.openRoute(this.selectedRoute()); },
      error: () => {},
    });
  }

  // Students
  openAssignStudent() {
    this.api.get<any>('/transport/students/unassigned').subscribe({
      next: (res: any) => { this.unassignedStudents.set(res.data ?? []); this.assignForm.reset(); this.showAssignStudent.set(true); },
      error: () => {},
    });
  }
  saveAssignStudent() {
    if (this.assignForm.invalid || !this.selectedRoute()) return;
    this.saving.set(true);
    const v = this.assignForm.value;
    this.api.post<any>('/transport/students/assign', {
      student_id:     v.student_id,
      route_id:       this.selectedRoute()!.id,
      stop_no:        1,
      pickup_stop_id: v.pickup_stop_id || undefined,
      drop_stop_id:   v.drop_stop_id   || undefined,
    }).subscribe({
      next: () => { this.saving.set(false); this.showAssignStudent.set(false); this.snack.open('Student assigned', 'OK', { duration: 2500 }); this.openRoute(this.selectedRoute()); },
      error: (err: any) => { this.saving.set(false); this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }); },
    });
  }
  unassignStudent(s: any) {
    if (!confirm('Remove ' + s.student_name + ' from this route?')) return;
    this.api.delete<any>('/transport/students/' + s.student_id).subscribe({
      next: () => { this.snack.open('Student removed', 'OK', { duration: 2000 }); this.openRoute(this.selectedRoute()); },
      error: () => {},
    });
  }

  // Trips
  onTripDateChange(e: Event) { this.tripDate.set((e.target as HTMLInputElement).value); this.loadTrips(); }
  changeTripDate(dir: number) { const d = new Date(this.tripDate()); d.setDate(d.getDate()+dir); this.tripDate.set(d.toISOString().slice(0,10)); this.loadTrips(); }

  onTripRouteChange(routeId: string) {
    if (!routeId) return;
    const route = this.routes().find(r => r.id === routeId);
    if (route?.driver_id) {
      this.tripForm.patchValue({ driver_id: route.driver_id });
    }
  }

  openStartTrip() { this.tripForm.reset({ trip_date: this.tripDate(), trip_type: 'morning', driver_id: '' }); this.showStartTrip.set(true); }
  doStartTrip() {
    if (this.tripForm.invalid) return;
    this.saving.set(true);
    this.api.post<any>('/transport/trips', this.tripForm.value).subscribe({
      next: () => { this.saving.set(false); this.showStartTrip.set(false); this.snack.open('Trip started', 'OK', { duration: 2500 }); this.loadTrips(); this.loadDashboard(); },
      error: (err: any) => { this.saving.set(false); this.snack.open(err.error?.error?.message ?? 'Error', 'OK', { duration: 3000 }); },
    });
  }

  openTripDetail(t: any) {
    this.activeTripDetail.set(null);
    this.editingDriver.set(false);
    this.selectedDriverId = '';
    this.api.get<any>('/transport/trips/' + t.id).subscribe({
      next: (res: any) => {
        this.activeTripDetail.set(res.data);
        this.selectedDriverId = res.data?.driver_id ?? '';
      },
      error: (err: any) => {
        this.snack.open(err.error?.error?.message ?? 'Failed to load trip details', 'OK', { duration: 3000 });
      },
    });
  }

  toggleDropped(b: any) {
    const newVal = !b.dropped;
    this.api.post<any>('/transport/trips/' + this.activeTripDetail()!.id + '/drop', {
      student_id: b.student_id, dropped: newVal,
    }).subscribe({
      next: () => { b.dropped = newVal; },
      error: () => {},
    });
  }

  toggleBoarding(b: any) {
    const newVal = !b.boarded;
    this.api.post<any>('/transport/trips/' + this.activeTripDetail()!.id + '/board', {
      student_id: b.student_id, boarded: newVal,
    }).subscribe({
      next: () => { b.boarded = newVal; },
      error: () => {},
    });
  }

  completeTrip(t: any) {
    if (!confirm('Mark trip as completed?')) return;
    this.api.patch<any>('/transport/trips/' + t.id + '/complete', {}).subscribe({
      next: () => { this.snack.open('Trip completed', 'OK', { duration: 2000 }); this.loadTrips(); this.loadDashboard(); this.activeTripDetail.set(null); },
      error: () => {},
    });
  }

  isExpiringSoon(date: string | null): boolean {
    if (!date) return false;
    const diff = (new Date(date).getTime() - Date.now()) / 86400000;
    return diff <= 30;
  }

  getRouteFee(): number {
    return this.selectedRoute()?.monthly_fee ?? 0;
  }

  saveDriver() {
    const detail = this.activeTripDetail();
    if (!detail) return;
    this.api.patch<any>('/transport/trips/' + detail.id + '/driver', {
      driver_id: this.selectedDriverId || null,
    }).subscribe({
      next: (res: any) => {
        detail.driver_id   = res.data.driver_id;
        detail.driver_name = this.drivers().find(d => d.id === this.selectedDriverId)
          ? this.drivers().find(d => d.id === this.selectedDriverId)!.first_name + ' ' +
            this.drivers().find(d => d.id === this.selectedDriverId)!.last_name
          : null;
        this.editingDriver.set(false);
        this.snack.open('Driver updated', 'OK', { duration: 2000 });
        this.loadTrips();
      },
      error: () => this.snack.open('Failed to update driver', 'OK', { duration: 3000 }),
    });
  }

  isPickupTrip = () => {
    const d = this.activeTripDetail();
    return d?.trip_type === 'morning' || d?.direction === 'pickup' || d?.trip_type === 'special';
  };

  boardedCount  = () => this.activeTripDetail()?.boardings?.filter((b: any) => b.boarded).length ?? 0;
  droppedCount  = () => this.activeTripDetail()?.boardings?.filter((b: any) => b.dropped).length ?? 0;

  boardingsByStop() {
    const boardings = this.activeTripDetail()?.boardings ?? [];
    const groups = new Map<string, any[]>();
    for (const b of boardings) {
      const key = b.pickup_stop ?? 'Unassigned';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(b);
    }
    return Array.from(groups.entries()).map(([name, bs]) => ({ name, boardings: bs }));
  }

  markAllBoarded() {
    const detail = this.activeTripDetail();
    if (!detail) return;
    const unboarded = detail.boardings.filter((b: any) => !b.boarded);
    unboarded.forEach((b: any) => {
      this.api.post<any>('/transport/trips/' + detail.id + '/board', {
        student_id: b.student_id, boarded: true,
      }).subscribe({ next: () => { b.boarded = true; }, error: () => {} });
    });
  }

  markAllDropped() {
    const detail = this.activeTripDetail();
    if (!detail) return;
    detail.boardings.filter((b: any) => !b.dropped).forEach((b: any) => {
      this.api.post<any>('/transport/trips/' + detail.id + '/drop', {
        student_id: b.student_id, dropped: true,
      }).subscribe({ next: () => { b.dropped = true; }, error: () => {} });
    });
  }

  completeTripFromPanel() {
    const detail = this.activeTripDetail();
    if (!detail || !confirm('Complete this trip?')) return;
    this.api.patch<any>('/transport/trips/' + detail.id + '/complete', {}).subscribe({
      next: () => {
        detail.status = 'completed';
        detail.end_time = new Date().toISOString();
        this.snack.open('Trip completed', 'OK', { duration: 2000 });
        this.loadTrips();
        this.loadDashboard();
      },
      error: () => {},
    });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }

  getColor(name: string): string {
    const colors = ['#2563EB','#7C3AED','#DB2777','#D97706','#059669','#0891B2'];
    return colors[(name?.charCodeAt(0) || 0) % colors.length];
  }
}
