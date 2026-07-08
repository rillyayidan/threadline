package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/rillyayidan/threadline/backend/internal/config"
	"github.com/rillyayidan/threadline/backend/internal/database"
	"github.com/rillyayidan/threadline/backend/internal/users"
)

func main() {
	ctx := context.Background()

	cfg := config.Load()

	db, err := database.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	userHandler := users.NewHandler(db)

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

	addr := ":" + cfg.APIPort
	log.Println("Threadline API running on http://localhost" + addr)

	err = http.ListenAndServe(addr, mux)
	if err != nil {
		log.Fatal(err)
	}
}
