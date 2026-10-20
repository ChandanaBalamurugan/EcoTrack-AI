import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import CalcSteps from "../components/CalcSteps";
import { ErrorBox, Loading } from "../components/States";
import useFetch from "../hooks/useFetch";
import { api } from "../services/api";
import { fmt } from "../utils/format";

export default function CalculationDetails() {
  const { id } = useParams();
  const { data, loading, error, reload } = useFetch(() => api.calculation(id), [id]);
  return (
    <div className="page">
      <Link to="/history" className="row small"><ArrowLeft size={16} /> Back to history</Link>
      <div className="page-head mt">
        <div><h1>Calculation details</h1><p>How record #{id} became a CO2e estimate, step by step.</p></div>
        {data && <div className="calc-card"><div className="muted small">Result</div><div className="big">{fmt(data.emissions_kg, 3)} kg CO2e</div></div>}
      </div>
      {loading && <Loading />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && (
        <>
          {data.illustrative && <div className="banner" style={{ marginBottom: 12 }}>This record uses an illustrative classroom factor, not an official value. Check the source before using it for real reporting.</div>}
          <CalcSteps steps={data.steps} />
        </>
      )}
    </div>
  );
}
