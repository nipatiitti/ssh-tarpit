FROM node:14.17.0-alpine

WORKDIR /usr/src/app
COPY package.json .

RUN yarn install

ADD . /usr/src/app

CMD [ "yarn", "start" ]
EXPOSE 22