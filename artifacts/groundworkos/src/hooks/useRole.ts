import { useSession } from "../lib/authClient";
import { type Role, ROLE_RANK, resolveRole } from "@workspace/shared-role";

export type { Role };

export function useRole(): Role {
  const { data: session } = useSession();
  // New users have no role set yet: default them to foreman (lowest
  // privilege) so a stranger who reaches a public sign-up page never lands
  // with elevated access. The first admin is created via the one-time
  // bootstrap flow (see routes/admin.ts on the backend), not via this default.
  return resolveRole(session?.user?.role);
}

export function isAtLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "Admin",
  manager: "Manager",
  foreman: "Foreman",
};
