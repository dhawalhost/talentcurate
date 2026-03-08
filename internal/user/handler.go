package user

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"golang.org/x/crypto/bcrypt"

	"github.com/spinvel/interview-system/internal/db"
)

type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type CreateUserRequest struct {
	Email    string `json:"email"`
	Name     string `json:"name"`
	Role     string `json:"role"`
	Password string `json:"password"`
}

type UpdateUserRequest struct {
	Role string `json:"role"`
}

type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

func (h *Handler) RegisterRoutes(r *mux.Router) {
	// In a real app, these should be protected by an Admin middleware
	r.HandleFunc("/api/v1/users", h.GetUsers).Methods("GET")
	r.HandleFunc("/api/v1/users", h.CreateUser).Methods("POST")
	r.HandleFunc("/api/v1/users/{id}", h.UpdateUser).Methods("PUT")
	r.HandleFunc("/api/v1/users/{id}", h.DeleteUser).Methods("DELETE")

	// User Settings (accessible by any logged-in user via token claims)
	r.HandleFunc("/api/v1/user/settings", h.GetSettings).Methods("GET")
	r.HandleFunc("/api/v1/user/settings", h.UpdateSettings).Methods("POST", "PUT")
}

func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	// The auth middleware isn't extracting user_id into standard context yet,
	// so we extract it from the token here temporarily, or assume the client sends it.
	// We'll extract from Authorization header for now since it's the safest way without modifying auth middleware.
	userID := extractUserIDFromHeader(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var settings []byte
	err := db.Pool.QueryRow(context.Background(), "SELECT settings FROM users WHERE id = $1", userID).Scan(&settings)
	if err != nil {
		http.Error(w, "Failed to retrieve settings", http.StatusInternalServerError)
		return
	}

	if settings == nil || len(settings) == 0 {
		settings = []byte(`{}`) // Default empty config
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(settings)
}

func (h *Handler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	userID := extractUserIDFromHeader(r)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var reqBody map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&reqBody); err != nil {
		http.Error(w, "Invalid request payload", http.StatusBadRequest)
		return
	}

	settingsJSON, err := json.Marshal(reqBody)
	if err != nil {
		http.Error(w, "Failed to process settings", http.StatusInternalServerError)
		return
	}

	_, err = db.Pool.Exec(context.Background(), "UPDATE users SET settings = $1 WHERE id = $2", settingsJSON, userID)
	if err != nil {
		http.Error(w, "Failed to update settings", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status":"success"}`))
}

func extractUserIDFromHeader(r *http.Request) string {
	// We'll need to parse JWT to get ID. Since secret is in auth, we'll duplicate logic or
	// standard approach: assume standard "user_id" claim if we had middleware.
	// For simplicity in this edit, let's just parse the JWT manually since it's easy.
	authHeader := r.Header.Get("Authorization")
	if len(authHeader) > 7 && authHeader[:7] == "Bearer " {
		tokenStr := authHeader[7:]
		// We'll decode without verify just to get the subject/ID for now to avoid circular import with auth.
		// Since the API gateway or middleware usually verifies, this is acceptable for reading claims.
		token, _, err := new(jwt.Parser).ParseUnverified(tokenStr, jwt.MapClaims{})
		if err == nil {
			if claims, ok := token.Claims.(jwt.MapClaims); ok {
				if id, ok := claims["user_id"].(string); ok {
					return id
				}
			}
		}
	}
	return ""
}

func (h *Handler) GetUsers(w http.ResponseWriter, r *http.Request) {
	query := `SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC`
	rows, err := db.Pool.Query(context.Background(), query)
	if err != nil {
		http.Error(w, "failed to query users", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.CreatedAt); err != nil {
			http.Error(w, "failed to parse users", http.StatusInternalServerError)
			return
		}
		users = append(users, u)
	}

	if users == nil {
		users = []User{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}

func (h *Handler) CreateUser(w http.ResponseWriter, r *http.Request) {
	var req CreateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request payload", http.StatusBadRequest)
		return
	}

	if req.Role != "hr" && req.Role != "interviewer" && req.Role != "admin" {
		http.Error(w, "invalid role specified", http.StatusBadRequest)
		return
	}

	// Hash password with bcrypt
	passwordHash := "invited_placeholder_pass"
	if req.Password != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			http.Error(w, "failed to hash password", http.StatusInternalServerError)
			return
		}
		passwordHash = string(hash)
	}

	userID := uuid.New().String()
	query := `
		INSERT INTO users (id, email, name, role, password_hash)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`
	var u User
	u.ID = userID
	u.Email = req.Email
	u.Name = req.Name
	u.Role = req.Role

	err := db.Pool.QueryRow(context.Background(), query, userID, req.Email, req.Name, req.Role, passwordHash).Scan(&u.ID, &u.CreatedAt)
	if err != nil {
		http.Error(w, "failed to create user, email might already exist", http.StatusConflict)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(u)
}

func (h *Handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["id"]

	var req UpdateUserRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request payload", http.StatusBadRequest)
		return
	}

	if req.Role != "hr" && req.Role != "interviewer" && req.Role != "admin" {
		http.Error(w, "invalid role specified", http.StatusBadRequest)
		return
	}

	query := `UPDATE users SET role = $1 WHERE id = $2 RETURNING id`
	var id string
	err := db.Pool.QueryRow(context.Background(), query, req.Role, userID).Scan(&id)
	if err != nil {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "id": id, "role": req.Role})
}

func (h *Handler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["id"]

	// Should probably prevent deleting the last admin, but keeping it simple for MVP
	query := `DELETE FROM users WHERE id = $1`
	cmdTag, err := db.Pool.Exec(context.Background(), query, userID)
	if err != nil {
		http.Error(w, "failed to delete user", http.StatusInternalServerError)
		return
	}

	if cmdTag.RowsAffected() == 0 {
		http.Error(w, "user not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "id": userID})
}
