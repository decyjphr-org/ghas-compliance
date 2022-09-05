FROM node:16-slim
WORKDIR /usr/src/app
COPY package.json package-lock.json ./
RUN npm ci --production
RUN npm cache clean --force
ENV NODE_ENV="production"
COPY . .
## This app will listen on port 3000
EXPOSE 3000
CMD [ "npm", "start" ]
