# Multi-stage Dockerfile for TalentCurate API
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy dependency files first for caching
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the API binary
RUN CGO_ENABLED=0 GOOS=linux go build -o api-gateway ./cmd/api/main.go

# Production stage
FROM alpine:latest
RUN apk add --no-cache ca-certificates

WORKDIR /root/

# Copy the binary from the builder stage
COPY --from=builder /app/api-gateway .

# Expose the API port
EXPOSE 8080

CMD ["./api-gateway"]
