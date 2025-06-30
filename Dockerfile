ARG NODE_VERSION=22.15.1
FROM node:${NODE_VERSION}-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install

COPY . .

# Download the RDS truststore to a known path
RUN mkdir -p /usr/src/app/certs && \
    wget -O /usr/src/app/certs/global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

# Set the CA certificate for RDS connections
ENV NODE_EXTRA_CA_CERTS=/usr/src/app/certs/global-bundle.pem

# Expose Fastify port
EXPOSE 5000

# Start server with drizzle migration and Fastify
CMD ["sh", "-c", "npx drizzle-kit push && npx tsx main.ts"]
