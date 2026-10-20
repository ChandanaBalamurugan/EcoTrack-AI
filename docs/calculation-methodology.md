# Calculation methodology

**Core formula:** Estimated emissions (kg CO2e) = Activity quantity x Emission factor

The quantity is first converted into the unit the factor expects. All code lives in `backend/app/calculations/engine.py` and has no Flask or database dependency.

| Category | Formula | Factor unit | Unit conversions |
|---|---|---|---|
| Electricity | kWh x grid factor | kg CO2e/kWh | MWh to kWh (x1000) |
| Transport (car, motorcycle) | km x vehicle factor / occupants | kg CO2e/vehicle-km | miles to km (x1.609344) |
| Transport (bus, train/metro, air) | km x passenger factor | kg CO2e/passenger-km | miles to km |
| Fuel (petrol, diesel) | litres x factor | kg CO2e/L | US gallon to L (x3.785411784) |
| Fuel (LPG) | kg x factor | kg CO2e/kg | L to kg (x0.51, assumed density) |
| Fuel (natural gas) | m3 x factor | kg CO2e/m3 | none |
| Waste | kg x disposal factor | kg CO2e/kg | g to kg, tonne to kg |

## Worked examples (using the bundled illustrative factors)

1. **Electricity:** 100 kWh x 0.71 = **71 kg CO2e** (0.071 t). Factor is illustrative.
2. **Car, 2 occupants:** 40 km x 0.17 / 2 = **3.4 kg CO2e** per person.
3. **Petrol, 1 US gallon:** 1 x 3.785411784 = 3.7854 L; 3.7854 x 2.31 = **8.744 kg CO2e**.
4. **Food waste, 10 kg:** landfill 10 x 0.58 = 5.8 kg; composting 10 x 0.10 = 1.0 kg; saving **4.8 kg CO2e**.

The app never hardcodes these results. Each is computed from the saved input and the factor dataset.

## Assumptions and boundaries

* Factors are **direct operational (tailpipe, combustion or disposal-stage) emissions** only. They exclude lifecycle emissions such as fuel production or vehicle manufacture. Each factor lists its own boundary in `emission_factors.json`.
* Recycling and composting factors do **not** credit avoided virgin-material emissions.
* Occupancy division is applied only to per-vehicle factors.
* Results are estimates. Changes in recorded activity are not verified environmental impact.

## Simulation and targets

* Simulations reuse the same engine and never modify saved records.
* Annual estimates are shown only when the selected period is at least 28 days: annual = reduction x 365 / period days.
* Target progress compares emissions per baseline-length period: `current_equivalent = current total / days elapsed x baseline days`.
