package session

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/mux"
	lkauth "github.com/livekit/protocol/auth"

	localauth "github.com/dhawalhost/talentcurate/internal/auth"

	"os"

	"fmt"
	"log"

	"github.com/google/generative-ai-go/genai"
	"github.com/jackc/pgx/v5"
	"github.com/livekit/protocol/livekit"
	lksdk "github.com/livekit/server-sdk-go/v2"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"google.golang.org/api/option"

	"github.com/dhawalhost/talentcurate/internal/db"
	"github.com/dhawalhost/talentcurate/internal/notify"
)

// Models

type Session struct {
	SessionID            string        `json:"session_id"`
	Title                string        `json:"title"`
	InterviewerID        string        `json:"interviewer_id"`
	CandidateEmail       string        `json:"candidate_email"`
	CandidateName        string        `json:"candidate_name"`
	Status               string        `json:"status"` // CREATED, LIVE, COMPLETED
	Participants         []Participant `json:"participants"`
	StartTime            time.Time     `json:"start_time"`
	LanguagePreset       string        `json:"language_preset"`
	Feedback             string        `json:"feedback,omitempty"`
	HireRecommendation   string        `json:"hire_recommendation,omitempty"`
	ScoreAlgorithms      int           `json:"score_algorithms,omitempty"`
	ScoreCodeQuality     int           `json:"score_code_quality,omitempty"`
	ScoreCommunication   int           `json:"score_communication,omitempty"`
	ScoreSystemDesign    int           `json:"score_system_design,omitempty"`
	ScoreLeadership      int           `json:"score_leadership,omitempty"`
	ScoreProblemSolving  int           `json:"score_problem_solving,omitempty"`
	ScoreCultureFit      int           `json:"score_culture_fit,omitempty"`
	ScoreDomainKnowledge int           `json:"score_domain_knowledge,omitempty"`
	InterviewNotes       string        `json:"interview_notes,omitempty"`
	AISummary            string        `json:"ai_summary,omitempty"`
	RecordingURL         string        `json:"recording_url,omitempty"`
	InterviewType        string        `json:"interview_type,omitempty"`
}

type Participant struct {
	UserID   string    `json:"user_id"`
	Role     string    `json:"role"`
	JoinedAt time.Time `json:"joined_at"`
}

type CreateSessionRequest struct {
	Title           string   `json:"title"`
	InterviewerID   string   `json:"interviewer_id,omitempty"`  // backward compat
	InterviewerIDs  []string `json:"interviewer_ids,omitempty"` // new: multi-interviewer
	CandidateEmail  string   `json:"candidate_email"`
	CandidateName   string   `json:"candidate_name"`
	LanguagePreset  string   `json:"language_preset"`
	TemplateID      string   `json:"template_id,omitempty"`
	ScheduledFor    string   `json:"scheduled_for,omitempty"` // ISO 8601
	DurationMinutes int      `json:"duration_minutes,omitempty"`
	InterviewType   string   `json:"interview_type,omitempty"`
}

type CreateSessionResponse struct {
	SessionID          string `json:"session_id"`
	JoinUrlInterviewer string `json:"join_url_interviewer"`
	JoinUrlCandidate   string `json:"join_url_candidate"`
	Status             string `json:"status"`
}

type SubmitFeedbackRequest struct {
	Feedback             string `json:"feedback"`
	HireRecommendation   string `json:"hire_recommendation"`
	ScoreAlgorithms      int    `json:"score_algorithms"`
	ScoreCodeQuality     int    `json:"score_code_quality"`
	ScoreCommunication   int    `json:"score_communication"`
	ScoreSystemDesign    int    `json:"score_system_design"`
	ScoreLeadership      int    `json:"score_leadership"`
	ScoreProblemSolving  int    `json:"score_problem_solving"`
	ScoreCultureFit      int    `json:"score_culture_fit"`
	ScoreDomainKnowledge int    `json:"score_domain_knowledge"`
	InterviewNotes       string `json:"interview_notes"`
}

// Handler HTTP Server Wrapper
type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

// RegisterRoutes binds endpoints to the router
func (h *Handler) RegisterRoutes(r *mux.Router) {
	r.HandleFunc("/api/v1/sessions", h.CreateSession).Methods("POST")
	r.HandleFunc("/api/v1/sessions", h.GetAllSessions).Methods("GET")
	r.HandleFunc("/api/v1/sessions/{session_id}", h.GetSession).Methods("GET")
	r.HandleFunc("/api/v1/sessions/{session_id}", h.DeleteSession).Methods("DELETE")
	r.HandleFunc("/api/v1/sessions/{session_id}/join", h.JoinSession).Methods("POST")
	r.HandleFunc("/api/v1/sessions/{session_id}/end", h.EndSession).Methods("POST")
	r.HandleFunc("/api/v1/sessions/{session_id}/feedback", h.SubmitFeedback).Methods("POST")
	r.HandleFunc("/api/v1/sessions/{session_id}/record", h.StartRecording).Methods("POST")
	r.HandleFunc("/api/v1/sessions/{session_id}/question", h.LoadQuestion).Methods("POST")
	r.HandleFunc("/api/v1/sessions/{session_id}/analyze", h.AnalyzeSession).Methods("POST")
	r.HandleFunc("/api/v1/sessions/{session_id}/submit", h.SubmitAnswer).Methods("POST")
	r.HandleFunc("/api/v1/sessions/{session_id}/submissions", h.GetSubmissions).Methods("GET")

	// Template Sub-Routes
	h.RegisterTemplateRoutes(r)

	// Calendar Sub-Routes
	h.RegisterCalendarRoutes(r)
}

