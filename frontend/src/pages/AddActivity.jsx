import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CatIcon from "../components/CatIcon";
import { Loading } from "../components/States";
import { useToast } from "../components/Toast";
import useFetch from "../hooks/useFetch";
import { api } from "../services/api";
import { CATS, CAT_KEYS, fmt, isoDate, pretty } from "../utils/format";

const FUEL_UNITS = { petrol: ["L", "gal"], diesel: ["L", "gal"], lpg: ["kg", "L"], natural_gas: ["m3"] };
const MODES = [["car", "Car"], ["motorcycle", "Motorcycle"], ["bus", "Bus"], ["train_metro", "Train or metro"], ["air", "Air travel"]];

const defaults = (cat) => ({
  electricity: { unit: "kWh", region: "IN" },
  transport: { unit: "km", subtype: "car", method: "petrol", occupancy: 1 },
  fuel: { subtype: "petrol", unit: "L" },
  waste: { unit: "kg", subtype: "food", method: "landfill" },
}[cat]);

const blank = (cat = "electricity") => ({ category: cat, quantity: "", activity_date: isoDate(new Date()), period_start: "", period_end: "", notes: "", ...defaults(cat) });

export default function AddActivity() {
  const { id } = useParams();
  const nav = useNavigate();
  const notify = useToast();
  const [form, setForm] = useState(blank());
  const [errors, setErrors] = useState({});
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const factors = useFetch(() => api.factors(), []);
  const existing = useFetch(() => (id ? api.activity(id) : Promise.resolve(null)), [id]);

  useEffect(() => {
    const a = existing.data;
    if (a) setForm({ ...blank(a.category), ...a, quantity: a.quantity, period_start: a.period_start || "", period_end: a.period_end || "", notes: a.notes || "", occupancy: a.occupancy || 1 });
  }, [existing.data]);

  const waste = (factors.data?.factors || []).filter((f) => f.category === "waste");
  const wasteCats = [...new Set(waste.map((f) => f.subtype))];
  const wasteMethods = waste.filter((f) => f.subtype === form.subtype).map((f) => f.method);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const pickCategory = (cat) => { setForm(blank(cat)); setErrors({}); setPreview(null); };
  const pickWasteCat = (e) => {
    const sub = e.target.value;
    const methods = waste.filter((f) => f.subtype === sub).map((f) => f.method);
    setForm((f) => ({ ...f, subtype: sub, method: methods.includes(f.method) ? f.method : methods[0] }));
  };
  const pickFuel = (e) => { const sub = e.target.value; setForm((f) => ({ ...f, subtype: sub, unit: FUEL_UNITS[sub][0] })); };

  const payload = () => {
    const p = { ...form, quantity: form.quantity === "" ? null : Number(form.quantity) };
    p.occupancy = Number(form.occupancy) || 1;
    if (form.category !== "electricity") { delete p.period_start; delete p.period_end; }
    return p;
  };

  const validate = () => {
    const e = {};
    const q = Number(form.quantity);
    if (form.quantity === "" || Number.isNaN(q)) e.quantity = "Enter a number.";
    else if (q < 0) e.quantity = "Quantity cannot be negative.";
    if (!form.activity_date) e.activity_date = "Choose the activity date.";
    else if (form.activity_date > isoDate(new Date())) e.activity_date = "The date cannot be in the future.";
    if (form.period_start && form.period_end && form.period_start > form.period_end) e.period_end = "End must be after the start.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  useEffect(() => {
    if (form.quantity === "" || Number(form.quantity) < 0 || Number.isNaN(Number(form.quantity))) { setPreview(null); return; }
    const t = setTimeout(() => {
      api.calculate(payload()).then(setPreview).catch((e) => setPreview({ error: e.message }));
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.category, form.quantity, form.unit, form.subtype, form.method, form.region, form.occupancy]);

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate()) return;
    setBusy(true);
    try {
      if (id) { await api.updateActivity(id, payload()); notify("Activity updated"); nav("/history"); }
      else { const a = await api.addActivity(payload()); notify("Activity saved"); nav(`/activities/${a.id}/calculation`); }
    } catch (e) { notify(e.message, "error"); } finally { setBusy(false); }
  };

  if (id && existing.loading) return <Loading />;
  const cat = form.category;
  return (
    <div className="page">
      <div className="page-head"><div><h1>{id ? "Edit activity" : "Add activity"}</h1><p>Emissions are calculated when you save and recalculated if you edit.</p></div></div>
      {!id && (
        <div className="tabs" style={{ marginBottom: 16 }} role="tablist">
          {CAT_KEYS.map((k) => (
            <button key={k} type="button" role="tab" aria-selected={cat === k} className={`tab ${cat === k ? "on" : ""}`} onClick={() => pickCategory(k)}>
              <CatIcon category={k} /> {CATS[k].label}
            </button>
          ))}
        </div>
      )}
      <div className="grid g2">
        <form className="card form" onSubmit={submit} noValidate>
          <label>
            {cat === "transport" ? "Distance" : cat === "waste" ? "Quantity" : "Quantity"}
            <input type="number" step="any" min="0" value={form.quantity} onChange={set("quantity")} aria-invalid={!!errors.quantity} />
            {errors.quantity && <span className="field-error">{errors.quantity}</span>}
          </label>
          <label>
            Unit
            {cat === "electricity" && <select value={form.unit} onChange={set("unit")}><option>kWh</option><option>MWh</option></select>}
            {cat === "transport" && <select value={form.unit} onChange={set("unit")}><option value="km">km</option><option value="mi">miles</option></select>}
            {cat === "fuel" && <select value={form.unit} onChange={set("unit")}>{FUEL_UNITS[form.subtype].map((u) => <option key={u} value={u}>{u === "gal" ? "US gallon" : u}</option>)}</select>}
            {cat === "waste" && <select value={form.unit} onChange={set("unit")}><option value="kg">kg</option><option value="g">g</option><option value="t">tonne</option></select>}
          </label>
          <label>
            Activity date
            <input type="date" value={form.activity_date} max={isoDate(new Date())} onChange={set("activity_date")} aria-invalid={!!errors.activity_date} />
            {errors.activity_date && <span className="field-error">{errors.activity_date}</span>}
          </label>
          {cat === "electricity" && (
            <label>Grid region
              <select value={form.region} onChange={set("region")}><option value="IN">India</option><option value="OTHER">Other (generic)</option></select>
            </label>
          )}
          {cat === "transport" && (
            <>
              <label>Mode
                <select value={form.subtype} onChange={(e) => setForm((f) => ({ ...f, subtype: e.target.value, method: e.target.value === "car" ? "petrol" : "" }))}>
                  {MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              {form.subtype === "car" && (
                <>
                  <label>Fuel type
                    <select value={form.method} onChange={set("method")}><option value="petrol">Petrol</option><option value="diesel">Diesel</option></select>
                  </label>
                  <label>People in the vehicle
                    <input type="number" min="1" max="20" value={form.occupancy} onChange={set("occupancy")} />
                    <span className="hint">Your share = vehicle emissions divided by occupants.</span>
                  </label>
                </>
              )}
              {form.subtype === "motorcycle" && (
                <label>People on the motorcycle
                  <input type="number" min="1" max="20" value={form.occupancy} onChange={set("occupancy")} />
                </label>
              )}
            </>
          )}
          {cat === "fuel" && (
            <label>Fuel type
              <select value={form.subtype} onChange={pickFuel}>{Object.keys(FUEL_UNITS).map((f) => <option key={f} value={f}>{pretty(f)}</option>)}</select>
            </label>
          )}
          {cat === "waste" && (
            <>
              <label>Waste category
                <select value={form.subtype} onChange={pickWasteCat}>{wasteCats.map((c) => <option key={c} value={c}>{c}</option>)}</select>
              </label>
              <label>Disposal method
                <select value={form.method} onChange={set("method")}>{wasteMethods.map((m) => <option key={m} value={m}>{m}</option>)}</select>
                <span className="hint">Only methods with a documented factor are listed.</span>
              </label>
            </>
          )}
          {cat === "electricity" && (
            <>
              <label>Reporting period start (optional)<input type="date" value={form.period_start} onChange={set("period_start")} /></label>
              <label>Reporting period end (optional)
                <input type="date" value={form.period_end} onChange={set("period_end")} />
                {errors.period_end && <span className="field-error">{errors.period_end}</span>}
              </label>
            </>
          )}
          <label className="full">Notes (optional)<input maxLength={255} value={form.notes} onChange={set("notes")} /></label>
          <div className="full row">
            <button className="btn" disabled={busy}>{busy ? "Saving..." : id ? "Save changes" : "Save activity"}</button>
            <button type="button" className="btn ghost" onClick={() => nav(-1)}>Cancel</button>
          </div>
        </form>
        <div className="card soft" aria-live="polite">
          <h2>Live preview</h2>
          {!preview && <p className="muted">Enter a quantity to see the calculation.</p>}
          {preview?.error && <p className="field-error">{preview.error}</p>}
          {preview && !preview.error && (
            <>
              <p className="formula">{preview.substitution}</p>
              <p style={{ fontSize: "1.6rem", fontWeight: 700, margin: "10px 0 4px" }}>{fmt(preview.emissions_kg, 3)} kg CO2e</p>
              <p className="small muted">Factor: {preview.emission_factor} {preview.factor_unit}. {preview.illustrative && "Illustrative classroom value."}</p>
              <p className="small muted">This is a preview. Save the activity to open the full 8-step breakdown.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
