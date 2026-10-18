export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-text-muted mb-4">{title}</h3>
      {children}
    </div>
  );
}