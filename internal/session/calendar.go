package session

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/mux"
	"github.com/dhawalhost/talentcurate/internal/db"
)

// --- Calendar Event Models ---

type CalendarEvent struct {
	SessionID       string            `json:"session_id"`
	Title           string            `json:"title"`
	CandidateEmail  string            `json:"candidate_email"`
	CandidateName   string            `json:"candidate_name"`
	Status          string            `json:"status"`
	ScheduledFor    *time.Time        `json:"scheduled_for"`
	DurationMinutes int               `json:"duration_minutes"`
	InterviewType   string            `json:"interview_type"`
	Interviewers    []InterviewerInfo `json:"interviewers"`
	CreatedAt       time.Time         `json:"created_at"`
}

type InterviewerInfo struct {
	UserID     string `json:"user_id"`
	Name       string `json:"name"`
	Email      string `json:"email"`
	Role       string `json:"role"`        // lead, interviewer, observer
	PrepStatus string `json:"prep_status"` // pending, ready, skipped
	TemplateID string `json:"template_id,omitempty"`
}

type AvailabilitySlot struct {
	ID        string `json:"id,omitempty"`
	UserID    string `json:"user_id,omitempty"`
	DayOfWeek int    `json:"day_of_week"` // 0=Sunday, 6=Saturday
	StartTime string `json:"start_time"`  // HH:MM
	EndTime   string `json:"end_time"`    // HH:MM
}

type FreeSlotResult struct {
	Date      string `json:"date"`       // YYYY-MM-DD
	StartTime string `json:"start_time"` // HH:MM
	EndTime   string `json:"end_time"`   // HH:MM
}

type timeRange struct {
	Start string
	End   string
}

// --- Calendar Route Registration ---

func (h *Handler) RegisterCalendarRoutes(router *mux.Router) {
	router.HandleFunc("/api/v1/calendar/events", h.GetCalendarEvents).Methods("GET")
	router.HandleFunc("/api/v1/calendar/availability/{user_id}", h.GetAvailability).Methods("GET")
	router.HandleFunc("/api/v1/calendar/availability", h.SetAvailability).Methods("PUT")
	router.HandleFunc("/api/v1/calendar/free-slots", h.GetFreeSlots).Methods("GET")
	router.HandleFunc("/api/v1/calendar/my-interviews", h.GetMyInterviews).Methods("GET")
	router.HandleFunc("/api/v1/calendar/prep/{session_id}", h.GetPrepDetails).Methods("GET")
	router.HandleFunc("/api/v1/calendar/prep/{session_id}", h.ConfirmPrep).Methods("PUT")
}

