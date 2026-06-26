export declare const ROLES: {
    readonly OWNER: "owner";
    readonly PRINCIPAL: "principal";
    readonly TEACHER: "teacher";
    readonly ASSISTANT_TEACHER: "assistant_teacher";
    readonly ACCOUNTANT: "accountant";
    readonly DRIVER: "driver";
    readonly SUPPORT: "support";
    readonly PARENT: "parent";
    readonly PLATFORM_ADMIN: "platform_admin";
};
export type Role = typeof ROLES[keyof typeof ROLES];
export declare const ATTENDANCE_STATUS: {
    readonly PRESENT: "present";
    readonly ABSENT: "absent";
    readonly LATE: "late";
    readonly HALF_DAY: "half_day";
    readonly HOLIDAY: "holiday";
};
export type AttendanceStatus = typeof ATTENDANCE_STATUS[keyof typeof ATTENDANCE_STATUS];
export declare const INVOICE_STATUS: {
    readonly PENDING: "pending";
    readonly PAID: "paid";
    readonly PARTIAL: "partial";
    readonly OVERDUE: "overdue";
    readonly WAIVED: "waived";
};
export type InvoiceStatus = typeof INVOICE_STATUS[keyof typeof INVOICE_STATUS];
export declare const PLAN_NAMES: readonly ["starter", "growth", "enterprise"];
export type PlanName = typeof PLAN_NAMES[number];
export interface PaginationQuery {
    page?: number;
    limit?: number;
}
export interface PaginatedResponse<T> {
    data: T[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}
export interface ApiSuccess<T = unknown> {
    data: T;
    message?: string;
}
export interface ApiError {
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
}
export interface FeeHead {
    name: string;
    amount: number;
    is_optional: boolean;
}
export interface Address {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
}
//# sourceMappingURL=index.d.ts.map