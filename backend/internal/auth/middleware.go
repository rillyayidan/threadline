package auth

import (
	"context"
	"net/http"
	"strings"
)

type contextKey string

const userIDContextKey contextKey = "user_id"

func Middleware(secret string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, "missing authorization header", http.StatusUnauthorized)
			return
		}

		tokenString, ok := strings.CutPrefix(authHeader, "Bearer ")
		if !ok || tokenString == "" {
			http.Error(w, "invalid authorization header", http.StatusUnauthorized)
			return
		}

		claims, err := ParseToken(secret, tokenString)
		if err != nil {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), userIDContextKey, claims.UserID)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func UserIDFromContext(ctx context.Context) (string, bool) {
	userID, ok := ctx.Value(userIDContextKey).(string)
	return userID, ok
}
