import { useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { BarChart3, BookOpen, FileText, History, Leaf, LayoutDashboard, Lightbulb, Menu, PlusCircle, Search, SlidersHorizontal, Target, X } from "lucide-react";

const links = [
  ["/dashboard", "Dashboard", LayoutDashboard],
  ["/add", "Add activity", PlusCircle],
  ["/history", "Activity history", History],
  ["/analysis", "Emission analysis", Search],
  ["/recommendations", "Recommendations", Lightbulb],
  ["/simulator", "What-if simulator", SlidersHorizontal],
  ["/targets", "Targets and progress", Target],
  ["/reports", "Reports", FileText],
  ["/methodology", "Methodology", BookOpen],
];

export default function AppLayout() {
  const [open, setOpen] = useState(false);
  return (
    <div className="shell">
      <header className="topbar">
        <button className="icon-btn menu" aria-label="Toggle menu" onClick={() => setOpen(!open)}>
          {open ? <X /> : <Menu />}
        </button>
        <Link to="/" className="brand">
          <Leaf size={22} /> EcoTrack AI
        </Link>
        <span className="topbar-note">
          <BarChart3 size={16} /> Estimates based on illustrative factors
        </span>
      </header>
      <nav className={`sidebar ${open ? "open" : ""}`} aria-label="Main">
        {links.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? "active" : "")}>
            <Icon size={18} /> {label}
          </NavLink>
        ))}
      </nav>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
