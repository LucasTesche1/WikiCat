# WikiCat - Guia de Deploy (Intranet via Podman)

## 0. Pré-requisitos
- Servidor Linux com Podman 4.9+ e `podman-compose` (1.2+ recomendado)
- 4 GB RAM mínima (8 GB recomendada), 2+ vCPUs, SSD com 50 GB+ livres
- Portas 80 e 443 liberadas no firewall interno (ou custom, ajuste `podman-compose.yml`)

## 1. Preparação (uma vez)
```bash
cd /opt
git clone <url-do-repositorio> wikicat && cd wikicat
cp .env.example .env
# Edite .env: configure DB_PASSWORD, JWT_SECRET, COOKIE_SECRET, INIT_ADMIN_*
# Dica: JWT_SECRET e COOKIE_SECRET podem ser gerados com:
# openssl rand -hex 32
# openssl rand -base64 24
```

### 1.1 (Opcional, recomendado) Certificado da CA corporativa
Copie certificado + chave para a pasta `deploy/caddy/certs/`:
```bash
mkdir -p deploy/caddy/certs
cp /etc/pki/tls/wikicat.crt deploy/caddy/certs/tls.crt
cp /etc/pki/tls/private/wikicat.key deploy/caddy/certs/tls.key
chmod 600 deploy/caddy/certs/tls.key
```
Se ausentes, Caddy auto-gera certificado autoassinado (`tls internal`) para intranet.

## 2. Subir ambiente completo
```bash
# Build de imagem + containers (isso demora ~2-5 min na primeira vez)
podman-compose up -d --build

# Verificar saúde dos 3 containers (aguarde até todos ficarem healthy)
podman ps
watch -n 5 'podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"'
```

## 3. Aplicar migrations + seed do admin inicial
```bash
# Dentro do contêiner app:
podman exec -it wikicat-app bash
cd /app
pnpm --filter @wikicat/api db:migrate
# (opcional, futuro) seed de usuário admin a partir de INIT_ADMIN_EMAIL (T4)
exit
```

## 4. Verificar deploy
```bash
# Health endpoint
curl -k https://localhost/health
# Esperado: {"status":"ok","db":"ok",...}

# Acesso UI
# Navegador: https://<IP-ou-hostname-do-servidor>/
# Login inicial com INIT_ADMIN_EMAIL / INIT_ADMIN_PASSWORD
```

## 5. Backup diário (agendar via cron)
Crie `/usr/local/bin/wikicat-backup.sh` com 700:
```bash
#!/bin/bash
set -euo pipefail
DATE=$(date +%Y%m%d)
BACKUP_DIR="/var/backups/wikicat/${DATE}"
mkdir -p "$BACKUP_DIR"

# DB
podman exec -e PGPASSWORD=$(grep DB_PASSWORD /opt/wikicat/.env | cut -d= -f2) \
  wikicat-db pg_dump -U wikicat -d wikicat -Fp \
  > "$BACKUP_DIR/wikicat-db-${DATE}.sql"

# Attachments
podman volume export wikicat-attachments | gzip > "$BACKUP_DIR/wikicat-attachments-${DATE}.tar.gz"

# Retenção 30 dias
find /var/backups/wikicat -maxdepth 1 -mindepth 1 -type d -mtime +30 -exec rm -rf {} +
echo "Backup ${DATE} OK."
```
Cron (root):
```
15 2 * * * /usr/local/bin/wikicat-backup.sh >> /var/log/wikicat-backup.log 2>&1
```

## 6. Restauro de backup
```bash
cd /opt/wikicat
DATE=YYYYMMDD

# Apaga volumes existentes (CUIDADO!)
podman-compose down
podman volume rm wikicat-db-data wikicat-attachments || true

# Sobe apenas DB
podman volume create wikicat-db-data
podman volume create wikicat-attachments
podman-compose up -d db
sleep 20
podman exec -i wikicat-db psql -U wikicat -d wikicat \
  < "/var/backups/wikicat/${DATE}/wikicat-db-${DATE}.sql"

# Restaura attachments
podman volume import wikicat-attachments \
  "/var/backups/wikicat/${DATE}/wikicat-attachments-${DATE}.tar.gz"

# Sobe resto
podman-compose up -d
podman ps
```

## 7. Atualização para nova versão
```bash
cd /opt/wikicat
git pull
podman-compose build --no-cache app
podman-compose up -d
podman exec -it wikicat-app pnpm --filter @wikicat/api db:migrate
podman ps
```

## 8. Troubleshooting
- Contêiner unhealthy? Ver logs:
  ```bash
  podman logs -f wikicat-app
  podman logs -f wikicat-db
  podman logs -f wikicat-proxy
  ```
- Reset senha admin (T15):
  ```bash
  podman exec -it wikicat-app node apps/api/dist/scripts/reset-admin-password.js --email admin@corp --password NovaSenha123
  ```
- Não consigo acessar via navegador? Verifique firewall (`firewalld`/`ufw`) e selinux (RHEL-like pode precisar de `setsebool -P container_manage_cgroup on`).

## 9. Escalando recursos (opcional)
Edite `.env`:
```env
PG_SHARED_BUFFERS=1GB       # 25% da RAM dedicada ao Postgres
PG_EFFECTIVE_CACHE_SIZE=3GB # 75% da RAM
HTTP_PORT=8080
HTTPS_PORT=8443
```
Re-crie containers: `podman-compose up -d --force-recreate db`
