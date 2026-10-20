import { CAT_KEYS, CATS } from "../utils/format";

export default function FilterBar({ value, onChange, showCategory = true }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="filters">
      <label>
        From
        <input type="date" value={value.start} onChange={set("start")} />
      </label>
      <label>
        To
        <input type="date" value={value.end} onChange={set("end")} />
      </label>
      {showCategory && (
        <label>
          Category
          <select value={value.category || ""} onChange={set("category")}>
            <option value="">All categories</option>
            {CAT_KEYS.map((c) => (
              <option key={c} value={c}>
                {CATS[c].label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
