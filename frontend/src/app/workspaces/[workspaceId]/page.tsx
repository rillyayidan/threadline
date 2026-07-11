"use client";

import Link from "next/link";
import { startTransition, use, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Project } from "@/lib/types";

type WorkspacePageProps = {
  params: Promise<{ workspaceId: string }>;
};

export default function WorkspacePage({ params }: WorkspacePageProps) {
  const { workspaceId } = use(params);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("threadline.token");

    if (!token) {
      startTransition(() => {
        setError("Sesi tidak ditemukan. Silakan masuk kembali.");
        setIsLoading(false);
      });
      return;
    }

    let isActive = true;
    const authToken = token;

    async function loadProjects() {
      try {
        const data = await api<Project[]>(
          `/workspaces/${workspaceId}/projects`,
          { token: authToken },
        );

        if (isActive) {
          startTransition(() => {
            setProjects(data);
          });
        }
      } catch (error) {
        if (isActive) {
          startTransition(() => {
            setError(
              error instanceof ApiError
                ? error.message
                : "Gagal memuat project.",
            );
          });
        }
      } finally {
        if (isActive) {
          startTransition(() => {
            setIsLoading(false);
          });
        }
      }
    }

    void loadProjects();

    return () => {
      isActive = false;
    };
  }, [workspaceId]);

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
        >
          ← Semua workspace
        </Link>

        <header className="mt-8 border-b border-slate-800 pb-6">
          <p className="text-sm font-semibold tracking-[0.2em] text-cyan-400">
            THREADLINE
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Projects</h1>
          <p className="mt-2 text-slate-400">
            Task dan keputusan proyek akan dikelola dari sini.
          </p>
        </header>

        {isLoading && (
          <p className="mt-8 text-slate-400">Memuat project...</p>
        )}

        {error && (
          <p
            role="alert"
            className="mt-8 rounded-lg border border-red-900 bg-red-950 px-4 py-3 text-sm text-red-200"
          >
            {error}
          </p>
        )}

        {!isLoading && !error && projects.length === 0 && (
          <div className="mt-8 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-8 text-slate-300">
            Belum ada project di workspace ini.
          </div>
        )}

        {!isLoading && projects.length > 0 && (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <article
                key={project.id}
                className="rounded-xl border border-slate-700 bg-slate-900 p-5"
              >
                <p className="text-xs font-medium tracking-wider text-cyan-400">
                  PROJECT
                </p>
                <h2 className="mt-3 text-lg font-semibold">{project.name}</h2>
                {project.description && (
                  <p className="mt-2 text-sm text-slate-400">
                    {project.description}
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}