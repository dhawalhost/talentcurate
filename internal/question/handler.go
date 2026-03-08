package question

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/jackc/pgx/v5"
	"github.com/dhawalhost/talentcurate/internal/db"
)

type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

func (h *Handler) RegisterRoutes(router *mux.Router) {
	router.HandleFunc("/api/v1/questions", h.listQuestions).Methods("GET")
	router.HandleFunc("/api/v1/questions", h.createQuestion).Methods("POST")
	router.HandleFunc("/api/v1/questions/{id}", h.updateQuestion).Methods("PUT")
	router.HandleFunc("/api/v1/questions/{id}", h.deleteQuestion).Methods("DELETE")
}

func (h *Handler) listQuestions(w http.ResponseWriter, r *http.Request) {
	cursor := r.URL.Query().Get("cursor")
	limitStr := r.URL.Query().Get("limit")
	questionType := r.URL.Query().Get("type")
	limit := 20
	if limitStr != "" {
		fmt.Sscanf(limitStr, "%d", &limit)
	}

	var rows pgx.Rows
	var err error

	if questionType != "" && cursor != "" {
		rows, err = db.Pool.Query(context.Background(), `
			SELECT id, title, description, default_language, starter_code, test_cases, COALESCE(question_type, 'coding'), created_at
			FROM questions
			WHERE created_at < $1 AND COALESCE(question_type, 'coding') = $2
			ORDER BY created_at DESC
			LIMIT $3
		`, cursor, questionType, limit)
	} else if questionType != "" {
		rows, err = db.Pool.Query(context.Background(), `
			SELECT id, title, description, default_language, starter_code, test_cases, COALESCE(question_type, 'coding'), created_at
			FROM questions
			WHERE COALESCE(question_type, 'coding') = $1
			ORDER BY created_at DESC
			LIMIT $2
		`, questionType, limit)
	} else if cursor != "" {
		rows, err = db.Pool.Query(context.Background(), `
			SELECT id, title, description, default_language, starter_code, test_cases, COALESCE(question_type, 'coding'), created_at
			FROM questions
			WHERE created_at < $1
			ORDER BY created_at DESC
			LIMIT $2
		`, cursor, limit)
	} else {
		rows, err = db.Pool.Query(context.Background(), `
			SELECT id, title, description, default_language, starter_code, test_cases, COALESCE(question_type, 'coding'), created_at
			FROM questions
			ORDER BY created_at DESC
			LIMIT $1
		`, limit)
	}

	if err != nil {
		log.Printf("Failed to query questions: %v", err)
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var questions []Question
	for rows.Next() {
		var q Question
		var testCases []byte
		if err := rows.Scan(&q.ID, &q.Title, &q.Description, &q.DefaultLanguage, &q.StarterCode, &testCases, &q.QuestionType, &q.CreatedAt); err != nil {
			log.Printf("Failed to scan question: %v", err)
			continue
		}
		q.TestCases = testCases
		questions = append(questions, q)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(questions)
}

func (h *Handler) createQuestion(w http.ResponseWriter, r *http.Request) {
	var q Question
	if err := json.NewDecoder(r.Body).Decode(&q); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if q.Title == "" || q.Description == "" {
		http.Error(w, "title and description are required", http.StatusBadRequest)
		return
	}

	// Provide defaults if missing
	if q.DefaultLanguage == "" {
		q.DefaultLanguage = "python3"
	}
	if len(q.TestCases) == 0 {
		q.TestCases = json.RawMessage("[]")
	}
	if q.QuestionType == "" {
		q.QuestionType = "coding"
	}

	var newID string
	var createdAt time.Time
	err := db.Pool.QueryRow(context.Background(), `
		INSERT INTO questions (title, description, default_language, starter_code, test_cases, question_type)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, created_at
	`, q.Title, q.Description, q.DefaultLanguage, q.StarterCode, q.TestCases, q.QuestionType).Scan(&newID, &createdAt)

	if err != nil {
		log.Printf("Failed to insert question: %v", err)
		http.Error(w, "failed to create question", http.StatusInternalServerError)
		return
	}

	q.ID = newID
	q.CreatedAt = createdAt

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(q)
}

func (h *Handler) deleteQuestion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// The ON DELETE CASCADE on pivot tables will handle cleanup
	commandTag, err := db.Pool.Exec(context.Background(), "DELETE FROM questions WHERE id = $1", id)
	if err != nil {
		log.Printf("Failed to delete question %s: %v", id, err)
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}

	if commandTag.RowsAffected() == 0 {
		http.Error(w, "question not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) updateQuestion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var q Question
	if err := json.NewDecoder(r.Body).Decode(&q); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if q.Title == "" || q.Description == "" {
		http.Error(w, "title and description are required", http.StatusBadRequest)
		return
	}

	if q.DefaultLanguage == "" {
		q.DefaultLanguage = "python3"
	}
	if len(q.TestCases) == 0 {
		q.TestCases = json.RawMessage("[]")
	}
	if q.QuestionType == "" {
		q.QuestionType = "coding"
	}

	commandTag, err := db.Pool.Exec(context.Background(), `
		UPDATE questions 
		SET title = $1, description = $2, default_language = $3, starter_code = $4, test_cases = $5, question_type = $6
		WHERE id = $7
	`, q.Title, q.Description, q.DefaultLanguage, q.StarterCode, q.TestCases, q.QuestionType, id)

	if err != nil {
		log.Printf("Failed to update question %s: %v", id, err)
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}

	if commandTag.RowsAffected() == 0 {
		http.Error(w, "question not found", http.StatusNotFound)
		return
	}

	q.ID = id
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(q)
}
