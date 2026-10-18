import clsx from "clsx";

export function DetailRow({ icon, label, value, fullWidth }: { icon: React.ReactNode; label: string; value: string; fullWidth?: boolean }) {
  return (
    <div className={clsx("flex items-start gap-3 min-w-0", fullWidth && "md:col-span-2")}>
      <span className="mt-0.5 text-text-muted shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{label}</p>
        <p
          className={clsx("text-sm text-text-primary", fullWidth ? "break-all" : "truncate")}
          title={value}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
