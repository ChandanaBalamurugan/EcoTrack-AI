import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import FilterBar from "../components/FilterBar";
import { Loading } from "../components/States";
import { useToast } from "../components/Toast";
import useFetch from "../hooks/useFetch";
import { api } from "../services/api";
import { defaultRange, fmt } from "../utils/format";

const TYPES = {
  reduce_electricity: { label: "Reduce electricity", init: { percent: 20 } },
  reduce_fuel: { label: "Reduce fuel", init: { percent: 10, fuel_type: "" } },
  shift_transport: { label: "Shift trips to public transport", init: { percent: 30, from_mode: "car", to_mode: "bus" } },
  change_waste: { label: "Change waste disposal", init: { waste_category: "food", from_method: "landfill", to_method: "composting" } },
};

export default function Simulator() {
  const notify = useToast();
  const [range, setRange] = useState(defaultRange());
  const [scenarios, setScenarios] = useState([{ type: "reduce_electricity", ...TYPES.reduce_electricity.init }, { type: "shift_transport", ...TYPES.shift_transport.init }]);
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const saved = useFetch(() => api.scenarios(), []);

  const patch = (i, k, v) => setScenarios((s) => s.map((x, j) => (j === i ? { ...x, [k]: v } : x)));
  const retype = (i, type) => setScenarios((s) => s.map((x, j) => (j === i ? { type, ...TYPES[type].init } : x)));
  const run = async () => {
    setBusy(true);
    try {
      const body = scenarios.map((s) => (s.percent !== undefined ? { ...s, percent: Number(s.percent) } : s));
      setOut(await api.simulate({ ...range, scenarios: body }));
    } catch (e) { notify(e.message, "error"); setOut(null); } finally { setBusy(false); }
  };
  const save = async () => {
    try { await api.saveScenario({ name, scenarios, results: out.results }); notify("Scenario saved"); setName(""); saved.reload(); } catch (e) { notify(e.message, "error"); }
  };

  return (
    <div className="page">
      <div className="page-head"><div><h1>What-if simulator</h1><p>Try changes on top of your records for the chosen period. Nothing here edits your saved data.</p></div></div>
      <FilterBar value={range} onChange={setRange} showCategory={false} />
      <div className="grid">
        {scenarios.map((s, i) => (
          <div className="card" key={i}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <h3 style={{ margin: 0 }}>Scenario {i + 1}</h3>
              {scenarios.length > 1 && <button className="btn sm danger" aria-label="Remove scenario" onClick={() => setScenarios((x) => x.filter((_, j) => j !== i))}><Trash2 size={14} /></button>}
            </div>
            <div className="form mt">
              <label>Type<select value={s.type} onChange={(e) => retype(i, e.target.value)}>{Object.entries(TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
              {s.percent !== undefined && <label>Percent<input type="number" min="0" max="100" value={s.percent} onChange={(e) => patch(i, "percent", e.target.value)} /></label>}
              {s.type === "reduce_fuel" && <label>Fuel<select value={s.fuel_type} onChange={(e) => patch(i, "fuel_type", e.target.value)}><option value="">All fuels</option><option value="petrol">Petrol</option><option value="diesel">Diesel</option><option value="lpg">LPG</option><option value="natural_gas">Natural gas</option></select></label>}
              {s.type === "shift_transport" && (
                <>
                  <label>From<select value={s.from_mode} onChange={(e) => patch(i, "from_mode", e.target.value)}><option value="car">Car</option><option value="motorcycle">Motorcycle</option><option value="air">Air</option></select></label>
                  <label>To<select value={s.to_mode} onChange={(e) => patch(i, "to_mode", e.target.value)}><option value="bus">Bus</option><option value="train_metro">Train or metro</option></select></label>
                </>
              )}
              {s.type === "change_waste" && (
                <>
                  <label>Waste<select value={s.waste_category} onChange={(e) => patch(i, "waste_category", e.target.value)}>{["food", "paper", "plastic", "glass", "mixed"].map((c) => <option key={c}>{c}</option>)}</select></label>
                  <label>From<select value={s.from_method} onChange={(e) => patch(i, "from_method", e.target.value)}>{["landfill", "recycling", "composting", "incineration"].map((c) => <option key={c}>{c}</option>)}</select></label>
                  <label>To<select value={s.to_method} onChange={(e) => patch(i, "to_method", e.target.value)}>{["landfill", "recycling", "composting", "incineration"].map((c) => <option key={c}>{c}</option>)}</select></label>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="row mt">
        {scenarios.length < 6 && <button className="btn ghost" onClick={() => setScenarios((s) => [...s, { type: "reduce_electricity", ...TYPES.reduce_electricity.init }])}><Plus size={16} /> Add scenario</button>}
        <button className="btn" onClick={run} disabled={busy}>{busy ? "Running..." : "Run simulation"}</button>
      </div>
      {busy && <Loading />}
      {out && (
        <div className="mt">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Scenario</th><th>Category</th><th>Baseline kg</th><th>Simulated kg</th><th>Reduction kg</th><th>Reduction %</th><th>Annual estimate kg</th></tr></thead>
              <tbody>{out.results.map((r, i) => (
                <tr key={i}><td>{r.name}</td><td>{r.category}</td><td>{fmt(r.baseline_kg)}</td><td>{fmt(r.simulated_kg)}</td><td><strong>{fmt(r.reduction_kg)}</strong></td><td>{r.reduction_percent}%</td><td>{r.annual_reduction_kg == null ? "n/a" : fmt(r.annual_reduction_kg)}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <div className="card mt"><div className="chart-box"><ResponsiveContainer><BarChart data={out.results}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip /><Legend /><Bar dataKey="baseline_kg" name="Baseline" fill="#a9d4b6" /><Bar dataKey="simulated_kg" name="Simulated" fill="#14532d" /></BarChart></ResponsiveContainer></div></div>
          <div className="grid g2 mt">
            {out.results.map((r, i) => (
              <div className="card soft small" key={i}>
                <strong>{r.name}</strong>
                <p className="formula">{r.formula}</p>
                <ul className="lines">{r.assumptions.map((a, j) => <li key={j}>{a}</li>)}</ul>
                <div className="muted">{r.annual_note}</div>
                {r.baseline_kg === 0 && <div className="field-error">No matching records in this period, so there is nothing to reduce.</div>}
              </div>
            ))}
          </div>
          <div className="row mt">
            <input placeholder="Name this comparison" value={name} onChange={(e) => setName(e.target.value)} aria-label="Scenario name" />
            <button className="btn ghost" disabled={!name.trim()} onClick={save}>Save comparison</button>
          </div>
        </div>
      )}
      {saved.data?.scenarios?.length > 0 && (
        <div className="card mt">
          <h2>Saved comparisons</h2>
          {saved.data.scenarios.map((s) => (
            <div className="row" key={s.id} style={{ justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #d3e3d8" }}>
              <span><strong>{s.name}</strong> <span className="muted small">{s.result.map((r) => `${r.name}: -${fmt(r.reduction_kg)} kg`).join("; ")}</span></span>
              <button className="btn sm danger" onClick={async () => { await api.deleteScenario(s.id); saved.reload(); }}>Delete</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
