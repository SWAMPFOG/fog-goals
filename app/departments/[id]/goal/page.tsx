"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { canEditDepartmentGoal, normalizeRole } from "@/utils/permissions";

export default function DepartmentGoalPage() {
  const [supabase] = useState(() => createClient());
  const params = useParams();
  const router = useRouter();
  const departmentId = params.id as string;

  const [month, setMonth] = useState("2026-08");
  const [sales, setSales] = useState("");
  const [champagne, setChampagne] = useState("");
  const [visits, setVisits] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string | null>(null);
  const [profileDepartmentId, setProfileDepartmentId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("role, team_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        alert(`権限情報の取得に失敗しました\n${profileError.message}`);
        setAuthChecked(true);
        return;
      }

      setRole(profileData?.role ?? null);

      let ownDepartmentId: string | null = null;

      if (profileData?.team_id) {
        const { data: ownTeam, error: ownTeamError } = await supabase
          .from("teams")
          .select("department_id")
          .eq("id", profileData.team_id)
          .maybeSingle();

        if (ownTeamError) {
          alert(`所属営業部の取得に失敗しました\n${ownTeamError.message}`);
          setAuthChecked(true);
          return;
        }

        ownDepartmentId = ownTeam?.department_id ?? null;
      }

      setProfileDepartmentId(ownDepartmentId);
      setAuthChecked(true);
    }

    init();
  }, [router, supabase]);

  useEffect(() => {
    if (!authChecked) return;
    loadGoal();
  }, [departmentId, month, authChecked]);

  async function loadGoal() {
    setLoading(true);

    const targetMonth = `${month}-01`;

    const { data } = await supabase
      .from("department_goals")
      .select("*")
      .eq("department_id", departmentId)
      .eq("target_month", targetMonth)
      .maybeSingle();

    if (data) {
      setSales(String(data.target_sales ?? ""));
      setChampagne(String(data.champagne_target ?? ""));
      setVisits(String(data.visit_count_target ?? ""));
    } else {
      setSales("");
      setChampagne("");
      setVisits("");
    }

    setLoading(false);
  }

  const normalizedRole = normalizeRole(role);

  const canEditThisDepartment =
    canEditDepartmentGoal(role) &&
    (normalizedRole === "department_manager"
      ? !!profileDepartmentId && profileDepartmentId === departmentId
      : normalizedRole !== "team_manager" && normalizedRole !== "member");

  async function saveGoal() {
    if (!canEditThisDepartment) {
      alert("営業部目標を編集する権限がありません");
      return;
    }

    setSaving(true);

    const targetMonth = `${month}-01`;

    const { data: existing } = await supabase
      .from("department_goals")
      .select("id")
      .eq("department_id", departmentId)
      .eq("target_month", targetMonth)
      .maybeSingle();

    const values = {
      department_id: departmentId,
      target_month: targetMonth,
      target_sales: Number(sales || 0),
      champagne_target: Number(champagne || 0),
      visit_count_target: Number(visits || 0),
    };

    let error;

    if (existing) {
      const result = await supabase
        .from("department_goals")
        .update(values)
        .eq("id", existing.id);

      error = result.error;
    } else {
      const result = await supabase
        .from("department_goals")
        .insert(values);

      error = result.error;
    }

    setSaving(false);

    if (error) {
      alert(`保存に失敗しました\n${error.message}`);
      return;
    }

    alert("営業部目標を保存しました");
    router.push(`/departments/${departmentId}`);
  }

  if (!authChecked || loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-500">読み込み中...</p>
      </main>
    );
  }

  if (!canEditThisDepartment) {
    return (
      <main className="min-h-screen bg-black text-white px-5 py-8">
        <div className="mx-auto max-w-md">
          <button
            onClick={() => router.back()}
            className="text-sm text-zinc-500"
          >
            ← 営業部へ戻る
          </button>

          <p className="mt-8 text-xs tracking-widest text-zinc-500">
            DEPARTMENT GOAL SETTING
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            営業部目標設定
          </h1>

          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="font-bold">
              営業部目標は営業部責任者以上が設定します
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              このアカウントには営業部目標を編集する権限がありません。
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white px-5 py-8">
      <div className="mx-auto max-w-md">

        <button
          onClick={() => router.back()}
          className="text-sm text-zinc-500"
        >
          ← 営業部へ戻る
        </button>

        <p className="mt-8 text-xs tracking-widest text-zinc-500">
          DEPARTMENT GOAL SETTING
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          営業部目標設定
        </h1>

        <div className="mt-8 space-y-5">

          <div>
            <label className="text-xs text-zinc-500">
              対象月
            </label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500">
              営業部売上目標
            </label>
            <input
              type="number"
              value={sales}
              onChange={(e) => setSales(e.target.value)}
              placeholder="例：50000000"
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-xl font-bold"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500">
              オリシャン目標
            </label>
            <input
              type="number"
              value={champagne}
              onChange={(e) => setChampagne(e.target.value)}
              placeholder="例：100"
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-xl font-bold"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-500">
              来店組数目標
            </label>
            <input
              type="number"
              value={visits}
              onChange={(e) => setVisits(e.target.value)}
              placeholder="例：300"
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 p-4 text-xl font-bold"
            />
          </div>

          <button
            onClick={saveGoal}
            disabled={saving || loading}
            className="w-full rounded-2xl bg-white py-4 font-bold text-black disabled:opacity-50"
          >
            {saving ? "保存中..." : "営業部目標を保存"}
          </button>

        </div>
      </div>
    </main>
  );
}
