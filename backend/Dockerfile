# Base: Ubuntu 22.04 (Stables for Wine + Python)
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Force IPv4 for apt (fixes exit code 100 on many VPS)
RUN echo 'Acquire::ForceIPv4 "true";' > /etc/apt/apt.conf.d/99force-ipv4

# Install System Dependencies
RUN dpkg --add-architecture i386 && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    wine wine64 wine32 xvfb xauth wget ca-certificates \
    python3 python3-pip python3-dev build-essential \
    libglib2.0-0 libgomp1 unzip cabextract && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Winetricks (Standalone Script - Lighter than apt package)
RUN wget -q https://raw.githubusercontent.com/Winetricks/winetricks/master/src/winetricks -O /usr/local/bin/winetricks && \
    chmod +x /usr/local/bin/winetricks

# Set Wine environment
ENV WINEPREFIX=/root/.wine
ENV WINEARCH=win64
ENV DISPLAY=:99
ENV WINEDEBUG=-all
ENV WINEDLLOVERRIDES="mscoree,mshtml=n"

WORKDIR /app

# Copy and install native Linux dependencies
COPY requirements.txt .
RUN pip3 install --no-cache-dir --upgrade pip && \
    pip3 install --no-cache-dir -r requirements.txt

# Copy backend code
COPY . .

# Create data directory
RUN mkdir -p /app/data

# Install Windows Python (Embeddable) for MT5 Bridge
RUN mkdir -p /root/.wine/drive_c/python311 && \
    wget -q https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip -O /tmp/python.zip && \
    unzip -q /tmp/python.zip -d /root/.wine/drive_c/python311 && \
    sed -i 's/#import site/import site/' /root/.wine/drive_c/python311/python311._pth && \
    rm /tmp/python.zip

# Install PIP and MetaTrader5 Library inside Wine Python
RUN wget -q https://bootstrap.pypa.io/get-pip.py -O /tmp/get-pip.py && \
    xvfb-run wine C:\\python311\\python.exe /tmp/get-pip.py && \
    xvfb-run wine C:\\python311\\python.exe -m pip install MetaTrader5 pytz proxy-randomizer && \
    rm /tmp/get-pip.py

# Install VC++ Runtime for MT5 support (using standalone winetricks)
RUN xvfb-run winetricks -q vcrun2015

EXPOSE 8000

# Start virtual display + backend
CMD Xvfb :99 -screen 0 1024x768x16 & \
    sleep 2 && \
    python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --workers 1
