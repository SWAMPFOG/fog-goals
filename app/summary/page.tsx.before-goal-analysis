"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Profile = {
  role: string;
  department_id: string | null;
  team_id: string | null;
};

type Department = {
  id: string;
  name: string;
};

type Team = {
  id: string;
  department_id: string | null;
  name: string;
};

type Member = {
  id: string;
  team_id: string | null;
  name: string;
};

type Daily = {
  member_id: string;
  sales: number | null;
  champagne_count: number | null;
  visit_count: number | null;
};

type Row = {
  id: string;
  name: string;
  sales: number;
  champagne: number;
  visits: number;
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function yen(v: number) {
  return `¥${v.toLocaleString("ja-JP")}`;
}

export default function SummaryPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [month, setMonth] = useState(currentMonth());
  const [profile, setProfile] = useState<Profile | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [results, setResults] = useState<Daily[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role, department_id, team_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profileData) {
        setErrorMessage(
          profileError?.message ?? "プロフィールが見つかりません"
        );
        setLoading(false);
        return;
      }

      const p = profileData as Profile;
      setProfile(p);

      const [departmentRes, teamRes, memberRes] = await Promise.all([
        supabase
          .from("departments")
          .select("id,name")
          .eq("is_active", true),
        supabase
          .from("teams")
          .select("id,department_id,name")
          .eq("is_active", true),
        supabase
          .from("members")
          .select("id,team_id,name")
          .eq("is_active", true),
      ]);

      if (departmentRes.error || teamRes.error || memberRes.error) {
        setErrorMessage(
          departmentRes.error?.message ??
            teamRes.error?.message ??
            memberRes.error?.message ??
            "組織データ取得エラー"
        );
        setLoading(false);
        return;
      }

      let allowedDepartments = departmentRes.data ?? [];
      let allowedTeams = teamRes.data ?? [];
      let allowedMembers = memberRes.data ?? [];

      if (p.role === "team_manager") {
        allowedTeams = allowedTeams.filter((t) => t.id === p.team_id);
        allowedMembers = allowedMembers.filter(
          (m) => m.team_id === p.team_id
        );
        allowedDepartments = allowedDepartments.filter((d) =>
          allowedTeams.some((t) => t.department_id === d.id)
        );
      } else if (p.role === "department_manager") {
        allowedDepartments = allowedDepartments.filter(
          (d) => d.id === p.department_id
        );
        allowedTeams = allowedTeams.filter(
          (t) => t.department_id === p.department_id
        );
        const teamIds = allowedTeams.map((t) => t.id);
        allowedMembers = allowedMembers.filter(
          (m) => m.team_id && teamIds.includes(m.team_id)
        );
      } else if (
        !["business_manager", "company_manager", "chairman"].includes(
          p.role
        )
      ) {
        allowedDepartments = [];
        allowedTeams = [];
        allowedMembers = [];
      }

      setDepartments(allowedDepartments);
      setTeams(allowedTeams);
      setMembers(allowedMembers);

      const startDate = `${month}-01`;
      const [y, m] = month.split("-").map(Number);
      const next = new Date(y, m, 1);
      const nextMonth = `${next.getFullYear()}-${String(
        next.getMonth() + 1
      ).padStart(2, "0")}-01`;

      if (allowedMembers.length === 0) {
        setResults([]);
        setLoading(false);
        return;
      }

      const { data: dailyData, error: dailyError } = await supabase
        .from("daily_results")
        .select("member_id,sales,champagne_count,visit_count")
        .in(
          "member_id",
          allowedMembers.map((m) => m.id)
        )
        .gte("business_date", startDate)
        .lt("business_date", nextMonth);

      if (dailyError) {
        setErrorMessage(dailyError.message);
        setLoading(false);
        return;
      }

      setResults(dailyData ?? []);
      setLoading(false);
    }

    load();
  }, [router, supabase, month]);

  const memberTotals = useMemo(() => {
    const map = new Map<string, Row>();

    members.forEach((member) => {
      map.set(member.id, {
        id: member.id,
        name: member.name,
        sales: 0,
        champagne: 0,
        visits: 0,
      });
    });

    results.forEach((r) => {
      const row = map.get(r.member_id);
      if (!row) return;

      row.sales += Number(r.sales ?? 0);
      row.champagne += Number(r.champagne_count ?? 0);
      row.visits += Number(r.visit_count ?? 0);
    });

    return map;
  }, [members, results]);

  const teamRows = useMemo(() => {
    return teams
      .map((team) => {
        const teamMembers = members.filter(
          (member) => member.team_id === team.id
        );

        return teamMembers.reduce<Row>(
          (sum, member) => {
            const r = memberTotals.get(member.id);
            if (!r) return sum;

            sum.sales += r.sales;
            sum.champagne += r.champagne;
            sum.visits += r.visits;
            return sum;
          },
          {
            id: team.id,
            name: team.name,
            sales: 0,
            champagne: 0,
            visits: 0,
          }
        );
      })
      .sort((a, b) => b.sales - a.sales);
  }, [teams, members, memberTotals]);

  const departmentRows = useMemo(() => {
    return departments
      .map((department) => {
        const departmentTeamIds = teams
          .filter((team) => team.department_id === department.id)
          .map((team) => team.id);

        return teamRows
          .filter((row) => departmentTeamIds.includes(row.id))
          .reduce<Row>(
            (sum, row) => {
              sum.sales += row.sales;
              sum.champagne += row.champagne;
              sum.visits += row.visits;
              return sum;
            },
            {
              id: department.id,
              name: department.name,
              sales: 0,
              champagne: 0,
              visits: 0,
            }
          );
      })
      .sort((a, b) => b.sales - a.sales);
  }, [departments, teams, teamRows]);

  const total = useMemo(
    () =>
      teamRows.reduce(
        (sum, row) => {
          sum.sales += row.sales;
          sum.champagne += row.champagne;
          sum.visits += row.visits;
          return sum;
        },
        { sales: 0, champagne: 0, visits: 0 }
      ),
    [teamRows]
  );

  function roleLabel(role?: string) {
    switch (role) {
      case "team_manager":
        return "部責";
      case "department_manager":
        return "業責";
      case "business_manager":
        return "社責";
      case "company_manager":
        return "会社管理";
      case "chairman":
        return "会長";
      default:
        return "閲覧権限なし";
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-500">読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white pb-20">
      <div className="mx-auto w-full max-w-md px-5 pt-8">
        <Link href="/" className="text-sm text-zinc-500">
          ← ホーム
        </Link>

        <header className="mt-7 mb-7">
          <p className="text-xs tracking-[0.3em] text-zinc-500">
            SWAMP-FOG
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            集約ダッシュボード
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            {roleLabel(profile?.role)} VIEW
          </p>
        </header>

        <label className="block mb-7">
          <span className="text-sm text-zinc-500">対象月</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-4 text-white"
          />
        </label>

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-900 p-4 text-sm text-red-400">
            ERROR: {errorMessage}
          </div>
        )}

        <section className="rounded-3xl border border-zinc-800 p-5">
          <p className="text-xs text-zinc-500">TOTAL RESULT</p>
          <h2 className="mt-2 text-xl font-bold">集約実績</h2>

          <div className="mt-5 space-y-4">
            <div>
              <p className="text-sm text-zinc-500">売上</p>
              <p className="text-3xl font-bold">{yen(total.sales)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-zinc-900 p-4">
                <p className="text-xs text-zinc-500">オリシャン</p>
                <p className="mt-1 text-2xl font-bold">
                  {total.champagne}本
                </p>
              </div>

              <div className="rounded-2xl bg-zinc-900 p-4">
                <p className="text-xs text-zinc-500">来店組数</p>
                <p className="mt-1 text-2xl font-bold">
                  {total.visits}組
                </p>
              </div>
            </div>
          </div>
        </section>

        {departmentRows.length > 0 && (
          <section className="mt-8">
            <p className="text-xs text-zinc-500">DEPARTMENT</p>
            <h2 className="mt-1 text-xl font-bold">営業部別</h2>

            <div className="mt-4 space-y-3">
              {departmentRows.map((row) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-zinc-800 p-4"
                >
                  <p className="font-bold">{row.name}</p>
                  <p className="mt-2 text-xl font-bold">
                    {yen(row.sales)}
                  </p>
                  <p className="mt-2 text-sm text-zinc-500">
                    オリシャン {row.champagne}本 / 来店 {row.visits}組
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="mt-8">
          <p className="text-xs text-zinc-500">TEAM</p>
          <h2 className="mt-1 text-xl font-bold">チーム別</h2>

          <div className="mt-4 space-y-3">
            {teamRows.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 p-4 text-sm text-zinc-500">
                表示できるチームがありません
              </div>
            ) : (
              teamRows.map((row, index) => (
                <div
                  key={row.id}
                  className="rounded-2xl border border-zinc-800 p-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-bold">{row.name}</p>
                    <p className="text-sm text-zinc-500">
                      #{index + 1}
                    </p>
                  </div>

                  <p className="mt-2 text-xl font-bold">
                    {yen(row.sales)}
                  </p>

                  <p className="mt-2 text-sm text-zinc-500">
                    オリシャン {row.champagne}本 / 来店 {row.visits}組
                  </p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
