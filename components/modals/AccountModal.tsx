"use client";
import React, { useState, useEffect } from "react";
import { useAuthStore } from "@/store";
import { AvatarIcon, TRADING_AVATARS, IcUser, IcLock, IcCamera, IcCheck, IcPlus } from "@/components/ui/AvatarIcon";

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
            setSuccess("Avatar updated successfully!");
        } catch (err: any) {
            setError(err.message || "Failed to upload image");
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
            setSuccess("Profile saved!");
            setTimeout(() => setSuccess(""), 3000);
        } catch (err: any) {
            setError(err.message || "Failed to update profile");
        } finally {
            setLoading(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            await changePassword(currentPassword, newPassword);
            setSuccess("Password updated!");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
            setTimeout(() => setSuccess(""), 3000);
        } catch (err: any) {
            setError(err.message || "Failed to change password");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-full w-full bg-surface font-montserrat" onClick={e => e.stopPropagation()}>
            <div className="h-4 shrink-0" />

            {/* Pill Tabs */}
            <div className="px-8 pb-6 shrink-0">
                <div className="flex p-1 bg-surface2/50 backdrop-blur-sm rounded-xl border border-border/50">
                    <button
                        onClick={() => setActiveTab("profile")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === "profile" ? "bg-surface text-accent shadow-sm border border-border/10" : "text-text3 hover:text-text hover:bg-surface3/30"}`}
                    >
                        <IcUser className="w-3.5 h-3.5" />
                        Profile
                    </button>
                    <button
                        onClick={() => setActiveTab("security")}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === "security" ? "bg-surface text-accent shadow-sm border border-border/10" : "text-text3 hover:text-text hover:bg-surface3/30"}`}
                    >
                        <IcLock className="w-3.5 h-3.5" />
                        Security
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-8 pb-8 no-scrollbar">
                {error && (
                    <div className="mb-6 p-3 rounded-xl bg-red/10 border border-red/20 text-red text-[11px] font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                        <span className="shrink-0 w-4 h-4 rounded-full bg-red text-white flex items-center justify-center text-[10px]">!</span>
                        {error}
                    </div>
                )}
                {success && (
                    <div className="mb-6 p-3 rounded-xl bg-green/10 border border-green/20 text-green text-[11px] font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                        <IcCheck className="w-4 h-4 text-green" />
                        {success}
                    </div>
                )}

                {activeTab === "profile" ? (
                    <form onSubmit={handleUpdateProfile} className="space-y-8">
                        {/* Elegant Hero Avatar */}
                        <div className="flex flex-col items-center py-4">
                            <div className="relative group">
                                <div className="w-32 h-32 rounded-full p-1 bg-gradient-to-tr from-accent/20 to-transparent border border-border/50 flex items-center justify-center transition-transform hover:scale-105 duration-500">
                                    <AvatarIcon id={selectedAvatar} className="w-full h-full" isLarge />
                                </div>
                                <button
                                    type="button"
                                    onClick={() => fileInputRef.current?.click()}
                                    className="absolute bottom-1 right-1 w-10 h-10 bg-accent text-white rounded-full flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all border-4 border-surface group-hover:bg-accent2"
                                >
                                    <IcCamera className="w-5 h-5" />
                                </button>
                                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                            </div>
                            <div className="mt-4 text-center">
                                <h3 className="text-sm font-bold text-text">{user?.name}</h3>
                                <p className="text-[10px] uppercase tracking-widest font-black text-text3 mt-1 opacity-60">
                                    Member since {user?.createdAt ? new Date(user.createdAt).getFullYear() : "2024"}
                                </p>
                            </div>
                        </div>

                        {/* Minimalist Selection */}
                        <div className="space-y-4">
                            <h4 className="text-[10px] font-black text-text3 uppercase tracking-[0.2em] px-1">Trading Identity</h4>
                            <div className="flex flex-wrap justify-between gap-3">
                                {TRADING_AVATARS.map(av => (
                                    <button
                                        key={av.id}
                                        type="button"
                                        onClick={() => setSelectedAvatar(av.id)}
                                        className={`w-12 h-12 rounded-full border-2 transition-all flex items-center justify-center hover:scale-110 ${selectedAvatar === av.id ? "border-accent bg-accent/5 shadow-md scale-110" : "border-border hover:border-text3 bg-surface2/30"}`}
                                        title={av.label}
                                    >
                                        <div className="w-6 h-6" style={{ color: av.color }}>
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                {av.svg}
                                            </svg>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Clean Inputs */}
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-text3 uppercase tracking-[0.2em] px-1">Public Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="w-full bg-surface2/50 border border-border/60 rounded-xl px-5 py-3.5 text-sm focus:outline-none focus:border-accent focus:bg-surface2 focus:ring-4 focus:ring-accent/5 transition-all font-bold placeholder:font-medium placeholder:opacity-30"
                                    placeholder="Enter your name"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-text3 uppercase tracking-[0.2em] px-1">Email Address</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full bg-surface2/50 border border-border/60 rounded-xl px-5 py-3.5 text-sm focus:outline-none focus:border-accent focus:bg-surface2 focus:ring-4 focus:ring-accent/5 transition-all font-bold placeholder:font-medium placeholder:opacity-30"
                                    placeholder="your@email.com"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-text text-surface font-black text-xs uppercase tracking-widest py-4 rounded-xl transition-all shadow-lg active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 mt-4 hover:bg-black dark:hover:bg-white dark:bg-white dark:text-black"
                        >
                            {loading ? <div className="w-4 h-4 border-2 border-surface/30 border-t-surface rounded-full animate-spin" /> : "Update Profile"}
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleChangePassword} className="space-y-6 max-w-sm mx-auto pt-4">
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-text3 uppercase tracking-[0.2em] px-1">Current Password</label>
                                <input
                                    type="password"
                                    value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                    className="w-full bg-surface2/50 border border-border/60 rounded-xl px-5 py-3.5 text-sm focus:outline-none focus:border-accent transition-all font-bold"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            <div className="w-full h-px bg-border/40" />
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-text3 uppercase tracking-[0.2em] px-1">New Password</label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    className="w-full bg-surface2/50 border border-border/60 rounded-xl px-5 py-3.5 text-sm focus:outline-none focus:border-accent transition-all font-bold"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-text3 uppercase tracking-[0.2em] px-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    className="w-full bg-surface2/50 border border-border/60 rounded-xl px-5 py-3.5 text-sm focus:outline-none focus:border-accent transition-all font-bold"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-accent text-white font-black text-xs uppercase tracking-widest py-4 rounded-xl transition-all shadow-lg shadow-accent/20 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 mt-4"
                        >
                            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : (
                                <>
                                    <IcLock className="w-4 h-4" />
                                    Change Password
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
