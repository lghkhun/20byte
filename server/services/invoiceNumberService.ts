function padSequence(value: number): string {
  return String(Math.max(1, Math.floor(value))).padStart(4, "0");
}

export function formatInvoiceNumber(year: number, sequence: number): string {
  return `INV-${year}-${padSequence(sequence)}`;
}

export function getInvoiceYearRange(year: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
  return { start, end };
}

