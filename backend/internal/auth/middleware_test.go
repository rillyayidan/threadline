package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMiddlewareRejectsInvalidAuthorization(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		header string
		body   string
	}{
		{name: "missing header", body: "missing authorization header\n"},
		{name: "wrong scheme", header: "Basic abc", body: "invalid authorization header\n"},
		{name: "empty bearer token", header: "Bearer ", body: "invalid authorization header\n"},
		{name: "invalid token", header: "Bearer invalid", body: "invalid token\n"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			recorder := httptest.NewRecorder()
			request := httptest.NewRequest(http.MethodGet, "/protected", nil)
			request.Header.Set("Authorization", tt.header)
			handler := Middleware("test-secret", http.HandlerFunc(func(http.ResponseWriter, *http.Request) {
				t.Fatal("protected handler should not be called")
			}))

			handler.ServeHTTP(recorder, request)

			if recorder.Code != http.StatusUnauthorized {
				t.Errorf("status = %d, want %d", recorder.Code, http.StatusUnauthorized)
			}
			if recorder.Body.String() != tt.body {
				t.Errorf("body = %q, want %q", recorder.Body.String(), tt.body)
			}
		})
	}
}

func TestMiddlewareAddsUserIDToContext(t *testing.T) {
	t.Parallel()

	tokenString, err := GenerateToken("test-secret", "user-123", "user@example.com")
	if err != nil {
		t.Fatalf("GenerateToken() error = %v", err)
	}

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/protected", nil)
	request.Header.Set("Authorization", "Bearer "+tokenString)
	handler := Middleware("test-secret", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := UserIDFromContext(r.Context())
		if !ok {
			t.Fatal("UserIDFromContext() ok = false, want true")
		}
		if userID != "user-123" {
			t.Errorf("user ID = %q, want %q", userID, "user-123")
		}
		w.WriteHeader(http.StatusNoContent)
	}))

	handler.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", recorder.Code, http.StatusNoContent)
	}
}

func TestMiddlewareAcceptsCaseInsensitiveBearerScheme(t *testing.T) {
	t.Parallel()

	tokenString, err := GenerateToken("test-secret", "user-123", "user@example.com")
	if err != nil {
		t.Fatalf("GenerateToken() error = %v", err)
	}

	for _, header := range []string{
		"bearer " + tokenString,
		"BEARER   " + tokenString,
	} {
		recorder := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, "/protected", nil)
		request.Header.Set("Authorization", header)
		handler := Middleware("test-secret", http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusNoContent)
		}))

		handler.ServeHTTP(recorder, request)

		if recorder.Code != http.StatusNoContent {
			t.Errorf("header %q: status = %d, want %d", header, recorder.Code, http.StatusNoContent)
		}
	}
}
