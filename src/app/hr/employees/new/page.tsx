import Link from "next/link";
import { EmployeeForm } from "@/app/hr/employees/employee-form";

export default function NewEmployeePage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Add employee</h1>
      <p className="mt-2 text-sm text-zinc-600">
        If the email already has a login, the record is linked automatically so
        they can view it under My profile.
      </p>
      <EmployeeForm mode="create" />
      <p className="mt-8 text-sm">
        <Link href="/hr" className="underline">
          Back to employees
        </Link>
      </p>
    </main>
  );
}
