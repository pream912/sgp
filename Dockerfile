# Slim Node.js 20 image for Cloudflare Containers.
# Chromium/Puppeteer deps removed: services/screenshot.js uses CF Browser Rendering.
# build-rev: 2
FROM node:20-slim

WORKDIR /app

# Build deps for native modules + tini for clean PID 1 behavior on Containers.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    tini \
    && rm -rf /var/lib/apt/lists/*

# Install production deps first for layer caching.
COPY package*.json ./
RUN npm ci --omit=dev

# Tailwind builder runs at runtime via child_process — install its deps too.
COPY templates/html-skeleton/package*.json ./templates/html-skeleton/
RUN cd templates/html-skeleton && npm install --omit=dev

# Copy source.
COPY . .

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "server.js"]
