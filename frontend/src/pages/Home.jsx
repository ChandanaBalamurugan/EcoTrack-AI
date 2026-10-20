import { Link } from "react-router-dom";
import { BarChart3, Calculator, Leaf, Lightbulb, SlidersHorizontal, Target } from "lucide-react";
import useFetch from "../hooks/useFetch";
import { api } from "../services/api";
import { fmt } from "../utils/format";

const features = [
  [Calculator, "Every number explained", "Open any record to see the 8-step calculation from your input to the final CO2e value."],
  [BarChart3, "Find your biggest source", "Electricity, transport, fuel and waste are compared so the hotspot is obvious."],
  [Lightbulb, "Practical suggestions", "Savings are calculated with the same factors, never invented by the AI."],
  [SlidersHorizontal, "Try before you change", "Simulate cutting power use or switching to the bus without touching your records."],
  [Target, "Track a reduction target", "Set a baseline and see whether your recent months are on track."],
];

export default function Home() {
  const sample = useFetch(() => api.calculate({ category: "electricity", quantity: 100, unit: "kWh", region: "IN" }), []);
  const c = sample.data;
  return (
    <div className="landing">
      <div className="landing-nav">
        <span className="brand">
          <Leaf size={22} /> EcoTrack AI
        </span>
        <Link className="btn ghost" to="/dashboard">
          Open dashboard
        </Link>
      </div>
      <section className="hero">
        <div>
          <h1>See exactly how each activity becomes a carbon number.</h1>
          <p className="lead">
            EcoTrack AI records your electricity, travel, fuel and waste, calculates the CO2e, and shows every step so you can
            check it, question it and reduce it.
          </p>
          <div className="row">
            <Link className="btn" to="/add">
              Get started
            </Link>
            <Link className="btn ghost" to="/methodology">
              How we calculate
            </Link>
          </div>
        </div>
        <div className="calc-card" aria-live="polite">
          <div className="muted small">Live sample calculation (computed by the backend)</div>
          {sample.loading && <p>Calculating...</p>}
          {sample.error && <p className="small">Start the Flask backend to see a live sample. ({sample.error})</p>}
          {c && (
            <>
              <p className="formula">{c.formula}</p>
              <p className="formula" style={{ marginTop: 8 }}>
                {c.substitution}
              </p>
              <div className="big">{fmt(c.emissions_kg, 2)} kg CO2e</div>
              <div className="small muted">
                100 kWh x {c.emission_factor} {c.factor_unit}
                {c.illustrative && " - illustrative factor, not an official value"}
              </div>
            </>
          )}
        </div>
      </section>
      <section className="grid g3">
        {features.map(([Icon, title, text]) => (
          <div className="card" key={title}>
            <Icon size={22} color="#14532d" />
            <h3 style={{ marginTop: 8 }}>{title}</h3>
            <p className="muted" style={{ margin: 0 }}>
              {text}
            </p>
          </div>
        ))}
      </section>
    </div>
  );
}
