package auth

import (
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

func TestGenerateAndParseToken(t *testing.T) {
	t.Parallel()

	tokenString, err := GenerateToken("test-secret", "user-123", "user@example.com")
	if err != nil {
		t.Fatalf("GenerateToken() error = %v", err)
	}

	claims, err := ParseToken("test-secret", tokenString)
	if err != nil {
		t.Fatalf("ParseToken() error = %v", err)
	}

	if claims.UserID != "user-123" {
		t.Errorf("UserID = %q, want %q", claims.UserID, "user-123")
	}
	if claims.Email != "user@example.com" {
		t.Errorf("Email = %q, want %q", claims.Email, "user@example.com")
	}
	if claims.ExpiresAt == nil || !claims.ExpiresAt.After(time.Now()) {
		t.Error("ExpiresAt should be in the future")
	}
}

func TestParseTokenRejectsWrongSecret(t *testing.T) {
	t.Parallel()

	tokenString, err := GenerateToken("correct-secret", "user-123", "user@example.com")
	if err != nil {
		t.Fatalf("GenerateToken() error = %v", err)
	}

	if _, err := ParseToken("wrong-secret", tokenString); err == nil {
		t.Fatal("ParseToken() error = nil, want signature error")
	}
}

func TestParseTokenRejectsExpiredToken(t *testing.T) {
	t.Parallel()

	claims := Claims{
		UserID: "user-123",
		Email:  "user@example.com",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(-time.Minute)),
		},
	}
	tokenString, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte("test-secret"))
	if err != nil {
		t.Fatalf("SignedString() error = %v", err)
	}

	if _, err := ParseToken("test-secret", tokenString); err == nil {
		t.Fatal("ParseToken() error = nil, want expiration error")
	}
}
