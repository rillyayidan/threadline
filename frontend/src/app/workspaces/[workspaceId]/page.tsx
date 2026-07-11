"use client";

import Link from "next/link";
import { FormEvent, startTransition, use, useEffect, useState } from "react";
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
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);

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

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = projectName.trim();
    if (!name) {
        setError("Nama project wajib diisi.");
        return;
    }

    const token = localStorage.getItem("threadline.token");
    if (!token) {
        setError("Sesi tidak ditemukan. Silakan masuk kembali.");
        return;
    }

    const authToken = token;
    setError("");
    setIsCreatingProject(true);

    try {
        const project = await api<Project>(
        `/workspaces/${workspaceId}/projects`,
        {
            method: "POST",
            token: authToken,
            body: {
            name,
            description: projectDescription.trim(),
            },
        },
        );

        setProjects((currentProjects) => [project, ...currentProjects]);
        setProjectName("");
        setProjectDescription("");
    } catch (error) {
        setError(
        error instanceof ApiError
            ? error.message
            : "Gagal membuat project.",
        );
    } finally {
        setIsCreatingProject(false);
    }
    }

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

        <form
            onSubmit={handleCreateProject}
            className="mt-8 rounded-xl border border-slate-700 bg-slate-900 p-5"
        >
            <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium">
                Nama project
                <input
                    type="text"
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    required
                    maxLength={120}
                    placeholder="Contoh: Threadline MVP"
                    className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 outline-none placeholder:text-slate-500 focus:border-cyan-400"
                />
                </label>

                <label className="block text-sm font-medium">
                Deskripsi
                <input
                    type="text"
                    value={projectDescription}
                    onChange={(event) => setProjectDescription(event.target.value)}
                    maxLength={500}
                    placeholder="Ringkasan tujuan project"
                    className="mt-2 w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2.5 outline-none placeholder:text-slate-500 focus:border-cyan-400"
                />
                </label>
            </div>

            <button
                type="submit"
                disabled={isCreatingProject}
                className="mt-4 rounded-lg bg-cyan-400 px-4 py-2.5 font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {isCreatingProject ? "Membuat..." : "Buat project"}
            </button>
        </form>

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