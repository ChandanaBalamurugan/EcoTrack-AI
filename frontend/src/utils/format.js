export const CATS = {
  electricity: { label: "Electricity", color: "#c98a00" },
  transport: { label: "Transportation", color: "#1d6f8f" },
  fuel: { label: "Fuel", color: "#b8512a" },
  waste: { label: "Waste", color: "#5c8a1f" },
};
export const CAT_KEYS = Object.keys(CATS);

export const fmt = (n, digits = 1) =>
  n == null || Number.isNaN(Number(n)) ? "-" : Number(n).toLocaleString(undefined, { maximumFractionDigits: digits });

export const isoDate = (d) => d.toLocaleDateString("en-CA");

export function defaultRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 89);
  return { start: isoDate(start), end: isoDate(end) };
}

export const addDays = (days) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return isoDate(d);
};

export const pretty = (s) => (s ? String(s).replace(/_/g, " ") : "");
