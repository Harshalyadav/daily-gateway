FROM node:16-alpine
RUN apk add g++ make python3

EXPOSE 3000

RUN mkdir -p /opt/app
WORKDIR /opt/app

RUN \
  apk --no-cache add \
  libc6-compat

COPY package.json .
COPY yarn.lock .

RUN yarn install --prod

COPY build .

CMD ["yarn", "start"]
