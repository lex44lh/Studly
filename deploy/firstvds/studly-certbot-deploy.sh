#!/bin/sh
# Certbot запускает этот hook после успешного обновления сертификата.
set -eu
/usr/sbin/nginx -t -q
/usr/bin/systemctl reload nginx
