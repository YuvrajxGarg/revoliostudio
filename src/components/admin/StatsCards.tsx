import { Card } from "@/components/ui/Card";

export function StatsCards({
  totalUsers,
  totalGenerations,
  generationsToday,
  failedGenerations,
}: {
  totalUsers: number;
  totalGenerations: number;
  generationsToday: number;
  failedGenerations: number;
}) {
  const stats = [
    { label: "Total users", value: totalUsers },
    { label: "Total generations", value: totalGenerations },
    { label: "Generations today", value: generationsToday },
    { label: "Failed generations", value: failedGenerations },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s) => (
        <Card key={s.label} className="p-4">
          <div className="text-xs text-muted">{s.label}</div>
          <div className="mt-1 text-2xl font-semibold">{s.value.toLocaleString()}</div>
        </Card>
      ))}
    </div>
  );
}
