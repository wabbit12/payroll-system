import type { UserRole } from "@/types/database";

export const ALL_ROLES: UserRole[] = [
  "employee",
  "manager",
  "hr_admin",
  "payroll_admin",
  "super_admin",
];

export const ADMIN_ROLES: UserRole[] = [
  "hr_admin",
  "payroll_admin",
  "super_admin",
];

/** Paths that require auth (prefix match). */
export const PROTECTED_PREFIXES = [
  "/dashboard",
  "/manager",
  "/hr",
  "/payroll",
  "/admin",
  "/mfa",
  "/me",
  "/notifications",
  "/auth/update-password",
] as const;

/** Role required for a path prefix. More specific prefixes first. */
export const ROUTE_ROLE_RULES: { prefix: string; roles: UserRole[] }[] = [
  { prefix: "/admin", roles: ["super_admin"] },
  { prefix: "/hr", roles: ["hr_admin", "super_admin"] },
  { prefix: "/payroll", roles: ["payroll_admin", "super_admin"] },
  {
    prefix: "/manager",
    roles: ["manager", "hr_admin", "payroll_admin", "super_admin"],
  },
  // Any signed-in user may complete an MFA challenge after password login.
  { prefix: "/mfa/verify", roles: ALL_ROLES },
  { prefix: "/mfa", roles: ADMIN_ROLES },
];

export function isAdminRole(role: UserRole | null | undefined): boolean {
  return !!role && ADMIN_ROLES.includes(role);
}

export function canAccessPath(
  pathname: string,
  role: UserRole | null | undefined,
): boolean {
  const rule = ROUTE_ROLE_RULES.find((r) => pathname.startsWith(r.prefix));
  if (!rule) return true;
  if (!role) return false;
  return rule.roles.includes(role);
}

export function roleLabel(role: UserRole): string {
  switch (role) {
    case "employee":
      return "Employee";
    case "manager":
      return "Manager";
    case "hr_admin":
      return "HR Admin";
    case "payroll_admin":
      return "Payroll Admin";
    case "super_admin":
      return "Super Admin";
  }
}
