# 📄 TimeJournal v5 Deployment Guide

Follow these steps to deploy the full TimeJournal v5 stack.

## 1. Debian PostgreSQL 16 Setup

Run these commands on your Debian server as `root` or a user with `sudo` privileges.

### Step 1.1: Install PostgreSQL
```bash
sudo apt update
sudo apt install curl ca-certificates -y
sudo install -d /usr/share/postgresql-common/pgdg
sudo curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc
sudo sh -c 'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
sudo apt update
sudo apt install postgresql-16 -y
```

### Step 1.2: Database & User Creation
```bash
sudo -u postgres psql
```
Inside the psql prompt:
```sql
CREATE DATABASE timejournal;
CREATE USER timejournal WITH ENCRYPTED PASSWORD 'SET_YOUR_PASSWORD_HERE';
GRANT ALL PRIVILEGES ON DATABASE timejournal TO timejournal;
\q
```

### Step 1.3: Enable External Access
1. Edit PHP configuration:
   ```bash
   sudo nano /etc/postgresql/16/main/postgresql.conf
   ```
   Find `#listen_addresses = 'localhost'` and change to:
   `listen_addresses = '*'`

2. Configure Access Control:
   ```bash
   sudo nano /etc/postgresql/16/main/pg_hba.conf
   ```
   Add this line at the bottom (replace `0.0.0.0/0` with your Coolify/Bridge IP for better security):
   `host    all             all             0.0.0.0/0               scram-sha-256`

3. Restart & Open Firewall:
   ```bash
   sudo systemctl restart postgresql
   sudo ufw allow 5432/tcp
   ```

---

## 2. Coolify Deployment

### Step 2.1: Connect Repository
1. In Coolify, create a new **Service** or **Application**.
2. Connect to `https://github.com/flincahyo/timejournalv5.git`.

### Step 2.2: Frontend (Next.js)
- **Base Directory**: `/`
- **Build Command**: `npm run build`
- **Start Command**: `npm run start`
- **Environment Variables**:
   - `NEXT_PUBLIC_BACKEND_URL`: `https://your-api-domain.com` (Must include `https://`)

#### Connecting via pgAdmin

To manage the database using pgAdmin (or any other GUI), use the following settings:

1.  **Open pgAdmin** and right-click "Servers" > "Register" > "Server...".
2.  **General Tab**:
    *   **Name**: `TimeJournal Production` (or any name you prefer).
3.  **Connection Tab**:
    *   **Host name/address**: `192.168.232.96`
    *   **Port**: `5432`
    *   **Maintenance database**: `timejournal`
    *   **Username**: `timejournal`
    *   **Password**: `timejournal`
    *   **Save password?**: Yes (optional).
4.  **Click Save**.

> [!NOTE]
> The server is configured to allow connections from any IP within your network. If you are connecting from outside the network, you may need to use an SSH Tunnel (SSH tab) with the root credentials provided.

### Step 2.3: Backend (FastAPI)
- **Base Directory**: `backend`
- **Build Command**: `pip install -r requirements.txt`
- **Start Command**: `uvicorn main:app --host 0.0.0.0 --port 8000`
- **Environment Variables**:
  - `DATABASE_URL`: `postgresql+asyncpg://timejournal:YOUR_PASSWORD@DB_SERVER_IP:5432/timejournal`
  - `JWT_SECRET_KEY`: `your_random_secret`
  - `MT5_BRIDGE_API_KEY`: `your_bridge_secret`
  - `ALLOWED_ORIGINS`: `https://your-frontend-domain.com` (Or `*` for testing, though not recommended for production)

---

## 3. Windows MT5 Bridge Setup

### Step 3.1: Python & MT5
1. Install **Python 3.12** (check "Add to PATH").
2. Install **MetaTrader 5 Terminal** and log in to your account.

### Step 3.2: Service Setup
1. Copy the `mt5_bridge` folder from the repository to `C:\TimeJournalBridge`.
2. Open CMD in that folder and run:
   ```bash
   pip install -r requirements.txt
   ```
3. Create a `.env` file in `C:\TimeJournalBridge`:
   ```env
   MT5_BRIDGE_HOST=https://your-api-domain.com
   MT5_BRIDGE_API_KEY=your_bridge_secret
   MT5_POLL_INTERVAL=10
   ```
4. Run the bridge:
   ```bash
   python app.py
   ```
   *(Optional: Use NSSM to run this as a Windows Service)*

---

## 🔔 Important Notes
- **Bridge Auth**: The `MT5_BRIDGE_API_KEY` must be identical on both the Backend (Coolify) and the Windows Bridge.
- **Async Database**: Ensure you use the `postgresql+asyncpg` prefix in your `DATABASE_URL`.
