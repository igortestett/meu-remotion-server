FROM node:18-bullseye

# Instala Chrome e FFmpeg (O Motor do Remotion)
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install \
    express \
    react \
    react-dom \
    remotion \
    @remotion/bundler \
    @remotion/renderer \
    @remotion/transitions \
    zod

COPY . .

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 3000
CMD ["node", "server.mjs"]
