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

      if (role === "member") {
        if (!profile?.member_id) {
          setTeamName("本人情報が未設定です");
          setMembers([]);
          setLoading(false);
          return;
        }

        router.replace(`/members/${profile.member_id}`);
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

  return (
    <main className="min-h-screen bg-black text-white pb-24">
      <div className="mx-auto w-full max-w-md px-5 pt-8">
        <header className="mb-6">
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

          <Link
            href="/daily"
            className="py-4 text-center text-xs text-zinc-600"
          >
            日報
          </Link>

          <Link
            href="/settings"
            className="py-4 text-center text-xs text-zinc-600"
          >
            設定
          </Link>
        </div>
      </nav>
    </main>
  );
}
