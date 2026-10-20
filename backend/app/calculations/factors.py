"""Loads the versioned emission-factor dataset (kept separate from calculation logic)."""
import json
import os

_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "emission_factors.json")
_cache = None


def load():
    global _cache
    if _cache is None:
        with open(_PATH, encoding="utf-8") as fh:
            _cache = json.load(fh)
    return _cache


def dataset_version():
    return load()["version"]


def all_factors():
    return load()["factors"]


def find(key):
    for f in all_factors():
        if f["key"] == key:
            return f
    return None


def waste_methods_for(waste_category):
    return [f["method"] for f in all_factors() if f["category"] == "waste" and f["subtype"] == waste_category]
