"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

type Department = {
  id: string;
  name: string;
  display_order: number;
};

type Team = {
  id: string;
  department_id: string | null;
  name: string;
  display_order: number;
};

export default function TeamsPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());

  const [departments, setDepartments] = useState<Department[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const [
        { data: departmentData, error: departmentError },
        { data: teamData, error: teamError },
      ] = await Promise.all([
        supabase
          .from("departments")
          .select("id, name, display_order")
          .eq("is_active", true)
          .order("display_order"),
        supabase
          .from("teams")
          .select("id, department_id, name, display_order")
          .eq("is_active", true)
          .order("display_order"),
      ]);

      if (departmentError) {
        setErrorMessage(departmentError.message);
        setLoading(false);
        return;
      }

      if (teamError) {
        setErrorMessage(teamError.message);
        setLoading(false);
        return;
      }

      setDepartments(departmentData ?? []);
      setTeams(teamData ?? []);
      setLoading(false);
    }

    load();
  }, [router, supabase]);

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <p className="text-zinc-500">読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white pb-24">
      <div className="mx-auto w-full max-w-md px-5 pt-8">
        <Link href="/" className="text-sm text-zinc-500">
          ← ホーム
        </Link>

        <header className="mt-6 mb-8">
          <p className="text-xs tracking-[0.3em] text-zinc-500">
            SWAMP-FOG
          </p>
          <h1 className="mt-2 text-3xl font-bold">
            営業部・チーム
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            DEPARTMENT / TEAM GOALS
          </p>
        </header>

        {errorMessage && (
          <p className="mb-4 text-sm text-red-400">
            ERROR: {errorMessage}
          </p>
        )}

        <div className="space-y-8">
          {departments.map((department) => {
            const departmentTeams = teams.filter(
              (team) => team.department_id === department.id
            );

            return (
              <section key={department.id}>
                <Link
                  href={`/departments/${department.id}`}
                  className="block rounded-3xl border border-zinc-700 bg-zinc-900 p-5"
                >
                  <p className="text-xs text-zinc-500">
                    DEPARTMENT
                  </p>

                  <p className="mt-2 text-2xl font-bold">
                    {department.name}
                  </p>

                  <p className="mt-2 text-sm text-zinc-400">
                    営業部目標・実績を見る →
                  </p>
                </Link>

                <div className="mt-3 space-y-3 pl-4">
                  {departmentTeams.map((team) => (
                    <Link
                      key={team.id}
                      href={`/teams/${team.id}`}
                      className="block rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
                    >
                      <p className="text-[10px] text-zinc-600">
                        TEAM
                      </p>

                      <p className="mt-1 text-lg font-bold">
                        {team.name}
                      </p>

                      <p className="mt-1 text-xs text-zinc-500">
                        チーム目標・実績を見る →
                      </p>
                    </Link>
                  ))}

                  {departmentTeams.length === 0 && (
                    <p className="px-2 py-3 text-sm text-zinc-600">
                      所属チームなし
                    </p>
                  )}
                </div>
              </section>
            );
          })}
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
            href="/teams"
            className="py-4 text-center text-xs font-bold text-white"
          >
            チーム
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
