import React, { ReactNode } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import "@/app/globals.css";
import { ThemeProvider } from "@/components/layout/ThemeProvider";

const font = Plus_Jakarta_Sans({ subsets: ["latin"] });

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className={`${font.className} min-h-screen bg-bg text-text selection:bg-accent/20`}>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-bg/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 flex items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="50" cy="50" r="48" className="fill-text" />
                <path
                  d="M32 20C32 20 32 30 40 40C48 50 48 50 48 50C48 50 48 50 40 60C32 70 32 80 32 80H68C68 80 68 70 60 60C52 50 52 50 52 50C52 50 52 50 60 40C68 30 68 20 68 20H32Z"
                  className="fill-bg stroke-bg"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <rect x="42" y="27" width="3" height="8" className="fill-text opacity-40" />
                <rect x="48" y="25" width="3" height="12" className="fill-text opacity-60" />
                <rect x="54" y="29" width="3" height="6" className="fill-text opacity-30" />
                <path d="M40 65C45 70 55 70 60 65C65 60 65 80 65 80H35C35 80 35 60 40 65Z" className="fill-text opacity-10" />
              </svg>
            </div>
            <span className="font-black text-[19px] tracking-tight uppercase text-text">TimeJournal</span>
          </div>
          <a 
            href="https://timejournal.site" 
            target="_blank"
            className="px-4 py-2 rounded-full bg-accent text-white text-[12px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-lg shadow-accent/20"
          >
            Create Your Journal
          </a>
        </div>
      </header>
      <main>
        {children}
      </main>
      <footer className="py-12 border-t border-border mt-12 bg-surface2/30">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-[12px] text-text3 font-bold uppercase tracking-widest opacity-40">
            Powered by TimeJournal &mdash; Professional MT5 Sync
          </p>
        </div>
      </footer>
    </div>
  );
}
