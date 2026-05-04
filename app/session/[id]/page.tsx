import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import SessionClient from "./SessionClient";
import RunningTabClient from "./RunningTabClient";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("sessions")
    .select("split_mode")
    .eq("id", id)
    .single();

  if (data?.split_mode === "running_tab") {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      redirect(`/login?next=/session/${id}`);
    }
    return <RunningTabClient sessionId={id} />;
  }

  return <SessionClient sessionId={id} />;
}
