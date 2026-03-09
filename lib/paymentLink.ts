/** Call only on client (uses window.location.origin). */
export function generatePaymentLink(
  sessionId: string,
  participantId: string
): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/pay/${sessionId}/${participantId}`;
}
