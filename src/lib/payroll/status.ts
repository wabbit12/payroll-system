import type { PayRunStatus } from "@/types/database";

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
