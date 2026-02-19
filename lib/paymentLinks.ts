export function createVenmoLink(
    username: string,
    amount: number,
    sessionTitle: string
  ) {
    const note = encodeURIComponent(
      `Divvy split — ${sessionTitle}`
    );
  
    return `https://venmo.com/?txn=pay&recipients=${username}&amount=${amount}&note=${note}`;
  }
  