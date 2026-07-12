package decisions

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

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

type createDecisionRequest struct {
	TaskID  *string `json:"task_id"`
	Title   string  `json:"title"`
	Context string  `json:"context"`
	Outcome string  `json:"outcome"`
}

type decisionResponse struct {
	ID        string  `json:"id"`
	ProjectID string  `json:"project_id"`
	TaskID    *string `json:"task_id"`
	Title     string  `json:"title"`
	Context   string  `json:"context"`
	Outcome   string  `json:"outcome"`
	CreatedBy string  `json:"created_by"`
	CreatedAt string `json:"created_at"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "missing authenticated user", http.StatusUnauthorized)
		return
	}

	projectID := r.PathValue("projectID")

	var req createDecisionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	req.Title = strings.TrimSpace(req.Title)
	req.Context = strings.TrimSpace(req.Context)
	req.Outcome = strings.TrimSpace(req.Outcome)

	if req.Title == "" || req.Outcome == "" {
		http.Error(w, "title and outcome are required", http.StatusBadRequest)
		return
	}

	var decision decisionResponse
	err := h.db.QueryRow(
		r.Context(),
		`
		INSERT INTO decisions (
			project_id, task_id, title, context, outcome, created_by
		)
		SELECT p.id, $1::uuid, $2, $3, $4, $5
		FROM projects p
		JOIN workspaces w ON w.id = p.workspace_id
		WHERE p.id = $6
		  AND w.owner_id = $5
		  AND (
		    $1::uuid IS NULL
		    OR EXISTS (
		      SELECT 1
		      FROM tasks t
		      WHERE t.id = $1::uuid AND t.project_id = p.id
		    )
		  )
		RETURNING
			id, project_id, task_id, title,
			context, outcome, created_by, created_at::text
		`,
		req.TaskID,
		req.Title,
		req.Context,
		req.Outcome,
		userID,
		projectID,
	).Scan(
		&decision.ID,
		&decision.ProjectID,
		&decision.TaskID,
		&decision.Title,
		&decision.Context,
		&decision.Outcome,
		&decision.CreatedBy,
		&decision.CreatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "project or task not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "failed to create decision", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(decision)
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
			d.id, d.project_id, d.task_id, d.title,
			d.context, d.outcome, d.created_by, d.created_at::text
		FROM decisions d
		JOIN projects p ON p.id = d.project_id
		JOIN workspaces w ON w.id = p.workspace_id
		WHERE d.project_id = $1 AND w.owner_id = $2
		ORDER BY d.created_at DESC
		`,
		projectID,
		userID,
	)
	if err != nil {
		http.Error(w, "failed to list decisions", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	decisions := []decisionResponse{}

	for rows.Next() {
		var decision decisionResponse
		if err := rows.Scan(
			&decision.ID,
			&decision.ProjectID,
			&decision.TaskID,
			&decision.Title,
			&decision.Context,
			&decision.Outcome,
			&decision.CreatedBy,
			&decision.CreatedAt,
		); err != nil {
			http.Error(w, "failed to read decision", http.StatusInternalServerError)
			return
		}

		decisions = append(decisions, decision)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "failed to read decisions", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(decisions)
}
