"use client";
import React, { useState, useEffect, memo } from 'react';
import { useThemeStore } from '@/store';
import { Clock, Sun, Moon, MapPin, Zap } from 'lucide-react';
import { detectSession } from '@/lib/utils';

interface Session {
    id: string;
    city: string;
    timezone: string;
    startHour: number;
    endHour: number;
    x: number; // percentage
    y: number; // percentage
    flag: string;
}

const SESSIONS: Session[] = [
    { id: 'sydney', city: 'Sydney', timezone: 'Australia/Sydney', startHour: 7, endHour: 16, x: 88, y: 78, flag: "🇦🇺" },
    { id: 'tokyo', city: 'Tokyo', timezone: 'Asia/Tokyo', startHour: 9, endHour: 18, x: 82, y: 40, flag: "🇯🇵" },
    { id: 'london', city: 'London', timezone: 'Europe/London', startHour: 8, endHour: 17, x: 48, y: 28, flag: "🇬🇧" },
    { id: 'newyork', city: 'New York', timezone: 'America/New_York', startHour: 8, endHour: 17, x: 26, y: 36, flag: "🇺🇸" },
];

function MarketSessionMap() {
    const { theme } = useThemeStore();
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(interval);
    }, []);

    const isSessionOpen = (session: Session) => {
        const localHour = parseInt(new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: session.timezone
        }).format(currentTime), 10);

        return localHour >= session.startHour && localHour < session.endHour;
    };

    const getLocalTime = (timezone: string) => {
        return new Intl.DateTimeFormat("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: timezone
        }).format(currentTime);
    };

    const activeSessionName = detectSession(currentTime.toISOString());

    return (
        <div className="relative w-full h-full flex flex-col bg-surface/5 overflow-hidden font-outfit">
            {/* Header / Info */}
            <div className="absolute top-3 left-3 z-20 flex flex-col gap-0.5 pointer-events-none">
                <div className="flex items-center gap-1.5 opacity-50">
                    <Zap size={10} className="text-blue fill-blue/20" />
                    <span className="text-[10px] font-black text-text3 uppercase tracking-[0.2em]">{activeSessionName}</span>
                </div>
                <div className="flex items-center gap-2">
                    <Clock size={12} className="text-blue" />
                    <span className="text-[12px] font-bold text-text tabular-nums tracking-tight">
                        {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} WIB
                    </span>
                </div>
            </div>

            {/* Map Container */}
            <div className="relative flex-1 w-full mt-4 mask-edge overflow-hidden">
                <img
                    src={theme === 'dark' ? '/images/world-map-dark.png' : '/images/world-map-light.png'}
                    alt="World Map"
                    className="w-full h-full object-cover opacity-80"
                />

                {/* Session Markers */}
                {SESSIONS.map((session) => {
                    const isOpen = isSessionOpen(session);
                    return (
                        <div
                            key={session.id}
                            className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-700"
                            style={{ left: `${session.x}%`, top: `${session.y}%` }}
                        >
                            <div className={`relative px-2.5 py-1.5 rounded-full flex items-center gap-2 backdrop-blur-md shadow-2xl transition-all ${isOpen
                                ? 'bg-surface/90 border border-blue/30 scale-110 z-10'
                                : 'bg-surface/40 border border-border/20 scale-90 grayscale opacity-60'
                                }`}>
                                <span className="text-[13px]">{session.flag}</span>
                                <div className="flex flex-col leading-none">
                                    <span className="text-[10px] font-extrabold text-text uppercase tracking-tight">
                                        {session.city}
                                    </span>
                                    <span className="text-[8px] font-bold text-text3 opacity-60">
                                        {getLocalTime(session.timezone)}
                                    </span>
                                </div>
                                {isOpen ? (
                                    <div className="flex items-center gap-1 ml-1">
                                        <Sun size={10} className="text-amber-500 animate-pulse" />
                                        <div className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" />
                                    </div>
                                ) : (
                                    <Moon size={10} className="text-blue/40 ml-1" />
                                )}
                            </div>

                            {/* Pulse effect for open session */}
                            {isOpen && (
                                <div className="absolute inset-0 rounded-full bg-blue/20 animate-ping -z-10" />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend / Footer */}
            <div className="px-4 py-2 flex items-center justify-between border-t border-border/10">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-green" />
                        <span className="text-[9px] font-bold text-text3 uppercase tracking-widest">Active</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-border" />
                        <span className="text-[9px] font-bold text-text3 uppercase tracking-widest">Closed</span>
                    </div>
                </div>
                <div className="flex items-center gap-1 text-text3 opacity-40">
                    <MapPin size={10} />
                    <span className="text-[9px] font-bold uppercase italic">Geographic Pulse</span>
                </div>
            </div>

            <style jsx>{`
                .mask-edge {
                    mask-image: linear-gradient(to bottom, transparent, black 10%, black 90%, transparent);
                    -webkit-mask-image: linear-gradient(to bottom, transparent, black 10%, black 90%, transparent);
                }
            `}</style>
        </div>
    );
}

export default memo(MarketSessionMap);
