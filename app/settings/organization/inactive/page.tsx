"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Team = {
  id: string;
  name: string;
  department_id: string | null;
};

type Member = {
  id: string;
  name: string;
  team_id: string | null;
};

export default function InactiveOrganizationPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const [teamsResult, membersResult] = await Promise.all([
      supabase
        .from("teams")
        .select("id,name,department_id")
        .eq("is_active", false)
        .order("display_order"),
      supabase
        .from("members")
        .select("id,name,team_id")
        .eq("is_active", false)
        .order("display_order"),
    ]);

    if (teamsResult.error || membersResult.error) {
      setMessage(
        "ERROR: " +
          (teamsResult.error?.message ??
            membersResult.error?.message ??
            "読み込みに失敗しました")
      );
      setLoading(false);
      return;
    }

    setTeams(teamsResult.data ?? []);
    setMembers(membersResult.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);

  async function restoreTeam(team: Team) {
    if (!window.confirm(`「${team.name}」を復元しますか？`)) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("teams")
      .update({ is_active: true })
      .eq("id", team.id);

    if (error) {
      setMessage("ERROR: " + error.message);
      setSaving(false);
      return;
    }

    setMessage("チームを復元しました");
    await loadData();
    setSaving(false);
  }

  async function restoreMember(member: Member) {
    if (!window.confirm(`「${member.name}」を復元しますか？`)) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("members")
      .update({ is_active: true })
      .eq("id", member.id);

    if (error) {
      setMessage("ERROR: " + error.message);
      setSaving(false);
      return;
    }

    setMessage("メンバーを復元しました");
    await loadData();
    setSaving(false);
  }

  return (
    <main className="min-h-screen bg-black text-white pb-16">
      <div className="mx-auto w-full max-w-md px-5 pt-8">
        <Link
          href="/settings/organization"
          className="text-sm text-zinc-500"
        >
          ← 組織管理へ戻る
        </Link>

        <header className="mt-8 mb-8">
          <p className="text-xs tracking-[0.3em] text-zinc-500">
            SWAMP-FOG
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            無効一覧・復元
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            INACTIVE / RESTORE
          </p>
        </header>

        {message && (
          <div
            className={`mb-6 rounded-2xl border p-4 text-sm ${
              message.startsWith("ERROR:")
                ? "border-red-900 text-red-400"
                : "border-zinc-800 text-white"
            }`}
          >
            {message}
          </div>
        )}

        {loading ? (
          <p className="text-zinc-500">読み込み中...</p>
        ) : (
          <>
            <section className="mb-10">
              <p className="text-xs text-zinc-500">
                INACTIVE TEAM
              </p>

              <h2 className="mt-1 text-2xl font-bold">
                無効チーム
              </h2>

              <div className="mt-4 space-y-3">
                {teams.length === 0 ? (
                  <p className="rounded-2xl border border-zinc-800 p-5 text-sm text-zinc-500">
                    無効化されたチームはありません
                  </p>
                ) : (
                  teams.map((team) => (
                    <div
                      key={team.id}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 p-4"
                    >
                      <p className="font-bold">{team.name}</p>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => restoreTeam(team)}
                        className="shrink-0 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold disabled:opacity-50"
                      >
                        復元
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <p className="text-xs text-zinc-500">
                INACTIVE MEMBER
              </p>

              <h2 className="mt-1 text-2xl font-bold">
                無効メンバー
              </h2>

              <div className="mt-4 space-y-3">
                {members.length === 0 ? (
                  <p className="rounded-2xl border border-zinc-800 p-5 text-sm text-zinc-500">
                    無効化されたメンバーはいません
                  </p>
                ) : (
                  members.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-zinc-800 p-4"
                    >
                      <p className="font-bold">{member.name}</p>

                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => restoreMember(member)}
                        className="shrink-0 rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold disabled:opacity-50"
                      >
                        復元
                      </button>
                    </div>
                  ))
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
