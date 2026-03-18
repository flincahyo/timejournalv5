"use client";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-0 relative group ${className}`} style={{ fontFamily: "'Montserrat', sans-serif" }}>
      {/* Decorative Ring - Use theme color with opacity for consistency */}
      <div className="absolute left-[55px] top-1/2 -translate-y-1/2 mt-[5px] w-3.5 h-3.5 rounded-full border-[2.2px] border-text opacity-40 dark:opacity-60 pointer-events-none group-hover:scale-125 transition-all duration-500" />
      
      <span className="font-bold text-[21px] tracking-tight text-text relative z-10 transition-colors">
        time
      </span>
      <span className="font-normal text-[21px] tracking-tight text-text2 relative z-10 ml-1 transition-colors">
        journal<span className="text-accent font-bold">.</span>
      </span>
    </div>
  );
}
