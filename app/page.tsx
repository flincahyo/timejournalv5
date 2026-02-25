"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store";

export default function RootPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  useEffect(() => {
    router.replace(user ? "/dashboard" : "/login");
  }, [user, router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-bg">
      <div className="w-8 h-8 rounded-full border-[3px] border-border border-t-accent animate-[spin_1s_linear_infinite]" />
    </div>
  );
}
