package session

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"github.com/jackc/pgx/v5"
	"github.com/dhawalhost/talentcurate/internal/db"
)

// Template Models
type InterviewTemplate struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Questions   []string  `json:"question_ids,omitempty"`
	OwnerID     *string   `json:"owner_id,omitempty"`
	OwnerName   string    `json:"owner_name,omitempty"`
	IsShared    bool      `json:"is_shared"`
	CreatedAt   time.Time `json:"created_at"`
}

type CreateTemplateRequest struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	QuestionIDs []string `json:"question_ids"`
	OwnerID     string   `json:"owner_id,omitempty"`
	IsShared    bool     `json:"is_shared"`
}

// RegisterTemplateRoutes binds template endpoints
func (h *Handler) RegisterTemplateRoutes(r *mux.Router) {
	r.HandleFunc("/api/v1/templates", h.ListTemplates).Methods("GET")
	r.HandleFunc("/api/v1/templates", h.CreateTemplate).Methods("POST")
	r.HandleFunc("/api/v1/templates/{id}", h.UpdateTemplate).Methods("PUT")
	r.HandleFunc("/api/v1/templates/{id}", h.DeleteTemplate).Methods("DELETE")
}

func (h *Handler) ListTemplates(w http.ResponseWriter, r *http.Request) {
	cursor := r.URL.Query().Get("cursor")
	ownerID := r.URL.Query().Get("owner_id")
	includeShared := r.URL.Query().Get("include_shared") != "false"
	limitStr := r.URL.Query().Get("limit")
	limit := 20
	if limitStr != "" {
		fmt.Sscanf(limitStr, "%d", &limit)
	}

	var rows pgx.Rows
	var err error

	baseQuery := `
		SELECT t.id, t.title, t.description, t.created_at,
		       array_agg(tq.question_id ORDER BY tq.position) as question_ids,
		       t.owner_id, COALESCE(u.name, '') as owner_name, COALESCE(t.is_shared, false)
		FROM interview_templates t
		LEFT JOIN template_questions tq ON t.id = tq.template_id
		LEFT JOIN users u ON t.owner_id = u.id
	`

	var conditions []string
	var args []interface{}
	argIdx := 1

	if ownerID != "" {
		if includeShared {
			conditions = append(conditions, fmt.Sprintf("(t.owner_id = $%d OR COALESCE(t.is_shared, false) = true OR t.owner_id IS NULL)", argIdx))
		} else {
			conditions = append(conditions, fmt.Sprintf("t.owner_id = $%d", argIdx))
		}
		args = append(args, ownerID)
		argIdx++
	}

	if cursor != "" {
		conditions = append(conditions, fmt.Sprintf("t.created_at < $%d", argIdx))
		args = append(args, cursor)
		argIdx++
	}

	if len(conditions) > 0 {
		baseQuery += " WHERE " + conditions[0]
		for _, c := range conditions[1:] {
			baseQuery += " AND " + c
		}
	}

	baseQuery += fmt.Sprintf(` GROUP BY t.id, u.name ORDER BY t.created_at DESC LIMIT $%d`, argIdx)
	args = append(args, limit)

	rows, err = db.Pool.Query(context.Background(), baseQuery, args...)
	if err != nil {
		http.Error(w, "failed to fetch templates: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var templates []InterviewTemplate
	for rows.Next() {
		var t InterviewTemplate
		var qIDs []uuid.UUID
		var ownerIDVal *uuid.UUID
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.CreatedAt, &qIDs, &ownerIDVal, &t.OwnerName, &t.IsShared); err != nil {
			http.Error(w, "row scan failed: "+err.Error(), http.StatusInternalServerError)
			return
		}

		if ownerIDVal != nil {
			s := ownerIDVal.String()
			t.OwnerID = &s
		}

		t.Questions = make([]string, 0)
		for _, id := range qIDs {
			if id != uuid.Nil {
				t.Questions = append(t.Questions, id.String())
			}
		}
		templates = append(templates, t)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(templates)
}

func (h *Handler) CreateTemplate(w http.ResponseWriter, r *http.Request) {
	var req CreateTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	tx, err := db.Pool.Begin(context.Background())
	if err != nil {
		http.Error(w, "failed to start transaction", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(context.Background())

	templateID := uuid.New()

	var ownerIDVal interface{}
	if req.OwnerID != "" {
		if uid, parseErr := uuid.Parse(req.OwnerID); parseErr == nil {
			ownerIDVal = uid
		}
	}

	_, err = tx.Exec(context.Background(),
		"INSERT INTO interview_templates (id, title, description, owner_id, is_shared) VALUES ($1, $2, $3, $4, $5)",
		templateID, req.Title, req.Description, ownerIDVal, req.IsShared)
	if err != nil {
		http.Error(w, "failed to insert template", http.StatusInternalServerError)
		return
	}

	for i, qIDStr := range req.QuestionIDs {
		qID, err := uuid.Parse(qIDStr)
		if err != nil {
			continue // Skip invalid UUIDs for now
		}
		_, err = tx.Exec(context.Background(),
			"INSERT INTO template_questions (template_id, question_id, position) VALUES ($1, $2, $3)",
			templateID, qID, i)
		if err != nil {
			http.Error(w, "failed to insert template question mapping", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(context.Background()); err != nil {
		http.Error(w, "failed to commit transaction", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"id": templateID.String(), "status": "CREATED"})
}

func (h *Handler) DeleteTemplate(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	_, err := db.Pool.Exec(context.Background(), "DELETE FROM interview_templates WHERE id = $1", id)
	if err != nil {
		http.Error(w, "failed to delete template", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) UpdateTemplate(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]

	templateID, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "invalid template ID", http.StatusBadRequest)
		return
	}

	var req CreateTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	tx, err := db.Pool.Begin(context.Background())
	if err != nil {
		http.Error(w, "failed to start transaction", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(context.Background())

	// Update Template Metadata
	commandTag, err := tx.Exec(context.Background(),
		"UPDATE interview_templates SET title = $1, description = $2 WHERE id = $3",
		req.Title, req.Description, templateID)
	if err != nil {
		http.Error(w, "failed to update template", http.StatusInternalServerError)
		return
	}
	if commandTag.RowsAffected() == 0 {
		http.Error(w, "template not found", http.StatusNotFound)
		return
	}

	// Replace all associated questions
	_, err = tx.Exec(context.Background(), "DELETE FROM template_questions WHERE template_id = $1", templateID)
	if err != nil {
		http.Error(w, "failed to clear existing template questions", http.StatusInternalServerError)
		return
	}

	for i, qIDStr := range req.QuestionIDs {
		qID, err := uuid.Parse(qIDStr)
		if err != nil {
			continue // Skip invalid UUIDs
		}
		_, err = tx.Exec(context.Background(),
			"INSERT INTO template_questions (template_id, question_id, position) VALUES ($1, $2, $3)",
			templateID, qID, i)
		if err != nil {
			http.Error(w, "failed to insert template question mapping", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(context.Background()); err != nil {
		http.Error(w, "failed to commit transaction", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"id": templateID.String(), "status": "UPDATED"})
}
