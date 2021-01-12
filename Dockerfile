FROM node:14

WORKDIR /webapp

COPY package*.json ./

RUN npm install pm2 -g

RUN npm install

COPY . .

EXPOSE 3030

CMD ["pm2-runtime", "process.yaml", "--only", "my-freetonleague"]