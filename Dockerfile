# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine


WORKDIR /app


COPY package*.json ./
RUN npm ci --omit=dev


COPY server.js ./
COPY --from=builder /app/build ./build


ENV NODE_ENV=production
ENV PORT=5001


EXPOSE 5001


CMD ["node", "server.js"]
