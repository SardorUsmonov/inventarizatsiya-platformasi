const defaultDepartments = [
  {
    code: "ENG",
    description: "Asosiy mahsulot va ichki platformalarni ishlab chiqadigan muhandislar jamoasi.",
    name: "Software Engineering",
  },
  {
    code: "FE",
    description: "Veb interfeyslar, admin panel va mijoz tomonidagi tajribani ishlab chiqadi.",
    name: "Frontend Development",
  },
  {
    code: "BE",
    description: "API, integratsiya, ma'lumotlar bazasi va biznes logikasini yuritadi.",
    name: "Backend Development",
  },
  {
    code: "MOB",
    description: "iOS va Android ilovalarini ishlab chiqish hamda qo'llab-quvvatlash jamoasi.",
    name: "Mobile Development",
  },
  {
    code: "QA",
    description: "Qo'lda va avtomatlashtirilgan testlar orqali sifat nazoratini yuritadi.",
    name: "QA & Test Automation",
  },
  {
    code: "SRE",
    description: "Deploy, monitoring, CI/CD va ishlab chiqarish muhitining barqarorligi uchun javobgar.",
    name: "DevOps & SRE",
  },
  {
    code: "PROD",
    description: "Mahsulot strategiyasi, backlog va release rejalashtirishni boshqaradi.",
    name: "Product Management",
  },
  {
    code: "PMO",
    description: "Muddatlar, resurslar va loyihalar kesimidagi koordinatsiyani olib boradi.",
    name: "Project Management",
  },
  {
    code: "UX",
    description: "Foydalanuvchi tadqiqoti, interfeys dizayni va prototiplash bilan shug'ullanadi.",
    name: "UI/UX Design",
  },
  {
    code: "DATA",
    description: "Hisobotlar, BI, analitika va data pipeline larni yuritadi.",
    name: "Data & Analytics",
  },
  {
    code: "SEC",
    description: "Axborot xavfsizligi, access siyosati va xavf tahlilini yuritadi.",
    name: "Cybersecurity",
  },
  {
    code: "SUP",
    description: "Xodimlar uchun texnik yordam, sozlash va tezkor incident ishlari.",
    name: "IT Support",
  },
  {
    code: "NET",
    description: "Ofis tarmog'i, Wi-Fi, VPN va infratuzilma uskunalarini boshqaradi.",
    name: "Infrastructure & Network",
  },
  {
    code: "HR",
    description: "Ishga qabul qilish, onboarding va ichki people ops jarayonlari.",
    name: "HR & People Ops",
  },
  {
    code: "FIN",
    description: "Byudjet, xarajatlar, kontrakt va buxgalteriya jarayonlarini boshqaradi.",
    name: "Finance & Accounting",
  },
  {
    code: "SALES",
    description: "B2B/B2C savdo, lead bilan ishlash va tijorat takliflarini yuritadi.",
    name: "Sales",
  },
  {
    code: "MKT",
    description: "Kontent, performance marketing va brend kommunikatsiyalarini boshqaradi.",
    name: "Marketing",
  },
  {
    code: "CS",
    description: "Mijozlarni onboarding qilish va ularga kundalik yordam ko'rsatish jamoasi.",
    name: "Customer Success",
  },
];

