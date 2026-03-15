"use client";
import React, { useState } from 'react';
import { useAlertStore, useMT5Store } from '@/store';
import { X, Bell, Zap, Activity, Info, Music } from 'lucide-react';

interface AddAlertModalProps {
    onClose: () => void;
}

export default function AddAlertModal({ onClose }: AddAlertModalProps) {
    const { addAlert } = useAlertStore();
    const { mt5Symbols } = useMT5Store();
    
    const [type, setType] = useState<'price' | 'candle'>('price');
    const [symbol, setSymbol] = useState(mt5Symbols[0] || 'EURUSD');
    const [loading, setLoading] = useState(false);

    // Price alert state
    const [trigger, setTrigger] = useState<'Above' | 'Below' | 'Crosses'>('Above');
    const [targetPrice, setTargetPrice] = useState('');
    const [frequency, setFrequency] = useState<'Once' | 'Everytime'>('Once');
    const [notes, setNotes] = useState('');

    // Candle alert state
    const [timeframe, setTimeframe] = useState('M15');
    const [minBodyPips, setMinBodyPips] = useState('10');
    const [maxWickPercent, setMaxWickPercent] = useState('30');

    // Notification state
    const [soundUri, setSoundUri] = useState('/sounds/alert.mp3');

    // Searchable symbol state
    const [symbolSearch, setSymbolSearch] = useState('');
    const [showSymbolList, setShowSymbolList] = useState(false);

    const filteredSymbols = mt5Symbols.filter(s => 
        s.toLowerCase().includes(symbolSearch.toLowerCase())
    ).slice(0, 10);

    const SOUNDS = [
        { name: 'Standard Alert', uri: '/sounds/alert.mp3' },
        { name: 'Modern notification', uri: '/sounds/modern.mp3' },
        { name: 'Digital beep', uri: '/sounds/beep.mp3' },
        { name: 'Success chime', uri: '/sounds/chime.mp3' },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (type === 'price') {
                await addAlert({
                    type: 'price',
                    symbol,
                    trigger,
                    targetPrice: parseFloat(targetPrice),
                    frequency,
                    notes,
                    enabled: true,
                    soundUri
                });
            } else {
                await addAlert({
                    type: 'candle',
                    symbol,
                    timeframe,
                    minBodyPips: parseFloat(minBodyPips),
                    maxWickPercent: parseFloat(maxWickPercent),
                    enabled: true,
                    soundUri
                });
            }
            onClose();
        } catch (error) {
            console.error("Failed to add alert:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 animate-in fade-in duration-200">
            <div className="relative w-full max-w-md bg-surface border border-border shadow-2xl rounded-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                            <Bell size={18} />
                        </div>
                        <h2 className="text-lg font-bold text-text">Create New Alert</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-surface2 rounded-full text-text3 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Alert Type Switcher */}
                    <div className="flex p-1 bg-surface2 rounded-xl border border-border/50">
                        <button
                            type="button"
                            onClick={() => setType('price')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                                type === 'price' ? 'bg-surface shadow-sm text-text' : 'text-text3 hover:text-text2'
                            }`}
                        >
                            <Zap size={14} /> Price Alert
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('candle')}
                            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${
                                type === 'candle' ? 'bg-surface shadow-sm text-text' : 'text-text3 hover:text-text2'
                            }`}
                        >
                            <Activity size={14} /> Candle Alert
                        </button>
                    </div>

                    {/* Common Fields */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5 relative">
                            <label className="text-[11px] font-bold text-text3 uppercase tracking-wider">Symbol</label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={symbolSearch || symbol}
                                    onFocus={() => setShowSymbolList(true)}
                                    onChange={(e) => {
                                        setSymbolSearch(e.target.value);
                                        setSymbol(e.target.value.toUpperCase());
                                    }}
                                    placeholder="Search symbol..."
                                    className="w-full bg-surface2 border border-border/50 rounded-lg px-3 py-2 text-sm font-bold focus:ring-1 focus:ring-accent outline-none uppercase"
                                />
                                {showSymbolList && filteredSymbols.length > 0 && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto scroller-minimal">
                                        {filteredSymbols.map(s => (
                                            <button
                                                key={s}
                                                type="button"
                                                onClick={() => {
                                                    setSymbol(s);
                                                    setSymbolSearch('');
                                                    setShowSymbolList(false);
                                                }}
                                                className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-accent/10 border-b border-border/10 last:border-0"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {showSymbolList && (
                                    <div className="fixed inset-0 z-40" onClick={() => setShowSymbolList(false)}></div>
                                )}
                            </div>
                        </div>
                        {type === 'candle' && (
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-text3 uppercase tracking-wider">Timeframe</label>
                                <select
                                    value={timeframe}
                                    onChange={(e) => setTimeframe(e.target.value)}
                                    className="w-full bg-surface2 border border-border/50 rounded-lg px-3 py-2 text-sm font-medium focus:ring-1 focus:ring-accent outline-none"
                                >
                                    {['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'].map(tf => <option key={tf} value={tf}>{tf}</option>)}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Type Specific Fields */}
                    {type === 'price' ? (
                        <div className="space-y-4 animate-in slide-in-from-left-2 fade-in duration-300">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-text3 uppercase tracking-wider">Trigger</label>
                                    <select
                                        value={trigger}
                                        onChange={(e) => setTrigger(e.target.value as any)}
                                        className="w-full bg-surface2 border border-border/50 rounded-lg px-3 py-2 text-sm font-medium focus:ring-1 focus:ring-accent outline-none"
                                    >
                                        <option value="Above">Above</option>
                                        <option value="Below">Below</option>
                                        <option value="Crosses">Crosses</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-text3 uppercase tracking-wider">Target Price</label>
                                    <input
                                        type="number"
                                        step="any"
                                        required
                                        value={targetPrice}
                                        onChange={(e) => setTargetPrice(e.target.value)}
                                        placeholder="0.00000"
                                        className="w-full bg-surface2 border border-border/50 rounded-lg px-3 py-2 text-sm font-medium focus:ring-1 focus:ring-accent outline-none"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-text3 uppercase tracking-wider">Frequency</label>
                                <div className="flex gap-2">
                                    {['Once', 'Everytime'].map(f => (
                                        <button
                                            key={f}
                                            type="button"
                                            onClick={() => setFrequency(f as any)}
                                            className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                                                frequency === f ? 'bg-accent/10 border-accent text-accent' : 'bg-surface2 border-border/50 text-text3 hover:text-text2'
                                            }`}
                                        >
                                            {f}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-text3 uppercase tracking-wider">Notes (Optional)</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={2}
                                    className="w-full bg-surface2 border border-border/50 rounded-lg px-3 py-2 text-sm font-medium focus:ring-1 focus:ring-accent outline-none resize-none"
                                    placeholder="Enter your reminder..."
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in slide-in-from-right-2 fade-in duration-300">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-text3 uppercase tracking-wider">Min Body (Pips)</label>
                                    <input
                                        type="number"
                                        required
                                        value={minBodyPips}
                                        onChange={(e) => setMinBodyPips(e.target.value)}
                                        className="w-full bg-surface2 border border-border/50 rounded-lg px-3 py-2 text-sm font-medium focus:ring-1 focus:ring-accent outline-none"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold text-text3 uppercase tracking-wider">Max Wick %</label>
                                    <input
                                        type="number"
                                        required
                                        value={maxWickPercent}
                                        onChange={(e) => setMaxWickPercent(e.target.value)}
                                        className="w-full bg-surface2 border border-border/50 rounded-lg px-3 py-2 text-sm font-medium focus:ring-1 focus:ring-accent outline-none"
                                    />
                                </div>
                            </div>
                            <div className="p-3 bg-blue/5 border border-blue/10 rounded-xl flex gap-3">
                                <Info size={16} className="text-blue shrink-0 mt-0.5" />
                                <p className="text-[11px] text-text2 leading-relaxed">
                                    This alert triggers when a candle closes with high momentum. The body must be at least <span className="text-blue font-bold">{minBodyPips} pips</span> and the total wick length must be less than <span className="text-blue font-bold">{maxWickPercent}%</span> of the total candle range.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Sound Selection */}
                    <div className="space-y-1.5 pb-2">
                        <label className="text-[11px] font-bold text-text3 uppercase tracking-wider flex items-center gap-1.5">
                            <Music size={12} className="text-accent" /> Notification Sound
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {SOUNDS.map(s => (
                                <button
                                    key={s.uri}
                                    type="button"
                                    onClick={() => setSoundUri(s.uri)}
                                    className={`px-3 py-2 rounded-lg border text-[10px] font-bold text-left transition-all flex items-center justify-between group ${
                                        soundUri === s.uri ? 'bg-accent/5 border-accent text-accent' : 'bg-surface2 border-border/50 text-text3 hover:text-text2'
                                    }`}
                                >
                                    <span className="truncate">{s.name}</span>
                                    {soundUri === s.uri && <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-2">
                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full py-3 rounded-xl bg-accent text-surface text-sm font-bold shadow-lg shadow-accent/20 hover:shadow-accent/30 hover:-translate-y-0.5 active:translate-y-0 transition-all ${
                                loading ? 'opacity-70 cursor-not-allowed' : ''
                            }`}
                        >
                            {loading ? 'Creating Alert...' : 'Create Alert'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
