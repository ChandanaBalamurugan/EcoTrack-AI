"""Carbon calculation engine. Pure Python: no Flask or database imports.

Emissions (kg CO2e) = activity quantity (in the factor's unit) x emission factor
"""
import math

from . import factors as F

CATEGORIES = ("electricity", "transport", "fuel", "waste")
TRANSPORT_MODES = ("car", "motorcycle", "bus", "train_metro", "air")

# Multipliers that convert an input unit into the unit the factor expects.
ENERGY_UNITS = {"kWh": 1.0, "MWh": 1000.0}
LENGTH_UNITS = {"km": 1.0, "mi": 1.609344}
MASS_UNITS = {"kg": 1.0, "g": 0.001, "t": 1000.0}
FUEL_UNITS = {
    "petrol": {"L": 1.0, "gal": 3.785411784},   # gal = US gallon
    "diesel": {"L": 1.0, "gal": 3.785411784},
    "lpg": {"kg": 1.0, "L": 0.51},              # 0.51 kg/L assumed liquid LPG density
    "natural_gas": {"m3": 1.0},
}
FUEL_FACTOR_UNIT = {"petrol": "L", "diesel": "L", "lpg": "kg", "natural_gas": "m3"}


class CalculationError(ValueError):
    """Raised for invalid input. The API turns this into a 400 response."""


def check_quantity(value, name="Quantity"):
    if value is None or isinstance(value, bool) or (isinstance(value, str) and not value.strip()):
        raise CalculationError(f"{name} is required.")
    try:
        number = float(value)
    except (TypeError, ValueError):
        raise CalculationError(f"{name} must be a number.")
    if math.isnan(number) or math.isinf(number):
        raise CalculationError(f"{name} must be a finite number.")
    if number < 0:
        raise CalculationError(f"{name} cannot be negative.")
    return number


def unit_multiplier(unit, table, label):
    if unit not in table:
        raise CalculationError(f"Unsupported unit '{unit}' for {label}. Use one of: {', '.join(table)}.")
    return table[unit]


def num(x):
    return ("%.6f" % x).rstrip("0").rstrip(".") or "0"


def _factor(key):
    f = F.find(key)
    if f is None:
        raise CalculationError("No emission factor is available for this combination of inputs.")
    return f


def _finish(category, subtype, method, qty_in, unit_in, qty_base, unit_base, factor,
            divisor, formula, assumptions, limitations, region=None, occupancy=None, mult=1.0):
    emissions = round(qty_base * factor["value"] / divisor, 6)
    fv, fu = num(factor["value"]), factor["unit"]
    arithmetic = []
    if unit_in != unit_base:
        arithmetic.append(f"Convert units: {num(qty_in)} {unit_in} x {num(mult)} = {num(qty_base)} {unit_base}")
    expr = f"{num(qty_base)} {unit_base} x {fv} {fu}"
    sub = f"Emissions = {num(qty_base)} x {fv}"
    if divisor != 1:
        expr += f" / {divisor} occupants"
        sub += f" / {divisor}"
    arithmetic.append(f"{expr} = {num(emissions)} kg CO2e")
    arithmetic.append(f"{num(emissions)} kg / 1000 = {num(emissions / 1000)} t CO2e")
    return {
        "category": category, "subtype": subtype, "method": method, "region": region,
        "input_quantity": qty_in, "input_unit": unit_in,
        "base_quantity": qty_base, "base_unit": unit_base,
        "occupancy": occupancy,
        "factor_key": factor["key"], "emission_factor": factor["value"], "factor_unit": fu,
        "factor_label": factor["label"], "factor_region": factor["region"], "factor_year": factor["year"],
        "factor_version": F.dataset_version(), "boundary": factor["boundary"],
        "source": factor["source"], "source_url": factor["url"], "illustrative": factor.get("illustrative", False),
        "formula": formula, "substitution": sub, "arithmetic": arithmetic,
        "emissions_kg": emissions, "emissions_tonnes": round(emissions / 1000, 9),
        "assumptions": assumptions,
        "limitations": limitations + ["This is an estimate, not a measured or verified emission value."],
    }


def calculate_electricity(quantity, unit="kWh", region="IN"):
    q = check_quantity(quantity, "Electricity consumption")
    mult = unit_multiplier(unit, ENERGY_UNITS, "electricity")
    region = (region or "IN").upper()
    f = _factor(f"electricity_{region.lower()}")
    return _finish("electricity", None, None, q, unit, q * mult, "kWh", f, 1,
                   "Emissions (kg CO2e) = Electricity consumed (kWh) x Grid emission factor (kg CO2e/kWh)",
                   [f"Grid region: {region}. Location-based average grid factor."],
                   ["Does not reflect your supplier's specific mix or on-site renewable generation."],
                   region=region, mult=mult)


