"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setMessage("メールアドレスまたはパスワードを確認してください。");
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <p className="text-xs tracking-[0.35em] text-zinc-500 mb-3">
            SWAMP-FOG
          </p>

          <h1 className="text-4xl font-bold tracking-tight">
            FOG GOALS
          </h1>

          <p className="mt-3 text-sm text-zinc-500">
            Team Goal Management
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              メールアドレス
            </label>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-base outline-none focus:border-zinc-500"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-2">
              パスワード
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-4 text-base outline-none focus:border-zinc-500"
              placeholder="••••••••"
            />
          </div>

          {message && (
            <p className="text-sm text-center text-red-400">
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-white py-4 font-bold text-black disabled:opacity-50"
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-zinc-700">
          SWAMP-FOG Goal Management System
        </p>
      </div>
    </main>
  );
}
