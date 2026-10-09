import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { canPreviewPrivacyImpact } from "@/utils/privacy/permissions";
import { summarizePrivacyImpact } from "@/utils/privacy/impact";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() { /* Read-only endpoint: no response cookies are persisted. */ },
      },
    }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("role,is_active").eq("id", user.id).maybeSingle();
  if (profileError || !profile?.is_active || !canPreviewPrivacyImpact(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const results = await Promise.all([
    supabase.from("client_sales").select("id", { head: true, count: "exact" }),
    supabase.from("clients").select("id", { head: true, count: "exact" }),
    supabase.from("daily_results").select("id", { head: true, count: "exact" }).neq("sales", 0),
    supabase.from("client_monthly_must_targets").select("id", { head: true, count: "exact" }),
  ]);
  if (results.some((result) => result.error || result.count === null)) {
    return NextResponse.json({ error: "Unable to count accessible records" }, { status: 500 });
  }

  const impact = summarizePrivacyImpact({
    clientSalesRows: results[0].count!,
    clientRows: results[1].count!,
    dailyRowsWithSales: results[2].count!,
    clientTargetRows: results[3].count!,
  });

  return NextResponse.json(
    { ...impact, scope: "rls-visible-only", destructiveActionEnabled: false },
    { headers: { "Cache-Control": "no-store" } }
  );
}
