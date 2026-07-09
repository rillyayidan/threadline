package projects

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

type createProjectRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type projectResponse struct {
	ID          string `json:"id"`
	WorkspaceID string `json:"workspace_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "missing authenticated user", http.StatusUnauthorized)
		return
	}

	workspaceID := r.PathValue("workspaceID")

	var req createProjectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)

	if req.Name == "" {
		http.Error(w, "project name is required", http.StatusBadRequest)
		return
	}

	var project projectResponse
	err := h.db.QueryRow(
		r.Context(),
		`
		INSERT INTO projects (workspace_id, name, description)
		SELECT id, $1, $2
		FROM workspaces
		WHERE id = $3 AND owner_id = $4
		RETURNING id, workspace_id, name, description
		`,
		req.Name,
		req.Description,
		workspaceID,
		userID,
	).Scan(
		&project.ID,
		&project.WorkspaceID,
		&project.Name,
		&project.Description,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		http.Error(w, "workspace not found", http.StatusNotFound)
		return
	}
	if err != nil {
		http.Error(w, "failed to create project", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(project)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "missing authenticated user", http.StatusUnauthorized)
		return
	}

	workspaceID := r.PathValue("workspaceID")

	rows, err := h.db.Query(
		r.Context(),
		`
		SELECT p.id, p.workspace_id, p.name, p.description
		FROM projects p
		JOIN workspaces w ON w.id = p.workspace_id
		WHERE p.workspace_id = $1 AND w.owner_id = $2
		ORDER BY p.created_at DESC
		`,
		workspaceID,
		userID,
	)
	if err != nil {
		http.Error(w, "failed to list projects", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	projects := []projectResponse{}

	for rows.Next() {
		var project projectResponse

		if err := rows.Scan(
			&project.ID,
			&project.WorkspaceID,
			&project.Name,
			&project.Description,
		); err != nil {
			http.Error(w, "failed to read project", http.StatusInternalServerError)
			return
		}

		projects = append(projects, project)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "failed to read projects", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(projects)
}
