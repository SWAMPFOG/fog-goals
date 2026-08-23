"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function GoalSettingPage() {
  const params = useParams();
  const router = useRouter();
  const memberId = params.id as string;
  const [supabase] = useState(() => createClient());

  const [memberName, setMemberName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [month, setMonth] = useState(
    `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
  );

  const [mustSales, setMustSales] = useState("");
  const [targetSales, setTargetSales] = useState("");
  const [champagneTarget, setChampagneTarget] = useState("");
  const [visitTarget, setVisitTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: member } = await supabase
        .from("members")
        .select("name, team_id")
        .eq("id", memberId)
        .single();

      if (!member) return;

      setMemberName(member.name);
      setTeamId(member.team_id);

      const { data: goal } = await supabase
        .from("monthly_goals")
        .select("*")
        .eq("member_id", memberId)
        .eq("target_month", `${month}-01`)
        .maybeSingle();

      if (goal) {
        setMustSales(String(goal.must_sales ?? ""));
        setTargetSales(String(goal.target_sales ?? ""));
        setChampagneTarget(String(goal.champagne_target ?? ""));
        setVisitTarget(String(goal.visit_count_target ?? ""));
      }
    }

    load();
  }, [memberId, month, router, supabase]);

  async function save() {
    if (!teamId) return;

    setSaving(true);
    setMessage("");

    const payload = {
      member_id: memberId,
      team_id: teamId,
      target_month: `${month}-01`,
      must_sales: Number(mustSales || 0),
      target_sales: Number(targetSales || 0),
      champagne_target: Number(champagneTarget || 0),
      visit_count_target: Number(visitTarget || 0),
    };

    const { data: existing } = await supabase
      .from("monthly_goals")
      .select("id")
      .eq("member_id", memberId)
      .eq("target_month", `${month}-01`)
      .maybeSingle();

    const result = existing
      ? await supabase.from("monthly_goals").update(payload).eq("id", existing.id)
      : await supabase.from("monthly_goals").insert(payload);

    if (result.error) {
      setMessage("ERROR: " + result.error.message);
      setSaving(false);
      return;
    }

    router.push(`/members/${memberId}`);
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-md px-5 py-8">
        <Link href={`/members/${memberId}`} className="text-sm text-zinc-500">
          ← 戻る
        </Link>

        <p className="mt-7 text-xs tracking-[0.3em] text-zinc-500">
          SWAMP-FOG
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          {memberName || "目標設定"}
        </h1>

        <p className="mt-1 text-sm text-zinc-500">
          GOAL SETTING
        </p>

        <div className="mt-8 space-y-5">
          <label className="block">
            <span className="text-sm text-zinc-400">対象月</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-white"
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-400">必達売上</span>
            <input
              type="number"
              value={mustSales}
              onChange={(e) => setMustSales(e.target.value)}
              placeholder="3000000"
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-white"
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-400">目標売上</span>
            <input
              type="number"
              value={targetSales}
              onChange={(e) => setTargetSales(e.target.value)}
              placeholder="5000000"
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-white"
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-400">オリシャン目標本数</span>
            <input
              type="number"
              value={champagneTarget}
              onChange={(e) => setChampagneTarget(e.target.value)}
              placeholder="10"
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-white"
            />
          </label>

          <label className="block">
            <span className="text-sm text-zinc-400">来店組数目標</span>
            <input
              type="number"
              value={visitTarget}
              onChange={(e) => setVisitTarget(e.target.value)}
              placeholder="30"
              className="mt-2 w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-white"
            />
          </label>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full rounded-2xl bg-white py-4 font-bold text-black disabled:opacity-50"
          >
            {saving ? "保存中..." : "保存する"}
          </button>

          {message && (
            <p className="text-center text-sm text-red-400">{message}</p>
          )}
        </div>
      </div>
    </main>
  );
}
