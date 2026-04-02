FROM node:20-alpine AS deps
WORKDIR /app/frontend-react

COPY frontend-react/package.json frontend-react/package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app/frontend-react

COPY --from=deps /app/frontend-react/node_modules ./node_modules
COPY frontend-react/ ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app/frontend-react
ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder /app/frontend-react/public ./public
COPY --from=builder /app/frontend-react/.next/standalone ./
COPY --from=builder /app/frontend-react/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000

CMD ["node", "server.js"]