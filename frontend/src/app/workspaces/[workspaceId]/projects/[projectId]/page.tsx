"use client";

import Link from "next/link";
import { FormEvent, startTransition, use, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Decision, Project, Task, TaskStatus } from "@/lib/types";

type ProjectPageProps = {
    params: Promise<{ workspaceId: string; projectId: string }>;
};

type TaskStatusFilter = "all" | TaskStatus;
type DecisionScopeFilter = "all" | "project" | "task";

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
    const [decisionTitle, setDecisionTitle] = useState("");
    const [decisionContext, setDecisionContext] = useState("");
    const [decisionOutcome, setDecisionOutcome] = useState("");
    const [decisionTaskId, setDecisionTaskId] = useState("");
    const [isCreatingDecision, setIsCreatingDecision] = useState(false);
    const [pendingTaskStatuses, setPendingTaskStatuses] = useState<
        Record<string, TaskStatus>
    >({});
    const [savingTaskStatusId, setSavingTaskStatusId] = useState("");
    const [taskStatusFilter, setTaskStatusFilter] =
        useState<TaskStatusFilter>("all");
    const [decisionScopeFilter, setDecisionScopeFilter] =
        useState<DecisionScopeFilter>("all");
    const [project, setProject] = useState<Project | null>(null);
    const completedTasks = tasks.filter((task) => task.status === "done").length;
    const openTasks = tasks.length - completedTasks;
    const projectDecisions = decisions.filter((decision) => !decision.task_id).length;
    const taskDecisions = decisions.length - projectDecisions;
    const filteredTasks =
        taskStatusFilter === "all"
            ? tasks
            : tasks.filter((task) => task.status === taskStatusFilter);
    const filteredDecisions =
        decisionScopeFilter === "all"
            ? decisions
            : decisions.filter((decision) =>
                  decisionScopeFilter === "project"
                      ? !decision.task_id
                      : Boolean(decision.task_id),
              );

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
                const [projectData, taskData, decisionData] = await Promise.all([
                  api<Project>(`/projects/${projectId}`, { token: authToken }),
                  api<Task[]>(`/projects/${projectId}/tasks`, { token: authToken }),
                  api<Decision[]>(`/projects/${projectId}/decisions`, {
                    token: authToken,
                  }),
                ]);

                if (isActive) {
                    startTransition(() => {
                        setProject(projectData);
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

    async function handleCreateDecision(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();

      const token = localStorage.getItem("threadline.token");
      const title = decisionTitle.trim();
      const outcome = decisionOutcome.trim();

      if (!token) {
        setError("Sesi tidak ditemukan. Silakan masuk kembali.");
        return;
      }

      if (!title || !outcome) {
        setError("Judul dan outcome keputusan wajib diisi.");
        return;
      }

      setIsCreatingDecision(true);
      setError("");

      try {
        const body: {
          title: string;
          context: string;
          outcome: string;
          task_id?: string;
        } = {
          title,
          context: decisionContext.trim(),
          outcome,
        };

        if (decisionTaskId) {
          body.task_id = decisionTaskId;
        }

        const createdDecision = await api<Decision>(
          `/projects/${projectId}/decisions`,
          {
            method: "POST",
            token,
            body,
          },
        );

        setDecisions((currentDecisions) => [
          createdDecision,
          ...currentDecisions,
        ]);
        setDecisionTitle("");
        setDecisionContext("");
        setDecisionOutcome("");
        setDecisionTaskId("");
      } catch (error) {
        setError(
          error instanceof ApiError
            ? error.message
            : "Gagal mencatat keputusan.",
        );
      } finally {
        setIsCreatingDecision(false);
      }
    }

    function getTaskStatusValue(task: Task) {
      return pendingTaskStatuses[task.id] ?? task.status;
    }

    function getTaskTitle(taskId: string | null) {
      if (!taskId) {
        return "";
      }

      return tasks.find((task) => task.id === taskId)?.title ?? "";
    }

    function formatTimestamp(value?: string) {
      if (!value) {
        return "Waktu belum tersedia";
      }

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return "Waktu belum tersedia";
      }

      return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
    }

    async function handleUpdateTaskStatus(task: Task) {
      const token = localStorage.getItem("threadline.token");
      const status = getTaskStatusValue(task);

      if (!token) {
        setError("Sesi tidak ditemukan. Silakan masuk kembali.");
        return;
      }

      if (status === task.status) {
        return;
      }

      setSavingTaskStatusId(task.id);
      setError("");

      try {
        const updatedTask = await api<Task>(`/tasks/${task.id}/status`, {
          method: "PATCH",
          token,
          body: { status },
        });

        setTasks((currentTasks) =>
          currentTasks.map((currentTask) =>
            currentTask.id === updatedTask.id ? updatedTask : currentTask,
          ),
        );

        setPendingTaskStatuses((currentStatuses) => {
          const nextStatuses = { ...currentStatuses };
          delete nextStatuses[updatedTask.id];
          return nextStatuses;
        });
      } catch (error) {
        setError(
          error instanceof ApiError
            ? error.message
            : "Gagal mengubah status task.",
        );
      } finally {
        setSavingTaskStatusId("");
      }
    }

    return (
        <main className="min-h-screen bg-slate-950 px-6 py-8 text-white">
            <div className="mx-auto max-w-5xl">
                <Link
                    href={`/workspaces/${workspaceId}`}
                    className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
                >
                    {`<-`} Semua project
                </Link>

                <header className="mt-8 border-b border-slate-800 pb-6">
                    <p className="text-sm font-semibold tracking-[0.2em] text-cyan-400">
                        THREADLINE
                    </p>
                    <h1 className="mt-2 text-3xl font-semibold">
                      {project?.name ?? "Project overview"}
                    </h1>
                    <p className="mt-2 text-slate-400">
                      {project?.description ||
                        "Pantau pekerjaan dan alasan di balik keputusan project."}
                    </p>
                </header>

                {!isLoading && !error && (
                  <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                      <p className="text-xs font-medium tracking-wider text-slate-500">
                        TOTAL TASKS
                      </p>
                      <p className="mt-2 text-2xl font-semibold">{tasks.length}</p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                      <p className="text-xs font-medium tracking-wider text-slate-500">
                        OPEN TASKS
                      </p>
                      <p className="mt-2 text-2xl font-semibold">{openTasks}</p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                      <p className="text-xs font-medium tracking-wider text-slate-500">
                        DONE TASKS
                      </p>
                      <p className="mt-2 text-2xl font-semibold">{completedTasks}</p>
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                      <p className="text-xs font-medium tracking-wider text-slate-500">
                        DECISIONS
                      </p>
                      <p className="mt-2 text-2xl font-semibold">{decisions.length}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {projectDecisions} project / {taskDecisions} task
                      </p>
                    </div>
                  </section>
                )}

                {!isLoading && !error && tasks.length > 0 && (
                  <section className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-200">Task completion</span>
                      <span className="text-slate-400">
                        {Math.round((completedTasks / tasks.length) * 100)}%
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-cyan-400"
                        style={{
                          width: `${Math.round((completedTasks / tasks.length) * 100)}%`,
                        }}
                      />
                    </div>
                  </section>
                )}

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
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-xl font-semibold">Tasks</h2>
                                    <p className="text-sm text-slate-400">
                                        {filteredTasks.length} shown / {tasks.length} total
                                    </p>
                                </div>

                                <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-1 text-xs">
                                    {(["all", "todo", "in_progress", "done"] as TaskStatusFilter[]).map(
                                        (status) => (
                                            <button
                                                key={status}
                                                type="button"
                                                onClick={() => setTaskStatusFilter(status)}
                                                className={`rounded-md px-3 py-1.5 font-medium transition ${
                                                    taskStatusFilter === status
                                                        ? "bg-cyan-400 text-slate-950"
                                                        : "text-slate-400 hover:text-white"
                                                }`}
                                            >
                                                {status === "in_progress"
                                                    ? "In progress"
                                                    : status === "all"
                                                      ? "All"
                                                      : status}
                                            </button>
                                        ),
                                    )}
                                </div>
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
                            ) : filteredTasks.length === 0 ? (
                                <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-5 text-sm text-slate-300">
                                    Tidak ada task untuk filter ini.
                                </div>
                            ) : (
                                <div className="mt-4 space-y-3">
                                    {filteredTasks.map((task) => (
                                        <article
                                            key={task.id}
                                            className="rounded-xl border border-slate-700 bg-slate-900 p-4"
                                        >
                                            <div className="flex items-center gap-2">
                                              <select
                                                value={getTaskStatusValue(task)}
                                                onChange={(event) =>
                                                  setPendingTaskStatuses((currentStatuses) => ({
                                                    ...currentStatuses,
                                                    [task.id]: event.target.value as TaskStatus,
                                                  }))
                                                }
                                                className="rounded-full border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-cyan-300 outline-none focus:border-cyan-400"
                                              >
                                                <option value="todo">todo</option>
                                                <option value="in_progress">in progress</option>
                                                <option value="done">done</option>
                                              </select>

                                              <button
                                                type="button"
                                                onClick={() => void handleUpdateTaskStatus(task)}
                                                disabled={
                                                  savingTaskStatusId === task.id || getTaskStatusValue(task) === task.status
                                                }
                                                className="rounded-full bg-cyan-400 px-3 py-1 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
                                              >
                                                {savingTaskStatusId === task.id ? "Saving..." : "Save"}
                                              </button>
                                            </div>
                                            {task.description && (
                                                <p className="mt-2 text-sm text-slate-400">
                                                    {task.description}
                                                </p>
                                            )}
                                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                                              <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">
                                                Priority: {task.priority}
                                              </span>
                                              <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">
                                                Created: {formatTimestamp(task.created_at)}
                                              </span>
                                              {task.due_date && (
                                                <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">
                                                  Due: {task.due_date}
                                                </span>
                                              )}

                                            </div>
                                        </article>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section>
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-xl font-semibold">Decision Log</h2>
                                    <p className="text-sm text-slate-400">
                                        {filteredDecisions.length} shown / {decisions.length} total
                                    </p>
                                </div>

                                <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-1 text-xs">
                                    {(["all", "project", "task"] as DecisionScopeFilter[]).map(
                                        (scope) => (
                                            <button
                                                key={scope}
                                                type="button"
                                                onClick={() => setDecisionScopeFilter(scope)}
                                                className={`rounded-md px-3 py-1.5 font-medium transition ${
                                                    decisionScopeFilter === scope
                                                        ? "bg-cyan-400 text-slate-950"
                                                        : "text-slate-400 hover:text-white"
                                                }`}
                                            >
                                                {scope === "all"
                                                    ? "All"
                                                    : scope === "project"
                                                      ? "Project"
                                                      : "Task"}
                                            </button>
                                        ),
                                    )}
                                </div>
                            </div>

                            <form
                              onSubmit={handleCreateDecision}
                              className="mt-4 rounded-xl border border-slate-800 bg-slate-900 p-4"
                            >
                              <div className="space-y-3">
                                <input
                                  value={decisionTitle}
                                  onChange={(event) => setDecisionTitle(event.target.value)}
                                  placeholder="Decision title"
                                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                                />

                                <textarea
                                  value={decisionContext}
                                  onChange={(event) => setDecisionContext(event.target.value)}
                                  placeholder="Context"
                                  rows={3}
                                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                                />

                                <textarea
                                  value={decisionOutcome}
                                  onChange={(event) => setDecisionOutcome(event.target.value)}
                                  placeholder="Outcome"
                                  rows={3}
                                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                                />

                                <select
                                  value={decisionTaskId}
                                  onChange={(event) => setDecisionTaskId(event.target.value)}
                                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-cyan-400"
                                >
                                  <option value="">Project decision</option>
                                  {tasks.map((task) => (
                                    <option key={task.id} value={task.id}>
                                      Task: {task.title}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  type="submit"
                                  disabled={isCreatingDecision}
                                  className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isCreatingDecision ? "Saving..." : "Save decision"}
                                </button>
                              </div>
                            </form>

                            {decisions.length === 0 ? (
                                <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-5 text-sm text-slate-300">
                                    Belum ada keputusan yang dicatat.
                                </div>
                            ) : filteredDecisions.length === 0 ? (
                                <div className="mt-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/50 p-5 text-sm text-slate-300">
                                    Tidak ada decision untuk filter ini.
                                </div>
                            ) : (
                                <div className="mt-4 space-y-3">
                                    {filteredDecisions.map((decision) => (
                                        <article
                                            key={decision.id}
                                            className="rounded-xl border border-slate-700 bg-slate-900 p-4"
                                        >
                                            <p className="text-xs font-medium tracking-wider text-cyan-400">
                                                {decision.task_id ? "TASK DECISION" : "PROJECT DECISION"}
                                            </p>
                                            <p className="mt-1 text-xs text-slate-500">
                                              {formatTimestamp(decision.created_at)}
                                            </p>
                                            {decision.task_id && getTaskTitle(decision.task_id) && (
                                                <p className="mt-2 text-xs text-slate-400">
                                                    Linked task: {getTaskTitle(decision.task_id)}
                                                </p>
                                            )}
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
