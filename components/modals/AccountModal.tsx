"use client";
import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store";
import { fmtUSD } from "@/lib/utils";

const TRADING_AVATARS = [
    {
        id: "bull", label: "The Bull", color: "#22c55e", svg: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 4v4m-4-2l2 2m4-2l-2 2" />
                <path d="M3 13h18l-2 7H5l-2-7z" />
                <path d="M12 13v-3a2 2 0 0 1 2-2h4" />
                <path d="M12 13v-3a2 2 0 0 0-2-2H6" />
            </svg>
        )
    },
    {
        id: "bear", label: "The Bear", color: "#ef4444", svg: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="7" cy="7" r="2" />
                <circle cx="17" cy="7" r="2" />
                <path d="M12 12c-3.3 0-6 2.7-6 6v2h12v-2c0-3.3-2.7-6-6-6z" />
                <path d="M12 12V9a2 2 0 0 1 4 0v3" />
                <path d="M12 12V9a2 2 0 0 0-4 0v3" />
            </svg>
        )
    },
    {
        id: "candle", label: "The Candle", color: "#10b981", svg: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="5" width="6" height="14" rx="1" />
                <line x1="12" y1="2" x2="12" y2="5" />
                <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
        )
    },
    {
        id: "rocket", label: "To The Moon", color: "#f59e0b", svg: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
                <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
                <path d="M9 12H4s.55-3.03 2-5c1.62-2.2 5-3 5-3" />
                <path d="M12 15v5s3.03-.55 5-2c2.2-1.62 3-5 3-5" />
            </svg>
        )
    },
    {
        id: "chart", label: "Chart Master", color: "#3b82f6", svg: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 3v18h18" />
                <path d="m19 9-5 5-4-4-3 3" />
            </svg>
        )
    },
    {
        id: "whale", label: "The Whale", color: "#6366f1", svg: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 10a8 8 0 0 1 8-8c1.5 0 3 .5 4.1 1.4C15.5 2.5 17 2 18.5 2c1.4 0 2.5 1.1 2.5 2.5 0 .5-.1 1-.4 1.4A8 8 0 0 1 22 10v4a8 8 0 0 1-8 8H10a8 8 0 0 1-8-8v-4z" />
                <path d="M12 14v2" />
                <path d="M10 14v2" />
                <path d="M14 14v2" />
            </svg>
        )
    },
];

export function AvatarIcon({ id, className = "w-6 h-6" }: { id: string | null | undefined, className?: string }) {
    if (!id) return <div className={`${className} bg-surface3 rounded-full`} />;

    // Check if it's a predefined ID or a URL
    const avatar = TRADING_AVATARS.find(a => a.id === id);
    if (avatar) {
        return (
            <div className={`${className} flex items-center justify-center rounded-full`} style={{ color: avatar.color }}>
                {avatar.svg}
            </div>
        );
    }

    // Assume it's a URL
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const src = id.startsWith("http") ? id : `${baseUrl}${id}`;

    // For uploaded images (URLs), we want them to fill the space (no padding)
    const containerClasses = className.includes('p-')
        ? className.split(' ').filter(c => !c.startsWith('p-')).join(' ')
        : className;

    return (
        <div className={`${containerClasses} rounded-full overflow-hidden border border-border bg-surface2`}>
            <img src={src} alt="Avatar" className="w-full h-full object-cover" />
        </div>
    );
}

