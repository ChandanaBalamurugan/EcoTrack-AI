export default function CalcSteps({ steps }) {
  return (
    <ol className="steps">
      {steps.map((s) => (
        <li key={s.step} className="card step">
          <div className="step-head">
            <span className="step-num">{s.step}</span>
            <h3>{s.title}</h3>
          </div>
          {s.text && <p className="formula">{s.text}</p>}
          {s.lines && (
            <ul className="lines">
              {s.lines.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
          {s.items && (
            <dl className="kv">
              {s.items.map((it, i) => (
                <div key={i}>
                  <dt>{it.label}</dt>
                  <dd>
                    {it.url ? (
                      <a href={it.url} target="_blank" rel="noreferrer">
                        {it.value}
                      </a>
                    ) : (
                      it.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </li>
      ))}
    </ol>
  );
}
