"use client";
import React, { useState, useEffect } from 'react';
import { useAlertStore } from '@/store';
import { useMT5Store } from '@/store';
import {
    Bell,
    History,
    Activity,
    Trash2,
    Plus,
    Search,
    Settings2,
    Filter,
    CheckCircle2,
    Clock,
    TrendingUp,
    TrendingDown,
    Zap,
    X
} from 'lucide-react';
import { toWIB } from '@/lib/utils';

export default function AlertWidget() {
    const { alerts, history, fetchAlerts, fetchHistory, deleteAlert, clearHistory } = useAlertStore();
    const { isConnected } = useMT5Store();
    const [activeTab, setActiveTab] = useState<'active' | 'history' | 'system'>('active');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchAlerts();
        fetchHistory();

        // Refresh history periodically if showing history
        const interval = setInterval(() => {
            if (activeTab === 'history') fetchHistory();
        }, 10000);

        return () => clearInterval(interval);
    }, [fetchAlerts, fetchHistory, activeTab]);

    const filteredAlerts = alerts.filter(a =>
        a.symbol.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const filteredHistory = history.filter(h =>
        h.data.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        h.data.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-surface/20 backdrop-blur-sm overflow-hidden border-0">
            {/* Custom Header within Widget */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-surface/30">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    <TabButton
                        active={activeTab === 'active'}
                        onClick={() => setActiveTab('active')}
                        icon={<Bell size={13} />}
                        label="Alerts"
                        count={alerts.length}
                    />
                    <TabButton
                        active={activeTab === 'history'}
                        onClick={() => setActiveTab('history')}
                        icon={<History size={13} />}
                        label="History"
                        count={history.length}
                    />
                    <TabButton
                        active={activeTab === 'system'}
                        onClick={() => setActiveTab('system')}
                        icon={<Activity size={13} />}
                        label="System"
                    />
                </div>

                <div className="flex items-center gap-1 ml-2">
                    <button className="p-1.5 rounded-md hover:bg-surface/50 text-text3 transition-all">
                        <Plus size={14} />
                    </button>
                    <button className="p-1.5 rounded-md hover:bg-surface/50 text-text3 transition-all">
                        <Search size={14} />
                    </button>
                    {activeTab === 'history' && history.length > 0 && (
                        <button
                            onClick={() => { if (confirm("Clear history?")) clearHistory(); }}
                            className="p-1.5 rounded-md hover:bg-red/10 text-text3 hover:text-red transition-all"
                        >
                            <Trash2 size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                {activeTab === 'active' && (
                    <div className="space-y-1">
                        {filteredAlerts.length === 0 ? (
                            <EmptyState message="No active alerts" />
                        ) : (
                            filteredAlerts.map(alert => (
                                <AlertItem key={alert.id} alert={alert} onDelete={() => deleteAlert(alert.id)} />
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-1">
                        {filteredHistory.length === 0 ? (
                            <EmptyState message="No alert history" />
                        ) : (
                            filteredHistory.map(h => (
                                <HistoryItem key={h.id} item={h} />
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'system' && (
                    <div className="space-y-1 p-2">
                        <SystemLog type="info" message="Evaluator loop active" time={new Date()} />
                        <SystemLog type="success" message={`Connected to MT5: ${isConnected}`} time={new Date()} />
                        <SystemLog type="info" message="Monitoring 12 symbols" time={new Date()} />
                    </div>
                )}
            </div>

            {/* Footer / Status */}
            <div className="px-3 py-1.5 border-t border-border/30 bg-surface/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green animate-pulse' : 'bg-red'}`} />
                    <span className="text-[9px] text-text3 uppercase tracking-tighter">
                        {isConnected ? 'Bridge Active' : 'Bridge Offline'}
                    </span>
                </div>
                <div className="flex items-center gap-2 opacity-60">
                    <Settings2 size={11} className="text-text3 cursor-pointer hover:text-text transition-colors" />
                </div>
            </div>
        </div>
    );
}

function TabButton({ active, onClick, icon, label, count }: any) {
    return (
        <button
            onClick={onClick}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all shrink-0 ${active
                ? 'bg-blue/10 text-blue shadow-sm'
                : 'text-text3 hover:bg-surface/50 hover:text-text'
                }`}
        >
            {icon}
            <span className="hidden sm:inline">{label}</span>
            {count !== undefined && (
                <span className={`px-1 rounded-full text-[9px] ${active ? 'bg-blue/20' : 'bg-surface/80'}`}>
                    {count}
                </span>
            )}
        </button>
    );
}

function AlertItem({ alert, onDelete }: any) {
    return (
        <div className="group relative flex items-center justify-between p-2 rounded-lg hover:bg-surface/40 border border-transparent hover:border-border/40 transition-all">
            <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2 rounded-full bg-surface/60 ${alert.enabled ? 'text-blue' : 'text-text3 opacity-40'}`}>
                    {alert.type === 'price' ? <Zap size={14} /> : <Activity size={14} />}
                </div>
                <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-[12px] text-text truncate uppercase">{alert.symbol}</span>
                        {alert.type === 'price' && (
                            <span className={`text-[10px] px-1 rounded ${alert.trigger === 'Above' ? 'text-green bg-green/10' : 'text-red bg-red/10'}`}>
                                {alert.trigger}
                            </span>
                        )}
                    </div>
                    <span className="text-[10px] text-text3 truncate">
                        {alert.type === 'price' ? `Target: ${alert.targetPrice}` : `${alert.timeframe} Momentum`}
                    </span>
                </div>
            </div>

            <button
                onClick={onDelete}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-md hover:bg-red/10 text-text3 hover:text-red transition-all"
            >
                <Trash2 size={14} />
            </button>
        </div>
    );
}

function HistoryItem({ item }: { item: any }) {
    const time = new Date(item.triggeredAt);
    const isBullish = item.data.body?.toLowerCase().includes('bullish') || item.data.body?.includes('above');

    return (
        <div className="flex items-center justify-between p-2 rounded-lg hover:bg-surface/30 transition-all border-l-2 border-transparent hover:border-blue/40">
            <div className="flex items-center gap-3 min-w-0">
                <div className={`p-1.5 rounded-md ${isBullish ? 'bg-green/10 text-green' : 'bg-red/10 text-red'}`}>
                    {isBullish ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-[11px] text-text truncate uppercase">{item.data.symbol}</span>
                    <span className="text-[10px] text-text3 truncate opacity-80">{item.data.body}</span>
                </div>
            </div>
            <div className="text-[9px] text-text3 shrink-0 opacity-60 tabular-nums font-medium">
                {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
        </div>
    );
}

function SystemLog({ type, message, time }: any) {
    return (
        <div className="flex items-start gap-2 py-1">
            <div className={`mt-1 w-1 h-1 rounded-full shrink-0 ${type === 'success' ? 'bg-green' : 'bg-blue'
                }`} />
            <div className="flex flex-col">
                <span className="text-[10px] text-text">{message}</span>
                <span className="text-[9px] text-text3 opacity-40">{time.toLocaleTimeString()}</span>
            </div>
        </div>
    );
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center py-10 opacity-30">
            <Bell size={24} className="mb-2" />
            <span className="text-[11px] font-medium">{message}</span>
        </div>
    );
}
