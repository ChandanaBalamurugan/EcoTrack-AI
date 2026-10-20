export const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";

const qs = (params) => {
  const entries = Object.entries(params || {}).filter(([, v]) => v !== "" && v != null);
  return entries.length ? "?" + new URLSearchParams(entries).toString() : "";
};

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(API_BASE + path, { headers: { "Content-Type": "application/json" }, ...options });
  } catch {
    throw new Error("Cannot reach the server. Check that the Flask backend is running.");
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const send = (method, path, body) => request(path, { method, body: body ? JSON.stringify(body) : undefined });

export const api = {
  url: (path, params) => API_BASE + path + qs(params),
  health: () => request("/health"),
  factors: () => request("/factors"),
  calculate: (body) => send("POST", "/calculate", body),
  activities: (p) => request("/activities" + qs(p)),
  activity: (id) => request(`/activities/${id}`),
  addActivity: (b) => send("POST", "/activities", b),
  updateActivity: (id, b) => send("PUT", `/activities/${id}`, b),
  deleteActivity: (id) => send("DELETE", `/activities/${id}`),
  calculation: (id) => request(`/activities/${id}/calculation`),
  dashboard: (p) => request("/dashboard" + qs(p)),
  hotspot: (p) => request("/hotspot" + qs(p)),
  recommendations: (p) => request("/recommendations" + qs(p)),
  simulate: (b) => send("POST", "/simulate", b),
  scenarios: () => request("/scenarios"),
  saveScenario: (b) => send("POST", "/scenarios", b),
  deleteScenario: (id) => send("DELETE", `/scenarios/${id}`),
  targets: () => request("/targets"),
  addTarget: (b) => send("POST", "/targets", b),
  deleteTarget: (id) => send("DELETE", `/targets/${id}`),
  targetProgress: () => request("/targets/progress"),
  reportSummary: (year) => request("/reports/summary" + qs({ year })),
  loadDemo: () => send("POST", "/demo-data"),
  clearAll: () => send("DELETE", "/demo-data"),
};
