# syntax=docker/dockerfile:1
FROM node:alpine

RUN npm install -g pnpm

COPY package.json .
COPY pnpm-lock.yaml .

RUN pnpm install

COPY src ./src
COPY tsconfig.json ./
COPY node_modules ./node_modules

EXPOSE 3000
CMD pnpm run dev