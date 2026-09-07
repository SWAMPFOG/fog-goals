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

  const [role, setRole] = useState<string | null>(null);

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [draftName, setDraftName] =
    useState("");

  const [savingId, setSavingId] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState("");


  const normalizedRole =
    normalizeRole(role);

  const canRename =
    normalizedRole !== "member";


  async function loadMembers() {
    setLoading(true);

    setMessage("");


    const {
      data: { user },
    } =
      await supabase.auth.getUser();


    if (!user) {
      router.replace("/login");
      return;
    }


    const {
      data: profile,
      error: profileError,
    } =
      await supabase
        .from("profiles")
        .select(
          "role, team_id, member_id"
        )
        .eq("id", user.id)
        .maybeSingle();


    if (profileError) {
      setTeamName(
        "PROFILE ERROR: " +
          profileError.message
      );

      setLoading(false);

      return;
    }


    setRole(
      profile?.role ?? null
    );


    const currentRole =
      normalizeRole(
        profile?.role ?? null
      );


    // 一般キャスト
    if (
      currentRole === "member"
    ) {

      if (!profile?.member_id) {
        setTeamName(
          "本人情報が未設定です"
        );

        setMembers([]);

        setLoading(false);

        return;
      }


      const {
        data,
        error,
      } =
        await supabase
          .from("members")
          .select(
            "id, name, display_order"
          )
          .eq(
            "id",
            profile.member_id
          )
          .eq(
            "is_active",
            true
          )
          .maybeSingle();


      if (error) {

        setTeamName(
          "ERROR: " +
            error.message
        );

        setMembers([]);

      } else {

        setTeamName(
          "マイページ"
        );

        setMembers(
          data ? [data] : []
        );

      }


      setLoading(false);

      return;
    }


    // 部責
    if (
      currentRole ===
      "team_manager"
    ) {

      if (!profile?.team_id) {

        setTeamName(
          "所属チームが未設定です"
        );

        setMembers([]);

        setLoading(false);

        return;
      }


      const {
        data: team,
      } =
        await supabase
          .from("teams")
          .select("name")
          .eq(
            "id",
            profile.team_id
          )
          .maybeSingle();


      setTeamName(
        team?.name ??
          "所属チーム"
      );


      const {
        data,
        error,
      } =
        await supabase
          .from("members")
          .select(
            "id, name, display_order"
          )
          .eq(
            "team_id",
            profile.team_id
          )
          .eq(
            "is_active",
            true
          )
          .order(
            "display_order"
          );


      if (error) {

        setTeamName(
          "ERROR: " +
            error.message
        );

        setMembers([]);

      } else {

        setMembers(
          data ?? []
        );

      }


      setLoading(false);

      return;
    }


    // 営業部責以上
    const {
      data,
      error,
    } =
      await supabase
        .from("members")
        .select(
          "id, name, display_order"
        )
        .eq(
          "is_active",
          true
        )
        .order(
          "display_order"
        );


    if (error) {

      setTeamName(
        "ERROR: " +
          error.message
      );

      setMembers([]);

    } else {

      setTeamName(
        "全メンバー"
      );

      setMembers(
        data ?? []
      );

    }


    setLoading(false);
  }


  useEffect(() => {

    void loadMembers();

    // eslint-disable-next-line react-hooks/exhaustive-deps

  }, []);


  function startRename(
    member: Member
  ) {

    setEditingId(
      member.id
    );

    setDraftName(
      member.name
    );

    setMessage("");
  }


  function cancelRename() {

    setEditingId(null);

    setDraftName("");

    setMessage("");
  }


  async function saveRename(
    member: Member
  ) {

    const nextName =
      draftName.trim();


    if (!nextName) {

      setMessage(
        "名前を入力してください"
      );

      return;
    }


    if (
      nextName ===
      member.name
    ) {

      cancelRename();

      return;
    }


    setSavingId(
      member.id
    );

    setMessage("");


    const {
      error,
    } =
      await supabase.rpc(
        "rename_member",
        {
          p_member_id:
            member.id,

          p_new_name:
            nextName,
        }
      );


    if (error) {

      setMessage(
        "ERROR: " +
          error.message
      );

      setSavingId(null);

      return;
    }


    setMembers(
      (prev) =>
        prev.map(
          (item) =>
            item.id ===
            member.id
              ? {
                  ...item,
                  name: nextName,
                }
              : item
        )
    );


    setEditingId(null);

    setDraftName("");

    setSavingId(null);


    setMessage(
      `「${member.name}」→「${nextName}」に変更しました`
    );
  }


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


          {canRename && (

            <p className="mt-3 text-xs leading-5 text-zinc-600">

              表示名を
              SWAMP-FLOWと
              同じ名前に変更できます。

              <br />

              既存の目標・実績データは
              そのまま残ります。

            </p>

          )}

        </header>


        {message && (

          <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-300">

            {message}

          </div>

        )}


        {loading ? (

          <p className="text-zinc-500">
            読み込み中...
          </p>

        ) : members.length === 0 ? (

          <section className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5">

            <p className="text-zinc-400">
              表示できるメンバーがいません。
            </p>

          </section>

        ) : (

          <div className="space-y-3">

            {members.map(
              (member) => {

                const isEditing =
                  editingId ===
                  member.id;

                const isSaving =
                  savingId ===
                  member.id;


                return (

                  <div
                    key={
                      member.id
                    }
                    className="rounded-3xl border border-zinc-800 bg-zinc-950 p-5"
                  >

                    {isEditing ? (

                      <div>

                        <p className="text-xs text-zinc-600">
                          MEMBER NAME
                        </p>


                        <input
                          autoFocus
                          type="text"
                          value={
                            draftName
                          }
                          onChange={(
                            e
                          ) =>
                            setDraftName(
                              e
                                .target
                                .value
                            )
                          }
                          maxLength={
                            50
                          }
                          className="mt-3 w-full rounded-2xl border border-zinc-700 bg-black px-4 py-4 text-lg font-bold text-white outline-none focus:border-zinc-500"
                          placeholder="SWAMP-FLOWと同じ名前"
                        />


                        <div className="mt-3 grid grid-cols-2 gap-2">

                          <button
                            type="button"
                            onClick={
                              cancelRename
                            }
                            disabled={
                              isSaving
                            }
                            className="rounded-2xl border border-zinc-800 px-4 py-3 text-sm font-bold text-zinc-400 disabled:opacity-50"
                          >
                            キャンセル
                          </button>


                          <button
                            type="button"
                            onClick={() =>
                              saveRename(
                                member
                              )
                            }
                            disabled={
                              isSaving
                            }
                            className="rounded-2xl bg-white px-4 py-3 text-sm font-bold text-black disabled:opacity-50"
                          >

                            {isSaving
                              ? "保存中..."
                              : "保存"}

                          </button>

                        </div>

                      </div>

                    ) : (

                      <div className="flex items-center justify-between gap-4">

                        <Link
                          href={`/members/${member.id}`}
                          className="min-w-0 flex-1"
                        >

                          <p className="text-xs text-zinc-600">
                            MEMBER
                          </p>


                          <h2 className="mt-1 truncate text-xl font-bold">

                            {
                              member.name
                            }

                          </h2>

                        </Link>


                        <div className="flex items-center gap-3">

                          {canRename && (

                            <button
                              type="button"
                              onClick={() =>
                                startRename(
                                  member
                                )
                              }
                              className="rounded-xl border border-zinc-800 px-3 py-2 text-xs font-bold text-zinc-300"
                            >

                              名前変更

                            </button>

                          )}


                          <Link
                            href={`/members/${member.id}`}
                            className="px-1 text-2xl text-zinc-600"
                            aria-label={`${member.name}の詳細`}
                          >
                            ›
                          </Link>

                        </div>

                      </div>

                    )}

                  </div>

                );
              }
            )}

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
