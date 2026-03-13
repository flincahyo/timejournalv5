"use client";
import React, { useEffect, useState } from "react";
import { X } from "lucide-react";

interface SideDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
    width?: string; // e.g., "max-w-md" or "450px"
    noPadding?: boolean;
}

export default function SideDrawer({
    isOpen,
    onClose,
    title,
    subtitle,
    children,
    width = "max-w-md",
    noPadding = false,
}: SideDrawerProps) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setMounted(true);
            document.body.style.overflow = "hidden";
        } else {
            const timer = setTimeout(() => setMounted(false), 300);
            document.body.style.overflow = "unset";
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!mounted && !isOpen) return null;

    return (
        <div className={`fixed inset-0 z-[100] transition-all duration-300 ${isOpen ? "opacity-100" : "opacity-0 "}`}>
            {/* Backdrop */}
            <div
                className={`absolute inset-0 bg-black/70 transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
                onClick={onClose}
            />

            {/* Drawer Panel */}
            <div
                className={`absolute top-0 right-0 h-full w-full ${width} max-w-[100vw] bg-bg border-l border-border shadow-2xl transition-transform duration-300 ease-out flex flex-col ${isOpen ? "translate-x-0" : "translate-x-full"}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-border bg-bg z-10">
                    <div>
                        <h2 className="text-lg font-bold text-text tracking-tight">{title}</h2>
                        {subtitle && <p className="text-xs text-text3 mt-0.5">{subtitle}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface2 text-text3 hover:text-text transition-all"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content Area */}
                <div className={`flex-1 overflow-y-auto no-scrollbar ${noPadding ? '' : 'p-6'}`}>
                    <div className="animate-in fade-in slide-in-from-right-4 duration-500 delay-150 h-full">
                        {children}
                    </div>
                </div>

                {/* Optional Footer can be passed in children or added later */}
            </div>
        </div>
    );
}
