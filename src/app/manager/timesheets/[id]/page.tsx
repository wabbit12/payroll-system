import Link from "next/link";
import { notFound } from "next/navigation";
import { getTimesheet } from "@/app/me/timesheets/actions";
import { ReviewForm } from "@/app/manager/review-form";

export default async function ManagerTimesheetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const timesheet = await getTimesheet(id);
  if (!timesheet) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Review timesheet</h1>
      <ReviewForm timesheet={timesheet} />
      <p className="mt-8 text-sm">
        <Link href="/manager" className="underline">
          Back to approvals
        </Link>
      </p>
    </main>
  );
}