const defaultDevices = [
  {
    category: "Laptop",
    description: "Windows asosidagi ishlab chiqish va ofis vazifalari uchun ishchi noutbuk.",
    model: "Latitude 7440",
    name: "Dell Latitude 7440",
  },
  {
    category: "Laptop",
    description: "Korporativ ishlatish uchun ishonchli Lenovo ishchi noutbuki.",
    model: "ThinkPad T14 Gen 4",
    name: "Lenovo ThinkPad T14 Gen 4",
  },
  {
    category: "Laptop",
    description: "Dasturchi va dizaynerlar uchun kuchli macOS ishchi qurilmasi.",
    model: 'MacBook Pro 14" M3',
    name: 'Apple MacBook Pro 14"',
  },
  {
    category: "Laptop",
    description: "Harakatdagi xodimlar uchun yengil va energiya tejamkor noutbuk.",
    model: 'MacBook Air 13" M2',
    name: 'Apple MacBook Air 13"',
  },
  {
    category: "Monitor",
    description: "Ofis va dizayn ishlariga mos 27 dyuymli 4K monitor.",
    model: "UltraSharp U2723QE",
    name: "Dell UltraSharp U2723QE",
  },
  {
    category: "Monitor",
    description: "USB-C bilan qulay ulanadigan universal ishchi monitor.",
    model: "27UP850-W",
    name: "LG 27UP850-W",
  },
  {
    category: "Docking Station",
    description: "Noutbukni monitor, LAN va periferiya bilan tez ulash uchun dok stansiya.",
    model: "WD22TB4",
    name: "Dell WD22TB4 Dock",
  },
  {
    category: "Keyboard",
    description: "Ko'p qurilma bilan ishlaydigan premium simsiz klaviatura.",
    model: "MX Keys S",
    name: "Logitech MX Keys S",
  },
  {
    category: "Mouse",
    description: "Analitika, dizayn va kundalik ish uchun ergonomik sichqoncha.",
    model: "MX Master 3S",
    name: "Logitech MX Master 3S",
  },
  {
    category: "Keyboard",
    description: "Mac ekotizimi bilan ishlovchi jamoalar uchun ixcham klaviatura.",
    model: "Magic Keyboard",
    name: "Apple Magic Keyboard",
  },
  {
    category: "Mouse",
    description: "Mac foydalanuvchilari uchun simsiz sichqoncha.",
    model: "Magic Mouse",
    name: "Apple Magic Mouse",
  },
  {
    category: "Headset",
    description: "Call, meeting va remote ish uchun professional headset.",
    model: "Evolve2 65",
    name: "Jabra Evolve2 65",
  },
  {
    category: "Headset",
    description: "Shovqinni kamaytiruvchi ofis va call-center headset.",
    model: "Voyager Focus 2",
    name: "Poly Voyager Focus 2",
  },
  {
    category: "Webcam",
    description: "Meeting room va remote qo'ng'iroqlar uchun 4K kamera.",
    model: "Brio 4K",
    name: "Logitech Brio 4K",
  },
  {
    category: "Smartphone",
    description: "Test, MDM va korporativ aloqa uchun iOS qurilma.",
    model: "iPhone 15",
    name: "Apple iPhone 15",
  },
  {
    category: "Smartphone",
    description: "Android build va mobil test jarayonlari uchun flagman telefon.",
    model: "Galaxy S24",
    name: "Samsung Galaxy S24",
  },
  {
    category: "Tablet",
    description: "Demo, prezentatsiya va mobil UX tekshiruvi uchun planshet.",
    model: 'iPad 10th Gen',
    name: "Apple iPad 10th Gen",
  },
  {
    category: "Network",
    description: "Ofis Wi-Fi tarmog'i uchun korporativ access point.",
    model: "MR36",
    name: "Cisco Meraki MR36",
  },
  {
    category: "Network",
    description: "Kichik va o'rta ofislar uchun barqaror access point.",
    model: "UniFi U6 Pro",
    name: "Ubiquiti UniFi U6 Pro",
  },
  {
    category: "Power",
    description: "Server va tarmoq uskunalari uchun zaxira quvvat manbai.",
    model: "Smart-UPS 1500",
    name: "APC Smart-UPS 1500",
  },
  {
    category: "Printer",
    description: "Kontrakt, hisob-faktura va ofis hujjatlari uchun lazer printer.",
    model: "LaserJet Pro M404dn",
    name: "HP LaserJet Pro M404dn",
  },
  {
    category: "Furniture",
    description: "Xodim ish joyiga biriktiriladigan ofis stoli.",
    model: "Office Desk",
    name: "Ofis stoli",
  },
  {
    category: "Furniture",
    description: "Xodimga biriktiriladigan ergonomik ofis stuli.",
    model: "Ergonomic Chair",
    name: "Ofis stuli",
  },
  {
    category: "Furniture",
    description: "Hujjat va jihozlarni saqlash uchun ofis shkafi.",
    model: "Storage Cabinet",
    name: "Ofis shkafi",
  },
  {
    category: "Furniture",
    description: "Ish joyi yonida ishlatiladigan tumba yoki kichik saqlash jihozi.",
    model: "Pedestal",
    name: "Ofis tumbasi",
  },
];

module.exports = {
  defaultDepartments,
  defaultDevices,
};
