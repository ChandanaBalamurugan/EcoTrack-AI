import { useState } from "react";
import { Link } from "react-router-dom";
import { Calculator, Pencil, Trash2 } from "lucide-react";
import FilterBar from "../components/FilterBar";
import { EmptyState, ErrorBox, Loading } from "../components/States";
import { useToast } from "../components/Toast";
import useFetch from "../hooks/useFetch";
import { api } from "../services/api";
import { CATS, fmt, pretty } from "../utils/format";

export default function History() {
  const notify = useToast();
  const [f, setF] = useState({ start: "", end: "", category: "" });
  const { data, loading, error, reload } = useFetch(() => api.activities(f), [f.start, f.end, f.category]);

  const del = async (a) => {
    if (!window.confirm(`Delete this ${a.category} record from ${a.activity_date}?`)) return;
    try { await api.deleteActivity(a.id); notify("Activity deleted"); reload(); } catch (e) { notify(e.message, "error"); }
  };
  const demo = async () => { try { await api.loadDemo(); notify("Demo data loaded"); reload(); } catch (e) { notify(e.message, "error"); } };
  const clear = async () => {
    if (!window.confirm("Delete ALL activities, targets and saved scenarios?")) return;
    try { await api.clearAll(); notify("All data cleared"); reload(); } catch (e) { notify(e.message, "error"); }
  };

  const acts = data?.activities || [];
  return (
    <div className="page">
      <div className="page-head">
        <div><h1>Activity history</h1><p>Every record with the factor used. Open a record to see its calculation.</p></div>
        <Link className="btn" to="/add">Add activity</Link>
      </div>
      <FilterBar value={f} onChange={setF} />
      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && acts.length === 0 && (
        <EmptyState title="No activities found" text="Add your first activity or load demo data.">
          <Link className="btn" to="/add">Add activity</Link>
          <button className="btn ghost" onClick={demo}>Load demo data</button>
        </EmptyState>
      )}
      {acts.length > 0 && (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Category</th><th>Details</th><th>Quantity</th><th>Factor</th><th>kg CO2e</th><th>Actions</th></tr></thead>
              <tbody>
                {acts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.activity_date}</td>
                    <td><span className="dot" style={{ background: CATS[a.category].color }} />{CATS[a.category].label}</td>
                    <td>{[pretty(a.subtype), a.method, a.region].filter(Boolean).join(", ") || "-"}</td>
                    <td>{fmt(a.quantity, 2)} {a.unit}</td>
                    <td>{a.factor_value} {a.factor_unit}</td>
                    <td><strong>{fmt(a.emissions_kg, 2)}</strong></td>
                    <td>
                      <div className="row">
                        <Link className="btn sm ghost" to={`/activities/${a.id}/calculation`}><Calculator size={14} /> View calculation details</Link>
                        <Link className="btn sm ghost" to={`/activities/${a.id}/edit`} aria-label="Edit"><Pencil size={14} /></Link>
                        <button className="btn sm danger" onClick={() => del(a)} aria-label="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">{acts.length} records.</p>
        </>
      )}
      <div className="row mt">
        <button className="btn sm ghost" onClick={demo}>Load demo data</button>
        <button className="btn sm danger" onClick={clear}>Clear all data</button>
      </div>
    </div>
  );
}
