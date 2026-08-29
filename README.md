# TBM Ring Planner — Modern Web Edition

เวอร์ชันใหม่ของระบบวางแผน TBM Ring Segment ที่ย้ายจาก Google Apps Script (GAS) แบบเดิม มาเป็น **Modern Web App (React + Vite)** เพื่อประสิทธิภาพที่ดีขึ้น ดีไซน์ที่สวยงามกว่า และรองรับการทำ CI/CD ผ่าน GitHub

## 🏗️ โครงสร้างระบบใหม่
- **Frontend**: React (Vite) + Lucide Icons + Framer Motion (Hosting บน GitHub Pages)
- **Backend (API)**: Google Apps Script Web App (ทำหน้าที่เป็น Bridge เชื่อมต่อ Google Sheets)
- **Database**: Google Sheets (เหมือนเดิม เพื่อให้ทีมงานยังคงดูข้อมูลดิบได้สะดวก)

## 🚀 วิธีการตั้งค่าครั้งแรก

### 1. ฝั่ง Google Apps Script (Backend)
- นำโค้ดจาก `Code.gs` ในโฟลเดอร์โปรเจกต์ไปทับใน GAS Editor เดิม
- กดปุ่ม **Deploy** > **New Deployment**
- เลือกประเภทเป็น **Web App**
- ตั้งค่า:
  - **Execute as:** Me (ตัวคุณ)
  - **Who has access:** Anyone (เพื่อให้ GitHub App เรียก API ได้)
- กด **Deploy** และคัดลอก **Web App URL** ไว้

### 2. ฝั่ง Web App (Frontend)
- ไปที่ไฟล์ `src/services/api.js`
- นำ URL ที่คัดลอกมาใส่ในตัวแปร `GAS_URL`
- รันคำสั่งทดสอบในโฟลเดอร์ `tbm-web-app`:
  ```bash
  npm install
  npm run dev
  ```

## 🎨 จุดเด่นของเวอร์ชันนี้
- **Premium UI**: ใช้โทนสี Dark Mode แบบพรีเมียม (Cyan Accent) และ Glassmorphism
- **Interactive Diagram**: Ring Diagram แบบใหม่ เขียนด้วย SVG ให้ความคมชัดสูงและตอบสนองได้เร็วขึ้น
- **State Management**: ใช้ React Context ในการจัดการข้อมูลผู้ใช้และสิทธิ์การเข้าถึง (Admin/Worker/Survey)
- **Sidebar Navigation**: แยกเมนูการใช้งานชัดเจน (Dashboard, Planner, History)

## 📦 การนำขึ้น GitHub
- สร้าง Repository ใหม่ใน GitHub
- Push โค้ดในโฟลเดอร์ `tbm-web-app` ขึ้นไป
- ตั้งค่า **GitHub Pages** ให้ชี้ไปที่โฟลเดอร์ที่ Build แล้ว (แนะนำใช้ GitHub Actions เพื่อ Deploy อัตโนมัติ)

---
*MWA-9D TBM#34 Project Engineering Optimization*
