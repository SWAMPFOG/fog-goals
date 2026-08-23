"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { canEditStoreGoal } from "@/utils/permissions";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function SettingsPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [month, setMonth] = useState(currentMonth());
  const [teamId, setTeamId] = useState("");

  const [targetSales, setTargetSales] = useState("");
  const [champagneTarget, setChampagneTarget] = useState("");
  const [visitTarget, setVisitTarget] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [role, setRole] = useState<string | null>(null);

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
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setMessage("ERROR: " + profileError.message);
        setLoading(false);
        return;
      }

      setRole(profileData?.role ?? null);

      const { data: currentTeamId, error } =
        await supabase.rpc("current_user_team_id");

      if (error || !currentTeamId) {
        setMessage(
          "ERROR: " + (error?.message ?? "チームIDを取得できませんでした")
        );
        setLoading(false);
        return;
      }

      setTeamId(currentTeamId);
      setLoading(false);
    }

    init();
  }, [router, supabase]);

  useEffect(() => {
    async function loadGoal() {
      if (!teamId || !month) return;

      setMessage("");

      const targetMonth = `${month}-01`;

      const { data, error } = await supabase
        .from("store_goals")
        .select(
          "target_sales, champagne_target, visit_count_target"
        )
        .eq("team_id", teamId)
        .eq("target_month", targetMonth)
        .maybeSingle();

      if (error) {
        setMessage("ERROR: " + error.message);
        return;
      }

      if (data) {
        setTargetSales(String(data.target_sales ?? 0));
        setChampagneTarget(String(data.champagne_target ?? 0));
        setVisitTarget(String(data.visit_count_target ?? 0));
      } else {
        setTargetSales("");
        setChampagneTarget("");
        setVisitTarget("");
      }
    }

    loadGoal();
  }, [teamId, month, supabase]);

  async function saveGoal() {
    if (!canEditStoreGoal(role)) {
      setMessage("ERROR: 店舗目標を編集する権限がありません");
      return;
    }

    if (!teamId) return;

    setSaving(true);
    setMessage("");

    const payload = {
      team_id: teamId,
      target_month: `${month}-01`,
      target_sales: Number(targetSales || 0),
      champagne_target: Number(champagneTarget || 0),
      visit_count_target: Number(visitTarget || 0),
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("store_goals")
      .upsert(payload, {
        onConflict: "team_id,target_month",
      });

    if (error) {
      setMessage("ERROR: " + error.message);
      setSaving(false);
      return;
    }

    setMessage("保存しました");
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-500">読み込み中...</p>
      </main>
    );
  }

  if (!canEditStoreGoal(role)) {
    return (
      <main className="min-h-screen bg-black text-white p-6">
        <div className="mx-auto max-w-md">
          <p className="text-xs tracking-[0.3em] text-zinc-500">
            SWAMP-FOG
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            店舗目標設定
          </h1>

          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="font-bold">
              店舗目標は社責以上が設定します
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              このアカウントには店舗目標を編集する権限がありません。
            </p>

            <Link
              href="/"
              className="mt-5 block rounded-xl border border-zinc-700 py-3 text-center text-sm font-bold"
            >
              ホームへ戻る
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white pb-24">
      <div className="mx-auto w-full max-w-md px-5 pt-8">
        <Link
          href="/"
          className="text-sm text-zinc-500"
        >
          ← ホーム
        </Link>

        <header className="mt-6 mb-8">
          <p className="text-xs tracking-[0.3em] text-zinc-500">
            SWAMP-FOG
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            店舗目標設定
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            STORE GOAL SETTING
          </p>
        </header>

        <div className="space-y-5">
          <label className="block">
            <span className="text-sm text-zinc-400">
              対象月
            </span>

            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-4 text-white outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-400">
              店舗月間売上目標
            </span>

            <input
              type="number"
              inputMode="numeric"
              value={targetSales}
              onChange={(e) => setTargetSales(e.target.value)}
              placeholder="100000000"
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-4 text-white outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-400">
              オリシャン目標本数
            </span>

            <input
              type="number"
              inputMode="numeric"
              value={champagneTarget}
              onChange={(e) => setChampagneTarget(e.target.value)}
              placeholder="100"
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-4 text-white outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-400">
              来店組数目標
            </span>

            <input
              type="number"
              inputMode="numeric"
              value={visitTarget}
              onChange={(e) => setVisitTarget(e.target.value)}
              placeholder="300"
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-black px-4 py-4 text-white outline-none"
            />
          </label>

          <button
            onClick={saveGoal}
            disabled={saving}
            className="w-full rounded-2xl bg-white py-4 font-bold text-black disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存する"}
          </button>

          {message && (
            <p
              className={`text-center text-sm ${
                message.startsWith("ERROR")
                  ? "text-red-400"
                  : "text-green-400"
              }`}
            >
              {message}
            </p>
          )}
        </div>
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
            className="py-4 text-center text-xs text-zinc-600"
          >
            メンバー
          </Link>

          <Link
            href="/daily"
            className="py-4 text-center text-xs text-zinc-600"
          >
            日報
          </Link>

          <Link
            href="/settings"
            className="py-4 text-center text-xs font-bold text-white"
          >
            設定
          </Link>
        </div>
      </nav>
    </main>
  );
}
