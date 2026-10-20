import { useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import FilterBar from "../components/FilterBar";
import StatCard from "../components/StatCard";
import CatIcon from "../components/CatIcon";
import { EmptyState, ErrorBox, Loading } from "../components/States";
import { useToast } from "../components/Toast";
import useFetch from "../hooks/useFetch";
import { api } from "../services/api";
import { CATS, CAT_KEYS, defaultRange, fmt, pretty } from "../utils/format";

export default function Dashboard() {
  const notify = useToast();
  const [f, setF] = useState({ ...defaultRange(), category: "" });
  const [trend, setTrend] = useState("monthly");
  const { data, loading, error, reload } = useFetch(() => api.dashboard(f), [f.start, f.end, f.category]);

  const demo = async () => {
    try {
      await api.loadDemo();
      notify("Demo data loaded");
      reload();
    } catch (e) {
      notify(e.message, "error");
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Dashboard</h1>
          <p>Totals come from your saved activities and the calculation engine.</p>
        </div>
        <Link className="btn" to="/add">
          Add activity
        </Link>
      </div>
      <FilterBar value={f} onChange={setF} />
      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.activity_count === 0 && (
        <EmptyState title="No activities in this period" text="Add an activity, widen the dates, or load sample data to explore the app.">
          <Link className="btn" to="/add">
            Add activity
          </Link>
          <button className="btn ghost" onClick={demo}>
            Load demo data
          </button>
        </EmptyState>
      )}
      {data && data.activity_count > 0 && <Body d={data} trend={trend} setTrend={setTrend} />}
    </div>
  );
}

function Body({ d, trend, setTrend }) {
  const pie = d.by_category.filter((c) => c.kg > 0);
  const up = d.change_kg > 0;
  const tgt = d.target;
  const trendData = trend === "monthly" ? d.monthly : d.daily;
  const trendKey = trend === "monthly" ? "month" : "date";
  return (
    <>
      <div className="grid g5">
        <StatCard label="Total emissions" value={fmt(d.total_kg)} unit="kg CO2e" sub={`${fmt(d.total_tonnes, 3)} t, ${d.activity_count} records`} />
        {CAT_KEYS.map((k) => {
          const row = d.by_category.find((c) => c.category === k);
          return (
            <StatCard key={k} accent={CATS[k].color} icon={<CatIcon category={k} />} label={CATS[k].label} value={fmt(row.kg)} unit="kg" sub={`${row.percent}% of total`} />
          );
        })}
      </div>
      <div className="grid g3 mt">
        <div className="card">
          <div className="muted small">Change vs previous equivalent period</div>
          {d.change_percent == null ? (
            <p style={{ margin: 0 }}>No data in the previous period ({d.previous_period.start} to {d.previous_period.end}) to compare with.</p>
          ) : (
            <div className="row" style={{ marginTop: 6 }}>
              {up ? <ArrowUpRight color="#a32d2d" /> : <ArrowDownRight color="#1e6b3d" />}
              <strong>{fmt(Math.abs(d.change_percent))}% {up ? "higher" : "lower"}</strong>
              <span className="muted small">({fmt(d.change_kg)} kg vs {fmt(d.previous_period.total_kg)} kg)</span>
            </div>
          )}
        </div>
        <div className="card">
          <div className="muted small">Highest-emission category</div>
          <strong>{CATS[d.top_category.category].label}</strong> - {fmt(d.top_category.kg)} kg ({d.top_category.percent}%)
          <div><Link to="/analysis">See hotspot analysis</Link></div>
        </div>
        <div className="card">
          <div className="muted small">Highest-emission activity</div>
          <strong>{pretty(d.top_activity.label)}</strong> on {d.top_activity.date} - {fmt(d.top_activity.emissions_kg, 2)} kg
          <div><Link to={`/activities/${d.top_activity.id}/calculation`}>View calculation</Link></div>
        </div>
      </div>

      <div className="grid g2 mt">
        <div className="card">
          <h2>Category contribution</h2>
          <div className="chart-box">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pie} dataKey="kg" nameKey="category" innerRadius={60} outerRadius={100} paddingAngle={2}>
                  {pie.map((p) => <Cell key={p.category} fill={CATS[p.category].color} />)}
                </Pie>
                <Tooltip formatter={(v, n) => [`${fmt(v)} kg`, CATS[n].label]} />
                <Legend formatter={(v) => CATS[v].label} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h2>Category comparison</h2>
          <div className="chart-box">
            <ResponsiveContainer>
              <BarChart data={d.by_category.map((c) => ({ ...c, name: CATS[c.category].label }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(v) => `${fmt(v)} kg CO2e`} />
                <Bar dataKey="kg" name="kg CO2e">
                  {d.by_category.map((c) => <Cell key={c.category} fill={CATS[c.category].color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid g2 mt">
        <div className="card">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <h2>Emission trend</h2>
            <div className="tabs">
              {["monthly", "daily"].map((t) => (
                <button key={t} className={`tab ${trend === t ? "on" : ""}`} onClick={() => setTrend(t)}>{t}</button>
              ))}
            </div>
          </div>
          <div className="chart-box">
            <ResponsiveContainer>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={trendKey} />
                <YAxis />
                <Tooltip formatter={(v) => `${fmt(v)} kg CO2e`} />
                <Line type="monotone" dataKey="total" stroke="#14532d" strokeWidth={2} dot={trend === "monthly"} name="Total kg CO2e" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <TargetCard t={tgt} />
      </div>
    </>
  );
}

function TargetCard({ t }) {
  if (!t || !t.target) {
    return (
      <div className="card">
        <h2>Reduction target</h2>
        <p className="muted">No target yet. Set a baseline and a reduction goal to track progress.</p>
        <Link className="btn ghost" to="/targets">Set a target</Link>
      </div>
    );
  }
  if (!t.baseline_kg || t.status === "not_started" || !t.monthly?.length) {
    return (
      <div className="card">
        <h2>Reduction target</h2>
        <p className="muted">{t.message || "Progress will appear once activities after your baseline period are recorded."}</p>
        <Link className="btn ghost" to="/targets">View target</Link>
      </div>
    );
  }
  return (
    <div className="card">
      <h2>Target vs actual</h2>
      <div className="row small">
        <span className={`badge ${t.status === "behind" ? "bad" : ""}`}>{pretty(t.status)}</span>
        <span>Progress {t.progress_percent}% - {fmt(t.remaining_kg)} kg still to cut</span>
      </div>
      <div className="chart-box">
        <ResponsiveContainer>
          <BarChart data={t.monthly}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(v) => `${fmt(v)} kg`} />
            <Legend />
            <Bar dataKey="target_kg" name="Target" fill="#a9d4b6" />
            <Bar dataKey="actual_kg" name="Actual" fill="#14532d" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
