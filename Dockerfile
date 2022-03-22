# Build Image
FROM node:16-alpine as build

MAINTAINER Zibbp
LABEL description="Spotify to Deezer"

WORKDIR /opt/app

COPY package.json .

COPY yarn.lock .

RUN yarn install

COPY . .

# Final Image
FROM node:16-alpine

WORKDIR /opt/app

COPY --from=build /opt/app .

CMD ["node", "main.js"]