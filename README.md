# Inventarizatsiya Platformasi

Korxona moddiy bazasi uchun tayyorlangan boshqaruv tizimi:

- login va session autentifikatsiya
- foydalanuvchi rollari: `admin`, `manager`, `viewer`
- inventar CRUD
- bo'limlar katalogi
- texnikalar katalogi
- audit log
- Excel import/export va template yuklab olish
- SQLite baza
- Docker va Render deploy tayyorgarligi

## Lokal ishga tushirish

```powershell
npm.cmd install
npm.cmd start
```

Brauzerda `http://localhost:3000` ni oching.

## Dastlabki login

- Login: `admin`
- Parol: `Admin123!`

## Test

```powershell
npm.cmd test
```

## Sozlamalar

Kerak bo'lsa quyidagi environment variable larni o'zgartiring:

```powershell
$env:PORT="4000"
$env:ADMIN_USERNAME="superadmin"
$env:ADMIN_PASSWORD="KuchliParol123!"
$env:ADMIN_FULL_NAME="Bosh administrator"
$env:DATABASE_PATH="C:\\inventory\\inventory.sqlite"
npm.cmd start
```

## Rollar

- `admin`: barcha imkoniyatlar, user boshqaruvi va audit
- `manager`: inventar, katalog, Excel import/export va audit
- `viewer`: faqat ko'rish va eksport

## Online deploy

Loyiha uchun quyidagi fayllar qo'shilgan:

- `Dockerfile`
- `.dockerignore`
- `render.yaml`

`SQLite` ishlatilgani uchun online deployda persistent disk kerak bo'ladi. Render ishlatsangiz `render.yaml` tayyorlangan va `plan: starter` explicit ko'rsatilgan, chunki disk bilan ishlaydigan service pullik tier talab qiladi.

### GitHub + Render orqali bitta public link

1. GitHub'da yangi private repo yarating.
2. Loyihani git repo sifatida tayyorlang va push qiling:

```powershell
git init -b main
git add .
git commit -m "Prepare inventory platform for Render deploy"
git remote add origin https://github.com/<username>/<repo>.git
git push -u origin main
```

3. Render dashboard'da `New > Blueprint` ni tanlang.
4. GitHub accountingizni ulang va repo'ni tanlang.
5. Root'dagi `render.yaml` faylini ishlating.
6. Quyidagi secret env qiymatlarni kiriting:

```text
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<kuchli-parol>
```

7. Persistent disk `mountPath=/app/data`, `size=1 GB` bilan yaratilganini tasdiqlang.
8. Deploy tugagach public link quyidagi formatda bo'ladi:

```text
https://inventarizatsiya-platformasi.onrender.com
```

Agar service nomi band bo'lsa, Render boshqa nom bilan link beradi.

### Deploydan keyin smoke test

Public link chiqqandan keyin quyidagi buyruq bilan asosiy oqimni tekshirishingiz mumkin:

```powershell
$env:SMOKE_BASE_URL="https://inventarizatsiya-platformasi.onrender.com"
$env:SMOKE_USERNAME="admin"
$env:SMOKE_PASSWORD="<kuchli-parol>"
npm.cmd run smoke:url
```

## Doimiy saqlashni yoqish

Render free plan ma'lumotlarni doimiy saqlashni kafolatlamaydi. To'liq production holat uchun `starter + persistent disk` kerak.

1. Render billing sahifasida karta qo'shing:

```text
https://dashboard.render.com/billing
```

2. Keyin quyidagi buyruqni ishga tushiring:

```powershell
npm.cmd run render:persist
```

Bu skript quyidagini avtomatik bajaradi:

- live saytdan backup oladi
- service plan'ni `starter` ga o'tkazadi
- `/app/data` uchun `1 GB` disk yaratadi
- deploy qiladi
- backup'ni qayta tiklaydi
- restart qilib saqlanishni tekshiradi
