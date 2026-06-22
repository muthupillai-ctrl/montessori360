export type BillingCycle   = 'monthly' | 'quarterly' | 'half_yearly' | 'annually' | 'one_time';
export type InvoiceStatus  = 'pending' | 'paid' | 'partial' | 'overdue' | 'waived';
export type PaymentMethod  = 'razorpay' | 'cash' | 'bank_transfer' | 'cheque';

// ── DB rows ───────────────────────────────────────────────────────────────────

export interface FeeHead {
  name:        string;
  amount:      number;
  is_optional: boolean;
  description?: string;
}

export interface FeeStructureRow {
  id:             string;
  name:           string;
  academic_year:  string;
  billing_cycle:  BillingCycle;
  heads:          FeeHead[];
  applies_to:     'all' | 'class';
  class_ids:      string[];
  is_active:      boolean;
  allow_multiple: boolean;
  created_at:     Date;
  updated_at:     Date;
}

export interface LineItem {
  name:        string;
  amount:      number;
  description?: string;
}

export interface FeeInvoiceRow {
  id:                string;
  invoice_no:        string;
  student_id:        string;
  fee_structure_id:  string | null;
  billing_period:    string;
  line_items:        LineItem[];
  subtotal:          number;
  discount:          number;
  discount_note:     string | null;
  concession_id:     string | null;
  tax:               number;
  total:             number;
  due_date:          Date;
  status:            InvoiceStatus;
  razorpay_order_id: string | null;
  paid_amount:       number;
  paid_at:           Date | null;
  payment_method:    PaymentMethod | null;
  created_by:        string | null;
  created_at:        Date;
  updated_at:        Date;
  // Joined
  student_name?:     string;
  admission_no?:     string;
  class_name?:       string;
}

export interface PaymentRow {
  id:             string;
  invoice_id:     string;
  amount:         number;
  method:         PaymentMethod;
  reference_no:   string | null;
  razorpay_payment_id: string | null;
  notes:          string | null;
  recorded_by:    string;
  created_at:     Date;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateFeeStructureDto {
  name:            string;
  academic_year:   string;
  billing_cycle:   BillingCycle;
  heads:           FeeHead[];
  applies_to?:     'all' | 'class';
  class_ids?:      string[];
  allow_multiple?: boolean;
}

export interface CreateInvoiceDto {
  student_id:         string;
  fee_structure_id?:  string;
  invoice_type?:      'fee_structure' | 'transport' | 'adhoc';
  billing_period:     string;
  line_items:         LineItem[];
  discount?:          number;
  discount_note?:     string;
  concession_id?:     string;
  skip_concession?:   boolean;
  tax?:               number;
  due_date:           string;
}

export interface BulkCreateInvoicesDto {
  fee_structure_id: string;
  billing_period:   string;
  due_date:         string;
  class_id?:        string;   // if omitted — all active students
  discount?:        number;
}

export interface RecordPaymentDto {
  amount:              number;
  method:              PaymentMethod;
  reference_no?:       string;
  razorpay_payment_id?: string;
  notes?:              string;
}

export interface WaiveInvoiceDto {
  reason: string;
}

export interface InvoiceFilters {
  student_id?:   string;
  class_id?:     string;
  status?:       InvoiceStatus;
  due_date_from?: string;
  due_date_to?:   string;
  billing_period?: string;
  page?:          number;
  limit?:         number;
}

export interface DefaulterFilters {
  class_id?:      string;
  overdue_days?:  number;   // minimum days overdue
}
