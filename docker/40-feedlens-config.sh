#!/bin/sh
# Grava o config.json que o app lê ao subir (ver src/app/core/app-config.ts)
# a partir das variáveis de ambiente do contêiner. Roda a cada start.
set -eu

target=/usr/share/nginx/html/config.json

case "${USE_MOCK:-true}" in
  true|false) ;;
  *)
    echo "USE_MOCK deve ser 'true' ou 'false' (recebido: '${USE_MOCK}')." >&2
    exit 1
    ;;
esac

# Escapa barra invertida e aspas para o valor caber numa string JSON.
json_escape() {
  printf '%s' "$1" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

api_base_url="$(json_escape "${API_BASE_URL:-}")"
product_name="$(json_escape "${PRODUCT_NAME:-o nosso produto}")"

cat > "$target" <<EOF
{
  "apiBaseUrl": "${api_base_url}",
  "useMock": ${USE_MOCK:-true},
  "productName": "${product_name}"
}
EOF

echo "config.json gravado (useMock=${USE_MOCK:-true})."
