# dump1090-dashboard — multi-stage build:
#   1. node: npm ci + vite build → dist/
#   2. nginx: serves dist/ and proxies /data/ to the decoder
#
# CI does NOT build this image (see .github/workflows/ci.yml).
#
# Build:
#   docker build -t dump1090-dashboard .
#
# Point the /data/ proxy at your decoder without editing the config:
#   docker build --build-arg DECODER_UPSTREAM=http://192.168.1.10:8080 -t dump1090-dashboard .
#
# Run (the decoder's HTTP server must be reachable from the container):
#   docker run --rm -p 8081:80 dump1090-dashboard            # Linux: use DECODER_UPSTREAM=http://172.17.0.1:8080
#   docker run --rm -p 8081:80 --add-host host.docker.internal:host-gateway \
#     -e ... --build-arg DECODER_UPSTREAM=http://host.docker.internal:8080

FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY vite.config.ts tsconfig.json index.html ./
COPY src ./src
RUN npm run build

FROM nginx:1.29-alpine

# Upstream rewrite target — must match the string in nginx.conf.example.
ARG DECODER_UPSTREAM=http://127.0.0.1:8080
COPY nginx.conf.example /etc/nginx/conf.d/default.conf
RUN sed -i "s|http://127.0.0.1:8080|${DECODER_UPSTREAM}|g" /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
