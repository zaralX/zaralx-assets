FROM node:18.20.2-alpine3.18 as build

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . ./

ENV PATH=/app/node_modules/.bin:$PATH

CMD ["npm", "start"]
