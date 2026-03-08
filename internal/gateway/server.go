package gateway

import (
	"context"
	"encoding/json"
	"log"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/dhawalhost/talentcurate/internal/auth"
	"github.com/dhawalhost/talentcurate/internal/collaboration"
	"github.com/dhawalhost/talentcurate/internal/execution/models"
	"github.com/dhawalhost/talentcurate/internal/question"
	"github.com/dhawalhost/talentcurate/internal/session"
	"github.com/dhawalhost/talentcurate/internal/user"
	"github.com/dhawalhost/talentcurate/pkg/queue"
)

type Gateway struct {
	HTTPServer  *http.Server
	SessionSvc  *session.Handler
	CollabSvc   *collaboration.Handler
	AuthSvc     *auth.Handler
	QuestionSvc *question.Handler
	UserSvc     *user.Handler
	Queue       queue.ExecutionQueue
}

func NewGateway(addr string, q queue.ExecutionQueue) *Gateway {
	router := mux.NewRouter()

	// CORS Middleware for MVP Development
	corsRouter := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Access-Control-Allow-Origin", "*")
			w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
			w.Header().Set("Access-Control-Allow-Headers", "Accept, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization")
			if r.Method == "OPTIONS" {
				return
			}
			next.ServeHTTP(w, r)
		})
	}
	// Panic Recovery Middleware
	recoveryMiddleware := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					log.Printf("PANIC RECOVERED handling request: %v", err)
					http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				}
			}()
			next.ServeHTTP(w, r)
		})
	}

	gw := &Gateway{
		SessionSvc:  session.NewHandler(),
		CollabSvc:   collaboration.NewHandler(),
		AuthSvc:     auth.NewHandler(),
		QuestionSvc: question.NewHandler(),
		UserSvc:     user.NewHandler(),
		Queue:       q,
	}

	// Subscribe to execution results broadcast from Workers
	gw.Queue.SubscribeToResults(context.Background(), gw.handleExecutionResult)

	// Mount Sub-Services
	gw.SessionSvc.RegisterRoutes(router)
	gw.CollabSvc.RegisterRoutes(router)
	gw.AuthSvc.RegisterRoutes(router)
	gw.QuestionSvc.RegisterRoutes(router)
	gw.UserSvc.RegisterRoutes(router)

	// Direct Execution Trigger API (usually requested over WS, but REST fallback provided)
	router.HandleFunc("/api/v1/sessions/{session_id}/execute", gw.handleExecute).Methods("POST")

	// Static frontend for testing MVP
	router.PathPrefix("/").Handler(http.FileServer(http.Dir("./static/")))

	gw.HTTPServer = &http.Server{
		Addr:    addr,
		Handler: corsRouter(recoveryMiddleware(router)),
	}

	return gw
}

func (g *Gateway) handleExecute(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["session_id"]

	var req models.ExecutionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	// Hydrate Job with Identity / Context
	req.SessionID = sessionID
	// In MVP we generate an ExecutionID here; later UUID mapping
	req.ExecutionID = "exec_" + sessionID[:5] + "123"

	// Push job to message queue
	if err := g.Queue.PublishRequest(context.Background(), req); err != nil {
		log.Printf("Failed to publish execution request: %v", err)
		http.Error(w, "failed to enqueue execution", http.StatusInternalServerError)
		return
	}

	// Return acceptance
	res := map[string]string{
		"execution_id": req.ExecutionID,
		"status":       "QUEUED",
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	json.NewEncoder(w).Encode(res)
}

func (g *Gateway) handleExecutionResult(ctx context.Context, res models.ExecutionResult) {
	// Wrap in the standard WebSocket envelope for the frontend
	envelope := map[string]interface{}{
		"type":    "EXEC_COMPLETED",
		"payload": res,
	}

	payloadBytes, err := json.Marshal(envelope)
	if err != nil {
		log.Printf("Failed to marshal execution result envelope: %v", err)
		return
	}

	// Broadcast to all participants in the session
	g.CollabSvc.BroadcastToHub(res.SessionID, payloadBytes)
}

func (g *Gateway) Start() error {
	log.Printf("Gateway HTTP server starting on %s", g.HTTPServer.Addr)
	return g.HTTPServer.ListenAndServe()
}
