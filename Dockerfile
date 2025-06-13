ARG NODE_VERSION=22.15.1
FROM node:${NODE_VERSION}-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

# Expose Fastify port
EXPOSE 5000

# Run `drizzle:push` then start Fastify server
CMD ["npx", "tsx", "main.ts"]

