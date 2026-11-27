#!/usr/bin/env bash
# Установка или обновление сайта документации на сервере bx-shef (как он поставлен 2026-11-27).
#
# Сервер: обычный nginx в контейнере `proxy` (папка /home/bitrix/b24-proxy, сеть proxy-net),
# все сайты — в одном conf.d/default.conf, сертификаты — certbot (webroot) → том b24-ui_certs,
# продление — renew-certs.sh по крону (понедельник 04:17) по списку DOMAINS.
#
# Скрипт идемпотентен: повторный запуск ничего не ломает и не дублирует, а недоделанное доделывает.
#   1. папка /home/bitrix/b24-js-sdk-docs: docker-compose.prod.yml из main и .env (спросит ключ DeepSeek);
#   2. контейнер b24-js-sdk-docs в proxy-net (образ ghcr.io/bx-shef/b24-js-sdk-docs:latest);
#   3. блок :80 в default.conf (проверка Let's Encrypt) и сертификат certbot;
#   4. блок :443 (proxy_buffering off — ответы чата идут потоком);
#   5. домен — в DOMAINS скрипта продления (с проверкой, что добавился);
#   6. проверка снаружи — с самого сервера свой внешний адрес может не открываться (это не ошибка).
# Перед первой правкой default.conf кладёт копию в /home/bitrix/b24-proxy/.backup-default.conf.<время>
# и при любом сбое дальше возвращает её; renew-certs.sh — тоже с копией.
#
# Запуск: bash install-server.sh   (от пользователя bitrix, с доступом к docker)
set -Eeuo pipefail
D=${DOMAIN:-b24-js-sdk.bx-shef.by}
[[ $D =~ ^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$ ]] || { echo "!! недопустимый DOMAIN: $D"; exit 1; }
NAME=b24-js-sdk-docs
DIR=/home/bitrix/b24-js-sdk-docs
P=/home/bitrix/b24-proxy
CONF=$P/conf.d/default.conf
RENEW=$P/renew-certs.sh
RAW=https://raw.githubusercontent.com/bx-shef/b24-js-sdk/main/deploy/docker-compose.prod.yml
STAMP=$(date +%F-%H%M%S)

for v in b24-ui_certs b24_letsencrypt b24-ui_html; do
  docker volume inspect "$v" >/dev/null 2>&1 || { echo "!! нет тома $v — это не тот сервер или прокси устроен иначе"; exit 1; }
done
docker inspect proxy >/dev/null 2>&1 || { echo "!! нет контейнера proxy"; exit 1; }

reload() { docker exec proxy nginx -t && docker exec proxy nginx -s reload; }
# Общий конфиг nginx: копия перед первой правкой; при любом сбое дальше — вернуть её. Иначе следующий
# reload чужого деплоя или продления сертификатов упадёт на нашем блоке и заденет все сайты.
CONF_BACKUP=""
edit_conf() {
  if [ -z "$CONF_BACKUP" ]; then CONF_BACKUP="$P/.backup-default.conf.$STAMP"; cp "$CONF" "$CONF_BACKUP"; fi
  cat >> "$CONF"
}
rollback() {
  if [ -n "$CONF_BACKUP" ] && ! cmp -s "$CONF" "$CONF_BACKUP"; then
    cp "$CONF_BACKUP" "$CONF"
    docker exec proxy nginx -s reload || true
    echo "!! сбой — default.conf возвращён к $CONF_BACKUP"
  fi
}
trap 'rc=$?; [ "$rc" -eq 0 ] || rollback' EXIT

echo "== 1. Настройки сайта ($DIR)"
mkdir -p "$DIR" && cd "$DIR"
curl -fsSLo docker-compose.prod.yml "$RAW"
if [ ! -f .env ]; then
  printf 'Ключ DeepSeek (Enter — без чата): '; read -rs KEY < /dev/tty; echo
  ( umask 077
    printf 'DOMAIN=%s\nASSISTANT_ENABLED=%s\nASSISTANT_RATE_PER_MINUTE=20\nASSISTANT_DAILY_LIMIT=2000\nDEEPSEEK_API_KEY=%s\n' \
      "$D" "$([ -n "$KEY" ] && echo true || echo false)" "$KEY" > .env )
