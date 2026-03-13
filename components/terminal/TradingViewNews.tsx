"use client";
import React, { useEffect, useRef, memo } from 'react';
import { useThemeStore } from '@/store';

function TradingViewNews({ hideHeader = false }: { hideHeader?: boolean }) {
    const container = useRef<HTMLDivElement>(null);
    const { theme } = useThemeStore();

    useEffect(() => {
        if (container.current) {
            container.current.innerHTML = ''; // Clear previous
            const script = document.createElement("script");
            script.src = "https://s3.tradingview.com/external-embedding/embed-widget-timeline.js";
            script.type = "text/javascript";
            script.async = true;
            script.innerHTML = JSON.stringify({
                "displayMode": "regular",
                "feedMode": "all_symbols",
                "colorTheme": theme === 'dark' ? 'dark' : 'light',
                "isTransparent": true,
                "locale": "en",
                "width": "100%",
                "height": "100%"
            });
            container.current.appendChild(script);
        }
    }, [theme]);

    return (
        <div className={`flex flex-col h-full overflow-hidden ${hideHeader ? "bg-transparent shadow-none border-none" : "bg-surface border border-border rounded-xl shadow-sm"}`}>
            {!hideHeader && (
                <div className="px-4 py-2.5 border-b border-border bg-surface2 shrink-0">
                    <div className="font-bold text-[12px] text-text uppercase tracking-wider">Top Stories</div>
                </div>
            )}
            <div className="flex-1 w-full relative min-h-0" ref={container} />
        </div>
    );
}

export default memo(TradingViewNews);
