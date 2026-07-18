package config

import "testing"

func TestLoadUsesDevelopmentDefaults(t *testing.T) {
	t.Setenv("DATABASE_URL", "")
	t.Setenv("API_PORT", "")
	t.Setenv("JWT_SECRET", "")

	cfg := Load()

	if cfg.DatabaseURL != "postgres://threadline:threadline_password@localhost:5433/threadline_db?sslmode=disable" {
		t.Errorf("DatabaseURL = %q, want development default", cfg.DatabaseURL)
	}
	if cfg.APIPort != "8080" {
		t.Errorf("APIPort = %q, want %q", cfg.APIPort, "8080")
	}
	if cfg.JWTSecret != "dev-secret" {
		t.Errorf("JWTSecret = %q, want %q", cfg.JWTSecret, "dev-secret")
	}
}

func TestLoadUsesEnvironmentOverrides(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://example.test/threadline")
	t.Setenv("API_PORT", "9090")
	t.Setenv("JWT_SECRET", "production-secret")

	cfg := Load()

	if cfg.DatabaseURL != "postgres://example.test/threadline" {
		t.Errorf("DatabaseURL = %q, want environment value", cfg.DatabaseURL)
	}
	if cfg.APIPort != "9090" {
		t.Errorf("APIPort = %q, want %q", cfg.APIPort, "9090")
	}
	if cfg.JWTSecret != "production-secret" {
		t.Errorf("JWTSecret = %q, want environment value", cfg.JWTSecret)
	}
}
