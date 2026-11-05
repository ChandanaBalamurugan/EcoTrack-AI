import { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity, MapPin, Navigation, Route, Clock,
  Play, Square, Satellite, AlertCircle, CheckCircle
} from "lucide-react";
import { api } from "../services/api";
import { useToast } from "../components/Toast";

const MODES = [
  ["car", "Car"],
  ["motorcycle", "Motorcycle"],
  ["bus", "Bus"],
  ["train_metro", "Train / Metro"],
  ["air", "Air travel"],
];

const STATIONARY_TIME = 3 * 60 * 1000;

function distanceBetween(a, b) {
  const R = 6371000;
  const rad = (v) => v * Math.PI / 180;

  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) *
    Math.cos(rad(b.lat)) *
    Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

function localDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function TripTracking() {
  const notify = useToast();

  const [monitoring, setMonitoring] = useState(false);
  const [tripActive, setTripActive] = useState(false);
  const [distance, setDistance] = useState(0);
  const [mode, setMode] = useState("motorcycle");
  const [fuel, setFuel] = useState("petrol");
  const [occupancy, setOccupancy] = useState(1);
  const [status, setStatus] = useState("GPS tracking is currently off.");
  const [error, setError] = useState("");
  const [lastFix, setLastFix] = useState(null);
  const [savedActivity, setSavedActivity] = useState(null);

  const watchIdRef = useRef(null);
  const lastPointRef = useRef(null);
  const tripActiveRef = useRef(false);
  const distanceRef = useRef(0);
  const movementSamplesRef = useRef(0);
  const pendingDistanceRef = useRef(0);
  const lastMovementAtRef = useRef(0);
  const startedAtRef = useRef(null);
  const savingRef = useRef(false);
  const saveFailedRef = useRef(false);

  const resetTrip = () => {
    tripActiveRef.current = false;
    distanceRef.current = 0;
    movementSamplesRef.current = 0;
    pendingDistanceRef.current = 0;
    lastMovementAtRef.current = 0;
    startedAtRef.current = null;

    setTripActive(false);
    setDistance(0);
  };

  const saveTrip = useCallback(async () => {
    if (!tripActiveRef.current || savingRef.current) return;

    savingRef.current = true;
    saveFailedRef.current = false;

    const km = distanceRef.current / 1000;
    const start = startedAtRef.current || new Date();

    if (km < 0.05) {
      resetTrip();
      setStatus("Trip was too short to save. Waiting for the next trip.");
      savingRef.current = false;
      return;
    }

    const payload = {
      category: "transport",
      quantity: Number(km.toFixed(3)),
      unit: "km",
      subtype: mode,
      method: mode === "car" ? fuel : "",
      occupancy: Number(occupancy) || 1,
      activity_date: localDate(start),
      notes: `Automatically detected GPS trip. Distance: ${km.toFixed(2)} km.`,
    };

    try {
      const result = await api.addActivity(payload);

      setSavedActivity(result);
      notify("GPS trip saved successfully!");

      setStatus(
        `Trip saved! ${km.toFixed(2)} km recorded in your activity history.`
      );

      resetTrip();
      lastPointRef.current = null;

    } catch (err) {
      saveFailedRef.current = true;
      setError(err.message);
      setStatus("Trip is ready but could not be saved. Check your connection and retry.");
      notify(err.message, "error");

    } finally {
      savingRef.current = false;
    }
  }, [mode, fuel, occupancy, notify]);

  const handlePosition = useCallback((position) => {
    const coords = position.coords;

    if (coords.accuracy > 50) {
      setStatus("GPS accuracy is low. Waiting for a better location signal.");
      return;
    }

    setError("");

    const current = {
      lat: coords.latitude,
      lon: coords.longitude,
      timestamp: position.timestamp,
    };

    setLastFix(new Date(position.timestamp));

    const previous = lastPointRef.current;
    lastPointRef.current = current;

    if (!previous || savingRef.current) return;

    const delta = distanceBetween(previous, current);
    const seconds = Math.max(
      (current.timestamp - previous.timestamp) / 1000,
      1
    );

    const speed =
      Number.isFinite(coords.speed) && coords.speed > 0
        ? coords.speed
        : delta / seconds;

    // Ignore inaccurate GPS movement.
    const moving = delta >= 8 && speed >= 1;

    if (!tripActiveRef.current) {
      if (moving) {
        movementSamplesRef.current += 1;
        pendingDistanceRef.current += delta;

        setStatus("Movement detected. Confirming your trip...");

        // Two consecutive moving readings start a trip.
        if (movementSamplesRef.current >= 2) {
          tripActiveRef.current = true;
          startedAtRef.current = new Date(previous.timestamp);
          distanceRef.current = pendingDistanceRef.current;
          lastMovementAtRef.current = Date.now();

          setTripActive(true);
          setDistance(distanceRef.current / 1000);
          setStatus("Trip detected! Automatically tracking your journey.");
          notify("Your trip has started!");
        }
      } else {
        movementSamplesRef.current = 0;
        pendingDistanceRef.current = 0;
        setStatus("GPS active. Waiting for movement...");
      }

      return;
    }

    if (moving) {
      distanceRef.current += delta;
      lastMovementAtRef.current = Date.now();
      setDistance(distanceRef.current / 1000);
      setStatus("Trip in progress. GPS tracking active.");
    }

  }, [notify]);

  // Monitor stationary time and automatically finish a trip.
  useEffect(() => {
    if (!monitoring) return;

    const timer = setInterval(() => {
      if (
        tripActiveRef.current &&
        !saveFailedRef.current &&
        Date.now() - lastMovementAtRef.current >= STATIONARY_TIME
      ) {
        setStatus("You appear to have stopped. Saving your trip...");
        saveTrip();
      }
    }, 5000);

    return () => clearInterval(timer);
  }, [monitoring, saveTrip]);

  // Clean up the GPS watcher when leaving the page.
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const startTracking = () => {
    if (!navigator.geolocation) {
      setError("Your browser does not support GPS location.");
      return;
    }

    if (!window.isSecureContext) {
      setError("GPS requires HTTPS or localhost. Open the secure website.");
      return;
    }

    setError("");
    setSavedActivity(null);
    lastPointRef.current = null;
    resetTrip();

    try {
      const id = navigator.geolocation.watchPosition(
        handlePosition,
        (err) => {
          const messages = {
            1: "Location permission denied. Allow location access in browser settings.",
            2: "GPS location is unavailable. Check your device location settings.",
            3: "GPS request timed out. Try again.",
          };

          setError(messages[err.code] || "Unable to access GPS.");
          setStatus("GPS tracking encountered an error.");
        },
        {
          enableHighAccuracy: true,
          maximumAge: 2000,
          timeout: 20000,
        }
      );

      watchIdRef.current = id;
      setMonitoring(true);
      setStatus("GPS activated. Waiting for movement...");
      notify("GPS monitoring started.");

    } catch (err) {
      setError(err.message);
    }
  };

  const stopTracking = async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setMonitoring(false);

    if (tripActiveRef.current) {
      await saveTrip();
    } else {
      setStatus("GPS monitoring stopped.");
    }
  };

  const retrySave = () => {
    if (!tripActiveRef.current) return;
    saveTrip();
  };

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>GPS Transportation Tracking</h1>
          <p>
            Automatically detect journeys and calculate your
            transportation carbon footprint.
          </p>
        </div>
        <span className={`badge ${monitoring ? "" : "warn"}`}>
          {monitoring ? "GPS Active" : "GPS Inactive"}
        </span>
      </div>

      <div className="banner">
        <Satellite size={17} style={{ verticalAlign: "middle" }} />
        {" "}Keep this page open while travelling. GPS tracking
        requires location permission and an internet connection
        to save trips to your account.
      </div>

      <div className="grid g3 mt">
        <div className="card">
          <div className="stat-label">
            <Route size={17} /> Distance travelled
          </div>
          <div className="stat-value">
            {distance.toFixed(2)}
            <span className="stat-unit"> km</span>
          </div>
          <div className="stat-sub">Current trip</div>
        </div>

        <div className="card">
          <div className="stat-label">
            <Activity size={17} /> Trip status
          </div>
          <div className="stat-value" style={{ fontSize: "1.3rem" }}>
            {tripActive ? "Moving" : monitoring ? "Waiting" : "Stopped"}
          </div>
          <div className="stat-sub">Automatic movement detection</div>
        </div>

        <div className="card">
          <div className="stat-label">
            <Clock size={17} /> Last GPS update
          </div>
          <div className="stat-value" style={{ fontSize: "1.1rem" }}>
            {lastFix ? lastFix.toLocaleTimeString() : "--:--"}
          </div>
          <div className="stat-sub">Latest location reading</div>
        </div>
      </div>

      <div className="grid g2 mt">
        <div className="card">
          <h2>Transportation settings</h2>
          <p className="muted small">
            Select your usual transportation mode before tracking.
            GPS detects distance, not the exact vehicle type.
          </p>

          <div className="form mt">
            <label>
              Transport mode
              <select
                value={mode}
                disabled={monitoring || tripActive}
                onChange={(e) => setMode(e.target.value)}
              >
                {MODES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            {mode === "car" && (
              <label>
                Car fuel type
                <select
                  value={fuel}
                  disabled={monitoring}
                  onChange={(e) => setFuel(e.target.value)}
                >
                  <option value="petrol">Petrol</option>
                  <option value="diesel">Diesel</option>
                </select>
              </label>
            )}

            {(mode === "car" || mode === "motorcycle") && (
              <label>
                Number of occupants
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={occupancy}
                  disabled={monitoring}
                  onChange={(e) => setOccupancy(e.target.value)}
                />
              </label>
            )}
          </div>

          <div className="row mt">
            {!monitoring ? (
              <button className="btn" onClick={startTracking}>
                <Play size={17} /> Enable GPS & Start
              </button>
            ) : (
              <button className="btn danger" onClick={stopTracking}>
                <Square size={17} /> Stop monitoring
              </button>
            )}

            {saveFailedRef.current && (
              <button className="btn" onClick={retrySave}>
                Retry saving trip
              </button>
            )}
          </div>
        </div>

        <div className="card soft">
          <h2>
            <Navigation size={19} /> Tracking status
          </h2>

          <p>{status}</p>

          {error && (
            <div className="banner" style={{ marginTop: 12 }}>
              <AlertCircle size={17} />
              {" "}{error}
            </div>
          )}

          {monitoring && tripActive && (
            <div className="banner ok mt">
              <CheckCircle size={17} />
              {" "}Your trip is being recorded automatically.
            </div>
          )}

          {savedActivity && (
            <div className="banner ok mt">
              <CheckCircle size={17} />
              {" "}Trip saved! Activity ID: {savedActivity.id}
            </div>
          )}

          <hr style={{ border: 0, borderTop: "1px solid var(--line)", margin: "18px 0" }} />

          <h3>Automatic detection rules</h3>
          <ul className="small">
            <li>Two consecutive movement readings start a trip.</li>
            <li>GPS readings with poor accuracy are ignored.</li>
            <li>Three minutes without detected movement ends a trip.</li>
            <li>Trips are saved using your existing emission calculator.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}