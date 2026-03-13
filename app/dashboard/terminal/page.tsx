
"use client";
import dynamic from "next/dynamic";

// Load the grid component dynamically with SSR disabled
// react-grid-layout requires 'window' which is not available during SSR
const TerminalGrid = dynamic(
    () => import("@/components/terminal/TerminalGrid"),
    {
        ssr: false,
        loading: () => (
            <div className="h-screen w-full flex items-center justify-center bg-bg-grad">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-10 h-10 border-4 border-blue/20 border-t-blue rounded-full animate-spin" />
                    <p className="text-xs font-bold text-text3 uppercase tracking-widest animate-pulse">Initializing Terminal...</p>
                </div>
            </div>
        )
    }
);

export default function TradingTerminalPage() {
    return <TerminalGrid />;
}
