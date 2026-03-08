package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/oauth2"

	"github.com/dhawalhost/talentcurate/internal/db"
)

var (
	// In a real application, these should come from securely managed environment variables
	oauthConfig = &oauth2.Config{
		RedirectURL:  "http://localhost:8080/api/v1/auth/sso/callback",
		ClientID:     getEnv("OAUTH_CLIENT_ID", "mock_client_id"),
		ClientSecret: getEnv("OAUTH_CLIENT_SECRET", "mock_client_secret"),
		Scopes:       []string{"openid", "profile", "email"},
		Endpoint: oauth2.Endpoint{
			AuthURL:  getEnv("OAUTH_AUTH_URL", "http://localhost:8080/api/v1/auth/sso/mock/auth"),   // Mock endpoint for local dev
			TokenURL: getEnv("OAUTH_TOKEN_URL", "http://localhost:8080/api/v1/auth/sso/mock/token"), // Mock endpoint for local dev
		},
	}
	// Random string for oauth2 state protection against CSRF
	oauthStateString = "random_state_string_" + uuid.New().String()
)

// HandleSSOLogin initiates the OAuth2 flow by redirecting the user to the provider
func (h *Handler) HandleSSOLogin(w http.ResponseWriter, r *http.Request) {
	url := oauthConfig.AuthCodeURL(oauthStateString, oauth2.AccessTypeOnline)
	// Optionally attach prompt=login or similar based on provider
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

// CheckSSO checks if an email is associated with a Single Sign-On provider
func (h *Handler) CheckSSO(w http.ResponseWriter, r *http.Request) {
	email := r.URL.Query().Get("email")
	if email == "" {
		http.Error(w, "Email parameter is required", http.StatusBadRequest)
		return
	}

	// For the MVP, we will mock the SSO check logic.
	// We'll say any email ending in "@talentcurate.com" is SSO enabled except our default "hr@talentcurate.com" and "admin@talentcurate.com"
	// In production, query the `users` or `organizations` table for an `sso_provider` column.

	isSSO := false
	if len(email) > 12 && email[len(email)-12:] == "@talentcurate.com" && email != "hr@talentcurate.com" && email != "admin@talentcurate.com" {
		isSSO = true
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"sso_enabled": isSSO})
}

// MockUserInfo simulates decoding a profile from an ID token or /userinfo endpoint
type MockUserInfo struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}

// HandleSSOCallback receives the redirect from the OAuth Provider
func (h *Handler) HandleSSOCallback(w http.ResponseWriter, r *http.Request) {
	state := r.FormValue("state")
	if state != oauthStateString {
		http.Redirect(w, r, "/", http.StatusTemporaryRedirect)
		return
	}

	code := r.FormValue("code")

	// 1. Exchange the Authorization Code for an Access Token
	_, err := oauthConfig.Exchange(context.Background(), code)
	var userInfo MockUserInfo

	if err != nil {
		// If we're hitting our strict Mock endpoint locally without a real token API running,
		// let's just bypass the strict exchange failure in DEV MODE for demo purposes.
		if oauthConfig.ClientID == "mock_client_id" {
			// DEV ONLY MOCK
			userInfo = MockUserInfo{
				Email: "mock_sso_user@talentcurate.com",
				Name:  "Okta User",
				Role:  "hr",
			}
		} else {
			http.Error(w, "Failed to exchange token: "+err.Error(), http.StatusInternalServerError)
			return
		}
	} else {
		// In production with Okta/Google:
		// We would use the token to fetch the user profile from the provider's UserInfo endpoint
		// Using the simulated one for now to demonstrate success
		userInfo = MockUserInfo{
			Email: "sso_authorized@talentcurate.com",
			Name:  "Managed Okta User",
			Role:  "hr",
		}
	}

	// 2. Upsert User in PostgreSQL
	userID := uuid.New().String()
	query := `
		INSERT INTO users (id, email, name, role, password_hash)
		VALUES ($1, $2, $3, $4, 'hashed_pass_placeholder')
		ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role
		RETURNING id, role
	`
	var dbUserID, dbUserRole string
	err = db.Pool.QueryRow(context.Background(), query, userID, userInfo.Email, userInfo.Name, userInfo.Role).Scan(&dbUserID, &dbUserRole)

	if err != nil {
		http.Error(w, "Failed to create/update user in database", http.StatusInternalServerError)
		return
	}

	// 3. Generate internal JWT
	expirationTime := time.Now().Add(24 * time.Hour)
	claims := &Claims{
		UserID: dbUserID,
		Email:  userInfo.Email,
		Role:   dbUserRole,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString(JWTSecret)
	if err != nil {
		http.Error(w, "Internal JWT generation error", http.StatusInternalServerError)
		return
	}

	// Marshal user into JSON string to pass it cleanly
	userData := User{
		ID:    dbUserID,
		Email: userInfo.Email,
		Name:  userInfo.Name,
		Role:  dbUserRole,
	}
	userBytes, _ := json.Marshal(userData)

	// 4. Redirect the browser to the Frontend application with the generated context securely
	// Typically this goes to a dedicated React callback route that reads the token and drops it into localStorage
	frontendRedirectUrl := "http://localhost:8085/sso-callback?token=" + tokenString + "&user=" + string(userBytes)
	http.Redirect(w, r, frontendRedirectUrl, http.StatusFound)
}

// Optional Mock Endpoints for purely local unconfigured testing
func (h *Handler) MockAuth(w http.ResponseWriter, r *http.Request) {
	state := r.URL.Query().Get("state")
	callback := "http://localhost:8080/api/v1/auth/sso/callback?code=mock_auth_code_123&state=" + state
	http.Redirect(w, r, callback, http.StatusFound)
}
func (h *Handler) MockToken(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"access_token": "mock_access_token_abc",
		"token_type":   "Bearer",
		"expires_in":   3600,
	})
}
