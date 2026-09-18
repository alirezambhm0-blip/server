export function formatPrice(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return "۰";
  return amount.toLocaleString("fa-IR");
}

export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null) return "۰";
  return num.toLocaleString("fa-IR");
}

export function formatShamsiDate(dateStr: string | Date | undefined | null): string {
  if (!dateStr) return "—";
  try {
    const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    return new Intl.DateTimeFormat("fa-IR").format(d);
  } catch (e) {
    return String(dateStr);
  }
}
