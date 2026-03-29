FROM node:20-alpine

WORKDIR /app

# 1. Copy dependencies first (for caching)
COPY package.json package-lock.json* ./

# 2. Install dependencies (including typescript)
RUN npm install

# 3. Copy your actual source code (the .ts files)
COPY . .

# 4. Now compile the TypeScript to JavaScript
RUN npx tsc

EXPOSE 5050

CMD ["node", "dist/index.js"]