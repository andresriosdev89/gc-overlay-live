FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY . .

ENV HOST=0.0.0.0
ENV PORT=5173
EXPOSE 5173

CMD ["npm", "start"]
