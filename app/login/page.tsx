"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store";
import { authLogin, authRegister, authGoogleDemo, authGetMe } from "@/lib/auth";
import { getToken } from "@/lib/api";
import { BrandLogo } from "@/components/layout/BrandLogo";
import { motion, AnimatePresence } from "framer-motion";
import { Montserrat } from "next/font/google";

const montserrat = Montserrat({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800", "900"] });

/* ─── Running Clock + Animated Candlestick Overlay ───────────────────────── */
function ArtWidget() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const s = time.getSeconds();
  const m = time.getMinutes() + s / 60;
  const h = (time.getHours() % 12) + m / 60;

  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const hDeg = (h / 12) * 360;
  const mDeg = (m / 60) * 360;

  const candles = [
    { o: 80, c: 60, h: 50, l: 90, bull: false },
    { o: 60, c: 85, h: 55, l: 95, bull: true },
    { o: 85, c: 70, h: 65, l: 100, bull: false },
    { o: 70, c: 110, h: 60, l: 120, bull: true },
    { o: 110, c: 90, h: 80, l: 130, bull: false },
    { o: 90, c: 130, h: 80, l: 140, bull: true },
    { o: 130, c: 115, h: 105, l: 145, bull: false },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 1, delay: 0.8, ease: "easeOut" }}
      className="relative w-[300px] h-[300px] flex items-center justify-center group"
    >
      {/* Container styling with Glassmorphism */}
      <div className="w-[280px] h-[280px] rounded-[48px] bg-white/5 backdrop-blur-3xl border border-white/10 shadow-2xl overflow-hidden relative flex items-center justify-center transition-all duration-700 group-hover:border-white/20 group-hover:bg-white/10">

        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-transparent to-accent/10" />
        
        {/* Radar-like scanning effect */}
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 opacity-10"
        >
          <div className="absolute top-1/2 left-1/2 w-[200%] h-[200%] -translate-x-1/2 -translate-y-1/2 bg-[conic-gradient(from_0deg,transparent_0%,rgba(37,99,235,0.4)_10%,transparent_20%)]" />
        </motion.div>

        {/* Running Minimal Clock */}
        <svg viewBox="0 0 200 200" width="160" height="160" className="absolute opacity-50 z-10">
          <circle cx="100" cy="100" r="90" fill="none" stroke="white" strokeWidth="1" strokeOpacity="0.2" />
          <circle cx="100" cy="100" r="82" fill="none" stroke="white" strokeWidth="0.5" strokeOpacity="0.1" />
          {/* Hands */}
          <line
            x1="100" y1="100"
            x2={100 + Math.sin(toRad(hDeg)) * 40}
            y2={100 - Math.cos(toRad(hDeg)) * 40}
            stroke="white" strokeWidth="2.5" strokeLinecap="round"
            style={{ transition: "all .5s cubic-bezier(.4,0,.2,1)" }}
          />
          <line
            x1="100" y1="100"
            x2={100 + Math.sin(toRad(mDeg)) * 55}
            y2={100 - Math.cos(toRad(mDeg)) * 55}
            stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.4"
            style={{ transition: "all .5s cubic-bezier(.4,0,.2,1)" }}
          />
          <circle cx="100" cy="100" r="3" fill="#2563eb" />
        </svg>

        {/* Candlestick visualization */}
        <div className="absolute inset-0 z-0" style={{ maskImage: "linear-gradient(to right, transparent, black 25%, black 75%, transparent)", WebkitMaskImage: "linear-gradient(to right, transparent, black 25%, black 75%, transparent)" }}>
          <div className="w-[600px] h-full absolute left-0 top-0 flex items-center" style={{ animation: "scrollCandle 12s linear infinite" }}>
            <svg viewBox="0 0 600 280" className="w-[600px] h-[280px]">
              {[...candles, ...candles, ...candles].map((c, i) => {
                const x = 40 + i * 40;
                const top = Math.min(c.o, c.c);
                const height = Math.abs(c.o - c.c) || 2;
                const color = c.bull ? "#0ecb81" : "#f84960";
                return (
                  <g key={i}>
                    <line x1={x + 6} y1={c.h} x2={x + 6} y2={c.l} stroke={color} strokeWidth="1" strokeLinecap="round" opacity="0.4" />
                    <rect x={x} y={top} width="12" height={height} rx="1.5" fill={color} opacity="0.6" />
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ─── Main ───────────────────────────────────────────────────────────────── */
export default function LoginPage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    if (!user && getToken()) {
      authGetMe().then((u) => {
        if (u) setUser({ id: u.id, email: u.email, name: u.name, provider: "credentials", createdAt: u.createdAt });
      });
    }
  }, []);

  useEffect(() => { if (user) router.replace("/dashboard"); }, [user]);
  if (!mounted) return null;

  const applyUser = (u: any) => {
    setUser({ id: u.id, email: u.email, name: u.name, image: u.image, provider: "credentials", createdAt: u.createdAt });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError("");
    if (mode === "register") {
      const res = await authRegister(name, email, password);
      if (!res.ok) { setError(res.error!); setLoading(false); return; }
      applyUser(res.user!);
    } else {
      const res = await authLogin(email, password);
      if (!res.ok) { setError(res.error!); setLoading(false); return; }
      applyUser(res.user!);
    }
    setLoading(false);
  };

  const handleGoogle = async () => {
    setLoading(true);
    const u = await authGoogleDemo();
    if (u) applyUser(u);
    setLoading(false);
  };

  const inputStyle = (field: string, val: string): React.CSSProperties => {
    const isFocused = focusedField === field;
    return {
      width: "100%",
      padding: "16px 24px",
      borderRadius: "20px",
      border: `1.5px solid ${isFocused ? "#3b82f6" : "#f1f5f9"}`,
      background: isFocused ? "#ffffff" : "#f8fafc",
      fontSize: "14px",
      fontWeight: "600",
      color: "#0f172a",
      outline: "none",
      transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
      boxShadow: isFocused ? "0 4px 12px rgba(59, 130, 246, 0.08)" : "none",
    };
  };

  return (
    <div className={`${montserrat.className} selection:bg-accent/20 selection:text-accent`}>
      <style>{`
        @keyframes scrollCandle {
          from { transform: translateX(0); }
          to { transform: translateX(-280px); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.95); opacity: 0; }
          50% { transform: scale(1); opacity: 0.05; }
          100% { transform: scale(1.05); opacity: 0; }
        }
        input::placeholder { color: #94a3b8; font-weight: 500; }
        ::-webkit-scrollbar { width: 0px; background: transparent; }
      `}</style>

      <div className="min-h-screen flex flex-col lg:flex-row bg-[#0b0e11] overflow-hidden">

        {/* ── LEFT PANEL ─────────────────────────────────────────────── */}
        <div className="relative w-full lg:w-auto lg:flex-[1_1_55%] p-8 lg:p-16 flex flex-col justify-center items-center overflow-hidden">
          
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(37,99,235,0.15),transparent_50%),radial-gradient(circle_at_bottom_left,rgba(37,99,235,0.05),transparent_50%)]" />
          <div className="absolute inset-0 opacity-20 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none" />

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {[1, 2, 3, 4].map((i) => (
              <motion.div
                key={i}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ 
                  scale: [1, 1.05, 1],
                  opacity: [0.03, 0.06, 0.03]
                }}
                transition={{ 
                  duration: 4 + i * 2, 
                  repeat: Infinity, 
                  ease: "easeInOut",
                  delay: i * 0.5
                }}
                className="absolute rounded-full border border-white"
                style={{ 
                  width: `${300 + i * 150}px`, 
                  height: `${300 + i * 150}px` 
                }}
              />
            ))}
          </div>

          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="absolute top-10 left-10 hidden lg:flex items-center gap-3"
          >
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-white/40 text-[11px] font-black uppercase tracking-[0.2em]">Next-Gen Trading Journal</span>
          </motion.div>

          <div className="relative z-10 flex flex-col items-center">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="text-[48px] lg:text-[84px] font-black text-white leading-[0.9] tracking-[-0.04em] text-center mb-12"
            >
              Track <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-tr from-white via-white to-accent/60">your trades</span>
            </motion.h1>

            <ArtWidget />
          </div>

          <div className="absolute bottom-12 left-12 hidden xl:block">
            <motion.div 
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="px-4 py-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-green/20 flex items-center justify-center text-green">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></svg>
              </div>
              <div>
                <div className="text-[10px] font-black text-white/40 uppercase tracking-widest">Growth</div>
                <div className="text-[14px] font-black text-white">+24.8%</div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── RIGHT PANEL ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ x: 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="flex flex-col relative bg-white w-full lg:w-[500px] xl:w-[600px] flex-shrink-0 lg:rounded-l-[48px] shadow-2xl z-30"
          style={{ padding: "40px clamp(24px, 5vw, 64px)" }}
        >
          <div className="flex justify-between items-center w-full mb-12">
            <BrandLogo />
            <button
              onClick={() => { setMode(m => m === "login" ? "register" : "login"); setError(""); }}
              className="group flex items-center gap-2 text-[12px] font-black uppercase tracking-widest text-text3 hover:text-accent transition-all"
            >
              {mode === "login" ? "Need an account?" : "Have an account?"}
              <span className="text-accent underline underline-offset-4 decoration-2">
                {mode === "login" ? "Register" : "Login"}
              </span>
            </button>
          </div>

          <div className="w-full max-w-[400px] mx-auto flex-1 flex flex-col justify-center py-10">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <h2 className="text-[40px] font-black text-[#0f172a] tracking-[-0.03em] mb-2 leading-none">
                {mode === "login" ? "Welcome Back" : "Start Trading"}
              </h2>
              <p className="text-[14px] font-medium text-text3 mb-10">
                {mode === "login" ? "Enter your credentials to access your console." : "Create your account to start journaling your journey."}
              </p>
            </motion.div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <AnimatePresence mode="popLayout">
                {mode === "register" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <input
                      style={inputStyle("name", name)}
                      value={name} onChange={e => setName(e.target.value)}
                      placeholder="Display Name" required
                      onFocus={() => setFocusedField("name")} onBlur={() => setFocusedField(null)}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <input
                style={inputStyle("email", email)}
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Email address" required
                onFocus={() => setFocusedField("email")} onBlur={() => setFocusedField(null)}
              />

              <div className="relative">
                <input
                  style={{ ...inputStyle("pw", password), paddingRight: "56px" }}
                  type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Password" required minLength={6}
                  onFocus={() => setFocusedField("pw")} onBlur={() => setFocusedField(null)}
                />
                <button
                  type="button" onClick={() => setShowPw(p => !p)}
                  className="absolute right-[20px] top-1/2 -translate-y-1/2 text-text3 hover:text-text transition-colors p-1"
                >
                  {showPw
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  }
                </button>
              </div>

              {error && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red/5 text-red text-[12px] font-bold px-4 py-3 rounded-xl border border-red/10 flex items-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                  {error}
                </motion.div>
              )}

              {mode === "login" && (
                <div className="flex justify-end">
                  <span className="text-[12px] font-bold text-accent hover:underline cursor-pointer">
                    Forgot password?
                  </span>
                </div>
              )}

              <button
                type="submit" disabled={loading}
                className="group w-full rounded-2xl py-4.5 bg-accent text-white font-black text-[14px] uppercase tracking-widest shadow-xl shadow-accent/20 hover:shadow-accent/40 hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-70 flex items-center justify-center gap-3"
              >
                {loading ? (
                  <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <>
                    <span>{mode === "login" ? "Initialize Logic" : "Create Console"}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="transition-transform group-hover:translate-x-1"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                  </>
                )}
              </button>
            </form>

            <div className="relative my-10 flex items-center">
              <div className="flex-1 border-t border-slate-100" />
              <span className="px-4 text-[11px] font-black text-slate-300 uppercase tracking-widest">Protocol Sync</span>
              <div className="flex-1 border-t border-slate-100" />
            </div>

            <button
              onClick={handleGoogle} disabled={loading}
              className="w-full rounded-2xl py-4 border border-slate-200 bg-white text-text2 font-bold text-[14px] flex items-center justify-center gap-3 hover:bg-slate-50 hover:border-slate-300 active:bg-slate-100 transition-all"
            >
              <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
              </div>
              Sign in as Guest (Terminal Demo)
            </button>
          </div>

          <div className="mt-auto flex justify-between items-center text-[10px] font-bold text-slate-300 uppercase tracking-widest pt-10">
            <div>© 2025 time journal.</div>
            <div className="flex gap-8">
              <span className="hover:text-slate-500 cursor-pointer">Support</span>
              <span className="hover:text-slate-500 cursor-pointer flex items-center gap-1.5">
                EN <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M6 9l6 6 6-6" /></svg>
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
