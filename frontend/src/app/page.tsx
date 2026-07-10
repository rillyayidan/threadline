"use client";

import { FormEvent, startTransition, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { LoginResponse, User, Workspace } from "@/lib/types";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspaceName, setWorkspaceName] = useState("");
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);

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

  useEffect(() => {
    if (!user) {
      return;
    }

    const token = localStorage.getItem("threadline.token");
    if (!token) {
      return;
    }

    const authToken = token;

    let isActive = true;

    async function loadWorkspaces() {
      startTransition(() => {
        setIsLoadingWorkspaces(true);
        setWorkspaceError("");
      });

      try {
        const data = await api<Workspace[]>("/workspaces", { token: authToken });

        if (isActive) {
          startTransition(() => {
            setWorkspaces(data);
          });
        }
      } catch (error) {
        if (isActive) {
          startTransition(() => {
            setWorkspaceError(
              error instanceof ApiError
                ? error.message
                : "Gagal memuat workspace.",
            );
          });
        }
      } finally {
        if (isActive) {
          startTransition(() => {
            setIsLoadingWorkspaces(false);
          });
        }
      }
    }

    void loadWorkspaces();

    return () => {
      isActive = false;
    };
  }, [user]);

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

  async function handleCreateWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = localStorage.getItem("threadline.token");
    if (!token) {
      setWorkspaceError("Sesi tidak ditemukan. Silakan masuk kembali.");
      return;
    }

    const authToken = token;
    setWorkspaceError("");
    setIsCreatingWorkspace(true);

    try {
      const workspace = await api<Workspace>("/workspaces", {
        method: "POST",
        token: authToken,
        body: { name: workspaceName },
      });

      setWorkspaces((currentWorkspaces) => [workspace, ...currentWorkspaces]);
      setWorkspaceName("");
    } catch (error) {
      setWorkspaceError(
        error instanceof ApiError
          ? error.message
          : "Gagal membuat workspace.",
      );
    } finally {
      setIsCreatingWorkspace(false);
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
      <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
        <div className="mx-auto max-w-5xl">
          <header className="flex items-center justify-between border-b border-slate-800 pb-6">
            <div>
              <p className="text-sm font-semibold tracking-[0.2em] text-cyan-400">
                THREADLINE
              </p>
              <h1 className="mt-2 text-2xl font-semibold">
                Workspace Anda
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <span className="hidden text-sm text-slate-400 sm:block">
                {user.name}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm font-medium hover:bg-slate-800"
              >
                Keluar
              </button>
            </div>
          </header>

          <section className="mt-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-cyan-400">
                  PROJECT SPACES
                </p>
                <h2 className="mt-2 text-3xl font-semibold">
                  Pilih tempat kerja Anda
                </h2>
              </div>
              <span className="text-sm text-slate-400">
                {workspaces.length} workspace
              </span>
            </div>

            <form
              onSubmit={handleCreateWorkspace}
              className="mt-8 flex flex-col gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4 sm:flex-row"
            >
              <label className="sr-only" htmlFor="workspace-name">
                Nama workspace
              </label>
              <input
                id="workspace-name"
                type="text"
                value={workspaceName}
                onChange={(event) => setWorkspaceName(event.target.value)}
                required
                maxLength={120}
                placeholder="Contoh: Portfolio Projects"
                className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 outline-none placeholder:text-slate-500 focus:border-cyan-400"
              />
              <button
                type="submit"
                disabled={isCreatingWorkspace}
                className="rounded-lg bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreatingWorkspace ? "Membuat..." : "Buat workspace"}
              </button>
            </form>

            {isLoadingWorkspaces && (
              <p className="mt-8 text-slate-400">Memuat workspace...</p>
            )}

            {workspaceError && (
              <p
                role="alert"
                className="mt-8 rounded-lg border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-200"
              >
                {workspaceError}
              </p>
            )}

            {!isLoadingWorkspaces && !workspaceError && workspaces.length === 0 && (
              <div className="mt-8 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-slate-300">
                Belum ada workspace. Buat workspace pertama Anda menggunakan form di atas.
              </div>
            )}

            {!isLoadingWorkspaces && workspaces.length > 0 && (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {workspaces.map((workspace) => (
                  <article
                    key={workspace.id}
                    className="rounded-xl border border-slate-700 bg-slate-900 p-5"
                  >
                    <p className="text-xs font-medium tracking-wider text-cyan-400">
                      WORKSPACE
                    </p>
                    <h3 className="mt-3 text-lg font-semibold">
                      {workspace.name}
                    </h3>
                    <p className="mt-2 text-sm text-slate-400">
                      Project dan decision log Anda akan tampil di sini.
                    </p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
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