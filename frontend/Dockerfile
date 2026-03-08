# Spinvel Frontend Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
# Pass env vars for build time if needed
ARG VITE_API_URL=/api/v1
ARG VITE_WS_URL=/collab
RUN npm run build

# Serve with Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
# Custom nginx config to handle SPA routing and proxying if preferred
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