def calculate_transport(distance, mode, subtype=None, unit="km", occupancy=1):
    d = check_quantity(distance, "Distance")
    mult = unit_multiplier(unit, LENGTH_UNITS, "distance")
    if mode not in TRANSPORT_MODES:
        raise CalculationError(f"Unsupported transport mode '{mode}'. Use one of: {', '.join(TRANSPORT_MODES)}.")
    key = f"transport_{mode}"
    if mode == "car":
        if subtype not in ("petrol", "diesel"):
            raise CalculationError("Car trips need a fuel type: petrol or diesel.")
        key += f"_{subtype}"
    else:
        subtype = None
    f = _factor(key)
    divisor, occ = 1, None
    if f.get("per_vehicle"):
        try:
            occ = int(occupancy if occupancy not in (None, "") else 1)
        except (TypeError, ValueError):
            raise CalculationError("Occupancy must be a whole number.")
        if occ < 1 or occ > 20:
            raise CalculationError("Occupancy must be between 1 and 20.")
        divisor = occ
        formula = "Emissions (kg CO2e) = Distance (km) x Vehicle factor (kg CO2e/vehicle-km) / Occupants"
        assumptions = [f"Vehicle emissions are shared equally between {occ} occupant(s); your share is reported."]
    else:
        formula = "Emissions (kg CO2e) = Distance (km) x Passenger factor (kg CO2e/passenger-km)"
        assumptions = ["Factor already represents one passenger at average occupancy."]
    return _finish("transport", mode, subtype, d, unit, d * mult, "km", f, divisor, formula, assumptions,
                   ["Real emissions vary with vehicle age, load, traffic and driving style."],
                   occupancy=occ, mult=mult)


def calculate_fuel(quantity, fuel_type, unit=None):
    if fuel_type not in FUEL_UNITS:
        raise CalculationError(f"Unsupported fuel '{fuel_type}'. Use one of: {', '.join(FUEL_UNITS)}.")
    unit = unit or FUEL_FACTOR_UNIT[fuel_type]
    q = check_quantity(quantity, "Fuel quantity")
    mult = unit_multiplier(unit, FUEL_UNITS[fuel_type], f"{fuel_type}")
    f = _factor(f"fuel_{fuel_type}")
    base_unit = FUEL_FACTOR_UNIT[fuel_type]
    assumptions = []
    if unit != base_unit:
        assumptions.append(f"Converted {unit} to {base_unit} using multiplier {num(mult)}.")
    return _finish("fuel", fuel_type, None, q, unit, q * mult, base_unit, f, 1,
                   f"Emissions (kg CO2e) = Fuel burned ({base_unit}) x Fuel factor (kg CO2e/{base_unit})",
                   assumptions, ["Only direct combustion is counted; fuel production emissions are excluded."],
                   mult=mult)


def calculate_waste(quantity, waste_category, method, unit="kg"):
    q = check_quantity(quantity, "Waste quantity")
    mult = unit_multiplier(unit, MASS_UNITS, "waste")
    f = F.find(f"waste_{waste_category}_{method}")
    if f is None:
        ok = F.waste_methods_for(waste_category)
        hint = f" Supported methods for {waste_category}: {', '.join(ok)}." if ok else ""
        raise CalculationError(f"No documented factor for '{waste_category}' waste with '{method}' disposal.{hint}")
    return _finish("waste", waste_category, method, q, unit, q * mult, "kg", f, 1,
                   "Emissions (kg CO2e) = Waste mass (kg) x Disposal factor (kg CO2e/kg)",
                   [f"Disposal method: {method}."],
                   ["Avoided-emission credits (e.g. from recycling) are not included."], mult=mult)


def calculate(category, quantity, unit=None, subtype=None, method=None, region=None, occupancy=1):
    """Dispatch to the right calculator. subtype/method meaning depends on the category:
    transport: subtype=mode, method=car fuel type | fuel: subtype=fuel type | waste: subtype=category, method=disposal."""
    if category == "electricity":
        return calculate_electricity(quantity, unit or "kWh", region or "IN")
    if category == "transport":
        return calculate_transport(quantity, subtype, method, unit or "km", occupancy)
    if category == "fuel":
        return calculate_fuel(quantity, subtype, unit)
    if category == "waste":
        return calculate_waste(quantity, subtype, method, unit or "kg")
    raise CalculationError(f"Unknown category '{category}'. Use one of: {', '.join(CATEGORIES)}.")
