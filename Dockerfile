# Multi-stage: build frontend then serve both via separate containers or platforms
# This Dockerfile builds the frontend only. Backend has its own Dockerfile in backend/.

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Minimal static server (can be served by your hosting; included for reference)
FROM nginx:alpine AS static
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
