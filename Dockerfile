# Use a slim Node.js 20 image for a smaller footprint
FROM node:20-alpine AS base

# Step 1: Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Step 2: Final Runner stage
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV production
# Next.js/Express analytics disable (optional)
ENV NEXT_TELEMETRY_DISABLED 1

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodeapp

# Copy node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules
# Copy application source
COPY . .

# Set correct ownership for the non-root user
RUN chown -R nodeapp:nodejs /app

USER nodeapp

# Port 8080 is the standard for Azure Container Apps
ENV PORT 8080
EXPOSE 8080

CMD ["node", "server.js"]
