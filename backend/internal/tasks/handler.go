package tasks

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rillyayidan/threadline/backend/internal/auth"
)

type Handler struct {
	db *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{db: db}
}

type createTaskRequest struct {
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Priority    string  `json:"priority"`
	DueDate     *string `json:"due_date"`
}

type taskResponse struct {
	ID          string  `json:"id"`
	ProjectID   string  `json:"project_id"`
	Title       string  `json:"title"`
	Description string  `json:"description"`
	Status      string  `json:"status"`
	Priority    string  `json:"priority"`
	DueDate     *string `json:"due_date"`
}

type updateTaskStatusRequest struct {
	Status string `json:"status"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "missing authenticated user", http.StatusUnauthorized)
		return
	}

	projectID := r.PathValue("projectID")

	var req createTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	req.Description = strings.TrimSpace(req.Description)
	req.Priority = strings.ToLower(strings.TrimSpace(req.Priority))

	if req.Title == "" {
		http.Error(w, "task title is required", http.StatusBadRequest)
		return
	}

	if req.Priority == "" {
		req.Priority = "medium"
	}

	validPriorities := map[string]bool{
		"low": true, "medium": true, "high": true,
	}
	if !validPriorities[req.Priority] {
		http.Error(w, "priority must be low, medium, or high", http.StatusBadRequest)
		return
	}

	if req.DueDate != nil {
		dueDate := strings.TrimSpace(*req.DueDate)
		if _, err := time.Parse("2006-01-02", dueDate); err != nil {
			http.Error(w, "due_date must use YYYY-MM-DD format", http.StatusBadRequest)
			return
		}
		req.DueDate = &dueDate
	}

	var task taskResponse
	err := h.db.QueryRow(
		r.Context(),
		`
		INSERT INTO tasks (
			project_id, title, description, priority, due_date
		)
		SELECT p.id, $1, $2, $3, $4::date
		FROM projects p
		JOIN workspaces w ON w.id = p.workspace_id
		WHERE p.id = $5 AND w.owner_id = $6
		RETURNING
			id, project_id, title, description,
			status, priority, due_date::text
		`,
		req.Title,
		req.Description,
		req.Priority,
		req.DueDate,
		projectID,
		userID,
	).Scan(
		&task.ID,
		&task.ProjectID,
		&task.Title,
		&task.Description,
		&task.Status,
		&task.Priority,
		&task.DueDate,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "project not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "failed to create task", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(task)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "missing authenticated user", http.StatusUnauthorized)
		return
	}

	projectID := r.PathValue("projectID")

	rows, err := h.db.Query(
		r.Context(),
		`
		SELECT
			t.id, t.project_id, t.title, t.description,
			t.status, t.priority, t.due_date::text
		FROM tasks t
		JOIN projects p ON p.id = t.project_id
		JOIN workspaces w ON w.id = p.workspace_id
		WHERE t.project_id = $1 AND w.owner_id = $2
		ORDER BY t.created_at DESC
		`,
		projectID,
		userID,
	)
	if err != nil {
		http.Error(w, "failed to list tasks", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	tasks := []taskResponse{}

	for rows.Next() {
		var task taskResponse
		if err := rows.Scan(
			&task.ID,
			&task.ProjectID,
			&task.Title,
			&task.Description,
			&task.Status,
			&task.Priority,
			&task.DueDate,
		); err != nil {
			http.Error(w, "failed to read task", http.StatusInternalServerError)
			return
		}

		tasks = append(tasks, task)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "failed to read tasks", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tasks)
}

func (h *Handler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "missing authenticated user", http.StatusUnauthorized)
		return
	}

	taskID := r.PathValue("taskID")

	var req updateTaskStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	req.Status = strings.ToLower(strings.TrimSpace(req.Status))

	validStatuses := map[string]bool{
		"todo":        true,
		"in_progress": true,
		"done":        true,
	}
	if !validStatuses[req.Status] {
		http.Error(
			w,
			"status must be todo, in_progress, or done",
			http.StatusBadRequest,
		)
		return
	}

	var task taskResponse
	err := h.db.QueryRow(
		r.Context(),
		`
		UPDATE tasks t
		SET status = $1, updated_at = now()
		FROM projects p, workspaces w
		WHERE t.id = $2
		  AND p.id = t.project_id
		  AND w.id = p.workspace_id
		  AND w.owner_id = $3
		RETURNING
			t.id, t.project_id, t.title, t.description,
			t.status, t.priority, t.due_date::text
		`,
		req.Status,
		taskID,
		userID,
	).Scan(
		&task.ID,
		&task.ProjectID,
		&task.Title,
		&task.Description,
		&task.Status,
		&task.Priority,
		&task.DueDate,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "task not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "failed to update task status", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(task)
}
