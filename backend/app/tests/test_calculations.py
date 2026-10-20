import pytest

from app.calculations.engine import (CalculationError, calculate, calculate_electricity, calculate_fuel,
                                     calculate_transport, calculate_waste)
from app.calculations import factors as F


def test_electricity_formula_uses_dataset_factor():
    r = calculate_electricity(100, "kWh", "IN")
    assert r["emissions_kg"] == pytest.approx(100 * F.find("electricity_in")["value"])
    assert r["emissions_tonnes"] == pytest.approx(r["emissions_kg"] / 1000)
    assert "100 x 0.71" in r["substitution"]


def test_electricity_mwh_conversion():
    assert calculate_electricity(1, "MWh")["emissions_kg"] == pytest.approx(calculate_electricity(1000, "kWh")["emissions_kg"])


def test_transport_car_occupancy_and_conversion():
    solo = calculate_transport(100, "car", "petrol", "km", 1)["emissions_kg"]
    shared = calculate_transport(100, "car", "petrol", "km", 4)["emissions_kg"]
    assert shared == pytest.approx(solo / 4)
    miles = calculate_transport(10, "car", "petrol", "mi", 1)["emissions_kg"]
    assert miles == pytest.approx(calculate_transport(16.09344, "car", "petrol", "km", 1)["emissions_kg"])


def test_transport_bus_ignores_occupancy():
    assert calculate_transport(50, "bus", occupancy=5)["emissions_kg"] == pytest.approx(50 * 0.09)


def test_fuel_gallon_conversion():
    r = calculate_fuel(1, "petrol", "gal")
    assert r["base_quantity"] == pytest.approx(3.785411784)
    assert r["emissions_kg"] == pytest.approx(3.785411784 * 2.31, rel=1e-5)


def test_fuel_incompatible_unit_rejected():
    with pytest.raises(CalculationError):
        calculate_fuel(5, "natural_gas", "L")


def test_waste_methods_differ():
    landfill = calculate_waste(10, "food", "landfill")["emissions_kg"]
    compost = calculate_waste(10, "food", "composting")["emissions_kg"]
    assert landfill > compost


def test_waste_unsupported_combination():
    with pytest.raises(CalculationError):
        calculate_waste(1, "food", "recycling")


@pytest.mark.parametrize("bad", [-1, "abc", None, "", float("nan"), float("inf")])
def test_invalid_quantities(bad):
    with pytest.raises(CalculationError):
        calculate_electricity(bad)


def test_zero_gives_zero_emissions():
    assert calculate("electricity", 0)["emissions_kg"] == 0


def test_unknown_category_and_mode():
    with pytest.raises(CalculationError):
        calculate("space", 1)
    with pytest.raises(CalculationError):
        calculate_transport(5, "rocket")
    with pytest.raises(CalculationError):
        calculate_transport(5, "car")  # missing fuel subtype


def test_result_contains_required_fields():
    r = calculate("electricity", 10)
    for key in ("formula", "substitution", "arithmetic", "source", "source_url", "factor_version", "assumptions", "limitations"):
        assert r[key]
