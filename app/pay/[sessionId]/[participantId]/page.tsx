import PayPageClient from "./PayPageClient";

export default async function PayPage({
  params,
}: {
  params: Promise<{ sessionId: string; participantId: string }>;
}) {
  const { sessionId, participantId } = await params;
  return (
    <PayPageClient
      sessionId={sessionId}
      participantId={participantId}
    />
  );
}
