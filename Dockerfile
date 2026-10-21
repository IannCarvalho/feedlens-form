# Estágio 1: compila o Angular. Só o resultado estático segue para a imagem
# final; Node e node_modules ficam neste estágio.
# Node 24 (>= 24.15, o mínimo do projeto), a mesma linha do CI.
FROM node:24-slim AS build

WORKDIR /build

# Dependências primeiro, para aproveitar o cache de camadas
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build


# Estágio 2: nginx servindo o build como site estático.
FROM nginx:1.31-alpine

COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /build/dist/feedback-form/browser /usr/share/nginx/html

# O script roda a cada start do contêiner (convenção da imagem do nginx) e
# grava o config.json a partir de USE_MOCK, API_BASE_URL e PRODUCT_NAME.
COPY docker/40-feedlens-config.sh /docker-entrypoint.d/40-feedlens-config.sh
RUN chmod +x /docker-entrypoint.d/40-feedlens-config.sh

ENV USE_MOCK=true \
    API_BASE_URL="" \
    PRODUCT_NAME="o nosso produto"

EXPOSE 80

HEALTHCHECK --interval=15s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -q --spider http://127.0.0.1/healthz || exit 1
