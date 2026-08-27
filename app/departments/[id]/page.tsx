"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { canEditDepartmentGoal, normalizeRole } from "@/utils/permissions";

type Department = {
  id: string;
  name: string;
};

type Team = {
  id: string;
  name: string;
  display_order: number | null;
};

type DepartmentGoal = {
  target_sales: number;
  champagne_target: number;
  visit_count_target: number;
};

type DailyResult = {
  team_id: string;
  sales: number | null;
  champagne_count: number | null;
  visit_count: number | null;
  existing_visit_count: number | null;
  repeat_count: number | null;
  first_contact_count: number | null;
  send_count: number | null;
  inhouse_count: number | null;
  contact_acquired_count: number | null;
  repeat_plan_count: number | null;
};

const yen = (value: number) =>
  `¥${Math.round(value).toLocaleString("ja-JP")}`;

export default function DepartmentPage() {
  const [supabase] = useState(() => createClient());
  const router = useRouter();
  const params = useParams();
  const departmentId = params.id as string;

  const [department, setDepartment] = useState<Department | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [goal, setGoal] = useState<DepartmentGoal | null>(null);
  const [results, setResults] = useState<DailyResult[]>([]);
  const [month, setMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [profileDepartmentId, setProfileDepartmentId] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    if (!departmentId) return;

    async function load() {
      setLoading(true);

      const targetMonth = `${month}-01`;
      const next = new Date(`${targetMonth}T00:00:00`);
      next.setMonth(next.getMonth() + 1);
      const nextMonth = next.toISOString().slice(0, 10);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, team_id")
        .eq("id", user.id)
        .maybeSingle();

      const currentRole = normalizeRole(profile?.role ?? null);
      setRole(profile?.role ?? null);

      let ownDepartmentId: string | null = null;
      if (profile?.team_id) {
        const { data: ownTeam } = await supabase
          .from("teams")
          .select("department_id")
          .eq("id", profile.team_id)
          .maybeSingle();

        ownDepartmentId = ownTeam?.department_id ?? null;
      }

      setProfileDepartmentId(ownDepartmentId);

      const canView =
        currentRole === "business_manager" ||
        currentRole === "company_manager" ||
        currentRole === "chairman" ||
        (!!ownDepartmentId && ownDepartmentId === departmentId);

      if (!canView) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }

      setAccessDenied(false);

      const departmentResult = await supabase
        .from("departments")
        .select("id,name")
        .eq("id", departmentId)
        .single();

      const teamResult = await supabase
        .from("teams")
        .select("id,name,display_order")
        .eq("department_id", departmentId)
        .eq("is_active", true)
        .order("display_order");

      const goalResult = await supabase
        .from("department_goals")
        .select("target_sales,champagne_target,visit_count_target")
        .eq("department_id", departmentId)
        .eq("target_month", targetMonth)
        .maybeSingle();

      const teamIds = (teamResult.data ?? []).map((t) => t.id);

      let dailyData: DailyResult[] = [];

      if (teamIds.length > 0) {
        const dailyResult = await supabase
          .from("daily_results")
          .select("team_id,sales,champagne_count,visit_count,existing_visit_count,repeat_count,first_contact_count,send_count,inhouse_count,contact_acquired_count,repeat_plan_count")
          .in("team_id", teamIds)
          .gte("business_date", targetMonth)
          .lt("business_date", nextMonth);

        dailyData = dailyResult.data ?? [];
      }

      setDepartment(departmentResult.data ?? null);
      setTeams(teamResult.data ?? []);
      setGoal(goalResult.data ?? null);
      setResults(dailyData);
      setLoading(false);
    }

    load();
  }, [departmentId, month, router, supabase]);

  const totals = useMemo(() => {
    return results.reduce(
      (sum, row) => ({
        sales: sum.sales + Number(row.sales ?? 0),
        champagne:
          sum.champagne + Number(row.champagne_count ?? 0),
        visits: sum.visits + Number(row.visit_count ?? 0),
        existingVisits:
          sum.existingVisits + Number(row.existing_visit_count ?? 0),
        repeats:
          sum.repeats + Number(row.repeat_count ?? 0),
        firstContacts:
          sum.firstContacts + Number(row.first_contact_count ?? 0),
        sends:
          sum.sends + Number(row.send_count ?? 0),
        inhouse:
          sum.inhouse + Number(row.inhouse_count ?? 0),
        contacts:
          sum.contacts + Number(row.contact_acquired_count ?? 0),
        repeatPlans:
          sum.repeatPlans + Number(row.repeat_plan_count ?? 0),
      }),
      {
        sales: 0,
        champagne: 0,
        visits: 0,
        existingVisits: 0,
        repeats: 0,
        firstContacts: 0,
        sends: 0,
        inhouse: 0,
        contacts: 0,
        repeatPlans: 0,
      }
    );
  }, [results]);

  const salesTarget = Number(goal?.target_sales ?? 0);
  const champagneTarget = Number(goal?.champagne_target ?? 0);
  const visitTarget = Number(goal?.visit_count_target ?? 0);

  const salesRate =
    salesTarget > 0
      ? Math.round((totals.sales / salesTarget) * 1000) / 10
      : 0;

  const currentRole = normalizeRole(role);
  const canEditThisDepartment =
    canEditDepartmentGoal(role) &&
    (currentRole === "department_manager"
      ? !!profileDepartmentId && profileDepartmentId === departmentId
      : currentRole === "business_manager" ||
        currentRole === "company_manager" ||
        currentRole === "chairman");

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white p-6">
        読み込み中...
      </main>
    );
  }

  if (accessDenied) {
    return (
      <main className="min-h-screen bg-black p-6 text-white">
        <div className="mx-auto max-w-md">
          <Link href="/" className="text-xs text-zinc-500">← ホーム</Link>
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-lg font-bold">閲覧権限がありません</p>
            <p className="mt-2 text-sm text-zinc-500">この営業部の情報は閲覧できません。</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white pb-28">
      <div className="mx-auto max-w-md px-5 pt-8">
        <Link href="/" className="text-xs text-zinc-500">
          ← ホーム
        </Link>

        <p className="mt-8 text-xs tracking-widest text-zinc-500">
          DEPARTMENT GOAL
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          {department?.name ?? "営業部"}
        </h1>

        <div className="mt-6">
          <label className="text-xs text-zinc-500">対象月</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-2 w-full rounded-xl border border-zinc-800 bg-zinc-950 p-4"
          />
        </div>

        {canEditThisDepartment ? (
          <Link
            href={`/departments/${params.id}/goal`}
            className="mt-6 block rounded-2xl border border-zinc-700 bg-zinc-900 py-4 text-center text-sm font-bold text-white"
          >
            営業部目標を設定
          </Link>
        ) : (
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 py-4 text-center text-sm text-zinc-600">
            閲覧のみ
          </div>
        )}

      <section className="mt-6 rounded-2xl border border-zinc-800 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">営業部売上目標</p>
            <span className="text-xs text-zinc-500">
              達成率 {salesRate}%
            </span>
          </div>

          <p className="mt-2 text-3xl font-bold">
            {salesTarget > 0 ? yen(salesTarget) : "未設定"}
          </p>

          <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full bg-white"
              style={{ width: `${Math.min(salesRate, 100)}%` }}
            />
          </div>

          <div className="mt-3 flex justify-between text-xs text-zinc-500">
            <span>現在 {yen(totals.sales)}</span>
            <span>
              {salesTarget > 0
                ? totals.sales >= salesTarget
                  ? `目標達成 +${yen(totals.sales - salesTarget)}`
                  : `残り ${yen(salesTarget - totals.sales)}`
                : "目標未設定"}
            </span>
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-zinc-800 p-5">
          <p className="text-xs text-zinc-500">
            DEPARTMENT MONTHLY RESULT
          </p>

          <h2 className="mt-2 text-xl font-bold">
            営業部月間営業実績
          </h2>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <DepartmentResultBox label="既存来店" value={`${totals.existingVisits}組`} />
            <DepartmentResultBox label="リピート" value={`${totals.repeats}組`} />
            <DepartmentResultBox label="初回" value={`${totals.firstContacts}組`} />
            <DepartmentResultBox label="送り" value={`${totals.sends}件`} />
            <DepartmentResultBox label="場内" value={`${totals.inhouse}件`} />
            <DepartmentResultBox label="連絡先取得" value={`${totals.contacts}件`} />
            <DepartmentResultBox label="リピート予定" value={`${totals.repeatPlans}件`} />
          </div>
        </section>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-zinc-800 p-4">
            <p className="text-xs text-zinc-500">オリシャン</p>
            <p className="mt-2 text-xl font-bold">
              {totals.champagne} /{" "}
              {champagneTarget > 0 ? `${champagneTarget}本` : "未設定"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 p-4">
            <p className="text-xs text-zinc-500">来店組数</p>
            <p className="mt-2 text-xl font-bold">
              {totals.visits} /{" "}
              {visitTarget > 0 ? `${visitTarget}組` : "未設定"}
            </p>
          </div>
        </div>

        <section className="mt-8">
          <p className="text-xs tracking-widest text-zinc-500">
            TEAMS
          </p>

          <h2 className="mt-2 text-xl font-bold">所属チーム</h2>

          <div className="mt-4 space-y-3">
            {teams.map((team) => {
              const teamResults = results.filter(
                (row) => row.team_id === team.id
              );

              const teamSales = teamResults.reduce(
                (sum, row) => sum + Number(row.sales ?? 0),
                0
              );

              return (
                <Link
                  key={team.id}
                  href={`/teams/${team.id}`}
                  className="block rounded-2xl border border-zinc-800 p-5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">{team.name}</p>

                      <p className="mt-2 text-sm text-zinc-500">
                        現在売上 {yen(teamSales)}
                      </p>
                    </div>

                    <span className="text-zinc-500">→</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}


function DepartmentResultBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-zinc-900 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}