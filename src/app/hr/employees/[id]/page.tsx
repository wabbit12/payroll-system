import Link from "next/link";
import { notFound } from "next/navigation";
import { getEmployee } from "@/app/hr/employees/actions";
import { EmployeeForm } from "@/app/hr/employees/employee-form";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">
        {employee.full_name}
      </h1>
      <p className="mt-2 text-sm text-zinc-600">
        Edit employment and pay details. Sensitive fields stay encrypted.
      </p>
      <EmployeeForm mode="edit" employee={employee} />
      <p className="mt-8 text-sm">
        <Link href="/hr" className="underline">
          Back to employees
        </Link>
      </p>
    </main>
  );
}