func (h *Handler) CreateSession(w http.ResponseWriter, r *http.Request) {
	var req CreateSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request payload", http.StatusBadRequest)
		return
	}

	sessionID := "sess_" + uuid.New().String()[:8]

	// Insert into PostgreSQL
	// For MVP, we insert a placeholder UUID for interviewer_id if it's not a real UUID yet
	interviewerUUID := uuid.New() // Generate a dummy user ID for now since we don't have auth fully wired up

	// Create a dummy user first just so the foreign key doesn't fail
	_, err := db.Pool.Exec(context.Background(),
		"INSERT INTO users (id, email, name, role) VALUES ($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING",
		interviewerUUID, "interviewer_"+sessionID+"@spinvel.com", "Interviewer", "interviewer")

	if err != nil {
		http.Error(w, "failed to prep user data: "+err.Error(), http.StatusInternalServerError)
		return
	}

	query := `
		INSERT INTO sessions (id, title, interviewer_id, candidate_email, candidate_name, status, language_preset, template_id, scheduled_for, duration_minutes, interview_type)
		VALUES ($1, $2, $3, $4, $5, 'scheduled', $6, $7, $8, $9, $10)
	`
	templateIDVal := interface{}(nil)
	if req.TemplateID != "" {
		if tid, err := uuid.Parse(req.TemplateID); err == nil {
			templateIDVal = tid
		}
	}

	var scheduledForVal interface{}
	if req.ScheduledFor != "" {
		if t, err := time.Parse(time.RFC3339, req.ScheduledFor); err == nil {
			scheduledForVal = t
		}
	}

	durationMinutes := req.DurationMinutes
	if durationMinutes <= 0 {
		durationMinutes = 60
	}

	interviewType := req.InterviewType
	if interviewType == "" {
		interviewType = "technical"
	}

	_, err = db.Pool.Exec(context.Background(), query, sessionID, req.Title, interviewerUUID, req.CandidateEmail, req.CandidateName, req.LanguagePreset, templateIDVal, scheduledForVal, durationMinutes, interviewType)
	if err != nil {
		http.Error(w, "failed to create session in db: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Insert interviewers into session_interviewers pivot table
	interviewerIDs := req.InterviewerIDs
	if len(interviewerIDs) == 0 && req.InterviewerID != "" {
		interviewerIDs = []string{req.InterviewerID}
	}
	for i, iid := range interviewerIDs {
		parsedID, parseErr := uuid.Parse(iid)
		if parseErr != nil {
			continue
		}
		role := "interviewer"
		if i == 0 {
			role = "lead"
		}
		_, _ = db.Pool.Exec(context.Background(),
			"INSERT INTO session_interviewers (session_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING",
			sessionID, parsedID, role)
	}

	// If template is provided, store as suggested — questions are loaded during interviewer prep
	if req.TemplateID != "" {
		_, _ = db.Pool.Exec(context.Background(),
			"UPDATE sessions SET suggested_template_id = $1 WHERE id = $2",
			req.TemplateID, sessionID)
	}

	// Dispatch simulated email invitations (Links now just point to the session ID)
	joinUrlCandidate := "http://localhost:8085/interview/" + sessionID
	joinUrlInterviewer := "http://localhost:8085/interview/" + sessionID
	notify.SendInvitation(req.CandidateName, req.CandidateEmail, joinUrlCandidate, "Candidate")

	res := CreateSessionResponse{
		SessionID:          sessionID,
		JoinUrlInterviewer: joinUrlInterviewer,
		JoinUrlCandidate:   joinUrlCandidate,
		Status:             "CREATED",
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(res)
}

type SessionSummary struct {
	ID                 string    `json:"id"`
	Title              string    `json:"title"`
	Candidate          string    `json:"candidate"`
	CandidateName      string    `json:"candidate_name"`
	Status             string    `json:"status"`
	CreatedAt          time.Time `json:"created_at"`
	HireRecommendation string    `json:"hire_recommendation,omitempty"`
	ScoreAlgorithms    int       `json:"score_algorithms,omitempty"`
	ScoreCodeQuality   int       `json:"score_code_quality,omitempty"`
	ScoreCommunication int       `json:"score_communication,omitempty"`
	ScoreSystemDesign  int       `json:"score_system_design,omitempty"`
	AISummary          string    `json:"ai_summary,omitempty"`
	RecordingURL       string    `json:"recording_url,omitempty"`
}

func (h *Handler) GetAllSessions(w http.ResponseWriter, r *http.Request) {
	cursor := r.URL.Query().Get("cursor")
	limitStr := r.URL.Query().Get("limit")
	limit := 20
	if limitStr != "" {
		fmt.Sscanf(limitStr, "%d", &limit)
	}

	var rows pgx.Rows
	var err error

	if cursor != "" {
		query := `
			SELECT id, title, candidate_email, COALESCE(candidate_name, ''), status, created_at, COALESCE(hire_recommendation, ''), COALESCE(score_algorithms, 0), COALESCE(score_code_quality, 0), COALESCE(score_communication, 0), COALESCE(score_system_design, 0), COALESCE(ai_summary, ''), COALESCE(recording_url, '')
			FROM sessions 
			WHERE created_at < $1
			ORDER BY created_at DESC
			LIMIT $2
		`
		rows, err = db.Pool.Query(context.Background(), query, cursor, limit)
	} else {
		query := `
			SELECT id, title, candidate_email, COALESCE(candidate_name, ''), status, created_at, COALESCE(hire_recommendation, ''), COALESCE(score_algorithms, 0), COALESCE(score_code_quality, 0), COALESCE(score_communication, 0), COALESCE(score_system_design, 0), COALESCE(ai_summary, ''), COALESCE(recording_url, '')
			FROM sessions 
			ORDER BY created_at DESC
			LIMIT $1
		`
		rows, err = db.Pool.Query(context.Background(), query, limit)
	}

	if err != nil {
		http.Error(w, "failed to query sessions: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var sessions []SessionSummary
	for rows.Next() {
		var s SessionSummary
		if err := rows.Scan(&s.ID, &s.Title, &s.Candidate, &s.CandidateName, &s.Status, &s.CreatedAt, &s.HireRecommendation, &s.ScoreAlgorithms, &s.ScoreCodeQuality, &s.ScoreCommunication, &s.ScoreSystemDesign, &s.AISummary, &s.RecordingURL); err != nil {
			http.Error(w, "failed to parse sessions: "+err.Error(), http.StatusInternalServerError)
			return
		}
		sessions = append(sessions, s)
	}

	// Guarantee a JSON array even if empty
	if sessions == nil {
		sessions = []SessionSummary{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sessions)
}

type GetSessionResponse struct {
	Session *Session `json:"session"`
}

func (h *Handler) GetSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["session_id"]

	query := `
		SELECT id, title, candidate_email, COALESCE(candidate_name, ''), status, created_at, COALESCE(language_preset, ''), COALESCE(feedback, ''), COALESCE(hire_recommendation, ''), COALESCE(score_algorithms, 0), COALESCE(score_code_quality, 0), COALESCE(score_communication, 0), COALESCE(score_system_design, 0), COALESCE(ai_summary, ''), COALESCE(recording_url, '')
		FROM sessions WHERE id = $1
	`
	var sess Session
	var langPreset string
	err := db.Pool.QueryRow(context.Background(), query, sessionID).Scan(
		&sess.SessionID, &sess.Title, &sess.CandidateEmail, &sess.CandidateName, &sess.Status, &sess.StartTime, &langPreset, &sess.Feedback, &sess.HireRecommendation, &sess.ScoreAlgorithms, &sess.ScoreCodeQuality, &sess.ScoreCommunication, &sess.ScoreSystemDesign, &sess.AISummary, &sess.RecordingURL,
	)

	if err != nil {
		http.Error(w, "session not found or db error", http.StatusNotFound)
		return
	}
	sess.LanguagePreset = langPreset

	res := GetSessionResponse{
		Session: &sess,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

func (h *Handler) DeleteSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["session_id"]

	commandTag, err := db.Pool.Exec(context.Background(), "DELETE FROM sessions WHERE id = $1", sessionID)
	if err != nil {
		log.Printf("Failed to delete session %s: %v", sessionID, err)
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}

	if commandTag.RowsAffected() == 0 {
		http.Error(w, "session not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

type JoinSessionRequest struct {
	GuestName  string `json:"guest_name"`
	GuestEmail string `json:"guest_email"`
	HostName   string `json:"host_name"`
}

type JoinSessionResponse struct {
	VideoToken    string `json:"video_token"`
	Identity      string `json:"identity"`
	UserName      string `json:"user_name,omitempty"`
	InterviewType string `json:"interview_type,omitempty"`
}

func (h *Handler) JoinSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["session_id"]

	// 1. Fetch the Session to optionally verify candidate_email and get interview_type
	var targetEmail, interviewType string
	query := `SELECT candidate_email, COALESCE(interview_type, 'technical') FROM sessions WHERE id = $1`
	err := db.Pool.QueryRow(context.Background(), query, sessionID).Scan(&targetEmail, &interviewType)
	if err != nil {
		http.Error(w, "session not found", http.StatusNotFound)
		return
	}

	// Decode body early so we can use HostName for authenticated users
	var req JoinSessionRequest
	json.NewDecoder(r.Body).Decode(&req)

	// 2. Check Authentication
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" && len(authHeader) > 7 {
		tokenString := authHeader[7:]
		claims := &localauth.Claims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
			return localauth.JWTSecret, nil
		})

		if err == nil && token.Valid {
			identity := "int_" + uuid.New().String()[:8]
			if claims.Role == "observer" {
				identity = "obs_" + uuid.New().String()[:8]
			}
			hostName := req.HostName
			if hostName == "" {
				hostName = claims.Name // Should probably add Name to Claims or fetch from DB
				if hostName == "" {
					hostName = "Interviewer"
				}
			}
			isObserver := (claims.Role == "observer")
			videoToken, _ := h.generateVideoToken(sessionID, identity, hostName, claims.Role == "admin", isObserver)

			res := JoinSessionResponse{
				VideoToken:    videoToken,
				Identity:      identity,
				UserName:      hostName,
				InterviewType: interviewType,
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(res)
			return
		}
	}

	// 3. Guest (Candidate) Pre-Join Path
	if req.GuestEmail == "" && req.GuestName == "" {
		http.Error(w, "invalid request payload", http.StatusBadRequest)
		return
	}

	if req.GuestEmail != targetEmail {
		http.Error(w, "Access Denied: Email does not match the invited candidate.", http.StatusForbidden)
		return
	}

	// Granted access
	safeIdentity := "guest_" + uuid.New().String()[:8]
	displayName := req.GuestName
	if displayName == "" {
		displayName = "Candidate"
	}

	videoToken, _ := h.generateVideoToken(sessionID, safeIdentity, displayName, false, false)

	res := JoinSessionResponse{
		VideoToken:    videoToken,
		Identity:      safeIdentity,
		UserName:      displayName,
		InterviewType: interviewType,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

func (h *Handler) EndSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["session_id"]

	query := `UPDATE sessions SET status = 'completed' WHERE id = $1 RETURNING id, status`
	var id, status string
	err := db.Pool.QueryRow(context.Background(), query, sessionID).Scan(&id, &status)

	if err != nil {
		http.Error(w, "session not found or db error", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"id": id, "status": status})
}

func (h *Handler) SubmitFeedback(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["session_id"]

	var req SubmitFeedbackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request payload", http.StatusBadRequest)
		return
	}

	query := `UPDATE sessions SET status = 'completed', feedback = $1, hire_recommendation = $2, 
		score_algorithms = $3, score_code_quality = $4, score_communication = $5, score_system_design = $6,
		score_leadership = $7, score_problem_solving = $8, score_culture_fit = $9, score_domain_knowledge = $10,
		interview_notes = $11
		WHERE id = $12 RETURNING id`
	var id string
	err := db.Pool.QueryRow(context.Background(), query,
		req.Feedback, req.HireRecommendation,
		req.ScoreAlgorithms, req.ScoreCodeQuality, req.ScoreCommunication, req.ScoreSystemDesign,
		req.ScoreLeadership, req.ScoreProblemSolving, req.ScoreCultureFit, req.ScoreDomainKnowledge,
		req.InterviewNotes, sessionID).Scan(&id)
	if err != nil {
		http.Error(w, "session not found or db error", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "id": id})
}

type AnalyzeSessionRequest struct {
	Code     string `json:"code"`
	Language string `json:"language"`
	Question string `json:"question"`
}

// AnalyzeSession compiles all per-question analyses and adds audio/transcription insights
func (h *Handler) AnalyzeSession(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["session_id"]

	// 1. Gather all per-question submissions
	rows, err := db.Pool.Query(context.Background(),
		`SELECT q.title, COALESCE(sq.ai_analysis, '') 
		 FROM session_questions sq
		 JOIN questions q ON sq.question_id = q.id
		 WHERE sq.session_id = $1 AND sq.submitted_code IS NOT NULL
		 ORDER BY sq.submitted_at ASC`, sessionID,
	)
	if err != nil {
		log.Printf("Failed to query submissions for session %s: %v", sessionID, err)
	}

	var submissionSummaries []string
	if rows != nil {
		defer rows.Close()
		for rows.Next() {
			var title, analysis string
			if err := rows.Scan(&title, &analysis); err == nil && analysis != "" {
				submissionSummaries = append(submissionSummaries, fmt.Sprintf("### %s\n%s", title, analysis))
			}
		}
	}

	// 2. Stop any active LiveKit Egress recordings for this session
	livekitURL := os.Getenv("LIVEKIT_URL")
	apiKey := os.Getenv("LIVEKIT_API_KEY")
	apiSecret := os.Getenv("LIVEKIT_API_SECRET")

	if livekitURL != "" && apiKey != "" && apiSecret != "" {
		egressClient := lksdk.NewEgressClient(livekitURL, apiKey, apiSecret)
		ctxTimeout, cancelTimeout := context.WithTimeout(context.Background(), 5*time.Second)
		req := &livekit.ListEgressRequest{RoomName: sessionID, Active: true}
		if listResp, err := egressClient.ListEgress(ctxTimeout, req); err == nil {
			for _, egress := range listResp.Items {
				log.Printf("[RECORDING] Stopping active egress %s for session %s", egress.EgressId, sessionID)
				egressClient.StopEgress(context.Background(), &livekit.StopEgressRequest{EgressId: egress.EgressId})
			}
		} else {
			log.Printf("[RECORDING] Warning: Failed to list active egresses for stoppage: %v", err)
		}
		cancelTimeout()
	}

	// 3. Mark session as completed with a processing message immediately
	processingMsg := "Analysis and recording are being processed in the background. Please check back in a few minutes."
	initQuery := `UPDATE sessions SET status = 'completed', ai_summary = $1 WHERE id = $2 RETURNING id`
	var id string
	if err := db.Pool.QueryRow(context.Background(), initQuery, processingMsg, sessionID).Scan(&id); err != nil {
		log.Printf("session update error during async init: %v", err)
		http.Error(w, "session update error", http.StatusInternalServerError)
		return
	}

	// 4. Return 202 Accepted to the frontend immediately to unblock the UI
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{
		"status":     "processing",
		"id":         id,
		"ai_summary": processingMsg,
	})

	// 5. Run the heavy MinIO polling and Gemini analysis in the background
	go func(sessionID string, submissionSummaries []string) {
		log.Printf("[RECORDING] Starting background async analysis for session %s", sessionID)

		// 6. Try to download audio from MinIO (Poll for up to 45 seconds in background)
		endpoint := "minio:9000"
		minioClient, mErr := minio.New(endpoint, &minio.Options{
			Creds:  credentials.NewStaticV4("minioadmin", "minioadmin", ""),
			Secure: false,
		})

		objectName := sessionID + "-recording.mp4"
		filepath := "/tmp/" + objectName
		hasAudio := false

		if mErr != nil {
			log.Printf("[RECORDING] Failed to create MinIO client for session %s: %v", sessionID, mErr)
		} else {
			log.Printf("[RECORDING] Polling MinIO for recording: bucket=recordings, object=%s", objectName)
			maxAttempts := 10
			for i := 0; i < maxAttempts; i++ {
				dlCtx, dlCancel := context.WithTimeout(context.Background(), 5*time.Second)
				err := minioClient.FGetObject(dlCtx, "recordings", objectName, filepath, minio.GetObjectOptions{})
				dlCancel()

				if err == nil {
					hasAudio = true
					log.Printf("[RECORDING] SUCCESS: Audio recording downloaded from MinIO for session %s: %s", sessionID, filepath)
					break
				}

				log.Printf("[RECORDING] Attempt %d/%d: File not ready yet in MinIO: %v", i+1, maxAttempts, err)
				time.Sleep(3 * time.Second)
			}

			if !hasAudio {
				log.Printf("[RECORDING] TIMEOUT: No audio recording found in MinIO for session %s after 30 seconds", sessionID)
				filepath = ""
			}
		}

		// 4. Build the final AI summary
		ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second) // Increased timeout for audio upload
		defer cancel()

		genAiKey := os.Getenv("GEMINI_API_KEY")
		var aiSummary string

		if genAiKey != "" {
			client, err := genai.NewClient(ctx, option.WithAPIKey(genAiKey))
			if err == nil {
				defer client.Close()
				model := client.GenerativeModel("gemini-2.5-flash")

				var prompt string
				if len(submissionSummaries) > 0 {
					combined := strings.Join(submissionSummaries, "\n\n---\n\n")
					prompt = fmt.Sprintf("You are an AI interview analyst. Compile a final interview summary from the individual question analyses below. Provide an overall assessment of the candidate's performance including strengths, weaknesses, and a hiring recommendation.\n\n## Per-Question Analyses:\n%s\n\nProvide a concise overall summary in markdown.", combined)
				} else {
					prompt = "You are an AI interview analyst. No code submissions were made during this interview session. If audio is provided, analyze the conversation for communication skills, technical knowledge discussed verbally, and overall impression. If no audio is available either, state that insufficient data is available for analysis. Output markdown."
				}

				var parts []genai.Part

				if hasAudio && filepath != "" {
					f, err := os.Open(filepath)
					if err == nil {
						defer f.Close()
						uploadedFile, err := client.UploadFile(ctx, "", f, nil)
						if err == nil {
							// Wait for Gemini to process the audio file
							log.Printf("Gemini file upload successful: %s. Waiting for ACTIVE state...", uploadedFile.Name)
							maxPolls := 30
							fileActive := false

							for i := 0; i < maxPolls; i++ {
								fileInfo, err := client.GetFile(ctx, uploadedFile.Name)
								if err != nil {
									log.Printf("Warning: transient error getting file status from Gemini for %s: %v", uploadedFile.Name, err)
									// Continue polling instead of breaking on transient API errors
								} else if fileInfo.State == genai.FileStateActive {
									log.Printf("Gemini file %s is ACTIVE. Adding to analysis parts.", uploadedFile.Name)
									parts = append(parts, genai.FileData{URI: uploadedFile.URI})
									fileActive = true
									break
								} else if fileInfo.State == genai.FileStateFailed {
									log.Printf("Error: Gemini audio file processing failed for %s", uploadedFile.Name)
									break
								} else {
									log.Printf("Waiting for audio file to process... (State: %v)", fileInfo.State)
								}

								time.Sleep(3 * time.Second)
							}

							if !fileActive {
								log.Printf("Error: Polling timed out waiting for %s to become ACTIVE", uploadedFile.Name)
							}
						} else {
							log.Printf("Audio upload failed: %v", err)
						}
					}
				}

				parts = append(parts, genai.Text(prompt))

				log.Printf("Sending final analysis for session %s (%d submissions, audio=%v)...", sessionID, len(submissionSummaries), hasAudio)
				resp, err := model.GenerateContent(ctx, parts...)
				if err != nil {
					log.Printf("Gemini error for session %s: %v", sessionID, err)
					aiSummary = "AI analysis error: " + err.Error()
				} else if len(resp.Candidates) > 0 && len(resp.Candidates[0].Content.Parts) > 0 {
					aiSummary = fmt.Sprintf("%v", resp.Candidates[0].Content.Parts[0])
				}
			}
		}

		// If no Gemini but we have per-question analyses, just concatenate them
		if aiSummary == "" && len(submissionSummaries) > 0 {
			aiSummary = "# Interview Summary\n\n" + strings.Join(submissionSummaries, "\n\n---\n\n")
		} else if aiSummary == "" {
			aiSummary = "No submissions or audio available for analysis."
		}

		// 5. Update session with presigned recording URL
		recordingURL := ""
		if hasAudio {
			// Get public host for signing (e.g., localhost:9000)
			publicHost := os.Getenv("MINIO_PUBLIC_URL")
			if publicHost == "" {
				publicHost = "http://localhost:9000"
			}
			// Parse the public host to get endpoint (strip http://)
			signerEndpoint := strings.Replace(publicHost, "http://", "", 1)
			signerEndpoint = strings.Replace(signerEndpoint, "https://", "", 1)

			// Initialize a dedicated signer client with the public endpoint
			signerClient, sErr := minio.New(signerEndpoint, &minio.Options{
				Creds:  credentials.NewStaticV4("minioadmin", "minioadmin", ""),
				Secure: false,
			})

			if sErr == nil {
				// Generate a presigned URL with the signer client (valid for 7 days)
				presignedURL, pErr := signerClient.PresignedGetObject(context.Background(), "recordings", objectName, 7*24*time.Hour, nil)
				if pErr == nil {
					recordingURL = presignedURL.String()
					log.Printf("[RECORDING] Generated correctly signed public URL for session %s: %s", sessionID, recordingURL)
				} else {
					log.Printf("[RECORDING] Failed to presign with signer client for session %s: %v", sessionID, pErr)
					recordingURL = fmt.Sprintf("%s/recordings/%s", publicHost, objectName)
				}
			} else {
				log.Printf("[RECORDING] Failed to initialize signer client for session %s: %v", sessionID, sErr)
				recordingURL = fmt.Sprintf("%s/recordings/%s", publicHost, objectName)
			}
		} else {
			log.Printf("[RECORDING] No audio recording found for session %s, recording_url will be empty", sessionID)
		}

		// Final asynchronous DB update (reinforce completed status)
		finalQuery := `UPDATE sessions SET status = 'completed', ai_summary = $1, recording_url = $2 WHERE id = $3`
		_, err := db.Pool.Exec(context.Background(), finalQuery, aiSummary, recordingURL, sessionID)
		if err != nil {
			log.Printf("[ASYNC] Async session final update error for %s: %v", sessionID, err)
		} else {
			log.Printf("[ASYNC] Successfully completed all async steps for session %s (Status: completed)", sessionID)
		}
	}(sessionID, submissionSummaries)
}

type LoadQuestionRequest struct {
	QuestionID string `json:"question_id"`
}

func (h *Handler) LoadQuestion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["session_id"]

	var req LoadQuestionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request payload", http.StatusBadRequest)
		return
	}

	// Insert into session_questions
	query := `
		INSERT INTO session_questions (session_id, question_id, active)
		VALUES ($1, $2, true)
		ON CONFLICT (session_id, question_id) DO UPDATE SET active = true
	`
	_, err := db.Pool.Exec(context.Background(), query, sessionID, req.QuestionID)
	if err != nil {
		http.Error(w, "failed to load question into session", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success", "question_id": req.QuestionID})
}

func (h *Handler) generateVideoToken(roomName, identity, name string, isAdmin bool, isObserver bool) (string, error) {
	apiKey := "devkey"
	apiSecret := "spinvel_interview_secret_key_32_chars_min"

	at := lkauth.NewAccessToken(apiKey, apiSecret)
	grant := &lkauth.VideoGrant{
		RoomJoin: true,
		Room:     roomName,
	}
	if isAdmin {
		grant.RoomAdmin = true
	}
	if isObserver {
		grant.CanPublish = boolPtr(false)
		grant.CanPublishData = boolPtr(false)
		grant.CanSubscribe = boolPtr(true)
	}

	at.AddGrant(grant).SetIdentity(identity).SetName(name).SetValidFor(time.Hour)

	return at.ToJWT()
}

func boolPtr(b bool) *bool {
	return &b
}

func (h *Handler) StartRecording(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["session_id"]

	livekitURL := os.Getenv("LIVEKIT_URL")
	apiKey := os.Getenv("LIVEKIT_API_KEY")
	apiSecret := os.Getenv("LIVEKIT_API_SECRET")

	// Validate environment variables
	if livekitURL == "" || apiKey == "" || apiSecret == "" {
		log.Printf("[RECORDING] ERROR: Missing LiveKit env vars for session %s (URL=%q, Key=%q, Secret=<len %d>)",
			sessionID, livekitURL, apiKey, len(apiSecret))
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		json.NewEncoder(w).Encode(map[string]string{"status": "recording_unavailable", "reason": "LiveKit not configured"})
		return
	}

	log.Printf("[RECORDING] Initiating egress for session %s (LiveKit URL: %s)", sessionID, livekitURL)

	egressClient := lksdk.NewEgressClient(livekitURL, apiKey, apiSecret)

	recordingFilepath := sessionID + "-recording.mp4"

	// Configure S3 Upload for MinIO
	s3Upload := &livekit.S3Upload{
		AccessKey:      "minioadmin",
		Secret:         "minioadmin",
		Endpoint:       "http://minio:9000",
		Bucket:         "recordings",
		ForcePathStyle: true,
	}

	req := &livekit.RoomCompositeEgressRequest{
		RoomName:  sessionID,
		Layout:    "grid",
		AudioOnly: false,
		FileOutputs: []*livekit.EncodedFileOutput{
			{
				FileType: livekit.EncodedFileType_MP4,
				Filepath: recordingFilepath,
				Output: &livekit.EncodedFileOutput_S3{
					S3: s3Upload,
				},
			},
		},
	}

	log.Printf("[RECORDING] Egress config for %s: room=%s, file=%s, bucket=%s, endpoint=%s",
		sessionID, req.RoomName, recordingFilepath, s3Upload.Bucket, s3Upload.Endpoint)

	// Respond immediately — run egress in background
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(map[string]string{"status": "recording_scheduled", "room": sessionID})

	go func() {
		maxRetries := 10
		for i := 0; i < maxRetries; i++ {
			delay := time.Duration(3+i) * time.Second // progressive backoff: 3s, 4s, 5s...
			log.Printf("[RECORDING] Attempt %d/%d for room %s (waiting %v)...", i+1, maxRetries, sessionID, delay)
			time.Sleep(delay)

			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			info, err := egressClient.StartRoomCompositeEgress(ctx, req)
			cancel()

			if err == nil {
				log.Printf("[RECORDING] SUCCESS: Egress started for room %s, EgressID=%s, OutputFile=%s",
					sessionID, info.EgressId, recordingFilepath)
				return
			}

			errStr := err.Error()
			log.Printf("[RECORDING] Attempt %d/%d FAILED for room %s: %v", i+1, maxRetries, sessionID, err)

			// Don't retry on permanent errors
			if strings.Contains(errStr, "room not found") || strings.Contains(errStr, "not found") {
				log.Printf("[RECORDING] Room %s does not exist in LiveKit yet, will retry...", sessionID)
			} else if strings.Contains(errStr, "already being recorded") {
				log.Printf("[RECORDING] Room %s is already being recorded, skipping.", sessionID)
				return
			}
		}
		log.Printf("[RECORDING] FAILED: All %d egress attempts exhausted for room %s", maxRetries, sessionID)
	}()
}

// --- Phase 27: Per-Question Submission & AI Analysis ---

type SubmitAnswerRequest struct {
	QuestionID string `json:"question_id"`
	Code       string `json:"code"`
	Language   string `json:"language"`
}

type SubmissionResponse struct {
	QuestionID    string `json:"question_id"`
	QuestionTitle string `json:"question_title"`
	Code          string `json:"submitted_code"`
	Language      string `json:"submitted_language"`
	AIAnalysis    string `json:"ai_analysis"`
	SubmittedAt   string `json:"submitted_at"`
}

func (h *Handler) SubmitAnswer(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["session_id"]

	var req SubmitAnswerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	if req.QuestionID == "" || strings.TrimSpace(req.Code) == "" {
		http.Error(w, "question_id and code are required", http.StatusBadRequest)
		return
	}

	// 1. Fetch question description for Gemini prompt
	var questionTitle, questionDesc string
	err := db.Pool.QueryRow(context.Background(),
		"SELECT title, description FROM questions WHERE id = $1", req.QuestionID,
	).Scan(&questionTitle, &questionDesc)
	if err != nil {
		http.Error(w, "question not found", http.StatusNotFound)
		return
	}

	// 2. Call Gemini for per-question analysis
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	apiKey := os.Getenv("GEMINI_API_KEY")
	var aiAnalysis string

	if apiKey != "" {
		client, err := genai.NewClient(ctx, option.WithAPIKey(apiKey))
		if err == nil {
			defer client.Close()
			model := client.GenerativeModel("gemini-2.5-flash")
			prompt := fmt.Sprintf("You are an AI interview analyst. Analyze the candidate's submission for this coding question.\n\nQuestion: %s\n%s\n\nCandidate's %s code:\n```\n%s\n```\n\nEvaluate:\n1. **Correctness** - does it solve the problem?\n2. **Problem Solving** - approach, algorithm choice, edge cases\n3. **Code Quality** - readability, structure, best practices\n\nBe concise. Output markdown.", questionTitle, questionDesc, req.Language, req.Code)

			resp, err := model.GenerateContent(ctx, genai.Text(prompt))
			if err != nil {
				log.Printf("Gemini error for question %s: %v", req.QuestionID, err)
				aiAnalysis = "AI analysis unavailable: " + err.Error()
			} else if len(resp.Candidates) > 0 && len(resp.Candidates[0].Content.Parts) > 0 {
				aiAnalysis = fmt.Sprintf("%v", resp.Candidates[0].Content.Parts[0])
			}
		}
	} else {
		aiAnalysis = "AI analysis unavailable: GEMINI_API_KEY not set"
	}

	// 3. Save submission to DB
	_, err = db.Pool.Exec(context.Background(),
		`UPDATE session_questions 
		 SET submitted_code = $1, submitted_language = $2, ai_analysis = $3, submitted_at = NOW()
		 WHERE session_id = $4 AND question_id = $5`,
		req.Code, req.Language, aiAnalysis, sessionID, req.QuestionID,
	)
	if err != nil {
		// If row doesn't exist, insert it
		_, err = db.Pool.Exec(context.Background(),
			`INSERT INTO session_questions (session_id, question_id, active, submitted_code, submitted_language, ai_analysis, submitted_at)
			 VALUES ($1, $2, true, $3, $4, $5, NOW())
			 ON CONFLICT (session_id, question_id) DO UPDATE SET submitted_code = $3, submitted_language = $4, ai_analysis = $5, submitted_at = NOW()`,
			sessionID, req.QuestionID, req.Code, req.Language, aiAnalysis,
		)
		if err != nil {
			log.Printf("Failed to save submission: %v", err)
			http.Error(w, "failed to save submission", http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":      "submitted",
		"question_id": req.QuestionID,
		"ai_analysis": aiAnalysis,
	})
}

func (h *Handler) GetSubmissions(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["session_id"]

	rows, err := db.Pool.Query(context.Background(),
		`SELECT sq.question_id, q.title, COALESCE(sq.submitted_code, ''), COALESCE(sq.submitted_language, ''), COALESCE(sq.ai_analysis, ''), COALESCE(sq.submitted_at::TEXT, '')
		 FROM session_questions sq
		 JOIN questions q ON sq.question_id = q.id
		 WHERE sq.session_id = $1 AND sq.submitted_code IS NOT NULL
		 ORDER BY sq.submitted_at ASC`, sessionID,
	)
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var submissions []SubmissionResponse
	for rows.Next() {
		var s SubmissionResponse
		if err := rows.Scan(&s.QuestionID, &s.QuestionTitle, &s.Code, &s.Language, &s.AIAnalysis, &s.SubmittedAt); err != nil {
			continue
		}
		submissions = append(submissions, s)
	}

	if submissions == nil {
		submissions = []SubmissionResponse{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(submissions)
}
