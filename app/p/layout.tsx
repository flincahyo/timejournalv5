"use client";
import React, { ReactNode, useState, useEffect } from "react";
import "@/app/globals.css";
import { Sun, Moon } from "lucide-react";
import { BrandLogo } from "@/components/layout/BrandLogo";

export default function PublicLayout({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'dark' | 'light'>('light');

  useEffect(() => {
    // Check if user has a preference
    const saved = localStorage.getItem('tj_public_theme') as 'dark' | 'light';
    if (saved) setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('tj_public_theme', next);
  };

  return (
    <div className={`${theme} min-h-screen bg-bg text-text selection:bg-accent/20 transition-colors duration-300`} style={{ fontFamily: "'Montserrat', sans-serif" }}>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-bg/80 backdrop-blur-md h-[56px] flex items-center">
        <div className="w-full max-w-7xl mx-auto px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo />
          </div>

          <div className="flex items-center gap-3 md:gap-6">
            <button 
              onClick={toggleTheme}
              className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface2 border border-border hover:bg-surface3 transition-all text-text3 hover:text-text"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <a 
              href="https://timejournal.site" 
              target="_blank"
              className="px-4 py-2 rounded-full bg-accent text-white text-[12px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-accent/20"
            >
              Create Your Journal
            </a>
          </div>
        </div>
      </header>
      <main>
        {children}
      </main>
      <footer className="py-12 border-t border-border mt-12 bg-surface2/30">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-[12px] text-text3 font-bold uppercase tracking-widest opacity-40">
            Powered by time journal. &mdash; Professional MT5 Sync
          </p>
        </div>
      </footer>
    </div>
  );
}
