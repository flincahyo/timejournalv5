
"use client";
import { useMT5Store } from "@/store";
import { fmtUSD } from "@/lib/utils";

export default function AccountSummaryWidget() {
    const { account, trades, liveTrades } = useMT5Store();

    // Calculate Daily PnL
    const todayWIB = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    const realizedPnl = trades
        .filter(t => t.status === "closed" && t.closeTimeWIB?.startsWith(todayWIB))
        .reduce((a, t) => a + (t.pnl || 0), 0);
    const unrealizedPnl = liveTrades.reduce((a, t) => a + (t.pnl || 0), 0);
    const totalPnl = realizedPnl + unrealizedPnl;

    if (!account) return <div className="p-4 text-text3 text-xs">MT5 Not Connected</div>;

    return (
        <div className="h-full flex flex-col p-3 justify-center gap-4 bg-transparent">
            {/* Daily PnL Section */}
            <div className="flex flex-col">
                <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text3 opacity-40 mb-0.5">Daily P/L</span>
                <span className={`text-2xl font-black tabular-nums tracking-tighter leading-none ${totalPnl >= 0 ? "text-green" : "text-red"}`}>
                    {fmtUSD(totalPnl)}
                </span>
            </div>

            {/* Equity & Balance Row */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text3 opacity-40 mb-0.5">Account Equity</span>
                    <span className="text-sm font-black tabular-nums tracking-tight text-text leading-none">
                        {fmtUSD(account.equity)}
                    </span>
                </div>

                <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-text3 opacity-40 mb-0.5">Balance</span>
                    <span className="text-[12px] font-black tabular-nums tracking-tight text-text2 opacity-60 leading-none">
                        {fmtUSD(account.balance)}
                    </span>
                </div>
            </div>
        </div>
    );
}
