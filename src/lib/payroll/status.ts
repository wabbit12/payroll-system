import type { PayRunStatus, PaymentStatus } from "@/types/database";

/** Editable / recalculable statuses. */
export function isPayRunEditable(status: PayRunStatus): boolean {
  return status === "draft" || status === "rejected";
}

/**
 * Phase 7 payout gate: only approved or locked runs may be paid.
 * Unapproved drafts / pending / rejected cannot be marked paid.
 */
export function canMarkPayRunPaid(status: PayRunStatus): boolean {
  return status === "approved" || status === "locked";
}

/** Payslips only after the run is approved or locked. */
export function canGeneratePayslips(status: PayRunStatus): boolean {
  return status === "approved" || status === "locked";
}

export function payRunStatusLabel(status: PayRunStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "pending_approval":
      return "Pending approval";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "locked":
      return "Locked";
  }
}

export function paymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case "unpaid":
      return "Unpaid";
    case "pending":
      return "Pending (simulated)";
    case "paid":
      return "Paid (simulated)";
    case "failed":
      return "Failed";
  }
}
