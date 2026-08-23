import { createClient } from "@/utils/supabase/client";

export type UserProfile = {
  id: string;
  role: string;
  department_id: string | null;
  team_id: string | null;
  member_id: string | null;
  display_name: string | null;
};

export async function getCurrentProfile(): Promise<UserProfile | null> {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, role, department_id, team_id, member_id, display_name"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  return data as UserProfile;
}

export function roleLevel(role?: string | null) {
  switch (role) {
    case "cast":
      return 1;
    case "team_manager":
      return 2;
    case "department_manager":
      return 3;
    case "business_manager":
      return 4;
    case "company_manager":
      return 5;
    case "chairman":
      return 6;
    default:
      return 0;
  }
}

export function canManageTeam(role?: string | null) {
  return roleLevel(role) >= 2;
}

export function canManageDepartment(role?: string | null) {
  return roleLevel(role) >= 3;
}

export function canManageBusiness(role?: string | null) {
  return roleLevel(role) >= 4;
}

export function canManageCompany(role?: string | null) {
  return roleLevel(role) >= 5;
}

export function isChairman(role?: string | null) {
  return role === "chairman";
}
