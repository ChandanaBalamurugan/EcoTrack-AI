import { useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import FilterBar from "../components/FilterBar";
import { EmptyState, ErrorBox, Loading } from "../components/States";
import useFetch from "../hooks/useFetch";
import { api } from "../services/api";
import { CATS, defaultRange, fmt, pretty } from "../utils/format";

export default function Analysis() {
  const [f, setF] = useState(defaultRange());
  const { data, loading, error, reload } = useFetch(() => api.hotspot(f), [f.start, f.end]);
  return (
    <div className="page">
      <div className="page-head"><div><h1>Emission analysis</h1><p>Which category drives your footprint, and why we say so.</p></div></div>
      <FilterBar value={f} onChange={setF} showCategory={false} />
      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && !data.has_data && <EmptyState title="Nothing to analyse yet" text={data.message}><Link className="btn" to="/add">Add activity</Link></EmptyState>}
      {data?.has_data && (
        <>
          <div className="card soft">
            <div className="muted small">Hotspot</div>
            <h2>{CATS[data.category].label}: {fmt(data.category_kg)} kg CO2e ({data.percent}% of total)</h2>
            <p style={{ margin: 0 }}>{data.explanation}</p>
          </div>
          <div className="grid g2 mt">
            <div className="card">
              <h3>Category ranking</h3>
              <div className="chart-box">
                <ResponsiveContainer>
                  <BarChart data={data.ranking.map((r) => ({ ...r, name: CATS[r.category].label }))} layout="vertical" margin={{ left: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={110} />
                    <Tooltip formatter={(v) => `${fmt(v)} kg CO2e`} />
                    <Bar dataKey="kg" name="kg CO2e">{data.ranking.map((r) => <Cell key={r.category} fill={CATS[r.category].color} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <h3>Details</h3>
              <dl className="kv">
                <div><dt>Biggest single activity</dt><dd>{pretty(data.top_activity.label)} on {data.top_activity.date}: {fmt(data.top_activity.emissions_kg, 2)} kg <Link to={`/activities/${data.top_activity.id}/calculation`}>(calculation)</Link></dd></div>
                <div><dt>Previous period</dt><dd>{fmt(data.previous_category_kg)} kg in the same category</dd></div>
                <div><dt>Change</dt><dd>{data.change_percent == null ? "No earlier data to compare" : `${data.change_percent > 0 ? "+" : ""}${data.change_percent}%`}</dd></div>
              </dl>
              <h3 className="mt">Reduction opportunities</h3>
              {data.opportunities?.length ? (
                <ul className="lines">{data.opportunities.map((o) => <li key={o.title}>{o.title}: about {fmt(o.reduction_kg)} kg CO2e saved</li>)}</ul>
              ) : <p className="muted">Add more activities to see opportunities.</p>}
              <Link to="/recommendations">All recommendations</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
