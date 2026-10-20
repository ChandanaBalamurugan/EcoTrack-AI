import { Car, Fuel, Trash2, Zap } from "lucide-react";

const icons = { electricity: Zap, transport: Car, fuel: Fuel, waste: Trash2 };

export default function CatIcon({ category, size = 18 }) {
  const Icon = icons[category] || Zap;
  return <Icon size={size} aria-hidden="true" />;
}
