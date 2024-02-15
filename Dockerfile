FROM node:18-alpine
RUN mkdir -p /app
WORKDIR /app
COPY . .
RUN apk add --update python3 make g++ && rm -rf /var/cache/apk/*
RUN npm install --legacy-peer-deps
# RUN npm run proto:install
RUN npm run build
EXPOSE 80
EXPOSE 5000
CMD ["npm", "start"]