export default function AccountModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { user, updateProfile, changePassword, uploadAvatar } = useAuthStore();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [selectedAvatar, setSelectedAvatar] = useState("");

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        if (user && isOpen) {
            setName(user.name);
            setEmail(user.email);
            setSelectedAvatar(user.image || "bull");
            setError("");
            setSuccess("");
        }
    }, [user, isOpen]);

    if (!isOpen) return null;

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        setError("");
        try {
            const url = await uploadAvatar(file);
            setSelectedAvatar(url);
            setSuccess("Foto profil berhasil diunggah!");
        } catch (err: any) {
            setError(err.message || "Gagal mengunggah foto");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            await updateProfile({ name, email, image: selectedAvatar });
            setSuccess("Profil berhasil diperbarui!");
        } catch (err: any) {
            setError(err.message || "Gagal memperbarui profil");
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError("Konfirmasi password tidak cocok");
            return;
        }
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            await changePassword(currentPassword, newPassword);
            setSuccess("Password berhasil diganti!");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err: any) {
            setError(err.message || "Gagal mengganti password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full" onClick={e => e.stopPropagation()}>
            {/* Tabs */}
            <div className="flex border-b border-border bg-surface2/10 shrink-0">
                <button
                    onClick={() => setActiveTab("profile")}
                    className={`flex-1 py-3.5 text-sm font-bold transition-all border-b-2 ${activeTab === "profile" ? "border-accent text-accent bg-accent/5" : "border-transparent text-text3 hover:text-text"}`}
                >
                    👤 Profile Info
                </button>
                <button
                    onClick={() => setActiveTab("security")}
                    className={`flex-1 py-3.5 text-sm font-bold transition-all border-b-2 ${activeTab === "security" ? "border-accent text-accent bg-accent/5" : "border-transparent text-text3 hover:text-text"}`}
                >
                    🔒 Security
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 no-scrollbar">
                {error && <div className="mb-5 p-3 rounded-lg bg-red-bg border border-red-br text-red text-xs font-bold animate-in slide-in-from-top-2">{error}</div>}
                {success && <div className="mb-5 p-3 rounded-lg bg-green-bg border border-green-br text-green text-xs font-bold animate-in slide-in-from-top-2">✓ {success}</div>}

                {activeTab === "profile" ? (
                    <form onSubmit={handleUpdateProfile} className="space-y-6">
                        {/* Profile Header with Big Avatar */}
                        <div className="flex items-center gap-5 p-4 rounded-xl bg-surface2/30 border border-border/50">
                            <div className="relative group/avatar">
                                <div className="w-20 h-20 rounded-2xl bg-surface border border-border shadow-inner flex items-center justify-center overflow-hidden">
                                    <AvatarIcon id={selectedAvatar} className="w-full h-full p-2" />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute -bottom-1 -right-1 w-7 h-7 bg-accent text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all border-2 border-surface"
                                    title="Upload Foto"
                                >
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 5v14M5 12h14" /></svg>
                                </button>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileUpload}
                                    accept="image/*"
                                    className="hidden"
                                />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-text">{user?.name}</div>
                                <div className="text-xs text-text3">{user?.email}</div>
                                <div className="mt-2 text-[10px] uppercase tracking-wider font-bold text-accent px-2 py-0.5 bg-accent/10 rounded-full inline-block">Member since {user?.createdAt ? new Date(user.createdAt).getFullYear() : "2024"}</div>
                            </div>
                        </div>

                        {/* Avatar Grid */}
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-text3 uppercase tracking-widest pl-1">Pilih Avatar Trading</label>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                                {TRADING_AVATARS.map(av => (
                                    <button
                                        key={av.id}
                                        type="button"
                                        onClick={() => setSelectedAvatar(av.id)}
                                        className={`relative aspect-square rounded-xl border-2 transition-all flex flex-col items-center justify-center p-2 group ${selectedAvatar === av.id ? "border-accent bg-accent/5 shadow-md scale-105" : "border-border hover:border-text3 hover:bg-surface2"}`}
                                    >
                                        <div className="w-8 h-8 mb-1 transition-transform group-hover:scale-110" style={{ color: av.color }}>{av.svg}</div>
                                        <div className={`text-[8px] font-bold text-center uppercase tracking-tighter ${selectedAvatar === av.id ? "text-accent" : "text-text3"}`}>{av.label}</div>
                                        {selectedAvatar === av.id && (
                                            <div className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-accent text-white rounded-full flex items-center justify-center text-[8px] shadow-sm">✓</div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-4 pt-2">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-text3 uppercase tracking-widest pl-1">Display Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-all font-medium"
                                    placeholder="Nama Lengkap"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-text3 uppercase tracking-widest pl-1">Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-all font-medium"
                                    placeholder="email@contoh.com"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-accent hover:opacity-90 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-accent/20 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 mt-4"
                        >
                            {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Simpan Perubahan"}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleChangePassword} className="space-y-5">
                        <div className="p-4 rounded-xl bg-surface2/30 border border-border/50 flex gap-3.5 items-start">
                            <div className="text-xl">🛡️</div>
                            <p className="text-xs text-text3 leading-relaxed">Pastikan password Anda minimal 6 karakter dan menggunakan kombinasi simbol untuk keamanan ekstra.</p>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-text3 uppercase tracking-widest pl-1">Password Sekarang</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            <div className="h-px bg-border my-2" />
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-text3 uppercase tracking-widest pl-1">Password Baru</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-text3 uppercase tracking-widest pl-1">Konfirmasi Password Baru</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    className="w-full bg-surface2 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-accent hover:opacity-90 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
                        >
                            {loading ? <div className="w-5 h-5 border-2 border-surface/30 border-t-surface rounded-full animate-spin" /> : "🔒 Perbarui Keamanan"}
                        </button>
                    </form>
                )}
            </div>

            {/* Footer info */}
            <div className="px-6 py-4 bg-surface2/30 border-t border-border flex items-center justify-center gap-2 opacity-60 mt-auto">
                <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-text3">TimeJournal Secure Profile</span>
            </div>
        </div>
    );
}
