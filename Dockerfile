FROM node:18-bullseye

# Instala Chrome e FFmpeg (O Motor do Remotion)
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install
# Instala o express e o bundler que não vêm no template padrão
RUN npm install express @remotion/bundler @remotion/renderer

COPY . .

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

EXPOSE 3000
CMD ["node", "server.mjs"]
