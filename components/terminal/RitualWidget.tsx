
"use client";
import React, { useEffect, useState } from 'react';
import { useRitualStore } from '@/store/ritualStore';
import { 
    Brain, 
    Calendar, 
    Compass, 
    ShieldCheck, 
    Map, 
    Plane, 
    CheckCircle2, 
    Circle,
    Activity,
    ChevronRight,
    Trophy
} from 'lucide-react';
import RocketLaunch from './RocketLaunch';
import { AnimatePresence } from 'framer-motion';

const iconMap: Record<string, any> = {
    Brain,
    Calendar,
    Compass,
    ShieldCheck,
    Map
};

export default function RitualWidget() {
    const { items, toggleItem, checkReset, getProgress, isAllCompleted } = useRitualStore();
    const [isClient, setIsClient] = useState(false);
    const [celebrate, setCelebrate] = useState(false);
    const [showRocket, setShowRocket] = useState(false);

    useEffect(() => {
        setIsClient(true);
        checkReset();
    }, [checkReset]);

    if (!isClient) return null;

    const progress = getProgress();
    const completed = isAllCompleted();

    const handleReadyClick = () => {
        if (completed) {
            setCelebrate(true);
            setShowRocket(true);
            setTimeout(() => setCelebrate(false), 3000);
        }
    };

    return (
        <div className="flex flex-col h-full bg-surface2/20 backdrop-blur-md overflow-hidden border-0 p-4">
            {/* Header Area */}
            <div className="flex flex-col gap-1 mb-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${completed ? 'bg-green/10 text-green' : 'bg-accent/10 text-accent'} transition-colors duration-500`}>
                            <Plane size={16} className={completed ? '' : 'animate-pulse'} />
                        </div>
                        <h3 className="text-[13px] font-black uppercase tracking-widest text-text">Pre-Flight Prep</h3>
                    </div>
                    <span className="text-[10px] font-bold text-text3 bg-surface3 px-2 py-0.5 rounded-full tabular-nums">
                        {Math.round(progress)}%
                    </span>
                </div>
                
                {/* Progress Bar */}
                <div className="h-1 w-full bg-surface3 rounded-full mt-2 overflow-hidden">
                    <div 
                        className={`h-full transition-all duration-700 ease-out ${completed ? 'bg-green shadow-[0_0_10px_rgba(34,200,94,0.3)]' : 'bg-accent shadow-[0_0_10px_rgba(59,130,246,0.3)]'}`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>

            {/* Checklist items */}
            <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar pb-4">
                {items.map((item) => {
                    const Icon = iconMap[item.icon];
                    return (
                        <button
                            key={item.id}
                            onClick={() => toggleItem(item.id)}
                            className={`w-full group relative flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 ${
                                item.completed 
                                ? 'bg-green/5 border-green/20' 
                                : 'bg-surface/40 border-border/40 hover:border-accent/40 hover:bg-surface/60'
                            }`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-xl transition-all duration-300 ${
                                    item.completed ? 'text-green bg-green/10' : 'text-text3 bg-surface3 group-hover:text-accent group-hover:bg-accent/10'
                                }`}>
                                    <Icon size={16} />
                                </div>
                                <span className={`text-[12px] font-bold transition-all duration-300 ${
                                    item.completed ? 'text-green/80' : 'text-text2 group-hover:text-text'
                                }`}>
                                    {item.label}
                                </span>
                            </div>
                            
                            <div className={`transition-all duration-300 ${
                                item.completed ? 'text-green scale-110' : 'text-text3 opacity-30 group-hover:opacity-100 group-hover:text-accent'
                            }`}>
                                {item.completed ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Ready Button */}
            <div className="mt-4 pt-4 border-t border-border/20">
                <button
                    onClick={handleReadyClick}
                    disabled={!completed}
                    className={`w-full group relative overflow-hidden flex items-center justify-center gap-3 py-3.5 rounded-2xl font-black text-[12px] uppercase tracking-widest transition-all duration-500 ${
                        completed 
                        ? 'bg-green text-white shadow-xl shadow-green/20 hover:shadow-green/40 hover:-translate-y-0.5 active:translate-y-0' 
                        : 'bg-surface3 text-text3 opacity-50 cursor-not-allowed'
                    }`}
                >
                    {celebrate ? (
                        <div className="flex items-center gap-2 animate-in zoom-in-95 duration-300">
                            <Trophy size={16} />
                            <span>Systems Cleared</span>
                        </div>
                    ) : (
                        <>
                            <span>{completed ? 'Ignition Sequence Start' : 'Systems Check Pending'}</span>
                            <ChevronRight size={14} className={`transition-transform duration-300 ${completed ? 'group-hover:translate-x-1' : ''}`} />
                        </>
                    )}
                    
                    {/* Glossy Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                </button>
            </div>
            
            {/* Background Accent */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-accent/5 blur-3xl rounded-full pointer-events-none" />
            <div className="absolute -top-10 -left-10 w-24 h-24 bg-green/5 blur-3xl rounded-full pointer-events-none" />

            {/* Rocket Launch Overlay */}
            <AnimatePresence>
                {showRocket && (
                    <RocketLaunch onComplete={() => setShowRocket(false)} />
                )}
            </AnimatePresence>
        </div>
    );
}
