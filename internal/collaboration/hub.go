package collaboration

import (
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// MVP: Allow all origins (restrict in production)
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Hub manages WebSocket connections per session
type Hub struct {
	SessionID  string
	Clients    map[*Client]bool
	Broadcast  chan []byte
	Register   chan *Client
	Unregister chan *Client
	mu         sync.Mutex
}

func NewHub(sessionID string) *Hub {
	return &Hub{
		SessionID:  sessionID,
		Broadcast:  make(chan []byte),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		Clients:    make(map[*Client]bool),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			h.Clients[client] = true
			h.mu.Unlock()
			log.Printf("Client connected to session %s. Total: %d", h.SessionID, len(h.Clients))
		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.Clients[client]; ok {
				delete(h.Clients, client)
				close(client.send)
				log.Printf("Client disconnected from session %s. Total: %d", h.SessionID, len(h.Clients))
			}
			h.mu.Unlock()
		case message := <-h.Broadcast:
			h.mu.Lock()
			for client := range h.Clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.Clients, client)
				}
			}
			h.mu.Unlock()
		}
	}
}

// Global Hub Manager
var (
	hubs   = make(map[string]*Hub)
	hubsMu sync.RWMutex
)

func getOrCreateHub(sessionID string) *Hub {
	hubsMu.Lock()
	defer hubsMu.Unlock()

	if hub, ok := hubs[sessionID]; ok {
		return hub
	}

	hub := NewHub(sessionID)
	hubs[sessionID] = hub
	go hub.Run()
	return hub
}

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 512000 // 500kb max per message
)

func (c *Client) readPump() {
	defer func() {
		c.hub.Unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error { c.conn.SetReadDeadline(time.Now().Add(pongWait)); return nil })
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("error: %v", err)
			}
			break
		}
		// MVP: Broadcast all messages to all other clients in the hub.
		// Includes Yjs CRDT sync blobs and Execution requests from the browser
		c.hub.Broadcast <- message
	}
}

func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()
	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// The hub closed the channel.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.BinaryMessage) // Use Binary for Yjs and JSON results
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued chat messages to the current websocket message.
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// Handler exposed for the API server
type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

func (h *Handler) BroadcastToHub(sessionID string, message []byte) {
	hubsMu.RLock()
	hub, exists := hubs[sessionID]
	hubsMu.RUnlock()

	if exists {
		hub.Broadcast <- message
	}
}

func (h *Handler) RegisterRoutes(r *mux.Router) {
	// e.g. wss://localhost/collab/sess_abc123?token=xxx
	r.HandleFunc("/collab/{session_id}", h.ServeWS)
}

func (h *Handler) ServeWS(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	sessionID := vars["session_id"]

	// TODO: Validate auth token here

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("failed to upgrade to websocket: %v", err)
		return
	}

	hub := getOrCreateHub(sessionID)
	client := &Client{hub: hub, conn: conn, send: make(chan []byte, 256)}
	client.hub.Register <- client

	go client.writePump()
	go client.readPump()
}
