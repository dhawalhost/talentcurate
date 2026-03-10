# Multi-stage Dockerfile for TalentCurate Worker
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy dependency files first for caching
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the Worker binary
RUN CGO_ENABLED=0 GOOS=linux go build -o worker ./cmd/worker/main.go

# Production stage
FROM alpine:latest
RUN apk add --no-cache ca-certificates docker-cli

WORKDIR /root/

# Copy the binary from the builder stage
COPY --from=builder /app/worker .

# Worker needs to interact with Docker for sandboxing (mounted via socket)
# Also needs METRICS_PORT for observability
EXPOSE 9090

CMD ["./worker"]
