FROM node:20-alpine

WORKDIR /workspace

# Install workspace dependencies first.
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
COPY apps/web/package*.json ./apps/web/
RUN npm install

COPY . .

WORKDIR /workspace/apps/web

EXPOSE 3000

CMD ["npm", "run", "dev"]