fi

echo "== 2. Запуск"
docker compose -f docker-compose.prod.yml pull -q
docker compose -f docker-compose.prod.yml up -d
for _ in $(seq 1 60); do docker exec proxy wget -qO /dev/null "http://$NAME:3000/" 2>/dev/null && break; sleep 2; done
docker exec proxy wget -qO /dev/null "http://$NAME:3000/" || { echo "!! прокси не достучался до $NAME:3000 — docker logs $NAME"; exit 1; }
echo "сайт отвечает в proxy-net"

echo "== 3. Сертификат"
if ! grep -qF "server_name $D;" "$CONF"; then
  edit_conf <<EOF

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
certs_ok() { docker run --rm -v b24-ui_certs:/c alpine sh -c "for e in crt key chain.pem dhparam.pem; do test -s /c/$D.\$e || exit 1; done"; }
if ! certs_ok; then
  if ! docker run --rm -v b24_letsencrypt:/le alpine test -s "/le/live/$D/fullchain.pem"; then
    LOG="$DIR/certbot.log"
    docker run --rm -v b24_letsencrypt:/etc/letsencrypt -v b24-ui_html:/usr/share/nginx/html certbot/certbot \
      certonly --webroot -w /usr/share/nginx/html -d "$D" --non-interactive --agree-tos --register-unsafely-without-email --cert-name "$D" \
      >"$LOG" 2>&1 || { cat "$LOG"; echo "!! certbot не выпустил сертификат (DNS домена смотрит на этот сервер?)"; exit 1; }
    tail -2 "$LOG"
  fi
  # dhparam: копия соседнего сайта, а если такого нет — новый (минута-другая).
  docker run --rm -v b24_letsencrypt:/le:ro -v b24-ui_certs:/certs alpine sh -c "
    cp /le/live/$D/fullchain.pem /certs/$D.crt && cp /le/live/$D/privkey.pem /certs/$D.key && cp /le/live/$D/chain.pem /certs/$D.chain.pem &&
    if [ ! -s /certs/$D.dhparam.pem ]; then
      src=\$(ls /certs/*.dhparam.pem 2>/dev/null | head -1)
      if [ -n \"\$src\" ]; then cp \"\$src\" /certs/$D.dhparam.pem; else apk add -q openssl && openssl dhparam -out /certs/$D.dhparam.pem 2048; fi
    fi"
  certs_ok || { echo "!! файлы сертификата неполные в томе b24-ui_certs"; exit 1; }
fi

echo "== 4. HTTPS"
if ! grep -qF "ssl_certificate /etc/nginx/certs/$D.crt;" "$CONF"; then
  edit_conf <<EOF

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
  reload
fi
grep -q '^resolver ' "$CONF" || echo "!! в default.conf нет resolver — proxy_pass с переменной ответит 502"

echo "== 5. Продление сертификата"
short=${D%.bx-shef.by}
in_list() { grep -qE "^DOMAINS=\"([^\"]* )?$short( [^\"]*)?\"" "$RENEW"; }
if ! in_list; then
  cp "$RENEW" "$P/.backup-renew-certs.sh.$STAMP"
  sed -i "s/^DOMAINS=\"/DOMAINS=\"$short /" "$RENEW"
  in_list || { echo "!! не удалось добавить $short в DOMAINS в $RENEW — добавьте вручную"; exit 1; }
fi
grep '^DOMAINS=' "$RENEW"

echo "== 6. Готово. Проверьте снаружи: https://$D/ , https://$D/llms.txt (200), https://$D/mcp/ (405 на GET — нормально)."
echo "   С самого сервера его внешний адрес может не открываться (curl даёт 000) — это не ошибка."
