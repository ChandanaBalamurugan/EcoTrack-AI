export default function StatCard({ label, value, unit, sub, accent, icon }) {
  return (
    <div className="card stat" style={accent ? { borderTop: `4px solid ${accent}` } : undefined}>
      <div className="stat-label">
        {icon}
        {label}
      </div>
      <div className="stat-value">
        {value} {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
