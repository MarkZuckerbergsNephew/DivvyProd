"use client";

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

export type SessionRealtimeHandlers = {
  onItems?: () => void;
  onClaims?: () => void;
  onParticipants?: () => void;
  onPayments?: () => void | Promise<void>;
  onSessionUpdate?: (payload: {
    new: {
      status?: string;
      tax_amount?: number;
      tip_amount?: number;
    };
  }) => void;
};

export function useSessionRealtime(
  sessionId: string,
  handlers: SessionRealtimeHandlers
) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    const channel = supabase.channel(`session-${sessionId}`);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "items",
        filter: `session_id=eq.${sessionId}`,
      },
      () => handlersRef.current.onItems?.()
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "claims",
      },
      () => handlersRef.current.onClaims?.()
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "participants",
        filter: `session_id=eq.${sessionId}`,
      },
      () => handlersRef.current.onParticipants?.()
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "payments",
        filter: `session_id=eq.${sessionId}`,
      },
      () => handlersRef.current.onPayments?.()
    );

    channel.on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "sessions",
        filter: `id=eq.${sessionId}`,
      },
      (payload: {
        new: {
          status?: string;
          tax_amount?: number;
          tip_amount?: number;
        };
      }) => handlersRef.current.onSessionUpdate?.(payload)
    );

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);
}
