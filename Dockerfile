# ==========================================
# STAGE 1: The Builder
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install ALL dependencies (including devDependencies like TypeScript)
RUN npm install

# Copy source code and compile
COPY . .
RUN npx tsc

# ==========================================
# STAGE 2: The Production Runner
# ==========================================
FROM node:20-alpine

WORKDIR /app

# Set Node to production mode
ENV NODE_ENV=production

# Copy only the package files
COPY package*.json ./

# Install ONLY production dependencies (skips TypeScript, nodemon, etc.)
# Using 'npm ci' is faster and more reliable in Docker than 'npm install'
RUN npm install --omit=dev

# Copy ONLY the compiled JavaScript from the builder stage
COPY --from=builder /app/dist ./dist

# Expose the port
EXPOSE 5050

# Run the compiled JavaScript
CMD ["node", "dist/index.js"]