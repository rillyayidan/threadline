package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/rillyayidan/threadline/backend/internal/auth"
	"github.com/rillyayidan/threadline/backend/internal/config"
	"github.com/rillyayidan/threadline/backend/internal/database"
	"github.com/rillyayidan/threadline/backend/internal/projects"
	"github.com/rillyayidan/threadline/backend/internal/users"
	"github.com/rillyayidan/threadline/backend/internal/workspaces"
)

func main() {
	ctx := context.Background()

	cfg := config.Load()

	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	userHandler := users.NewHandler(db, cfg.JWTSecret)
	workspaceHandler := workspaces.NewHandler(db)
	projectHandler := projects.NewHandler(db)

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		response := map[string]string{
			"status":   "ok",
			"service":  "threadline-api",
			"database": "ok",
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	})

	mux.HandleFunc("/users", userHandler.Create)
	mux.HandleFunc("/login", userHandler.Login)

	mux.Handle("/workspaces", auth.Middleware(
		cfg.JWTSecret,
		http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.Method {
			case http.MethodGet:
				workspaceHandler.List(w, r)
			case http.MethodPost:
				workspaceHandler.Create(w, r)
			default:
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
		}),
	))

	mux.Handle(
		"POST /workspaces/{workspaceID}/projects",
		auth.Middleware(cfg.JWTSecret, http.HandlerFunc(projectHandler.Create)),
	)

	mux.Handle(
		"GET /workspaces/{workspaceID}/projects",
		auth.Middleware(cfg.JWTSecret, http.HandlerFunc(projectHandler.List)),
	)

	addr := ":" + cfg.APIPort
	log.Println("Threadline API running on http://localhost" + addr)

	err = http.ListenAndServe(addr, mux)
	if err != nil {
		log.Fatal(err)
	}
}
