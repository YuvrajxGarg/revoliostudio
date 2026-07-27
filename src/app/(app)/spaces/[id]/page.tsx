import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SpaceEditor } from "@/components/spaces/SpaceEditor";
import type { Space } from "@/lib/space-types";

export default async function SpacePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.isAdmin) redirect("/studio/image");

  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("spaces").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return <SpaceEditor space={data as Space} />;
}
