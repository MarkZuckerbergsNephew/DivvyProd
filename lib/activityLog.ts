import { supabase } from "@/lib/supabase";

export async function logActivity(
  sessionId: string,
  participantId: string | null,
  actionType: string,
  message: string,
) {
  await supabase.from("activity_log").insert({
    session_id: sessionId,
    participant_id: participantId,
    type: actionType,
    message,
  });
}
