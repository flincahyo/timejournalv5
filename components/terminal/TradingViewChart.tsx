
"use client";
import React, { useEffect, useRef, memo } from 'react';
import { useThemeStore } from '@/store';

function TradingViewChart({ symbol = "XAUUSD" }: { symbol?: string }) {
    const container = useRef<HTMLDivElement>(null);
    const { theme } = useThemeStore();

    useEffect(() => {
        if (container.current) {
            container.current.innerHTML = '';
            const script = document.createElement("script");
            script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
            script.type = "text/javascript";
            script.async = true;
            script.innerHTML = JSON.stringify({
                "autosize": true,
                "symbol": `OANDA:${symbol}`,
                "interval": "5",
                "timezone": "Asia/Jakarta",
                "theme": theme === 'dark' ? 'dark' : 'light',
                "style": "1",
                "locale": "en",
                "allow_symbol_change": true,
                "calendar": false,
                "details": false,
                "hide_side_toolbar": true,
                "hide_top_toolbar": true,
                "hide_legend": false,
                "hide_volume": true,
                "hotlist": false,
                "save_image": true,
                "backgroundColor": theme === 'dark' ? "#0f1117" : "#F9FAFB",
                "gridColor": theme === 'dark' ? "rgba(255, 255, 255, 0.03)" : "rgba(0, 0, 0, 0.03)",
                "toolbar_bg": theme === 'dark' ? "#0f1117" : "#F9FAFB",
                "watchlist": ["XAUUSD", "BTCUSD", "ETHUSD", "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "NZDUSD", "XAGUSD"],
                "withdateranges": false,
                "compareSymbols": [],
                "studies": [],
            });

            container.current.appendChild(script);
        }
    }, [symbol, theme]);

    return (
        <div className="tradingview-widget-container h-full w-full flex flex-col overflow-hidden" ref={container}>
            <div className="tradingview-widget-container__widget flex-1 w-full scale-[1.01] origin-top-left"></div>
        </div>
    );
}

export default memo(TradingViewChart);
