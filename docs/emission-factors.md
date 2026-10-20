# Emission factors

The dataset is `backend/app/data/emission_factors.json` (version `2025.1-classroom`). It is loaded by the calculation engine and copied into the `emission_factors` database table at startup for display.

## IMPORTANT: values are illustrative

Every factor is marked `"illustrative": true`. The numbers are rounded classroom approximations that sit in a plausible range. **They are not official published values.** The `source` and `url` fields name the authority where the real figure should be looked up:

| Area | Where to find the authoritative value |
|---|---|
| India electricity grid | CEA CO2 Baseline Database for the Indian Power Sector (https://cea.nic.in/cdm-co2-baseline-database/) |
| Transport and fuels | UK DEFRA GHG conversion factors; India GHG Program (https://indiaghgp.org/); IPCC EFDB |
| Waste | US EPA GHG Emission Factors Hub; UK DEFRA |
| Other-region electricity | Your national grid operator or IEA |

## How to update a factor

1. Open the cited source and read the value, unit, year and boundary.
2. Edit the entry in `emission_factors.json` (`value`, `unit`, `year`, `boundary`, `source`, `url`) and set `"illustrative": false`.
3. Change `"version"` at the top of the file.
4. Restart the backend. New activities use the new factor. Existing activities keep the factor version stored in their snapshot, so history stays reproducible. Editing and re-saving an old activity recalculates it with the current factor.
5. Run `python -m pytest` and update any test that asserts an exact number.

Always check that the factor unit matches the activity unit. The engine rejects incompatible units.
