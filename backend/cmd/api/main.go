package main

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rillyayidan/threadline/backend/internal/auth"
	"github.com/rillyayidan/threadline/backend/internal/config"
	"github.com/rillyayidan/threadline/backend/internal/database"
	"github.com/rillyayidan/threadline/backend/internal/decisions"
	"github.com/rillyayidan/threadline/backend/internal/projects"
	"github.com/rillyayidan/threadline/backend/internal/tasks"
	"github.com/rillyayidan/threadline/backend/internal/users"
	"github.com/rillyayidan/threadline/backend/internal/workspaces"
)

func corsMiddleware(allowedOrigin string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" {
			w.Header().Add("Vary", "Origin")
		}
		if origin == allowedOrigin {
			w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		}

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	response := map[string]string{
		"status":   "ok",
		"service":  "threadline-api",
		"database": "ok",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func newServer(addr string, corsOrigin string, handler http.Handler) *http.Server {
	return &http.Server{
		Addr:              addr,
		Handler:           corsMiddleware(corsOrigin, handler),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
}

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	cfg := config.Load()

	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	userHandler := users.NewHandler(db, cfg.JWTSecret)
	workspaceHandler := workspaces.NewHandler(db)
	projectHandler := projects.NewHandler(db)
	taskHandler := tasks.NewHandler(db)
	decisionHandler := decisions.NewHandler(db)

	mux := http.NewServeMux()

	mux.HandleFunc("/health", healthHandler)

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

	mux.Handle(
		"GET /projects/{projectID}",
		auth.Middleware(cfg.JWTSecret, http.HandlerFunc(projectHandler.Get)),
	)

	mux.Handle(
		"POST /projects/{projectID}/tasks",
		auth.Middleware(cfg.JWTSecret, http.HandlerFunc(taskHandler.Create)),
	)

	mux.Handle(
		"GET /projects/{projectID}/tasks",
		auth.Middleware(cfg.JWTSecret, http.HandlerFunc(taskHandler.List)),
	)

	mux.Handle(
		"PATCH /tasks/{taskID}/status",
		auth.Middleware(cfg.JWTSecret, http.HandlerFunc(taskHandler.UpdateStatus)),
	)

	mux.Handle(
		"POST /projects/{projectID}/decisions",
		auth.Middleware(
			cfg.JWTSecret,
			http.HandlerFunc(decisionHandler.Create),
		),
	)

	mux.Handle(
		"GET /projects/{projectID}/decisions",
		auth.Middleware(
			cfg.JWTSecret,
			http.HandlerFunc(decisionHandler.List),
		),
	)

	addr := ":" + cfg.APIPort
	log.Println("Threadline API running on http://localhost" + addr)

	server := newServer(addr, cfg.CORSOrigin, mux)
	go func() {
		<-ctx.Done()

		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("failed to gracefully shut down API server: %v", err)
		}
	}()

	err = server.ListenAndServe()
	if err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatal(err)
	}
}
