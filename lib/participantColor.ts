const PALETTE = [
  '#FF6B6B', '#FF8E53', '#FFC048', '#51CF66',
  '#339AF0', '#845EF7', '#F06595', '#20C997',
  '#74C0FC', '#FFD43B', '#A9E34B', '#63E6BE',
];

export function getParticipantColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}
