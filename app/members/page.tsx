"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { normalizeRole } from "@/utils/permissions";

type Member = {
  id: string;
  name: string;
  display_order: number;
};

export default function MembersPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [teamName, setTeamName] = useState("");
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
  const [canAddMember, setCanAddMember] = useState(false);
  const [addTeamId, setAddTeamId] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [addMessage, setAddMessage] = useState("");


  useEffect(() => {
    async function loadMembers() {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, team_id, member_id")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setTeamName("PROFILE ERROR: " + profileError.message);
        setLoading(false);
        return;
      }

      const role = normalizeRole(profile?.role ?? null);

      const upperRoles = ["business_manager", "company_manager", "chairman"];

      if (role === "team_manager" && profile?.team_id) {
        setCanAddMember(true);
        setAddTeamId(profile.team_id);
      } else if (upperRoles.includes(role)) {
        setCanAddMember(true);

        const { data: teamData } = await supabase
          .from("teams")
          .select("id, name")
          .eq("is_active", true)
          .order("display_order");

        setTeams(teamData ?? []);

        if ((teamData ?? []).length > 0) {
          setAddTeamId(teamData![0].id);
        }
      } else {
        setCanAddMember(false);
      }


      if (role === "member") {
        if (!profile?.member_id) {
          setTeamName("本人情報が未設定です");
          setMembers([]);
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
          .from("members")
          .select("id, name, display_order")
          .eq("id", profile.member_id)
          .eq("is_active", true)
          .maybeSingle();

        if (error) {
          setTeamName("ERROR: " + error.message);
          setMembers([]);
        } else {
          setTeamName("マイページ");
          setMembers(data ? [data] : []);
        }

        setLoading(false);
        return;
      }

      if (role === "team_manager") {
        if (!profile?.team_id) {
          setTeamName("所属チームが未設定です");
          setMembers([]);
          setLoading(false);
          return;
        }

        const { data: team } = await supabase
          .from("teams")
          .select("name")
          .eq("id", profile.team_id)
          .maybeSingle();

        setTeamName(team?.name ?? "所属チーム");

        const { data, error } = await supabase
          .from("members")
          .select("id, name, display_order")
          .eq("team_id", profile.team_id)
          .eq("is_active", true)
          .order("display_order");

        if (error) {
          setTeamName("ERROR: " + error.message);
          setMembers([]);
        } else {
          setMembers(data ?? []);
        }

        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("members")
        .select("id, name, display_order")
        .eq("is_active", true)
        .order("display_order");

      if (error) {
        setTeamName("ERROR: " + error.message);
        setMembers([]);
      } else {
        setTeamName("全メンバー");
        setMembers(data ?? []);
      }

      setLoading(false);
    }

    loadMembers();
  }, [router, supabase]);

  async function addMember() {
    const name = newMemberName.trim();

    if (!canAddMember || !addTeamId || !name) return;

    setAddingMember(true);
    setAddMessage("");

    const { data: lastMember } = await supabase
      .from("members")
      .select("display_order")
      .eq("team_id", addTeamId)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = Number(lastMember?.display_order ?? 0) + 1;

    const { error } = await supabase
      .from("members")
      .insert({
        name,
        team_id: addTeamId,
        display_order: nextOrder,
        is_active: true,
      });

    if (error) {
      setAddMessage("ERROR: " + error.message);
      setAddingMember(false);
      return;
    }

    setNewMemberName("");
    setAddMessage("追加しました");
    window.location.reload();
  }

  return (
    <main className="min-h-screen bg-black text-white pb-24">
      <div className="mx-auto w-full max-w-md px-5 pt-4">
        <header className="sticky top-0 z-40 -mx-5 mb-6 border-b border-zinc-900 bg-black/90 px-5 pb-4 pt-4 backdrop-blur-xl">
          <p className="text-xs tracking-[0.3em] text-zinc-500">
            SWAMP-FOG
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            メンバー
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            {teamName}
          </p>
        </header>

        {canAddMember && (
          <section className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <p className="text-sm font-bold">新規メンバー追加</p>

            {teams.length > 0 && (
              <select
                value={addTeamId}
                onChange={(e) => setAddTeamId(e.target.value)}
                className="mt-3 w-full rounded-xl border border-zinc-800 bg-black px-3 py-3 text-white"
              >
                {teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            )}

            <div className="mt-3 flex gap-2">
              <input
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                placeholder="メンバー名"
                className="min-w-0 flex-1 rounded-xl border border-zinc-800 bg-black px-3 py-3 text-white"
              />

              <button
                onClick={addMember}
                disabled={addingMember || !newMemberName.trim() || !addTeamId}
                className="rounded-xl bg-white px-4 font-bold text-black disabled:opacity-40"
              >
                {addingMember ? "追加中" : "追加"}
              </button>
            </div>

            {addMessage && (
              <p className="mt-2 text-xs text-zinc-400">{addMessage}</p>
            )}
          </section>
        )}

        {loading ? (
          <p className="text-zinc-500">読み込み中...</p>
        ) : members.length === 0 ? (
          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">
            <p className="text-zinc-400">
              表示できるメンバーがいません。
            </p>
          </section>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <Link
                key={member.id}
                href={`/members/${member.id}`}
                className="block rounded-3xl border border-zinc-800 bg-zinc-950 p-5 transition active:scale-[0.99]"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-600">
                      MEMBER
                    </p>

                    <h2 className="mt-1 text-xl font-bold">
                      {member.name}
                    </h2>
                  </div>

                  <span className="text-zinc-600">›</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-black/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto grid max-w-md grid-cols-4 px-2 pt-1">
          <Link
            href="/"
            className="py-2.5 text-center text-[10px] text-zinc-600"
          >
            <span className="block text-lg leading-none">⌂</span>
            <span className="mt-1 block">ホーム</span>
          </Link>

          <Link
            href="/members"
            className="py-2.5 text-center text-[10px] font-bold text-white"
          >
            <span className="block text-lg leading-none">♙</span>
            <span className="mt-1 block">メンバー</span>
          </Link>

          <Link
            href="/daily"
            className="py-2.5 text-center text-[10px] text-zinc-600"
          >
            <span className="block text-lg leading-none">✎</span>
            <span className="mt-1 block">日報</span>
          </Link>

          <Link
            href="/settings"
            className="py-2.5 text-center text-[10px] text-zinc-600"
          >
            <span className="block text-lg leading-none">⚙</span>
            <span className="mt-1 block">設定</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}
