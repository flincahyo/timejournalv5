"use client";
import { useEffect } from "react";

export function PublicInit() {
  useEffect(() => {
    document.documentElement.classList.add("dark");
    // Also ensure body has dark properties if used directly
    return () => {
      // Optional: Cleanup if navigating away to non-public pages
      // but usually public routes are separate enough.
    };
  }, []);

  return null;
}
