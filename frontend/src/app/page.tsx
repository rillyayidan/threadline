"use client";

import { FormEvent, startTransition, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { LoginResponse, User } from "@/lib/types";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  useEffect(() => {
    let restoredUser: User | null = null;

    const token = localStorage.getItem("threadline.token");
    const storedUser = localStorage.getItem("threadline.user");

    if (token && storedUser) {
      try {
        restoredUser = JSON.parse(storedUser) as User;
      } catch {
        localStorage.removeItem("threadline.token");
        localStorage.removeItem("threadline.user");
      }
    }

    startTransition(() => {
      setUser(restoredUser);
      setIsLoadingSession(false);
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await api<LoginResponse>("/login", {
        method: "POST",
        body: { email, password },
      });

      localStorage.setItem("threadline.token", response.token);
      localStorage.setItem("threadline.user", JSON.stringify(response.user));
      setUser(response.user);
    } catch (error) {
      setError(
        error instanceof ApiError
          ? error.message
          : "Terjadi kesalahan. Coba lagi.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("threadline.token");
    localStorage.removeItem("threadline.user");
    setUser(null);
    setPassword("");
  }

  if (isLoadingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
        Memuat Threadline...
      </main>
    );
  }

  if (user) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-xl">
          <p className="text-sm font-medium text-cyan-400">THREADLINE</p>
          <h1 className="mt-3 text-3xl font-semibold">
            Selamat datang, {user.name}.
          </h1>
          <p className="mt-3 text-slate-300">
            Sesi login tersimpan. Dashboard workspace akan kita buat pada fitur berikutnya.
          </p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-8 rounded-lg border border-slate-600 px-4 py-2 text-sm font-medium hover:bg-slate-800"
          >
            Keluar
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
      <section className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-xl">
        <p className="text-sm font-semibold tracking-[0.2em] text-cyan-400">
          THREADLINE
        </p>
        <h1 className="mt-3 text-3xl font-semibold">Masuk ke workspace Anda</h1>
        <p className="mt-3 text-slate-300">
          Kelola task dan simpan alasan di balik setiap keputusan proyek.
        </p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoComplete="email"
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 outline-none placeholder:text-slate-500 focus:border-cyan-400"
              placeholder="you@example.com"
            />
          </label>

          <label className="block text-sm font-medium">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
              className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 outline-none placeholder:text-slate-500 focus:border-cyan-400"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-200"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Memproses..." : "Masuk"}
          </button>
        </form>
      </section>
    </main>
  );
}