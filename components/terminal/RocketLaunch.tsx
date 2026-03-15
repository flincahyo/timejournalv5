
"use client";
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket } from 'lucide-react';

interface RocketLaunchProps {
    onComplete: () => void;
}

export default function RocketLaunch({ onComplete }: RocketLaunchProps) {
    useEffect(() => {
        const timer = setTimeout(onComplete, 4000);
        return () => clearTimeout(timer);
    }, [onComplete]);

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-end justify-center pointer-events-none overflow-hidden"
        >
            {/* Darkening Overlay */}
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.4 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black"
            />

            {/* Clouds/Smoke at the bottom */}
            <div className="absolute bottom-0 left-0 right-0 flex justify-center h-40">
                {[...Array(20)].map((_, i) => (
                    <motion.div
                        key={i}
                        initial={{ y: 100, x: (i - 10) * 30, scale: 0.5, opacity: 0 }}
                        animate={{ 
                            y: [100, -20, -50], 
                            scale: [1, 2, 3],
                            opacity: [0, 0.8, 0],
                            x: (i - 10) * 40 + (Math.random() * 40 - 20)
                        }}
                        transition={{ 
                            duration: 3, 
                            delay: Math.random() * 0.5,
                            ease: "easeOut"
                        }}
                        className="absolute bottom-0 w-24 h-24 bg-white/20 rounded-full blur-2xl"
                    />
                ))}
            </div>

            {/* The Rocket Container */}
            <motion.div
                initial={{ y: 0 }}
                animate={{ 
                    y: [0, -20, -1500],
                    rotate: [0, -1, 1, -1, 0]
                }}
                transition={{ 
                    y: { duration: 3.5, ease: [0.45, 0, 0.55, 1], delay: 0.5 },
                    rotate: { duration: 0.1, repeat: 10, ease: "linear" }
                }}
                className="relative mb-20 flex flex-col items-center"
            >
                {/* Exhaust Flame */}
                <motion.div 
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: [0, 1.5, 1] }}
                    transition={{ duration: 0.5, delay: 0.5 }}
                    className="absolute top-full w-6 h-32 bg-gradient-to-b from-orange to-red/0 rounded-full blur-md origin-top"
                />
                <motion.div 
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: [0, 2, 1.2] }}
                    transition={{ duration: 0.4, delay: 0.6 }}
                    className="absolute top-full w-3 h-20 bg-gradient-to-b from-white to-orange/0 rounded-full blur-sm origin-top"
                />

                {/* Rocket Shell */}
                <div className="relative z-10 p-6 bg-surface border-2 border-accent rounded-full shadow-[0_0_30px_rgba(59,130,246,0.5)]">
                    <Rocket size={48} className="text-accent" strokeWidth={2.5} />
                </div>
                
                {/* Text Indicator */}
                <motion.div
                    initial={{ opacity: 1, y: 0 }}
                    animate={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.5, delay: 1 }}
                    className="absolute -top-12 whitespace-nowrap"
                >
                    <span className="text-accent font-black text-xs uppercase tracking-[0.3em]">Ignition</span>
                </motion.div>
            </motion.div>

            {/* Screen Shake Effect (Global) */}
            <motion.div
                animate={{ 
                    x: [0, -2, 2, -2, 0],
                    y: [0, 2, -2, 2, 0]
                }}
                transition={{ duration: 0.1, repeat: 15, ease: "linear", delay: 0.4 }}
                className="fixed inset-0 pointer-events-none"
            />
        </motion.div>
    );
}
