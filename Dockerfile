FROM node:20-bullseye

# Instalar dependências do sistema necessárias para o Remotion (Chromium + FFmpeg)
RUN apt-get update && apt-get install -y \
    chromium \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar arquivos de dependência
COPY package*.json ./

# Instalar dependências do projeto
RUN npm install

# Copiar o restante do código fonte
COPY . .

# Configurar variável de ambiente para o Puppeteer usar o Chromium instalado
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Expor a porta que o servidor Express usa
EXPOSE 3000

# Comando para iniciar o servidor
CMD ["node", "server.mjs"]
