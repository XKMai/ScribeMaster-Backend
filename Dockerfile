ARG NODE_VERSION=22.15.1
FROM node:${NODE_VERSION}-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

# Expose Fastify port
EXPOSE 5000

RUN wget https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
RUN export NODE_EXTRA_CA_CERTS="/usr/src/app/global-bundle.pem" 

# Start Fastify server
CMD ["sh", "-c", "npx drizzle-kit push && npx tsx main.ts"]

