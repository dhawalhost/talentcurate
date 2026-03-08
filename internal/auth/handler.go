package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/mux"
	"golang.org/x/crypto/bcrypt"

	"github.com/spinvel/interview-system/internal/db"
)

var JWTSecret = []byte(getEnv("JWT_SECRET", "super_secret_dev_key"))

func getEnv(key, fallback string) string {
	if value, ok := os.LookupEnv(key); ok {
		return value
	}
	return fallback
}

// Models
type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type LoginResponse struct {
	Token string `json:"token"`
	User  User   `json:"user"`
}

type User struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}

type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Name   string `json:"name"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

func (h *Handler) RegisterRoutes(r *mux.Router) {
	r.HandleFunc("/api/v1/auth/login", h.Login).Methods("POST")

	// SSO OAuth Endpoints
	r.HandleFunc("/api/v1/auth/sso/check", h.CheckSSO).Methods("GET")
	r.HandleFunc("/api/v1/auth/sso/login", h.HandleSSOLogin).Methods("GET")
	r.HandleFunc("/api/v1/auth/sso/callback", h.HandleSSOCallback).Methods("GET", "POST")

	// Local Mock Endpoints (dev only)
	r.HandleFunc("/api/v1/auth/sso/mock/auth", h.MockAuth).Methods("GET")
	r.HandleFunc("/api/v1/auth/sso/mock/token", h.MockToken).Methods("POST")
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	query := `SELECT id, email, name, role, password_hash FROM users WHERE email = $1`
	var user User
	var hash string
	err := db.Pool.QueryRow(context.Background(), query, req.Email).Scan(&user.ID, &user.Email, &user.Name, &user.Role, &hash)

	if err != nil {
		// Time-safe response to prevent user enumeration
		bcrypt.CompareHashAndPassword([]byte(""), []byte(req.Password))
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	// Verify password with bcrypt
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)); err != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	// Generate JWT
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		UserID: user.ID,
		Email:  user.Email,
		Name:   user.Name,
		Role:   user.Role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(JWTSecret)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	res := LoginResponse{
		Token: tokenString,
		User:  user,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}
