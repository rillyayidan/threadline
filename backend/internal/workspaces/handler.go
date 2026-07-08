package workspaces

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rillyayidan/threadline/backend/internal/auth"
)

type Handler struct {
	db *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{db: db}
}

type createWorkspaceRequest struct {
	Name string `json:"name"`
}

type workspaceResponse struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	OwnerID string `json:"owner_id"`
}

func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "missing authenticated user", http.StatusUnauthorized)
		return
	}

	var req createWorkspaceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" {
		http.Error(w, "workspace name is required", http.StatusBadRequest)
		return
	}

	var workspace workspaceResponse
	err := h.db.QueryRow(
		r.Context(),
		`
		INSERT INTO workspaces (name, owner_id)
		VALUES ($1, $2)
		RETURNING id, name, owner_id
		`,
		req.Name,
		userID,
	).Scan(&workspace.ID, &workspace.Name, &workspace.OwnerID)

	if err != nil {
		http.Error(w, "failed to create workspace", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(workspace)
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID, ok := auth.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, "missing authenticated user", http.StatusUnauthorized)
		return
	}

	rows, err := h.db.Query(
		r.Context(),
		`
		SELECT id, name, owner_id
		FROM workspaces
		WHERE owner_id = $1
		ORDER BY created_at DESC
		`,
		userID,
	)
	if err != nil {
		http.Error(w, "failed to list workspaces", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	workspaces := []workspaceResponse{}

	for rows.Next() {
		var workspace workspaceResponse
		if err := rows.Scan(&workspace.ID, &workspace.Name, &workspace.OwnerID); err != nil {
			http.Error(w, "failed to read workspace", http.StatusInternalServerError)
			return
		}

		workspaces = append(workspaces, workspace)
	}

	if err := rows.Err(); err != nil {
		http.Error(w, "failed to read workspaces", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(workspaces)
}
