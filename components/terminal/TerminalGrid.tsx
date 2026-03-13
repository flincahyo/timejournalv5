
"use client";
import React, { useMemo, useState, useEffect, useRef } from "react";
import { Responsive } from "react-grid-layout";
import { useTerminalStore } from "@/store/terminalStore";
import TerminalToolbar from "@/components/terminal/TerminalToolbar";
import WidgetWrapper from "@/components/terminal/WidgetWrapper";
import TradingViewChart from "@/components/terminal/TradingViewChart";
import MarketHours from "@/components/terminal/MarketHours";
import MarketSessionMap from "@/components/terminal/MarketSessionMap";
import MiniNews from "@/components/terminal/MiniNews";
import TradingViewNews from "@/components/terminal/TradingViewNews";
import LiveTerminalTrades from "@/components/terminal/LiveTerminalTrades";
import AccountSummaryWidget from "@/components/terminal/AccountSummaryWidget";
import CustomHtmlWidget from "@/components/terminal/CustomHtmlWidget";
import AlertWidget from "@/components/terminal/AlertWidget";

// Import styles for react-grid-layout
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const gridStyles = `
  /* Global RGL handles styling */
  .react-resizable-handle {
    position: absolute;
    width: 24px !important;
    height: 24px !important;
    bottom: 0px !important;
    right: 0px !important;
    cursor: se-resize;
    z-index: 100 !important;
    background: transparent;
  }
  
  /* Indicators for handles */
  .react-resizable-handle::after {
    content: "";
    position: absolute;
    right: 6px;
    bottom: 6px;
    width: 12px;
    height: 12px;
    border-right: 2px solid rgba(255, 255, 255, 0.3);
    border-bottom: 2px solid rgba(255, 255, 255, 0.3);
    border-bottom-right-radius: 2px;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .react-resizable-handle:hover::after {
    border-color: #3b82f6;
    width: 14px;
    height: 14px;
    filter: drop-shadow(0 0 4px rgba(59, 130, 246, 0.5));
  }
  
  /* Horizontal handle (east) */
  .react-resizable-handle-e {
    cursor: e-resize;
    width: 10px !important;
    right: 0 !important;
    top: 0 !important;
    height: 100% !important;
    z-index: 90 !important;
  }
  
  /* Vertical handle (south) */
  .react-resizable-handle-s {
    cursor: s-resize;
    height: 10px !important;
    bottom: 0 !important;
    left: 0 !important;
    width: 100% !important;
    z-index: 90 !important;
  }
  
  .layout:not(.edit-mode) .react-resizable-handle {
    display: none !important;
  }
  
  .react-grid-item.react-grid-placeholder {
    background: rgba(59, 130, 246, 0.1) !important;
    border-radius: 12px !important;
    opacity: 0.5 !important;
  }
`;

export default function TerminalGrid() {
    const { widgets, setWidgets, isEditMode } = useTerminalStore();
    const [mounted, setMounted] = useState(false);
    const [width, setWidth] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const gridParentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        setMounted(true);
        if (!gridParentRef.current) return;

        const updateWidth = () => {
            if (gridParentRef.current) {
                setWidth(gridParentRef.current.offsetWidth);
            }
        };

        const observer = new ResizeObserver((entries) => {
            if (entries[0]) {
                const newWidth = entries[0].contentRect.width;
                if (newWidth > 0) {
                    setWidth(newWidth);
                }
            }
        });

        observer.observe(gridParentRef.current);
        updateWidth(); // Initial width

        return () => observer.disconnect();
    }, []);

    const layouts = useMemo(() => {
        const l = widgets.map((w) => ({
            i: w.id,
            x: w.layout.x,
            y: w.layout.y,
            w: w.layout.w,
            h: w.layout.h,
            minW: w.layout.minW || 2,
            minH: w.layout.minH || 2,
        }));
        // RGL Responsive needs the same ID for across layouts
        return { lg: l, md: l, sm: l, xs: l, xxs: l };
    }, [widgets]);

    const handleLayoutChange = (currentLayout: any) => {
        if (!isEditMode) return;

        const updatedWidgets = widgets.map((w) => {
            const item = currentLayout.find((l: any) => l.i === w.id);
            if (item) {
                return {
                    ...w,
                    layout: {
                        ...w.layout,
                        x: item.x,
                        y: item.y,
                        w: item.w,
                        h: item.h
                    },
                };
            }
            return w;
        });

        if (JSON.stringify(updatedWidgets) !== JSON.stringify(widgets)) {
            setWidgets(updatedWidgets);
        }
    };

    const renderWidget = (type: string, id: string, content?: string) => {
        switch (type) {
            case "chart": return <TradingViewChart />;
            case "market_hours": return <MarketSessionMap />;
            case "news_economic": return <MiniNews hideHeader={true} />;
            case "news_timeline": return <TradingViewNews hideHeader={true} />;
            case "live_trades": return <LiveTerminalTrades hideHeader={true} />;
            case "account_summary": return <AccountSummaryWidget />;
            case "price_alerts": return <AlertWidget />;
            case "custom_html": return <CustomHtmlWidget content={content || ""} />;
            default: return <div className="p-4 text-xs text-text3">Unknown Widget: {type}</div>;
        }
    };

    // Prevent rendering until width is detected to avoid stacking
    const shouldRenderGrid = mounted && width > 0;

    return (
        <div className="fade-in flex flex-col h-full overflow-hidden bg-bg" ref={containerRef}>
            <style>{gridStyles}</style>

            <TerminalToolbar />

            <div
                ref={gridParentRef}
                className="flex-1 overflow-x-hidden overflow-y-auto no-scrollbar p-0 pb-20 w-full"
            >
                {shouldRenderGrid ? (
                    <Responsive
                        className={`layout ${isEditMode ? "edit-mode" : ""}`}
                        layouts={layouts}
                        width={width}
                        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
                        cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
                        rowHeight={40}
                        // @ts-ignore
                        isDraggable={isEditMode}
                        // @ts-ignore
                        isResizable={isEditMode}
                        resizeHandles={['s', 'e', 'se']}
                        onLayoutChange={handleLayoutChange}
                        draggableHandle=".cursor-grab"
                        margin={[0, 0]}
                        useCSSTransforms={true}
                    >
                        {widgets.filter(w => w.isVisible).map((w) => (
                            <WidgetWrapper
                                key={w.id}
                                id={w.id}
                                title={w.title || (w.type.replace('_', ' ').toUpperCase())}
                            >
                                {renderWidget(w.type, w.id, w.content)}
                            </WidgetWrapper>
                        ))}
                    </Responsive>
                ) : (
                    <div className="h-full w-full flex items-center justify-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-8 h-8 border-2 border-blue/20 border-t-blue rounded-full animate-spin" />
                            <p className="text-[10px] font-bold text-text3 uppercase tracking-widest animate-pulse">
                                Calculating Grid...
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
