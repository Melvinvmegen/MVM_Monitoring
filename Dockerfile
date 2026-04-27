FROM node:24-alpine
RUN apk --no-cache add curl
EXPOSE 3000
COPY . .
ENV NODE_ENV=production
RUN npm install
RUN npm prune --production
ENTRYPOINT ["node", "server.js"]
