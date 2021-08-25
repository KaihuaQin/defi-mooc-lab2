FROM node:14

WORKDIR /lab2

COPY . .

RUN npm install