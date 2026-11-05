import { Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import AddActivity from "./pages/AddActivity";
import History from "./pages/History";
import CalculationDetails from "./pages/CalculationDetails";
import Analysis from "./pages/Analysis";
import Recommendations from "./pages/Recommendations";
import Simulator from "./pages/Simulator";
import Targets from "./pages/Targets";
import Reports from "./pages/Reports";
import TripTracking from "./pages/TripTracking";
import Methodology from "./pages/Methodology";
import ElectricityScanner from "./pages/ElectricityScanner";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route element={<AppLayout />}>
      
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/add" element={<AddActivity />} />
        <Route path="/tracking" element={<TripTracking />} />
        <Route path="/electricity-scanner" element={<ElectricityScanner />} />
        <Route path="/activities/:id/edit" element={<AddActivity />} />
        <Route path="/history" element={<History />} />
        <Route path="/activities/:id/calculation" element={<CalculationDetails />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/recommendations" element={<Recommendations />} />
        <Route path="/simulator" element={<Simulator />} />
        <Route path="/targets" element={<Targets />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/methodology" element={<Methodology />} />
        <Route path="*" element={<div className="page"><h1>Page not found</h1></div>} />
      </Route>
    </Routes>
  );
}
