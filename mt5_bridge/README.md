# MT5 Bridge Server — Setup Guide

Server Windows ringan yang menghubungkan MetaTrader 5 ke backend Linux (Coolify) via HTTP REST API.

## Arsitektur

```
[Windows Lokal / Server]              [Linux - Coolify]
  MetaTrader 5 Terminal     ←────────   Backend FastAPI
  + mt5_bridge/app.py                    (polling tiap 10 detik)
  + ngrok tunnel ──────HTTP──────────→
```

---

## Prerequisites

- Windows 10/11 (64-bit)
- Python 3.11+ sudah terinstall ([download](https://www.python.org/downloads/)) — **pastikan centang "Add Python to PATH"**
- MetaTrader 5 sudah terinstall dan bisa login ke broker kamu
- [ngrok](https://ngrok.com/download) — untuk expose port lokal ke internet

---

## Setup (Pertama Kali)

### Step 1 — Clone repo

```cmd
git clone https://github.com/flincahyo/timejournalv2-updatedb.git
cd timejournalv2-updatedb\mt5_bridge
```

### Step 2 — Generate API Key

Buka Command Prompt dan jalankan:

```cmd
python -c "import secrets; print(secrets.token_urlsafe(24))"
```

Contoh output: `uJ9mK2xP8qRn5tL7wA3cB6dE`

**Simpan output ini** — akan dipakai di Step 3 DAN di Coolify nanti.

### Step 3 — Buat file `.env`

```cmd
copy .env.example .env
notepad .env
```

Edit isinya:
```env
MT5_BRIDGE_API_KEY=uJ9mK2xP8qRn5tL7wA3cB6dE   ← ganti dengan hasil Step 2
MT5_BRIDGE_HOST=0.0.0.0
MT5_BRIDGE_PORT=8765
```

Simpan dan tutup Notepad.

### Step 4 — Install dependencies

Double-click **`install.bat`** atau jalankan di CMD:

```cmd
install.bat
```

Tunggu sampai selesai. Semua package Python akan terinstall otomatis.

### Step 5 — Setup ngrok

1. Download ngrok dari [ngrok.com/download](https://ngrok.com/download)
2. Extract `ngrok.exe` ke folder `mt5_bridge\`
3. Daftar akun gratis di [dashboard.ngrok.com](https://dashboard.ngrok.com)
4. Salin authtoken dari dashboard, lalu jalankan:
   ```cmd
   ngrok config add-authtoken YOUR_TOKEN_DISINI
   ```

---

## Menjalankan Bridge (Setiap Kali)

1. **Pastikan MetaTrader 5 sudah berjalan** dan login ke akun broker kamu
2. Double-click **`run.bat`**

Akan muncul 2 jendela:
- **MT5 Bridge** — server HTTP di port 8765
- **ngrok tunnel** — public URL

### Cek di browser (opsional)
Buka: `http://localhost:8765/health`

Response yang benar:
```json
{
  "status": "ok",
  "mt5_available": true,
  "active_connections": 0
}
```

### Salin URL ngrok

Di jendela ngrok, cari baris seperti ini:
```
Forwarding  https://abc123.ngrok-free.app -> http://localhost:8765
```

Salin URL `https://abc123.ngrok-free.app` — ini URL yang akan dipakai di Coolify.

> ⚠️ **Penting:** URL ngrok berubah setiap kali `run.bat` dijalankan (pada akun gratis).
> Jika ingin URL permanen, upgrade ngrok ke plan berbayar atau gunakan domain sendiri.

---

## Setup Coolify

Di Coolify, buka **service backend** → **Environment Variables** → tambahkan:

| Variable | Value |
|---|---|
| `MT5_BRIDGE_URL` | `https://abc123.ngrok-free.app` |
| `MT5_BRIDGE_API_KEY` | `uJ9mK2xP8qRn5tL7wA3cB6dE` *(sama persis dengan di .env)* |

Lalu klik **Redeploy** backend.

> 💡 Build akan jauh lebih cepat dari sebelumnya karena Dockerfile sekarang pakai `python:3.11-slim` tanpa Wine.

---

## Setelah Semua Jalan

1. Buka aplikasi → Login
2. Pergi ke halaman koneksi MT5
3. Masukkan **login number**, **password**, dan **nama server** broker kamu
4. Klik **Connect**
5. Data trades dan posisi akan mulai ter-stream ✅

---

## Troubleshooting

| Masalah | Solusi |
|---|---|
| `mt5_available: false` | Install MetaTrader5: `pip install MetaTrader5` |
| `Connection refused` | Pastikan MT5 terminal sudah dibuka dan login |
| `401 Unauthorized` | Cek API key di `.env` dan Coolify harus sama persis |
| URL ngrok berubah | Update `MT5_BRIDGE_URL` di Coolify dan Redeploy |
| Port 8765 sudah dipakai | Ubah `MT5_BRIDGE_PORT` di `.env` |

---

## API Endpoints (Referensi)

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/health` | Cek status bridge (tanpa auth) |
| `POST` | `/connect` | Connect MT5 dengan credentials |
| `GET` | `/trades?user_id=X` | Semua history trades |
| `GET` | `/positions?user_id=X` | Live open positions |
| `GET` | `/account?user_id=X` | Info akun (balance, equity, dll) |
| `DELETE` | `/disconnect?user_id=X` | Putus koneksi MT5 |

Semua endpoint (kecuali `/health`) memerlukan header: `x-api-key: YOUR_API_KEY`
