# QR nazorati bo'yicha qo'llanma

Bu qo'llanma jihozlarga QR yopishtirish va direktor/tekshiruvchi tomonidan skan qilib nazorat qilish tartibini tushuntiradi.

## Muhim tushuncha

QR kod alohida qo'lda yaratilmaydi. Saytda har bir inventar yozuvi uchun QR avtomatik yaratiladi.

Ya'ni:

1. Jihoz saytda ro'yxatga olinadi.
2. Sayt shu jihoz uchun QR beradi.
3. QR chop etilib jihozga yopishtiriladi.
4. Direktor yoki tekshiruvchi telefon kamerasi bilan QR'ni skan qiladi.
5. Saytda shu jihoz pasporti ochiladi.

## QR qayerdan olinadi?

1. Saytga login qiling.
2. `Inventar` bo'limiga o'ting.
3. `Ro'yxat / nazorat` oynasida kerakli jihozni toping.
4. Qatordagi `QR` tugmasini bosing yoki jihoz qatorini oching.
5. Agar qator ochilsa, pastda yoki yon tomonda `Aktiv pasporti` va `QR kartasi` oynasi ochiladi.
6. `QR kartasi` ichida QR rasmi ko'rinadi.
7. `QR ni ochish` tugmasini bosing.
8. Ochilgan QR sahifasini printerdan chiqaring yoki rasm sifatida saqlang.

## Avval qo'shilgan aktivlar uchun QR

Avvaldan bazada bor aktivlarga alohida qo'lda QR yaratish shart emas. Sayt har bir saqlangan aktiv ID'si bo'yicha QR'ni avtomatik beradi.

1. `Inventar` bo'limiga o'ting.
2. `Ro'yxat / nazorat` oynasida eski aktivni toping.
3. Qatordagi `QR` tugmasini bosing.
4. QR ochiladi va uni chop etish mumkin.

Bir nechta eski aktiv uchun birdan QR label chiqarish:

1. `Inventar` bo'limida kerakli filtr yoki qidiruvni qo'llang.
2. `QR label chop etish` tugmasini bosing.
3. Ochilgan sahifada shu filtrga mos aktivlarning QR label'lari chiqadi.
4. Brauzerning Print oynasi orqali label'larni chop eting.

## Yangi jihoz uchun QR olish

1. `Inventar` bo'limiga o'ting.
2. `Yangi inventar` oynasini oching.
3. Jihoz ma'lumotlarini kiriting:
   - xodim ismi va familyasi
   - bo'lim
   - hozir kimga biriktirilgani
   - jihoz turi
   - aktiv tegi
   - serial raqam
   - joylashuv
   - status
4. `Saqlash va QRni ochish` tugmasini bosing.
5. Saqlangandan keyin sayt shu jihoz detal oynasini avtomatik ochadi.
6. `QR kartasi` avtomatik ko'rinadi.

## QR'ni jihozga yopishtirish tartibi

1. QR'ni printerdan chiqaring.
2. QR yoniga kamida aktiv tegi yozib qo'ying.

Tavsiya etilgan label ko'rinishi:

```text
INVENTAR
Asset tag: NB-024
Jihoz: HP ProBook
QR kod
```

3. Labelni jihozning ko'rinadigan, lekin oson yirtilmaydigan joyiga yopishtiring.
4. Noutbuklarda: pastki qopqoq yoki klaviatura yonidagi bo'sh joy.
5. Monitorlarda: orqa tomon.
6. Printerlarda: old yoki yon qismi.
7. Mebellarda: ichki yoki pastki ko'rinadigan qism.

## Direktor qanday skan qiladi?

1. Direktor telefon kamerasini ochadi.
2. Jihozdagi QR kodni skan qiladi.
3. Sayt ochiladi.
4. Agar login qilmagan bo'lsa, avval login sahifasi chiqadi.
5. Login qilingandan keyin shu jihoz pasporti ochiladi.

Direktor ko'radigan ma'lumotlar:

- jihoz nomi
- aktiv tegi
- serial raqam
- kimga biriktirilgan
- qaysi bo'limda
- qaysi xona yoki joylashuvda
- statusi
- texnik holati
- transfer tarixi
- servis tarixi
- attachment/fayllar
- oxirgi QR skan vaqti

## QR skan nazorati dashboardda qayerda?

1. Saytga direktor/admin login qiladi.
2. `Dashboard` bo'limini ochadi.
3. `QR nazorati` yoki `Direktor uchun skan monitoringi` panelini ko'radi.

Bu panelda quyidagilar chiqadi:

- `QR tayyor`: tizimdagi jami jihozlar soni
- `Bugungi skanlar`: bugun QR orqali ochilgan jihozlar soni
- `Skan qamrovi`: kamida bir marta skan qilingan jihozlar ulushi
- `Oxirgi skan`: eng so'nggi QR skan vaqti
- `Oxirgi QR skanlar`: kim, qachon, qaysi jihozni skan qilgani
- `Hali skan qilinmaganlar`: hali QR orqali tekshirilmagan jihozlar

Dashboard har 30 soniyada avtomatik yangilanadi.

## Rollar bo'yicha ishlash

Direktor uchun eng qulay variant:

- direktorga `admin` yoki kamida `viewer` huquqi beriladi
- `admin`: ko'radi va o'zgartira oladi
- `manager`: tekshiradi, transfer/servis ishlarini yuritadi
- `viewer`: faqat ko'radi

Oddiy xodimlarga login berish shart emas. Agar kerak bo'lsa, keyingi bosqichda faqat o'ziga biriktirilgan jihozlarni ko'radigan rol qo'shish mumkin.

## Amaliy tekshiruv jarayoni

1. Direktor yoki tekshiruvchi xonaga kiradi.
2. Jihozdagi QR'ni skan qiladi.
3. Sayt jihoz pasportini ochadi.
4. Ma'lumot joyida tekshiriladi:
   - xodim to'g'rimi
   - bo'lim to'g'rimi
   - xona to'g'rimi
   - status to'g'rimi
5. Agar jihoz boshqa odamda bo'lsa, `Transfer` orqali yangilanadi.
6. Agar ta'mirda bo'lsa, servis yozuvi qo'shiladi.
7. Dashboardda skan tarixi saqlanadi.

## Eng sodda kundalik oqim

1. Yangi jihoz keldi.
2. Admin uni saytga qo'shdi.
3. QR avtomatik paydo bo'ldi.
4. QR chop etildi.
5. QR jihozga yopishtirildi.
6. Direktor skan qilib kimga biriktirilganini ko'rdi.
7. Dashboardda skan nazorati ko'rindi.

## Eslatma

Bu imkoniyat live saytda ishlashi uchun kod deploy/restart qilingan bo'lishi kerak. Agar local kompyuterda tekshirilsa, avval server ishga tushiriladi:

```powershell
npm.cmd start
```

Keyin brauzerda ochiladi:

```text
http://localhost:3000
```
