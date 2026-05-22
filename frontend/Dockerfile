# =========================
# BUILD STAGE
# =========================
FROM node:20 AS build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# 🚀 CLEANUP: Removed the ARG and ENV lines from here since we do this at runtime now!
RUN npm run build

# =========================
# RUNTIME STAGE
# =========================
FROM nginx:alpine

# Copy the build output
COPY --from=build /app/dist /usr/share/nginx/html

# COPY YOUR NEW NGINX CONFIG HERE:
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

# 🚀 THE FIX: Execute sed to replace the placeholder in index.html with $VITE_APP_TITLE right before Nginx starts
CMD ["/bin/sh", "-c", "sed -i \"s|__WINDOW_TITLE_PLACEHOLDER__|${VITE_APP_TITLE}|g\" /usr/share/nginx/html/index.html && nginx -g 'daemon off;'"]