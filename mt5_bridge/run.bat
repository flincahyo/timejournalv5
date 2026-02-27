@echo off
title MT5 Bridge Server
echo ============================================
echo  MT5 Bridge Server - Local Network Mode
echo ============================================
echo.

:: ─── KONFIGURASI ─────────────────────────────────────────────────────────────
:: Jika file .env ada, load variabelnya
if exist .env (
    for /f "usebackq tokens=1,* delims==" %%A in (".env") do (
        set "%%A=%%B"
    )
)

:: Default values jika belum di-set
if not defined MT5_BRIDGE_API_KEY set MT5_BRIDGE_API_KEY=changeme_secret_key_123
if not defined MT5_BRIDGE_PORT set MT5_BRIDGE_PORT=8765

:: ─── Deteksi IP Lokal ────────────────────────────────────────────────────────
set LOCAL_IP=
for /f "tokens=14" %%i in ('ipconfig ^| findstr /R "IPv4"') do (
    if not defined LOCAL_IP set LOCAL_IP=%%i
)
if not defined LOCAL_IP set LOCAL_IP=127.0.0.1

:: ─── Firewall Rule ───────────────────────────────────────────────────────────
netsh advfirewall firewall show rule name="MT5 Bridge" >nul 2>&1
if errorlevel 1 (
    netsh advfirewall firewall add rule name="MT5 Bridge" dir=in action=allow protocol=TCP localport=%MT5_BRIDGE_PORT% >nul 2>&1
    echo [OK] Firewall: port %MT5_BRIDGE_PORT% dibuka.
) else (
    echo [OK] Firewall: rule sudah ada.
)

:: ─── Info ────────────────────────────────────────────────────────────────────
echo.
echo =====================================================
echo  Bridge URL  : http://%LOCAL_IP%:%MT5_BRIDGE_PORT%
echo.
echo  Set di Coolify Environment Variables:
echo    MT5_BRIDGE_URL     = http://%LOCAL_IP%:%MT5_BRIDGE_PORT%
echo    MT5_BRIDGE_API_KEY = %MT5_BRIDGE_API_KEY%
echo.
echo  Health Check: http://%LOCAL_IP%:%MT5_BRIDGE_PORT%/health
echo =====================================================
echo.

:: ─── Jalankan Server ─────────────────────────────────────────────────────────
python app.py
pause
