# TBM Ring Planner

เว็บวางแผน Segment สำหรับ TBM1 (E/B) และ TBM2 (W/B) แยกข้อมูลริง แผน และแนวอุโมงค์ของแต่ละเครื่อง เปิดใช้งานที่ https://tbm-web-app.vercel.app/

## ฐานข้อมูล Google Sheets

- [TBM1 · E/B](https://docs.google.com/spreadsheets/d/1dyc2SDKhpUyxHdVFDx2RHTcdIbwEgX3hPkwR8v4amB8/edit): ประวัติ/แผนริงและข้อมูลตั้งค่าของ TBM1
- [TBM2 · W/B](https://docs.google.com/spreadsheets/d/1gTafcYxS_DFSDbxj56ypzvExAhhL3TdhOylGeRgjLdI/edit): ประวัติ/แผนริงและข้อมูลตั้งค่าของ TBM2

แต่ละไฟล์มีแท็บ `Records` (หนึ่งแถวต่อริง พร้อม JSON ฉบับเต็ม) และ `AppState` (แนวอุโมงค์ เซสชันการวางแผน ชนิด Segment ที่เปิดใช้ ชั้นดิน และค่าตั้งค่า) เว็บเก็บสำเนาในเบราว์เซอร์ไว้ใช้ขณะออฟไลน์ และส่งการเปลี่ยนแปลงขึ้นชีตหลังลงชื่อเข้าใช้ Google การลบใช้เครื่องหมายลบในคอลัมน์ `Deleted At` เพื่อไม่ให้รายการกลับมาเมื่อดึงข้อมูลอีกครั้ง

## เปิดใช้งานการซิงก์ในเว็บ

1. ใน Google Cloud Console เปิด **Google Sheets API** และตั้งค่า OAuth consent screen
2. สร้าง OAuth client ประเภท **Web application** เพิ่ม Authorized JavaScript origin `https://tbm-web-app.vercel.app` (สำหรับทดสอบในเครื่องเพิ่ม `http://127.0.0.1:5176`)
3. ใส่ Client ID ในเมนู **Google Sheets** ของเว็บ หรือกำหนด `VITE_GOOGLE_CLIENT_ID` ใน Vercel แล้ว deploy ใหม่
4. แชร์ Google Sheet ทั้งสองไฟล์ให้บัญชี Google ของผู้ใช้ที่ต้องแก้ไขข้อมูล ถ้า OAuth consent screen ยังอยู่ในโหมด Testing ให้เพิ่มบัญชีนั้นเป็น test user ด้วย
5. ลงชื่อเข้าใช้ Google ในเว็บ ชีตที่ว่างจะรับข้อมูลในเครื่องโดยอัตโนมัติ ถ้าชีตมีข้อมูลอยู่แล้วให้เลือก **อัปโหลดข้อมูลในเครื่อง** หรือ **ดึงข้อมูลจากชีต** ก่อนใช้งานร่วมกัน

เว็บไม่เก็บ OAuth access token ใน localStorage และไม่ใช้ service account key ในโค้ดหน้าเว็บ การเขียนลงชีตใช้สิทธิ์ของผู้ที่ลงชื่อเข้าใช้ และส่งข้อมูลแบบชุดเพื่อลดจำนวนคำขอ

## พัฒนาและทดสอบ

```bash
npm install
npm run dev -- --port 5176
npm test
npm run lint
npm run build
```

ค่าตัวอย่างของ environment อยู่ใน `.env.example` การ push ไป branch `main` ใช้ deployment ของ Vercel ที่ผูกไว้กับ repository
