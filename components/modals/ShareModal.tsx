"use client";
import { useState, useEffect } from "react";
import { useShareStore, useMT5Store, useUIStore } from "@/store";
import { Share2, Copy, Check, Trash2, Globe, Calendar, Layout, X } from "lucide-react";

export default function ShareModal() {
  const { shares, fetchShares, createShare, deleteShare, isLoading } = useShareStore();
  const { activeAccountId } = useMT5Store();
  const { closeDrawer } = useUIStore();
  
  const [slug, setSlug] = useState("");
  const [type, setType] = useState<"dashboard" | "calendar">("dashboard");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const handleCreate = async () => {
    if (!slug) { setError("Masukkan slug (nama link)"); return; }
    setError("");
    const res = await createShare({
      slug: slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
      type,
      account_id: activeAccountId || undefined
    });
    if (res.ok) {
      setSlug("");
    } else {
      setError(res.message || "Gagal membuat share link");
    }
  };

  const handleCopy = (slug: string, id: string) => {
    const url = `${window.location.origin}/p/${slug}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const inp = "bg-surface2 border border-border rounded-xl py-3 px-4 text-text text-[13px] w-full outline-none focus:border-accent focus:ring-2 focus:ring-accent/10 transition-all placeholder:text-text3/30";
  const lbl = "text-[10px] font-black text-text3 uppercase tracking-widest block mb-2 px-1";

  return (
    <div className="flex flex-col h-full bg-surface" onClick={e => e.stopPropagation()}>

      <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
        {/* Create Form */}
        <div className="space-y-5 mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 flex gap-4 items-start">
            <div className="p-2 bg-accent/10 rounded-lg text-accent"><Globe size={20} /></div>
            <p className="text-[11px] text-text3 leading-relaxed font-medium">Buat link publik agar orang lain bisa melihat statistik Anda tanpa perlu login. Data bersifat <span className="text-text font-black uppercase">Read-Only</span>.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className={lbl}>URL Slug</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text3/40 text-[13px]">/p/</span>
                <input 
                  className={`${inp} pl-8`} 
                  value={slug} 
                  onChange={e => setSlug(e.target.value)} 
                  placeholder="my-cool-portfolio" 
                />
              </div>
            </div>

            <div>
              <label className={lbl}>Share Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setType("dashboard")}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                    type === "dashboard" ? "bg-accent/10 border-accent text-accent" : "border-border hover:bg-surface2 text-text3"
                  }`}
                >
                  <Layout size={16} />
                  <span className="text-[12px] font-bold">Dashboard</span>
                </button>
                <button
                  onClick={() => setType("calendar")}
                  className={`flex items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                    type === "calendar" ? "bg-accent/10 border-accent text-accent" : "border-border hover:bg-surface2 text-text3"
                  }`}
                >
                  <Calendar size={16} />
                  <span className="text-[12px] font-bold">Calendar</span>
                </button>
              </div>
            </div>

            {error && <div className="text-[11px] text-red font-bold px-1">{error}</div>}

            <button
              onClick={handleCreate}
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-accent text-white font-black text-[12px] uppercase tracking-widest shadow-lg shadow-accent/20 hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {isLoading ? "Creating..." : "Create Share Link"}
            </button>
          </div>
        </div>

        {/* Existing Shares */}
        <div className="space-y-3">
          <h4 className={lbl}>Active Share Links ({shares.length})</h4>
          {shares.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-border rounded-xl opacity-40">
              <Share2 size={24} className="mx-auto mb-2" />
              <p className="text-[11px] font-bold uppercase tracking-widest">No links created yet</p>
            </div>
          ) : (
            shares.map(s => (
              <div key={s.id} className="p-4 rounded-xl border border-border bg-surface2/30 flex items-center justify-between group hover:border-accent/40 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-surface3 flex items-center justify-center text-text3">
                    {s.type === "dashboard" ? <Layout size={18} /> : <Calendar size={18} />}
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-text">/p/{s.slug}</div>
                    <div className="text-[10px] text-text3 font-bold uppercase tracking-tighter opacity-50">{s.type === "dashboard" ? "Portfolio Overview" : "Trading Calendar"}</div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 translate-x-2 group-hover:translate-x-0 transition-all">
                   <button 
                    onClick={() => handleCopy(s.slug, s.id)}
                    className={`p-2 rounded-lg transition-all ${copiedId === s.id ? "bg-green/10 text-green" : "text-text3 hover:text-accent hover:bg-accent/5"}`}
                    title="Copy Link"
                  >
                    {copiedId === s.id ? <Check size={16} /> : <Copy size={16} />}
                  </button>
                  <button 
                    onClick={() => deleteShare(s.id)}
                    className="p-2 rounded-lg text-text3 hover:text-red hover:bg-red/5 transition-all"
                    title="Delete Link"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="px-6 py-4 bg-surface2/30 border-t border-border flex items-center justify-center gap-2 opacity-40 shrink-0">
        <Share2 size={10} />
        <span className="text-[9px] font-black uppercase tracking-[0.2em]">Public Access Control</span>
      </div>
    </div>
  );
}
