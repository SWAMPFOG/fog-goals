"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Member = {
  id: string;
  name: string;
  team_id: string;
};

type Goal = {
  id: string;
  target_month: string;
  must_sales: number;
  target_sales: number;
  champagne_target: number;
  visit_count_target: number;
};

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function yen(value: number) {
  return `¥${Number(value || 0).toLocaleString("ja-JP")}`;
}

export default function MemberDetailPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id as string;

  const [supabase] = useState(() => createClient());

  const [member, setMember] = useState<Member | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);

  const [month, setMonth] = useState(currentMonth());
  const [mustSales, setMustSales] = useState("");
  const [targetSales, setTargetSales] = useState("");
  const [champagneTarget, setChampagneTarget] = useState("");
  const [visitCountTarget, setVisitCountTarget] = useState("");

  const [currentSales, setCurrentSales] = useState(0);
  const [currentChampagne, setCurrentChampagne] = useState(0);
  const [currentVisits, setCurrentVisits] = useState(0);
  const [currentExistingVisits, setCurrentExistingVisits] = useState(0);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  async function loadDailyResults(targetMonth: string) {
    const startDate = `${targetMonth}-01`;

    const [year, monthNumber] = targetMonth.split("-").map(Number);
    const nextMonthDate = new Date(year, monthNumber, 1);
    const nextMonth = `${nextMonthDate.getFullYear()}-${String(
      nextMonthDate.getMonth() + 1
    ).padStart(2, "0")}-01`;

    const { data, error } = await supabase
      .from("daily_results")
      .select("sales, champagne_count, visit_count, existing_visit_count")
      .eq("member_id", memberId)
      .gte("business_date", startDate)
      .lt("business_date", nextMonth);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    const rows = data ?? [];

    setCurrentSales(
      rows.reduce((sum, row) => sum + Number(row.sales ?? 0), 0)
    );

    setCurrentChampagne(
      rows.reduce((sum, row) => sum + Number(row.champagne_count ?? 0), 0)
    );

    setCurrentVisits(
      rows.reduce((sum, row) => sum + Number(row.visit_count ?? 0), 0)
    );
  
  setCurrentExistingVisits(
    rows.reduce(
      (sum, row) => sum + Number(row.existing_visit_count ?? 0),
      0
    )
  );
}

  async function loadGoal(teamId: string, targetMonth: string) {
    const monthDate = `${targetMonth}-01`;

    const { data, error } = await supabase
      .from("monthly_goals")
      .select(
        "id, target_month, must_sales, target_sales, champagne_target, visit_count_target"
      )
      .eq("member_id", memberId)
      .eq("target_month", monthDate)
      .maybeSingle();

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (data) {
      setGoal(data);
      setMustSales(String(data.must_sales ?? 0));
      setTargetSales(String(data.target_sales ?? 0));
      setChampagneTarget(String(data.champagne_target ?? 0));
      setVisitCountTarget(String(data.visit_count_target ?? 0));
    } else {
      setGoal(null);
      setMustSales("");
      setTargetSales("");
      setChampagneTarget("");
      setVisitCountTarget("");
    }
  }

  useEffect(() => {
    async function loadMember() {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("members")
        .select("id, name, team_id")
        .eq("id", memberId)
        .eq("is_active", true)
        .single();

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      setMember(data);
      await loadGoal(data.team_id, month);
      await loadDailyResults(month);
      setLoading(false);
    }

    loadMember();
  }, [memberId, router, supabase]);

  async function changeMonth(value: string) {
    setMonth(value);
    setMessage("");

    if (member) {
      await loadGoal(member.team_id, value);
      await loadDailyResults(value);
    }
  }

  async function saveGoal() {
    if (!member) return;

    setSaving(true);
    setMessage("");
    setErrorMessage("");

    const payload = {
      member_id: member.id,
      team_id: member.team_id,
      target_month: `${month}-01`,
      must_sales: Number(mustSales || 0),
      target_sales: Number(targetSales || 0),
      champagne_target: Number(champagneTarget || 0),
      visit_count_target: Number(visitCountTarget || 0),
    };

    let error;

    if (goal?.id) {
      const result = await supabase
        .from("monthly_goals")
        .update(payload)
        .eq("id", goal.id);

      error = result.error;
    } else {
      const result = await supabase
        .from("monthly_goals")
        .insert(payload);

      error = result.error;
    }

    if (error) {
      setErrorMessage(error.message);
      setSaving(false);
      return;
    }

    await loadGoal(member.team_id, month);

    setMessage("保存しました");
    setEditing(false);
    setSaving(false);
  }

  

  const salesTarget = goal?.target_sales ?? 0;
  const salesRate =
    salesTarget > 0
      ? Math.min(100, Math.round((currentSales / salesTarget) * 100))
      : 0;

  const champagneRemaining = Math.max(
    0,
    (goal?.champagne_target ?? 0) - currentChampagne
  );

  return (
    <main className="min-h-screen bg-black text-white pb-24">
      <div className="mx-auto w-full max-w-md px-5 pt-8">
        <Link href="/members" className="text-sm text-zinc-500">
          ← メンバー一覧
        </Link>

        {loading ? (
          <p className="mt-8 text-zinc-500">読み込み中...</p>
        ) : errorMessage ? (
          <p className="mt-8 rounded-2xl border border-red-900 p-4 text-sm text-red-400">
            ERROR: {errorMessage}
          </p>
        ) : member ? (
          <>
            <header className="mt-6 mb-7">
              <p className="text-xs tracking-[0.3em] text-zinc-500">
                SWAMP-FOG
              </p>

              <h1 className="mt-2 text-3xl font-bold">{member.name}</h1>

              <p className="mt-1 text-sm text-zinc-500">PERSONAL GOALS</p>
            </header>

            <div className="mb-4 flex items-center justify-between">
              <input
                type="month"
                value={month}
                onChange={(e) => changeMonth(e.target.value)}
                className="rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
              />

            <Link
              href={`/members/${memberId}/goal`}
              className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold"
            >
              {goal ? "目標を変更" : "目標を設定"}
            </Link>
            </div>

            <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
              <p className="text-xs text-zinc-500">必達売上</p>
              <p className="mt-2 text-2xl font-bold">
                {goal ? yen(goal.must_sales) : "未設定"}
              </p>

              <div className="mt-6 border-t border-zinc-900 pt-5">
                <p className="text-xs text-zinc-500">月間売上目標</p>
                <p className="mt-2 text-3xl font-bold">
                  {goal ? yen(goal.target_sales) : "未設定"}
                </p>

                <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-white"
                    style={{ width: `${salesRate}%` }}
                  />
                </div>

                <div className="mt-3 flex justify-between text-xs text-zinc-500">
                  <span>現在売上 {yen(currentSales)}</span>
                  <span>達成率 {salesRate}%</span>
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
              <p className="text-xs text-zinc-500">オリシャン目標</p>

              <p className="mt-2 text-3xl font-bold">
                {goal ? `${goal.champagne_target}本` : "未設定"}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-zinc-900 p-4">
                  <p className="text-xs text-zinc-500">現在</p>
                  <p className="mt-1 text-xl font-bold">
                    {currentChampagne}本
                  </p>
                </div>

                <div className="rounded-2xl bg-zinc-900 p-4">
                  <p className="text-xs text-zinc-500">残り</p>
                  <p className="mt-1 text-xl font-bold">
                    {goal ? `${champagneRemaining}本` : "－"}
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
              <p className="text-xs text-zinc-500">来店組数目標</p>

              <p className="mt-2 text-3xl font-bold">
                {goal ? `${goal.visit_count_target}組` : "未設定"}
              </p>

              <div className="mt-4 flex justify-between text-sm text-zinc-500">
                <span>現在 {currentVisits}組</span>
                <span>
                  残り{" "}
                  {goal
                    ? Math.max(0, goal.visit_count_target - currentVisits)
                    : "－"}
                  組
                </span>
              </div>
            </section>

            <section className="mt-4 rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
        <p className="text-xs text-zinc-500">既存来店組数</p>
        <p className="mt-2 text-3xl font-bold">
          {currentExistingVisits}組
        </p>
      </section>

      {editing && (
              <section className="mt-4 rounded-3xl border border-zinc-700 bg-zinc-950 p-5">
                <p className="text-lg font-bold">目標設定</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {month.replace("-", "年")}月
                </p>

                <div className="mt-5 space-y-4">
                  <label className="block">
                    <span className="text-xs text-zinc-500">必達売上</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={mustSales}
                      onChange={(e) => setMustSales(e.target.value)}
                      placeholder="3000000"
                      className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs text-zinc-500">目標売上</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={targetSales}
                      onChange={(e) => setTargetSales(e.target.value)}
                      placeholder="5000000"
                      className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs text-zinc-500">
                      オリシャン目標本数
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={champagneTarget}
                      onChange={(e) => setChampagneTarget(e.target.value)}
                      placeholder="10"
                      className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs text-zinc-500">
                      来店組数目標
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={visitCountTarget}
                      onChange={(e) => setVisitCountTarget(e.target.value)}
                      placeholder="30"
                      className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-3 text-white outline-none"
                    />
                  </label>
                </div>

                <button
                  onClick={saveGoal}
                  disabled={saving}
                  className="mt-6 w-full rounded-2xl bg-white py-4 font-bold text-black disabled:opacity-50"
                >
                  {saving ? "保存中..." : "保存する"}
                </button>
              </section>
            )}

            {message && (
              <p className="mt-4 text-center text-sm text-green-400">
                {message}
              </p>
            )}
          </>
        ) : null}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-zinc-900 bg-black/95">
        <div className="mx-auto grid max-w-md grid-cols-4">
          <Link
            href="/"
            className="py-4 text-center text-xs text-zinc-600"
          >
            ホーム
          </Link>

          <Link
            href="/members"
            className="py-4 text-center text-xs font-bold text-white"
          >
            メンバー
          </Link>

          <button className="py-4 text-xs text-zinc-600">日報</button>
          <button className="py-4 text-xs text-zinc-600">設定</button>
        </div>
      </nav>
    </main>
  );
}
