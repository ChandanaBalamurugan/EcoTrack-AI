import { useState } from "react";
import { Download, Printer } from "lucide-react";
import FilterBar from "../components/FilterBar";
import { ErrorBox, Loading } from "../components/States";
import useFetch from "../hooks/useFetch";
import { api } from "../services/api";
import { CATS, CAT_KEYS, defaultRange, fmt } from "../utils/format";

export default function Reports() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [range, setRange] = useState(defaultRange());
  const { data, loading, error, reload } = useFetch(() => api.reportSummary(year), [year]);
  return (
    <div className="page">
      <div className="page-head"><div><h1>Reports</h1><p>Monthly and yearly summaries, exports, and a printable report.</p></div></div>
      <div className="card">
        <h2>Exports for a date range</h2>
        <FilterBar value={range} onChange={setRange} showCategory={false} />
        <div className="row">
          <a className="btn ghost" href={api.url("/reports/activities.csv", range)}><Download size={16} /> Activities CSV</a>
          <a className="btn" href={api.url("/reports/printable", range)} target="_blank" rel="noreferrer"><Printer size={16} /> Open printable report</a>
        </div>
        <p className="small muted">The printable report includes calculation methodology, factor sources, targets and recommendations. Use the Print button in it, then choose Save as PDF.</p>
      </div>
      <div className="card mt">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Yearly summary</h2>
          <div className="row">
            <label style={{ flexDirection: "row", alignItems: "center" }}>Year<input type="number" value={year} min="2000" max="2100" onChange={(e) => setYear(Number(e.target.value) || year)} style={{ width: 90 }} /></label>
            <a className="btn sm ghost" href={api.url("/reports/summary.csv", { year })}><Download size={14} /> Summary CSV</a>
          </div>
        </div>
        {loading && <Loading />}
        {error && <ErrorBox message={error} onRetry={reload} />}
        {data && data.activity_count === 0 && <p className="muted">No activities recorded in {year}.</p>}
        {data && data.activity_count > 0 && (
          <>
            <p><strong>{fmt(data.total_kg)} kg CO2e</strong> ({fmt(data.total_kg / 1000, 3)} t) from {data.activity_count} records.</p>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Month</th>{CAT_KEYS.map((k) => <th key={k}>{CATS[k].label}</th>)}<th>Total kg</th></tr></thead>
                <tbody>
                  {data.monthly.map((m) => <tr key={m.month}><td>{m.month}</td>{CAT_KEYS.map((k) => <td key={k}>{fmt(m[k])}</td>)}<td><strong>{fmt(m.total)}</strong></td></tr>)}
                  <tr><th>Year</th>{CAT_KEYS.map((k) => <th key={k}>{fmt(data.by_category.find((c) => c.category === k).kg)}</th>)}<th>{fmt(data.total_kg)}</th></tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
