import { ErrorBox, Loading } from "../components/States";
import useFetch from "../hooks/useFetch";
import { api } from "../services/api";
import { CATS } from "../utils/format";

const formulas = [
  ["Electricity", "kWh x grid factor (kg CO2e/kWh)"],
  ["Transportation", "distance (km) x factor (kg CO2e per vehicle-km, divided by occupants, or per passenger-km)"],
  ["Fuel", "quantity (L, kg or m3) x fuel factor (kg CO2e per same unit)"],
  ["Waste", "mass (kg) x disposal-method factor (kg CO2e/kg)"],
];

export default function Methodology() {
  const { data, loading, error, reload } = useFetch(() => api.factors(), []);
  return (
    <div className="page">
      <div className="page-head"><div><h1>Methodology and emission factors</h1><p>Estimated emissions (kg CO2e) = activity quantity x emission factor.</p></div></div>
      <div className="grid g2">
        <div className="card"><h2>Formulas</h2><dl className="kv">{formulas.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl></div>
        <div className="card"><h2>Unit handling</h2><p className="muted" style={{ margin: 0 }}>Quantities are converted into the unit the factor expects before multiplying (MWh to kWh, miles to km, US gallons to litres, grams or tonnes to kg). Combinations without a documented factor are rejected rather than guessed.</p></div>
      </div>
      {data && <div className="banner mt"><strong>Dataset {data.version}.</strong> {data.notice}</div>}
      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && (
        <div className="table-wrap mt">
          <table>
            <thead><tr><th>Category</th><th>Factor</th><th>Value</th><th>Region and year</th><th>Boundary</th><th>Source</th><th>Status</th></tr></thead>
            <tbody>
              {data.factors.map((f) => (
                <tr key={f.key}>
                  <td>{CATS[f.category].label}</td><td>{f.label}</td><td>{f.value} {f.unit}</td><td>{f.region}, {f.year}</td><td>{f.boundary}</td>
                  <td><a href={f.url} target="_blank" rel="noreferrer">{f.source}</a></td>
                  <td><span className={`badge ${f.illustrative ? "warn" : ""}`}>{f.illustrative ? "Illustrative" : "Official"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
