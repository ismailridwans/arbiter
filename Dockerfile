# Arbiter — runs the live web dashboard (landing + dashboard) on :7777
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
EXPOSE 7777
CMD ["npm", "run", "serve"]
