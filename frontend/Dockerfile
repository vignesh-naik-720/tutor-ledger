# Stage 1: Build Frontend
FROM node:22-alpine AS builder

WORKDIR /app

COPY frontend/package*.json ./frontend/
RUN npm --prefix frontend install

COPY frontend/ ./frontend/
RUN npm --prefix frontend run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
