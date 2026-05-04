"use client";

import { getParticipantColor, getInitials } from "@/lib/participantColor";

type Size = "sm" | "md" | "lg";

const sizeClasses: Record<Size, string> = {
  sm: "w-6 h-6 text-[10px]",
  md: "w-8 h-8 text-xs",
  lg: "w-10 h-10 text-sm",
};

type Props = {
  name: string;
  size?: Size;
  className?: string;
};

export default function ParticipantAvatar({ name, size = "md", className = "" }: Props) {
  const color = getParticipantColor(name);
  const initials = getInitials(name);

  return (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold text-white flex-shrink-0 ${className}`}
      style={{ backgroundColor: color }}
      title={name}
    >
      {initials}
    </div>
  );
}
