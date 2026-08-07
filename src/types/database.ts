export type UserRole =
  | "employee"
  | "manager"
  | "hr_admin"
  | "payroll_admin"
  | "super_admin";

export type Profile = {
  id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
};

export type EmploymentStatus =
  | "active"
  | "inactive"
  | "on_leave"
  | "terminated";

export type PayType = "salary" | "hourly";

export type PayFrequency =
  | "weekly"
  | "biweekly"
  | "semimonthly"
  | "monthly";

export type Employee = {
  id: string;
  user_id: string | null;
  employee_number: string | null;
  full_name: string;
  email: string;
  job_title: string | null;
  department: string | null;
  hire_date: string | null;
  status: EmploymentStatus;
  pay_type: PayType;
  pay_rate: number;
  pay_frequency: PayFrequency;
  tax_id_encrypted: string | null;
  bank_account_encrypted: string | null;
  bank_routing_encrypted: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

/** Safe view for UI (secrets masked or omitted). */
export type EmployeePublic = Omit<
  Employee,
  "tax_id_encrypted" | "bank_account_encrypted" | "bank_routing_encrypted"
> & {
  tax_id_masked: string;
  bank_account_masked: string;
  bank_routing_masked: string;
};

export type TimesheetStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected";

export type TimesheetEntryType = "regular" | "overtime" | "unpaid_leave";

export type Timesheet = {
  id: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  status: TimesheetStatus;
  employee_note: string | null;
  review_note: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TimesheetEntry = {
  id: string;
  timesheet_id: string;
  work_date: string;
  hours: number;
  entry_type: TimesheetEntryType;
  notes: string | null;
  created_at: string;
};

export type TimesheetWithEntries = Timesheet & {
  entries: TimesheetEntry[];
  employee_name?: string;
  total_hours?: number;
};

export type PayRunStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "locked";

export type PayRun = {
  id: string;
  period_start: string;
  period_end: string;
  status: PayRunStatus;
  tax_rate: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  calculated_at: string | null;
  submitted_by: string | null;
  submitted_at: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  locked_at: string | null;
  locked_by: string | null;
};

export type PayRunLine = {
  id: string;
  pay_run_id: string;
  employee_id: string;
  employee_name: string;
  pay_type: PayType;
  pay_rate: number;
  regular_hours: number;
  overtime_hours: number;
  regular_pay: number;
  overtime_pay: number;
  gross_pay: number;
  tax_amount: number;
  other_deductions: number;
  net_pay: number;
  calc_note: string | null;
  created_at: string;
};

export type PayRunWithLines = PayRun & {
  lines: PayRunLine[];
  totals: {
    gross: number;
    tax: number;
    net: number;
    employees: number;
  };
};

export type Payslip = {
  id: string;
  pay_run_id: string;
  pay_run_line_id: string;
  employee_id: string;
  storage_path: string;
  file_name: string;
  period_start: string;
  period_end: string;
  gross_pay: number;
  tax_amount: number;
  other_deductions: number;
  net_pay: number;
  generated_by: string | null;
  generated_at: string;
};
