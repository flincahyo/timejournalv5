"use client";
import React, { useEffect, useRef, memo } from 'react';
import { useThemeStore } from '@/store';

function MiniNews({ hideHeader = false }: { hideHeader?: boolean }) {
    const container = useRef<HTMLDivElement>(null);
    const { theme } = useThemeStore(); // Keep theme for dynamic colorTheme

    useEffect(() => {
        if (!container.current) return;

        // Clear existing content before adding new script
        container.current.innerHTML = '';

        const script = document.createElement("script");
        script.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
        script.type = "text/javascript";
        script.async = true;
        script.innerHTML = `
        {
          "colorTheme": "${theme === 'dark' ? 'dark' : 'light'}",
          "isTransparent": true,
          "locale": "en",
          "countryFilter": "ar,au,br,ca,cn,fr,de,in,id,it,jp,kr,mx,ru,sa,za,tr,gb,us,eu",
          "importanceFilter": "-1,0,1",
          "currencyFilter": "USD,EUR,GBP,JPY,AUD,CAD,CHF,NZD",
          "width": "100%",
          "height": "100%"
        }`;
        container.current.appendChild(script);

        // Cleanup function to remove the widget when the component unmounts or theme changes
        return () => {
            if (container.current) container.current.innerHTML = "";
        };
    }, [theme]); // Re-run effect when theme changes

    return (
        <div className={`flex flex-col h-full overflow-hidden ${hideHeader ? "bg-transparent shadow-none border-none" : "bg-surface border border-border rounded-xl shadow-sm"}`}>
            {!hideHeader && (
                <div className="px-4 py-2.5 border-b border-border bg-surface2 flex justify-between items-center shrink-0">
                    <div className="font-bold text-[12px] text-text uppercase tracking-wider">Economic Calendar</div>
                </div>
            )}
            <div className="flex-1 w-full relative min-h-0" ref={container} />
        </div>
    );
}

export default memo(MiniNews);
