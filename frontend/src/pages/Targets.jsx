import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import StatCard from "../components/StatCard";
import { ErrorBox, Loading } from "../components/States";
import { useToast } from "../components/Toast";
import useFetch from "../hooks/useFetch";
import { api } from "../services/api";
import { addDays, fmt, pretty } from "../utils/format";

export default function Targets() {
  const notify = useToast();
  const [form, setForm] = useState({ baseline_start: addDays(-29), baseline_end: addDays(0), mode: "percent", value: 15, target_date: addDays(90) });
  const { data, loading, error, reload } = useFetch(() => api.targetProgress(), []);
  const list = useFetch(() => api.targets(), []);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const body = { baseline_start: form.baseline_start, baseline_end: form.baseline_end, target_date: form.target_date };
    if (form.mode === "percent") body.reduction_percent = Number(form.value); else body.target_emissions_kg = Number(form.value);
    try { await api.addTarget(body); notify("Target saved"); reload(); list.reload(); } catch (err) { notify(err.message, "error"); }
  };
  const remove = async (id) => { await api.deleteTarget(id); notify("Target deleted"); reload(); list.reload(); };

  const t = data;
  const ready = t && t.baseline_kg && t.status && !["not_started", "no_baseline"].includes(t.status);
  return (
    <div className="page">
      <div className="page-head"><div><h1>Targets and progress</h1><p>Compare your recent activity with a baseline period on a like-for-like basis.</p></div></div>
      <form className="card form" onSubmit={submit}>
        <label>Baseline start<input type="date" value={form.baseline_start} onChange={set("baseline_start")} required /></label>
        <label>Baseline end<input type="date" value={form.baseline_end} onChange={set("baseline_end")} required /></label>
        <label>Target type<select value={form.mode} onChange={set("mode")}><option value="percent">Reduction percentage</option><option value="kg">Target emissions (kg CO2e per baseline period)</option></select></label>
        <label>{form.mode === "percent" ? "Reduction (%)" : "Target (kg CO2e)"}<input type="number" min="0" step="any" value={form.value} onChange={set("value")} required /></label>
        <label>Target date<input type="date" value={form.target_date} onChange={set("target_date")} required /></label>
        <div className="row" style={{ alignItems: "end" }}><button className="btn">Save target</button></div>
      </form>
      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {t?.status === "no_target" && <p className="muted mt">No target set yet. Choose a baseline above. Progress is measured from the day after the baseline ends.</p>}
      {t?.status === "no_baseline" && <div className="banner mt">{t.message} Add activities dated within the baseline period.</div>}
      {t?.status === "not_started" && <div className="banner mt">{t.message}</div>}
      {ready && (
        <div className="mt">
          <div className="row" style={{ marginBottom: 10 }}>
            <span className={`badge ${t.status === "behind" ? "bad" : ""}`}>{pretty(t.status)}</span>
            <span className="muted small">Target date {t.target.target_date}. Compared as emissions per {t.baseline_days} days.</span>
          </div>
          <div className="grid g5">
            <StatCard label="Baseline" value={fmt(t.baseline_kg)} unit="kg" />
            <StatCard label="Target" value={fmt(t.target_kg)} unit="kg" />
            <StatCard label="Current (equivalent)" value={fmt(t.current_equivalent_kg)} unit="kg" sub={`${fmt(t.current_kg)} kg in ${t.days_elapsed} days`} />
            <StatCard label="Reduced so far" value={fmt(t.reduced_kg)} unit="kg" sub={`${t.reduced_percent}% vs baseline`} />
            <StatCard label="Remaining" value={fmt(t.remaining_kg)} unit="kg" />
          </div>
          <div className="card mt">
            <div className="row" style={{ justifyContent: "space-between" }}><strong>Progress toward target</strong><span>{t.progress_percent}%</span></div>
            <div className="bar" role="progressbar" aria-valuenow={t.progress_percent} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${t.progress_percent}%` }} /></div>
          </div>
          <div className="card mt">
            <h2>Monthly target vs actual</h2>
            <div className="chart-box"><ResponsiveContainer><BarChart data={t.monthly}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="month" /><YAxis /><Tooltip formatter={(v) => `${fmt(v)} kg`} /><Legend /><Bar dataKey="target_kg" name="Target" fill="#a9d4b6" /><Bar dataKey="actual_kg" name="Actual" fill="#14532d" /></BarChart></ResponsiveContainer></div>
          </div>
          <p className="small muted mt">{t.note}</p>
        </div>
      )}
      {list.data?.targets?.length > 0 && (
        <div className="card mt">
          <h2>Your targets</h2>
          {list.data.targets.map((x, i) => (
            <div className="row" key={x.id} style={{ justifyContent: "space-between", padding: "6px 0" }}>
              <span>{i === 0 && <span className="badge">current</span>} Baseline {x.baseline_start} to {x.baseline_end}: {x.reduction_percent != null ? `${x.reduction_percent}% cut` : `${x.target_emissions_kg} kg`} by {x.target_date}</span>
              <button className="btn sm danger" onClick={() => remove(x.id)}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
