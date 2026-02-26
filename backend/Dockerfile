# Base: Python 3.11 Bullseye (Stable for Wine)
FROM python:3.11-bullseye

# Force IPv4 for apt (fixes exit code 100 on many VPS)
RUN echo 'Acquire::ForceIPv4 "true";' > /etc/apt/apt.conf.d/99force-ipv4

# Install Wine and prerequisites
RUN dpkg --add-architecture i386 && \
    apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
    wine \
    wine32:i386 \
    wine64 \
    xvfb \
    wget \
    ca-certificates \
    libglib2.0-0 \
    libgomp1 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set Wine environment
ENV WINEPREFIX=/root/.wine
ENV WINEARCH=win64
ENV DISPLAY=:99

WORKDIR /app

# Copy and install native Linux dependencies
# (MetaTrader5 removed from here to avoid build failure)
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Create data directory
RUN mkdir -p /app/data

EXPOSE 8000

# Note: Windows Python and MT5 library must be installed inside Wine.
# This is usually done via terminal once the container is running
# to ensure the persistent volume is used.

# Start virtual display + backend
CMD Xvfb :99 -screen 0 1024x768x16 & \
    sleep 2 && \
    uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
