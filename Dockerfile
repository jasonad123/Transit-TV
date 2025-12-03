FROM node:24-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY svelte-app/package.json svelte-app/pnpm-lock.yaml ./svelte-app/
WORKDIR /app/svelte-app
RUN pnpm install

WORKDIR /app
COPY svelte-app ./svelte-app
COPY server ./server
COPY package.json pnpm-lock.yaml ./

RUN cd svelte-app && rm -rf node_modules/.pnpm/esbuild* && pnpm install --force && pnpm run build

FROM node:24-alpine

WORKDIR /app

RUN npm install -g pnpm

COPY --from=builder /app/svelte-app/build ./svelte-app/build
COPY --from=builder /app/svelte-app/package.json ./svelte-app/package.json
COPY --from=builder /app/server ./server
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

RUN pnpm install --prod
RUN cd svelte-app && pnpm install --prod

ENV NODE_ENV=production
ENV PORT=8080
ENV USE_SVELTE=true

EXPOSE 8080

CMD ["node", "server/app.js"]
