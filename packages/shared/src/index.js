"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_NAMES = exports.INVOICE_STATUS = exports.ATTENDANCE_STATUS = exports.ROLES = void 0;
// ── User roles ────────────────────────────────────────────────────────────────
exports.ROLES = {
    OWNER: 'owner',
    PRINCIPAL: 'principal',
    TEACHER: 'teacher',
    ASSISTANT_TEACHER: 'assistant_teacher',
    ACCOUNTANT: 'accountant',
    DRIVER: 'driver',
    SUPPORT: 'support',
    PARENT: 'parent',
    PLATFORM_ADMIN: 'platform_admin',
};
// ── Attendance status ─────────────────────────────────────────────────────────
exports.ATTENDANCE_STATUS = {
    PRESENT: 'present',
    ABSENT: 'absent',
    LATE: 'late',
    HALF_DAY: 'half_day',
    HOLIDAY: 'holiday',
};
// ── Fee invoice status ────────────────────────────────────────────────────────
exports.INVOICE_STATUS = {
    PENDING: 'pending',
    PAID: 'paid',
    PARTIAL: 'partial',
    OVERDUE: 'overdue',
    WAIVED: 'waived',
};
// ── Subscription plans ────────────────────────────────────────────────────────
exports.PLAN_NAMES = ['starter', 'growth', 'enterprise'];
//# sourceMappingURL=index.js.map