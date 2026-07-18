package config

import "os"

type Config struct {
	DatabaseURL string
	APIPort     string
	JWTSecret   string
	CORSOrigin  string
}

func Load() Config {
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		databaseURL = "postgres://threadline:threadline_password@localhost:5433/threadline_db?sslmode=disable"
	}

	apiPort := os.Getenv("API_PORT")
	if apiPort == "" {
		apiPort = "8080"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "dev-secret"
	}

	corsOrigin := os.Getenv("CORS_ORIGIN")
	if corsOrigin == "" {
		corsOrigin = "http://localhost:3000"
	}

	return Config{
		DatabaseURL: databaseURL,
		APIPort:     apiPort,
		JWTSecret:   jwtSecret,
		CORSOrigin:  corsOrigin,
	}
}
