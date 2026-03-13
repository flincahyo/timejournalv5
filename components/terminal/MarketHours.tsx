"use client";
import React, { memo } from 'react';

function MarketHours({ hideHeader = false }: { hideHeader?: boolean }) {
    return (
        <div className={`flex flex-col h-full overflow-hidden ${hideHeader ? "bg-transparent shadow-none border-none" : "bg-surface border border-border rounded-xl shadow-sm"}`}>
            {!hideHeader && (
                <div className="px-4 py-2.5 border-b border-border bg-surface2 flex justify-between items-center shrink-0">
                    <div className="font-bold text-[12px] text-text flex items-center gap-2 uppercase tracking-wider">
                        Market Sessions
                    </div>
                </div>
            )}
            <div className="flex-1 w-full bg-white relative overflow-hidden">
                <iframe
                    src="https://widget.myfxbook.com/widget/market-hours.html"
                    style={{ border: 0, width: '100%', height: '100%' }}
                />
            </div>
            <div className="px-4 py-1.5 border-t border-border bg-surface flex items-center justify-center">
                <div style={{ fontFamily: 'roboto,sans-serif!important', fontSize: '11px', color: '#666666' }}>
                    <a href="https://www.myfxbook.com/market-hours" title="Forex Market Hours" target="_blank" rel="noopener">
                        <b style={{ color: '#666666' }}>Market Hours</b>
                    </a> by Myfxbook.com
                </div>
            </div>
        </div>
    );
}

export default memo(MarketHours);
