#!/usr/bin/env bash
# Установка или обновление сайта документации на сервере bx-shef (как он поставлен 2026-11-27).
#
# Сервер: обычный nginx в контейнере `proxy` (папка /home/bitrix/b24-proxy, сеть proxy-net),
# все сайты — в одном conf.d/default.conf, сертификаты — certbot (webroot) → том b24-ui_certs,
# продление — renew-certs.sh по крону (понедельник 04:17) по списку DOMAINS.
#
# Скрипт идемпотентен: повторный запуск ничего не ломает и не дублирует.
#   1. папка /home/bitrix/b24-js-sdk-docs: docker-compose.prod.yml из main и .env (спросит ключ DeepSeek);
#   2. контейнер b24-js-sdk-docs в proxy-net (образ ghcr.io/bx-shef/b24-js-sdk-docs:latest);
#   3. блок :80 в default.conf (проверка Let's Encrypt) и сертификат certbot;
#   4. блок :443 (proxy_buffering off — ответы чата идут потоком); nginx не принял — прежний конфиг;
#   5. домен — в DOMAINS скрипта продления;
#   6. проверка снаружи — с самого сервера свой внешний адрес может не открываться (это не ошибка).
# Перед правкой default.conf кладёт копию в /home/bitrix/b24-proxy/.backup-default.conf.<дата>.
#
# Запуск: bash install-server.sh   (от пользователя bitrix, с доступом к docker)
set -euo pipefail
D=${DOMAIN:-b24-js-sdk.bx-shef.by}
NAME=b24-js-sdk-docs
DIR=/home/bitrix/b24-js-sdk-docs
P=/home/bitrix/b24-proxy
CONF=$P/conf.d/default.conf
RAW=https://raw.githubusercontent.com/bx-shef/b24-js-sdk/main/deploy/docker-compose.prod.yml

echo "== 1. Настройки сайта ($DIR)"
mkdir -p "$DIR" && cd "$DIR"
curl -fsSLo docker-compose.prod.yml "$RAW"
if [ ! -f .env ]; then
  printf 'Ключ DeepSeek (Enter — без чата): '; read -rs KEY < /dev/tty; echo
  printf 'DOMAIN=%s\nASSISTANT_ENABLED=%s\nASSISTANT_RATE_PER_MINUTE=20\nASSISTANT_DAILY_LIMIT=2000\nDEEPSEEK_API_KEY=%s\n' \
    "$D" "$([ -n "$KEY" ] && echo true || echo false)" "$KEY" > .env
  chmod 600 .env
fi

echo "== 2. Запуск"
docker compose -f docker-compose.prod.yml pull -q
docker compose -f docker-compose.prod.yml up -d
for _ in $(seq 1 60); do docker exec proxy wget -qO /dev/null "http://$NAME:3000/" 2>/dev/null && break; sleep 2; done
docker exec proxy wget -qO /dev/null "http://$NAME:3000/" && echo "сайт отвечает в proxy-net"

cp "$CONF" "$P/.backup-default.conf.$(date +%F-%H%M)"
reload() { docker exec proxy nginx -t && docker exec proxy nginx -s reload; }

echo "== 3. Сертификат"
if ! grep -q "server_name $D;" "$CONF"; then
  cat >> "$CONF" <<EOF

# $D -> $NAME:3000
server {
    server_name $D;
    access_log /var/log/nginx/access.log vhost;
    listen 80;
    location ^~ /.well-known/acme-challenge/ {
        allow all;
        root /usr/share/nginx/html;
        try_files \$uri =404;
    }
    location / {
        return 301 https://\$host\$request_uri;
    }
}
EOF
  reload
fi
if ! docker run --rm -v b24-ui_certs:/c alpine test -f "/c/$D.crt"; then
  docker run --rm -v b24_letsencrypt:/etc/letsencrypt -v b24-ui_html:/usr/share/nginx/html certbot/certbot \
    certonly --webroot -w /usr/share/nginx/html -d "$D" --non-interactive --agree-tos --register-unsafely-without-email --cert-name "$D" 2>&1 | tail -2
  docker run --rm -v b24_letsencrypt:/le:ro -v b24-ui_certs:/certs alpine sh -c \
    "cp /le/live/$D/fullchain.pem /certs/$D.crt && cp /le/live/$D/privkey.pem /certs/$D.key && cp /le/live/$D/chain.pem /certs/$D.chain.pem && cp /certs/cowork.bx-shef.by.dhparam.pem /certs/$D.dhparam.pem"
fi

echo "== 4. HTTPS"
if ! grep -q "ssl_certificate /etc/nginx/certs/$D.crt;" "$CONF"; then
  BACKUP=$(mktemp); cp "$CONF" "$BACKUP"
  cat >> "$CONF" <<EOF
server {
    server_name $D;
    access_log /var/log/nginx/access.log vhost;
    listen 443 ssl;
    ssl_session_timeout 5m;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    ssl_certificate /etc/nginx/certs/$D.crt;
    ssl_certificate_key /etc/nginx/certs/$D.key;
    ssl_dhparam /etc/nginx/certs/$D.dhparam.pem;
    add_header Strict-Transport-Security "max-age=31536000" always;
    location / {
        set \$up "$NAME:3000";
        proxy_pass http://\$up;
        proxy_buffering off;
        proxy_read_timeout 300s;
    }
}
EOF
  reload || { cp "$BACKUP" "$CONF"; reload; echo "!! nginx не принял конфиг — вернул прежний"; exit 1; }
fi

echo "== 5. Продление сертификата"
short=${D%.bx-shef.by}
grep -q " $short " "$P/renew-certs.sh" || sed -i "s/^DOMAINS=\"/DOMAINS=\"$short /" "$P/renew-certs.sh"
grep '^DOMAINS=' "$P/renew-certs.sh"

echo "== 6. Готово. Проверьте снаружи: https://$D/ , https://$D/llms.txt (200), https://$D/mcp/ (405 на GET — нормально)."
