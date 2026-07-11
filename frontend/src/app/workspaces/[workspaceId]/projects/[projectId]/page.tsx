"use client";

import Link from "next/link";
import { FormEvent, startTransition, use, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Decision, Task } from "@/lib/types";

type ProjectPageProps = {
    params: Promise<{ workspaceId: string; projectId: string }>;
};

export default function ProjectPage({ params }: ProjectPageProps) {
    const { workspaceId, projectId } = use(params);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [decisions, setDecisions] = useState<Decision[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState("");
    const [taskTitle, setTaskTitle] = useState("");
    const [taskDescription, setTaskDescription] = useState("");
    const [taskPriority, setTaskPriority] = useState<Task["priority"]>("medium");
    const [taskDueDate, setTaskDueDate] = useState("");
    const [isCreatingTask, setIsCreatingTask] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem("threadline.token");

        if (!token) {
            startTransition(() => {
                setError("Sesi tidak ditemukan. Silakan masuk kembali.");
                setIsLoading(false);
            });
            return;
        }

        const authToken = token;
        let isActive = true;

        async function loadProjectData() {
            try {
                const [taskData, decisionData] = await Promise.all([
                    api<Task[]>(`/projects/${projectId}/tasks`, { token: authToken }),
                    api<Decision[]>(`/projects/${projectId}/decisions`, {
                        token: authToken,
                    }),
                ]);

                if (isActive) {
                    startTransition(() => {
                    setTasks(taskData);
                    setDecisions(decisionData);
                    });
                }
            } catch (error) {
                if (isActive) {
                    startTransition(() => {
                        setError(
                            error instanceof ApiError
                            ? error.message
                            : "Gagal memuat detail project.",
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

        void loadProjectData();

        return () => {
            isActive = false;
        };
    }, [projectId]);

    async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const token = localStorage.getItem("threadline.token");
        const title = taskTitle.trim();

        if (!token) {
            setError("Sesi tidak ditemukan. Silakan masuk kembali.");
            return;
        }

        if (!title) {
            setError("Judul task wajib diisi.");
            return;
        }

        setIsCreatingTask(true);
        setError("");

        try {
            const body: {
                title: string;
                description: string;
                priority: Task["priority"];
                due_date?: string;
            } = {
                title,
                description: taskDescription.trim(),
                priority: taskPriority,
            };

            if (taskDueDate) {
                body.due_date = taskDueDate;
            }

            const createdTask = await api<Task>(`/projects/${projectId}/tasks`, {
                method: "POST",
                token,
                body,
            });

            setTasks((currentTasks) => [createdTask, ...currentTasks]);
            setTaskTitle("");
            setTaskDescription("");
            setTaskPriority("medium");
            setTaskDueDate("");
        } catch (error) {
            setError(
                error instanceof ApiError ? error.message : "Gagal membuat task.",
            );
        } finally {
            setIsCreatingTask(false);
        }
    }

    return (
        <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
            <div className="mx-auto max-w-5xl">
                <Link
                    href={`/workspaces/${workspaceId}`}
                    className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
                >
                    ← Semua project
                </Link>

                <header className="mt-8 border-b border-slate-800 pb-6">
                    <p className="text-sm font-semibold tracking-[0.2em] text-cyan-400">
                        THREADLINE
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold">Project overview</h1>
                    <p className="mt-2 text-slate-400">
                        Pantau pekerjaan dan alasan di balik keputusan project.
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

                {!isLoading && !error && (
                    <div className="mt-8 grid gap-8 lg:grid-cols-2">
                        <section>
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold">Tasks</h2>
                                <span className="text-sm text-slate-400">{tasks.length}</span>
                            </div>

                            <form
                                onSubmit={handleCreateTask}
                                className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4"
                            >
                                <div className="space-y-3">
                                    <input
                                        value={taskTitle}
                                        onChange={(event) => setTaskTitle(event.target.value)}
                                        placeholder="Task title"
                                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                                    />

                                    <textarea
                                        value={taskDescription}
                                        onChange={(event) => setTaskDescription(event.target.value)}
                                        placeholder="Description"
                                        rows={3}
                                        className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                                    />

                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <select
                                            value={taskPriority}
                                            onChange={(event) =>
                                                setTaskPriority(event.target.value as Task["priority"])
                                            }
                                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                                        >
                                            <option value="low">Low priority</option>
                                            <option value="medium">Medium priority</option>
                                            <option value="high">High priority</option>
                                        </select>

                                        <input
                                            type="date"
                                            value={taskDueDate}
                                            onChange={(event) => setTaskDueDate(event.target.value)}
                                            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={isCreatingTask}
                                        className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {isCreatingTask ? "Creating..." : "Create task"}
                                    </button>
                                </div>
                            </form>

                            {tasks.length === 0 ? (
                                <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-5 text-sm text-slate-300">
                                    Belum ada task.
                                </div>
                            ) : (
                                <div className="mt-4 space-y-3">
                                    {tasks.map((task) => (
                                        <article
                                            key={task.id}
                                            className="rounded-xl border border-slate-700 bg-slate-900 p-4"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <h3 className="font-semibold">{task.title}</h3>
                                                <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-cyan-300">
                                                    {task.status.replace("_", " ")}
                                                </span>
                                            </div>
                                            {task.description && (
                                                <p className="mt-2 text-sm text-slate-400">
                                                    {task.description}
                                                </p>
                                            )}
                                        </article>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section>
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-semibold">Decision Log</h2>
                                <span className="text-sm text-slate-400">
                                    {decisions.length}
                                </span>
                            </div>

                            {decisions.length === 0 ? (
                                <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-5 text-sm text-slate-300">
                                    Belum ada keputusan yang dicatat.
                                </div>
                            ) : (
                                <div className="mt-4 space-y-3">
                                    {decisions.map((decision) => (
                                        <article
                                            key={decision.id}
                                            className="rounded-xl border border-slate-700 bg-slate-900 p-4"
                                        >
                                            <p className="text-xs font-medium tracking-wider text-cyan-400">
                                                {decision.task_id
                                                    ? "TASK DECISION"
                                                    : "PROJECT DECISION"}
                                            </p>
                                            <h3 className="mt-2 font-semibold">{decision.title}</h3>
                                            {decision.context && (
                                                <p className="mt-2 text-sm text-slate-400">
                                                    {decision.context}
                                                </p>
                                            )}
                                            <p className="mt-3 text-sm text-slate-200">
                                                Outcome: {decision.outcome}
                                            </p>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                )}
            </div>
        </main>
    );
}