export type User = {
  id: string;
  name: string;
  email: string;
};

export type LoginResponse = {
  user: User;
  token: string;
};

export type Workspace = {
  id: string;
  name: string;
  owner_id: string;
};

export type Project = {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
};

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export type Task = {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  created_at: string;
};

export type Decision = {
  id: string;
  project_id: string;
  task_id: string | null;
  title: string;
  context: string;
  outcome: string;
  created_by: string;
  created_at: string;
};
