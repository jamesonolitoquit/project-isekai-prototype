# Phase 23 Task 2: Docker & Deployment Configuration
# Multi-stage build for Next.js + Node.js WebSocket server

# Stage 1: Build dependencies and application
FROM node:18-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build Next.js application
RUN npm run build

# Stage 2: Runtime container
FROM node:18-alpine

WORKDIR /app

# Install dumb-init and curl for health checks
RUN apk add --no-cache dumb-init curl

# Create app user (security best practice)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy built application from builder
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/package*.json ./

# Copy application files (non-build)
COPY --chown=nextjs:nodejs . .

# Switch to non-root user
USER nextjs

# Expose ports: 3000 (Next.js), 8080 (WebSocket)
EXPOSE 3000 8080

# Health check: verify app is responding
HEALTHCHECK --interval=10s --timeout=5s --retries=3 --start-period=10s \
    CMD curl -f http://localhost:3000/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Start the application
CMD ["npm", "run", "start"]
