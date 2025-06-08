# Imagem base com Node
FROM node:20-slim

# Instala dependências do Chromium
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libdrm2 \
    libgbm1 \
    libxshmfence1 \
    libxss1 \
    libxtst6 \
    chromium \
    --no-install-recommends && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# Cria diretório de app
WORKDIR /app

# Copia arquivos
COPY . .

# Instala dependências do Node
RUN npm install

# Expõe porta
EXPOSE 3000

# Inicia app
CMD ["node", "server.js"]
