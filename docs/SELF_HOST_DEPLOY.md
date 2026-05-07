# Self-host deploy

Bu yo'l saytni o'zingizning Linux serveringizda Docker orqali ishga tushiradi.
Ma'lumotlar `./data` papkasida saqlanadi, shuning uchun container qayta qurilsa ham SQLite, attachment va backup fayllari host diskda qoladi.

## Server talablari

- Ubuntu/Debian yoki boshqa Linux server
- Public IP
- `uninetworks.works` domeni A record orqali shu server IP manziliga ulangan bo'lishi
- 80 va 443 portlar ochiq bo'lishi
- Docker va Docker Compose plugin o'rnatilgan bo'lishi

## Birinchi deploy

```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin git
sudo systemctl enable --now docker
```

```bash
sudo mkdir -p /srv/inventory
sudo chown "$USER:$USER" /srv/inventory
cd /srv/inventory
git clone https://github.com/SardorUsmonov/inventarizatsiya-platformasi.git .
cp .env.production.example .env.production
nano .env.production
```

`.env.production` ichida `ADMIN_PASSWORD` ni real parol bilan almashtiring. Agar eski parol o'zgarmasligi kerak bo'lsa, Render'dagi maxfiy `ADMIN_PASSWORD` qiymatini shu yerga ko'chiring.
`AUTO_BACKUP_INTERVAL_MS=10800000` qiymati avtomatik backupni har 3 soatda ishga tushiradi.

```bash
mkdir -p data/attachments data/backups
docker compose -f docker-compose.server.yml up -d --build
```

## Domenni ulash

Cloudflare yoki domen DNS panelida quyidagilar bo'lishi kerak:

```text
@    A    SERVER_PUBLIC_IP
www  A    SERVER_PUBLIC_IP
```

Caddy container 80/443 portlarda avtomatik SSL sertifikat oladi.

## Tekshirish

```bash
docker compose -f docker-compose.server.yml ps
docker compose -f docker-compose.server.yml logs -f --tail=100
curl -I https://uninetworks.works/api/health
```

## Backup

Ilovaning ichki backup mexanizmi `data/backups` ichida backup saqlaydi. Server darajasida ham kamida har kuni `data` papkasini alohida joyga nusxalash tavsiya qilinadi.
Ichki avtomatik backup `AUTO_BACKUP_INTERVAL_MS=10800000` bilan har 3 soatda ishlaydi va `AUTO_BACKUP_KEEP_DAYS=30` bo'yicha eski nusxalarni tozalaydi.

Minimal cron namunasi:

```bash
sudo mkdir -p /srv/inventory-server-backups
crontab -e
```

```cron
15 3 * * * tar -czf /srv/inventory-server-backups/inventory-data-$(date +\%F).tar.gz -C /srv/inventory data
```

## Yangilash

```bash
cd /srv/inventory
git pull
docker compose -f docker-compose.server.yml up -d --build
```
