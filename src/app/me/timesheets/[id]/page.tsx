import Link from "next/link";
import { notFound } from "next/navigation";
import { getTimesheet } from "@/app/me/timesheets/actions";
import { TimesheetEditor } from "@/app/me/timesheets/timesheet-editor";

export default async function TimesheetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const timesheet = await getTimesheet(id);
  if (!timesheet) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Timesheet</h1>
      <p className="mt-2 text-sm text-zinc-600">
        {timesheet.employee_name ?? "Your hours"}
      </p>
      <TimesheetEditor timesheet={timesheet} />
      <p className="mt-8 text-sm">
        <Link href="/me/timesheets" className="underline">
          Back to my timesheets
        </Link>
      </p>
    </main>
  );
}
