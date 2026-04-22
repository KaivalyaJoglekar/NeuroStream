FROM node:18-slim

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY . .

EXPOSE ${PORT:-8085}

CMD ["node", "src/index.js"]
