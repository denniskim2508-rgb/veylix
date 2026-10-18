export function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const display = value && value.trim().length > 0 ? value : "—";
  return (
    <div className="h-full min-w-0 flex flex-col items-center justify-center gap-2 p-4 rounded-xl bg-bg-card/60 border border-border text-center">
      <div className="flex items-center justify-center text-primary shrink-0">{icon}</div>
      <p className="text-xl font-bold text-text-primary leading-tight break-words max-w-full">{display}</p>
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted leading-tight break-words max-w-full">{label}</p>
    </div>
  );
}
