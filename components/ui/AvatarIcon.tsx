"use client";
import React from "react";

export const TRADING_AVATARS = [
    { id: "bull", label: "The Bull", color: "#22c55e", svg: <path d="M12 4v4m-4-2l2 2m4-2l-2 2M3 13h18l-2 7H5l-2-7zM12 13v-3a2 2 0 0 1 2-2h4M12 13v-3a2 2 0 0 0-2-2H6" /> },
    { id: "bear", label: "The Bear", color: "#ef4444", svg: <path d="M7 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 12c-3.3 0-6 2.7-6 6v2h12v-2c0-3.3-2.7-6-6-6zM12 12V9a2 2 0 0 1 4 0v3M12 12V9a2 2 0 0 0-4 0v3" /> },
    { id: "candle", label: "The Candle", color: "#10b981", svg: <path d="M9 5h6v14H9V5zm3-3v3m0 14v3" /> },
    { id: "rocket", label: "To The Moon", color: "#f59e0b", svg: <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2zM9 12H4s.55-3.03 2-5c1.62-2.2 5-3 5-3M12 15v5s3.03-.55 5-2c2.2-1.62 3-5 3-5" /> },
    { id: "chart", label: "Chart Master", color: "#3b82f6", svg: <path d="M3 3v18h18M19 9l-5 5-4-4-3 3" /> },
    { id: "whale", label: "The Whale", color: "#6366f1", svg: <path d="M2 10a8 8 0 0 1 8-8c1.5 0 3 .5 4.1 1.4C15.5 2.5 17 2 18.5 2 20 2 21 3 21 4.5c0 .5-.1 1-.4 1.4A8 8 0 0 1 22 10v4a8 8 0 0 1-8 8H10a8 8 0 0 1-8-8v-4zM12 14v2M10 14v2M14 14v2" /> },
];

export const IcUser = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
    </svg>
);
export const IcLock = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);
export const IcCamera = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
    </svg>
);
export const IcCheck = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="20 6 9 17 4 12" />
    </svg>
);
export const IcPlus = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

export function AvatarIcon({ id, className = "w-6 h-6", isLarge = false }: { id: string | null | undefined, className?: string, isLarge?: boolean }) {
    if (!id) return <div className={`${className} bg-surface3 rounded-full`} />;

    const avatar = TRADING_AVATARS.find(a => a.id === id);
    if (avatar) {
        return (
            <div className={`${className} flex items-center justify-center rounded-full`} style={{ color: avatar.color }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full p-[20%]">
                    {avatar.svg}
                </svg>
            </div>
        );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    const src = id.startsWith("http") || id.startsWith("/") ? (id.startsWith("/") ? `${baseUrl}${id}` : id) : id;

    return (
        <div className={`${className} rounded-full overflow-hidden bg-surface2 border border-border shadow-inner`}>
            <img src={src} alt="Avatar" className="w-full h-full object-cover" />
        </div>
    );
}
