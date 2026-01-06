FROM node:22-alpine as build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . ./

ENV PATH=/app/node_modules/.bin:$PATH

CMD ["npm", "start"]
