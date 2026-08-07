"use client";

import { useState, useTransition } from "react";
import { getPayslipDownloadUrl } from "@/app/payroll/payslip-actions";

export function DownloadPayslipButton({ payslipId }: { payslipId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        className="text-sm underline disabled:opacity-60"
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await getPayslipDownloadUrl(payslipId);
            if (result.error || !result.url) {
              setError(result.error ?? "Download failed");
              return;
            }
            window.open(result.url, "_blank", "noopener,noreferrer");
          })
        }
      >
        {pending ? "Preparing…" : "Download PDF"}
      </button>
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </span>
  );
}
