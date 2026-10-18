interface SplashScreenProps {
  className?: string;
  lang?: string;
  /** 0-100, driven by the real startup gates — never a fabricated estimate. */
  progress?: number;
}

export function SplashScreen({ className, lang, progress = 0 }: SplashScreenProps) {
  const clamped = Math.max(0, Math.min(100, progress));

  return (
    <div
      lang={lang}
      className={`fixed inset-0 z-[999] flex flex-col items-center justify-center bg-[#060F1A] ${
        className ?? ""
      }`}
    >
      {/* Aura in the mark's own blue, sampled from the logo (#0069C0). */}
      <div className="veylix-splash-aura pointer-events-none absolute inset-0" />

      <img
        src="/veylix-logo.png"
        alt=""
        className="veylix-splash-logo relative h-28 w-28 object-cover"
      />

      <span className="veylix-splash-word relative mt-6 text-[15px] font-light uppercase tracking-[0.4em] text-white/85">
        Veylix
      </span>

      <div className="veylix-splash-bar relative mt-8 h-[2px] w-40 overflow-hidden rounded-full bg-white/10">
        <div
          className="veylix-splash-bar-fill h-full rounded-full bg-[#0069C0]"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
