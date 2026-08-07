import { NextResponse } from "next/server";
import { buildPaymentExportCsv } from "@/app/payroll/payment-actions";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const result = await buildPaymentExportCsv(id);

  if (result.error || !result.csv || !result.filename) {
    return NextResponse.json(
      { error: result.error ?? "Export failed" },
      { status: 400 },
    );
  }

  return new NextResponse(result.csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.filename}"`,
    },
  });
}