// GetCalendarEvents returns sessions as calendar events, filterable by date range
func (h *Handler) GetCalendarEvents(w http.ResponseWriter, r *http.Request) {
	startDate := r.URL.Query().Get("start")
	endDate := r.URL.Query().Get("end")
	userID := r.URL.Query().Get("user_id") // optional: filter to specific interviewer

	query := `
		SELECT s.id, s.title, s.candidate_email, COALESCE(s.candidate_name, ''), 
		       s.status, s.scheduled_for, COALESCE(s.duration_minutes, 60), 
		       COALESCE(s.interview_type, 'technical'), s.created_at
		FROM sessions s
	`
	var args []interface{}
	argIdx := 1
	whereAdded := false

	addWhere := func() string {
		if !whereAdded {
			whereAdded = true
			return " WHERE "
		}
		return " AND "
	}

	if userID != "" {
		query += addWhere() + fmt.Sprintf(`s.id IN (SELECT session_id FROM session_interviewers WHERE user_id = $%d)`, argIdx)
		args = append(args, userID)
		argIdx++
	}

	if startDate != "" {
		query += addWhere() + fmt.Sprintf(`(s.scheduled_for >= $%d::TIMESTAMP OR (s.scheduled_for IS NULL AND s.created_at >= $%d::TIMESTAMP))`, argIdx, argIdx)
		args = append(args, startDate)
		argIdx++
	}
	if endDate != "" {
		query += addWhere() + fmt.Sprintf(`(s.scheduled_for <= $%d::TIMESTAMP OR (s.scheduled_for IS NULL AND s.created_at <= $%d::TIMESTAMP))`, argIdx, argIdx)
		args = append(args, endDate)
		argIdx++
	}

	query += ` ORDER BY COALESCE(s.scheduled_for, s.created_at) ASC`

	rows, err := db.Pool.Query(context.Background(), query, args...)
	if err != nil {
		log.Printf("[CALENDAR] Failed to query events: %v", err)
		http.Error(w, "failed to load events", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var events []CalendarEvent
	for rows.Next() {
		var ev CalendarEvent
		var scheduledFor *time.Time
		if err := rows.Scan(&ev.SessionID, &ev.Title, &ev.CandidateEmail, &ev.CandidateName,
			&ev.Status, &scheduledFor, &ev.DurationMinutes, &ev.InterviewType, &ev.CreatedAt); err != nil {
			log.Printf("[CALENDAR] Row scan error: %v", err)
			continue
		}
		ev.ScheduledFor = scheduledFor
		ev.Interviewers = loadInterviewersForSession(ev.SessionID)
		events = append(events, ev)
	}

	if events == nil {
		events = []CalendarEvent{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(events)
}

// loadInterviewersForSession loads interviewer details for a session
func loadInterviewersForSession(sessionID string) []InterviewerInfo {
	rows, err := db.Pool.Query(context.Background(), `
		SELECT si.user_id, u.name, u.email, si.role
		FROM session_interviewers si
		JOIN users u ON si.user_id = u.id
		WHERE si.session_id = $1
	`, sessionID)
	if err != nil {
		return []InterviewerInfo{}
	}
	defer rows.Close()

	var interviewers []InterviewerInfo
	for rows.Next() {
		var info InterviewerInfo
		if err := rows.Scan(&info.UserID, &info.Name, &info.Email, &info.Role); err == nil {
			interviewers = append(interviewers, info)
		}
	}

	if interviewers == nil {
		interviewers = []InterviewerInfo{}
	}
	return interviewers
}

// loadInterviewersForSessionFull includes prep_status and template_id
func loadInterviewersForSessionFull(sessionID string) []InterviewerInfo {
	rows, err := db.Pool.Query(context.Background(), `
		SELECT si.user_id, u.name, u.email, si.role, COALESCE(si.prep_status, 'pending'), COALESCE(si.template_id::TEXT, '')
		FROM session_interviewers si
		JOIN users u ON si.user_id = u.id
		WHERE si.session_id = $1
	`, sessionID)
	if err != nil {
		return []InterviewerInfo{}
	}
	defer rows.Close()

	var interviewers []InterviewerInfo
	for rows.Next() {
		var info InterviewerInfo
		if err := rows.Scan(&info.UserID, &info.Name, &info.Email, &info.Role, &info.PrepStatus, &info.TemplateID); err == nil {
			interviewers = append(interviewers, info)
		}
	}

	if interviewers == nil {
		interviewers = []InterviewerInfo{}
	}
	return interviewers
}

// GetAvailability returns the weekly availability slots for a user
func (h *Handler) GetAvailability(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	userID := vars["user_id"]

	rows, err := db.Pool.Query(context.Background(), `
		SELECT id, user_id, day_of_week, start_time::TEXT, end_time::TEXT 
		FROM interviewer_availability 
		WHERE user_id = $1 
		ORDER BY day_of_week, start_time
	`, userID)
	if err != nil {
		http.Error(w, "failed to load availability", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var slots []AvailabilitySlot
	for rows.Next() {
		var s AvailabilitySlot
		if err := rows.Scan(&s.ID, &s.UserID, &s.DayOfWeek, &s.StartTime, &s.EndTime); err == nil {
			slots = append(slots, s)
		}
	}
	if slots == nil {
		slots = []AvailabilitySlot{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(slots)
}

// SetAvailability replaces all availability slots for a user
func (h *Handler) SetAvailability(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "user_id query parameter is required", http.StatusBadRequest)
		return
	}

	var slots []AvailabilitySlot
	if err := json.NewDecoder(r.Body).Decode(&slots); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	tx, err := db.Pool.Begin(context.Background())
	if err != nil {
		http.Error(w, "database error", http.StatusInternalServerError)
		return
	}
	defer tx.Rollback(context.Background())

	// Clear existing slots
	if _, err = tx.Exec(context.Background(), "DELETE FROM interviewer_availability WHERE user_id = $1", userID); err != nil {
		http.Error(w, "failed to clear availability", http.StatusInternalServerError)
		return
	}

	// Insert new slots
	for _, s := range slots {
		_, err = tx.Exec(context.Background(),
			"INSERT INTO interviewer_availability (user_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3::TIME, $4::TIME)",
			userID, s.DayOfWeek, s.StartTime, s.EndTime)
		if err != nil {
			log.Printf("[CALENDAR] Failed to insert availability slot: %v", err)
			http.Error(w, "failed to save availability", http.StatusInternalServerError)
			return
		}
	}

	if err := tx.Commit(context.Background()); err != nil {
		http.Error(w, "failed to commit availability", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "success"})
}

// GetFreeSlots finds available time slots for a set of interviewers on a given date
func (h *Handler) GetFreeSlots(w http.ResponseWriter, r *http.Request) {
	date := r.URL.Query().Get("date")
	interviewerIDs := r.URL.Query()["interviewer_ids"]
	durationStr := r.URL.Query().Get("duration")

	if date == "" || len(interviewerIDs) == 0 {
		http.Error(w, "date and interviewer_ids[] are required", http.StatusBadRequest)
		return
	}

	dur := 60
	if durationStr != "" {
		if d := 0; true {
			for _, c := range durationStr {
				if c >= '0' && c <= '9' {
					d = d*10 + int(c-'0')
				}
			}
			if d > 0 {
				dur = d
			}
		}
	}

	targetDate, err := time.Parse("2006-01-02", date)
	if err != nil {
		http.Error(w, "invalid date format, use YYYY-MM-DD", http.StatusBadRequest)
		return
	}

	dayOfWeek := int(targetDate.Weekday())

	// 1. Find common availability for all interviewers on this day
	var commonSlots []timeRange

	for i, uid := range interviewerIDs {
		rows, err := db.Pool.Query(context.Background(), `
			SELECT start_time::TEXT, end_time::TEXT 
			FROM interviewer_availability 
			WHERE user_id = $1 AND day_of_week = $2
			ORDER BY start_time
		`, uid, dayOfWeek)
		if err != nil {
			continue
		}

		var userSlots []timeRange
		for rows.Next() {
			var tr timeRange
			if err := rows.Scan(&tr.Start, &tr.End); err == nil {
				userSlots = append(userSlots, tr)
			}
		}
		rows.Close()

		if i == 0 {
			commonSlots = userSlots
		} else {
			commonSlots = intersectSlots(commonSlots, userSlots)
		}

		if len(commonSlots) == 0 {
			break
		}
	}

	// 2. Get existing bookings for these interviewers on this date
	bookedSlots := getBookedSlots(interviewerIDs, date)

	// 3. Generate free slots
	var freeSlots []FreeSlotResult
	for _, cs := range commonSlots {
		slots := subtractBookings(date, cs.Start, cs.End, bookedSlots, dur)
		freeSlots = append(freeSlots, slots...)
	}

	if freeSlots == nil {
		freeSlots = []FreeSlotResult{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(freeSlots)
}

// --- Utility Functions ---

func intersectSlots(a, b []timeRange) []timeRange {
	var result []timeRange
	for _, sa := range a {
		for _, sb := range b {
			start := sa.Start
			if sb.Start > start {
				start = sb.Start
			}
			end := sa.End
			if sb.End < end {
				end = sb.End
			}
			if start < end {
				result = append(result, timeRange{start, end})
			}
		}
	}
	return result
}

func getBookedSlots(interviewerIDs []string, date string) []timeRange {
	var booked []timeRange
	for _, uid := range interviewerIDs {
		rows, err := db.Pool.Query(context.Background(), `
			SELECT s.scheduled_for, COALESCE(s.duration_minutes, 60)
			FROM sessions s
			JOIN session_interviewers si ON si.session_id = s.id
			WHERE si.user_id = $1 
			  AND s.scheduled_for::DATE = $2::DATE
			  AND s.status != 'canceled'
		`, uid, date)
		if err != nil {
			continue
		}
		for rows.Next() {
			var sf time.Time
			var dur int
			if err := rows.Scan(&sf, &dur); err == nil {
				start := sf.Format("15:04")
				end := sf.Add(time.Duration(dur) * time.Minute).Format("15:04")
				booked = append(booked, timeRange{start, end})
			}
		}
		rows.Close()
	}
	return booked
}

func subtractBookings(date, availStart, availEnd string, booked []timeRange, durationMin int) []FreeSlotResult {
	var result []FreeSlotResult
	cursor := availStart

	for _, b := range booked {
		if b.Start > cursor && b.Start <= availEnd {
			if timeDiffMinutes(cursor, b.Start) >= durationMin {
				result = append(result, FreeSlotResult{Date: date, StartTime: cursor, EndTime: b.Start})
			}
		}
		if b.End > cursor {
			cursor = b.End
		}
	}

	// Remaining time after last booking
	if cursor < availEnd && timeDiffMinutes(cursor, availEnd) >= durationMin {
		result = append(result, FreeSlotResult{Date: date, StartTime: cursor, EndTime: availEnd})
	}

	return result
}

func timeDiffMinutes(a, b string) int {
	ta, _ := time.Parse("15:04", a)
	tb, _ := time.Parse("15:04", b)
	return int(tb.Sub(ta).Minutes())
}

// --- Interviewer Prep Endpoints ---

// GetMyInterviews returns interviews assigned to the logged-in user with prep status
func (h *Handler) GetMyInterviews(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		http.Error(w, "user_id query parameter is required", http.StatusBadRequest)
		return
	}

	type MyInterview struct {
		SessionID       string     `json:"session_id"`
		Title           string     `json:"title"`
		CandidateName   string     `json:"candidate_name"`
		CandidateEmail  string     `json:"candidate_email"`
		ScheduledFor    *time.Time `json:"scheduled_for"`
		DurationMinutes int        `json:"duration_minutes"`
		InterviewType   string     `json:"interview_type"`
		Status          string     `json:"status"`
		MyRole          string     `json:"my_role"`
		PrepStatus      string     `json:"prep_status"`
		TemplateID      string     `json:"template_id,omitempty"`
	}

	rows, err := db.Pool.Query(context.Background(), `
		SELECT s.id, s.title, COALESCE(s.candidate_name, ''), s.candidate_email,
		       s.scheduled_for, COALESCE(s.duration_minutes, 60), COALESCE(s.interview_type, 'technical'),
		       s.status, si.role, COALESCE(si.prep_status, 'pending'), COALESCE(si.template_id::TEXT, '')
		FROM sessions s
		JOIN session_interviewers si ON si.session_id = s.id
		WHERE si.user_id = $1 AND s.status NOT IN ('cancelled', 'completed')
		ORDER BY COALESCE(s.scheduled_for, s.created_at) ASC
	`, userID)
	if err != nil {
		http.Error(w, "failed to load interviews", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var interviews []MyInterview
	for rows.Next() {
		var mi MyInterview
		if err := rows.Scan(&mi.SessionID, &mi.Title, &mi.CandidateName, &mi.CandidateEmail,
			&mi.ScheduledFor, &mi.DurationMinutes, &mi.InterviewType,
			&mi.Status, &mi.MyRole, &mi.PrepStatus, &mi.TemplateID); err != nil {
			log.Printf("[MY-INTERVIEWS] Row scan error: %v", err)
			continue
		}
		interviews = append(interviews, mi)
	}

	if interviews == nil {
		interviews = []MyInterview{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(interviews)
}

// GetPrepDetails returns session info + available templates for the interviewer to prep
func (h *Handler) GetPrepDetails(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["session_id"]
	userID := r.URL.Query().Get("user_id")

	type PrepDetails struct {
		SessionID         string            `json:"session_id"`
		Title             string            `json:"title"`
		CandidateName     string            `json:"candidate_name"`
		ScheduledFor      *time.Time        `json:"scheduled_for"`
		DurationMinutes   int               `json:"duration_minutes"`
		InterviewType     string            `json:"interview_type"`
		SuggestedTemplate *string           `json:"suggested_template_id"`
		CurrentTemplateID string            `json:"current_template_id"`
		PrepStatus        string            `json:"prep_status"`
		Interviewers      []InterviewerInfo `json:"interviewers"`
	}

	var pd PrepDetails
	pd.SessionID = sessionID

	row := db.Pool.QueryRow(context.Background(), `
		SELECT s.title, COALESCE(s.candidate_name, ''), s.scheduled_for,
		       COALESCE(s.duration_minutes, 60), COALESCE(s.interview_type, 'technical'),
		       s.suggested_template_id
		FROM sessions s WHERE s.id = $1
	`, sessionID)

	var suggestedTpl *string
	if err := row.Scan(&pd.Title, &pd.CandidateName, &pd.ScheduledFor,
		&pd.DurationMinutes, &pd.InterviewType, &suggestedTpl); err != nil {
		http.Error(w, "session not found", http.StatusNotFound)
		return
	}
	pd.SuggestedTemplate = suggestedTpl

	// Get interviewer's current prep status and template
	if userID != "" {
		var prepStatus, currentTpl string
		err := db.Pool.QueryRow(context.Background(), `
			SELECT COALESCE(prep_status, 'pending'), COALESCE(template_id::TEXT, '')
			FROM session_interviewers WHERE session_id = $1 AND user_id = $2
		`, sessionID, userID).Scan(&prepStatus, &currentTpl)
		if err == nil {
			pd.PrepStatus = prepStatus
			pd.CurrentTemplateID = currentTpl
		}
	}

	pd.Interviewers = loadInterviewersForSessionFull(sessionID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(pd)
}

// ConfirmPrep sets the interviewer's chosen template and loads its questions into the session
func (h *Handler) ConfirmPrep(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["session_id"]

	var req struct {
		UserID     string `json:"user_id"`
		TemplateID string `json:"template_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	// Update prep status and template_id for this interviewer
	var templateIDVal interface{}
	if req.TemplateID != "" {
		templateIDVal = req.TemplateID
	}

	_, err := db.Pool.Exec(context.Background(), `
		UPDATE session_interviewers SET prep_status = 'ready', template_id = $1
		WHERE session_id = $2 AND user_id = $3
	`, templateIDVal, sessionID, req.UserID)
	if err != nil {
		http.Error(w, "failed to update prep status", http.StatusInternalServerError)
		return
	}

	// Check if this is the lead interviewer — if so, load questions into session
	var role string
	db.Pool.QueryRow(context.Background(), `
		SELECT role FROM session_interviewers WHERE session_id = $1 AND user_id = $2
	`, sessionID, req.UserID).Scan(&role)

	if role == "lead" && req.TemplateID != "" {
		loadQuestionsFromTemplate(sessionID, req.TemplateID)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}

// loadQuestionsFromTemplate loads template questions into a session
func loadQuestionsFromTemplate(sessionID, templateID string) {
	// Clear existing session questions first
	db.Pool.Exec(context.Background(), "DELETE FROM session_questions WHERE session_id = $1", sessionID)

	rows, err := db.Pool.Query(context.Background(),
		"SELECT question_id, position FROM template_questions WHERE template_id = $1 ORDER BY position",
		templateID)
	if err != nil {
		log.Printf("[PREP] Failed to load template questions: %v", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var qID string
		var pos int
		if err := rows.Scan(&qID, &pos); err == nil {
			db.Pool.Exec(context.Background(),
				"INSERT INTO session_questions (session_id, question_id, active, position) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING",
				sessionID, qID, pos == 0, pos)
		}
	}

	// Update session template_id
	db.Pool.Exec(context.Background(), "UPDATE sessions SET template_id = $1 WHERE id = $2", templateID, sessionID)
}
