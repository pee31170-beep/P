# ต้นทุนพลังงาน ICE vs EV 2569

เว็บแอปเปรียบเทียบต้นทุนพลังงานต่อกิโลเมตรระหว่างรถสันดาปกับรถไฟฟ้า ปี 2569
(แปลงมาจากแดชบอร์ด Claude Artifact)

- ปรับอัตราสิ้นเปลืองรถสันดาป (กม./ลิตร), รถไฟฟ้า (kWh/100 กม.) และระยะทางต่อปี แล้วทุกตัวเลข กราฟ และตารางคำนวณใหม่ทันที
- จำค่าที่ตั้งไว้ในเครื่อง และแชร์ลิงก์พร้อมค่าได้ (`?ice=14&ev=12.8&km=20000`)
- ติดตั้งเป็นแอปบนมือถือ/เดสก์ท็อปได้ (PWA) และใช้งานแบบออฟไลน์ได้
- รองรับธีมสว่าง/มืด

## รันในเครื่อง

เป็นไฟล์ static ล้วน ไม่ต้อง build:

```sh
python3 -m http.server 8000
# เปิด http://localhost:8000
```

(ต้องเปิดผ่าน HTTP server เพราะเบราว์เซอร์ไม่ให้โหลดไฟล์ CSV ผ่าน `file://`)

## Deploy

มี workflow `.github/workflows/pages.yml` สำหรับ GitHub Pages: เปิด Settings → Pages → Source: **GitHub Actions**
แล้ว push เข้า `main` หรือจะวางโฟลเดอร์นี้บน static host ใดก็ได้ (Netlify, Vercel, Cloudflare Pages)

## โครงสร้าง

| ไฟล์ | หน้าที่ |
| --- | --- |
| `index.html` | โครงหน้า |
| `styles.css` | สไตล์และธีมสว่าง/มืด |
| `app.js` | โหลด CSV, คำนวณ, วาดกราฟด้วย d3 |
| `data/*.csv` | ข้อมูลราคาน้ำมัน ค่าไฟ ค่าชาร์จ และข้อสมมติ |
| `sw.js`, `manifest.webmanifest`, `icons/` | PWA / ออฟไลน์ |
| `vendor/d3.v7.9.0.min.js` | d3 v7.9.0 (ISC license, `vendor/d3-LICENSE`) |

## อัปเดตข้อมูล

แก้ไฟล์ใน `data/` (เช่นเพิ่มแถวใน `fuel_prices_2569.csv`, แก้ `fuel_today.csv` และ `as_of` ใน `assumptions.csv`)
แล้วเพิ่มเลข `VERSION` ใน `sw.js` เพื่อให้แคชออฟไลน์รีเฟรช

## แหล่งข้อมูล

- ราคาน้ำมันขายปลีก กทม. ปี 2569: บางจาก (ราคาย้อนหลัง)
- ราคาน้ำมันวันนี้ 26 ต.ค. 2569: ไทยรัฐ, PPTV
- ค่าไฟบ้าน: ประกาศ MEA/PEA/กกพ. (บิล ก.ย. 2569), Ft ก.ย.–ธ.ค. 2569
- ค่าชาร์จสาธารณะ: PEA VOLTA, EV Station PluZ, EA Anywhere, MEA EV, EleX by EGAT, Tesla Supercharger
