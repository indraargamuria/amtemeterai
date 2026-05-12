# =========================
# BUILD STAGE
# =========================
FROM node:20 AS build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

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