# Build stage for React frontend
FROM node:20-bookworm-slim AS build-stage
WORKDIR /app
COPY client/package*.json ./client/
RUN cd client && npm install
COPY client/ ./client/
RUN cd client && npm run build

# Production stage
FROM node:20-bookworm-slim
WORKDIR /app

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Copy backend package files and install
COPY server/package*.json ./server/
RUN cd server && npm install

# Install Playwright browsers
RUN npx playwright install chromium

# Copy server code
COPY server/ ./server/

# Copy built frontend from build-stage (already placed in server/public by Vite)
COPY --from=build-stage /app/server/public ./server/public

# Copy the database if it exists (fresh one will be created otherwise)
COPY sevai_scout.db ./sevai_scout.db

WORKDIR /app/server
EXPOSE 7860
ENV PORT=7860
ENV NODE_ENV=production

CMD ["node", "index.js"]
