import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatRelativeTime } from "@/lib/utils";

export interface AdminUserRow {
  user_id: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
  joined_at: string;
  total_generations: number;
  image_generations: number;
  video_generations: number;
  model_3d_generations: number;
  failed_generations: number;
  total_cost_usd: number;
  last_generation_at: string | null;
}

export function UserTable({ users }: { users: AdminUserRow[] }) {
  return (
    <Card className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-left text-xs text-muted">
            <th className="px-4 py-3 font-medium">User</th>
            <th className="px-4 py-3 font-medium">Joined</th>
            <th className="px-4 py-3 font-medium text-right">Image</th>
            <th className="px-4 py-3 font-medium text-right">Video</th>
            <th className="px-4 py-3 font-medium text-right">3D</th>
            <th className="px-4 py-3 font-medium text-right">Total</th>
            <th className="px-4 py-3 font-medium text-right">Failed</th>
            <th className="px-4 py-3 font-medium text-right">Est. spend</th>
            <th className="px-4 py-3 font-medium">Last active</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.user_id} className="border-b border-border-subtle/60 last:border-0">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{u.display_name || u.email}</span>
                  {u.is_admin && <Badge>admin</Badge>}
                </div>
                <div className="text-xs text-muted">{u.email}</div>
              </td>
              <td className="px-4 py-3 text-muted">{formatRelativeTime(u.joined_at)}</td>
              <td className="px-4 py-3 text-right">{u.image_generations}</td>
              <td className="px-4 py-3 text-right">{u.video_generations}</td>
              <td className="px-4 py-3 text-right">{u.model_3d_generations}</td>
              <td className="px-4 py-3 text-right font-medium">{u.total_generations}</td>
              <td className="px-4 py-3 text-right text-danger-text">{u.failed_generations || "—"}</td>
              <td className="px-4 py-3 text-right font-medium">${Number(u.total_cost_usd || 0).toFixed(2)}</td>
              <td className="px-4 py-3 text-muted">
                {u.last_generation_at ? formatRelativeTime(u.last_generation_at) : "never"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
