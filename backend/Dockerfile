# Base: Python 3.11 Bullseye (Full version - includes build tools)
FROM python:3.11-bullseye

# Force IPv4 for apt (fixes exit code 100 on many VPS)
RUN echo 'Acquire::ForceIPv4 "true";' > /etc/apt/apt.conf.d/99force-ipv4

# Set Wine environment
ENV WINEPREFIX=/root/.wine
ENV WINEARCH=win64
ENV DISPLAY=:99

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

WORKDIR /app

# Copy and install dependencies
# We use a full image, so compilers for asyncpg/cryptography are already there
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt --verbose

# Copy backend code
COPY . .

# Create data directory
RUN mkdir -p /app/data

EXPOSE 8000

# Start virtual display + backend
CMD Xvfb :99 -screen 0 1024x768x16 & \
    sleep 2 && \
    uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
