from flask import Flask, jsonify
from flask_cors import CORS
from werkzeug.exceptions import HTTPException

from .calculations import factors as F
from .calculations.engine import CalculationError
from .config import Config
from .database import db


def seed_factors():
    from .models import EmissionFactor
    version = F.dataset_version()
    for f in F.all_factors():
        row = db.session.get(EmissionFactor, f["key"]) or EmissionFactor(key=f["key"])
        row.category, row.label, row.value, row.unit = f["category"], f["label"], f["value"], f["unit"]
        row.region, row.year, row.version, row.boundary = f["region"], f["year"], version, f["boundary"]
        row.source, row.url, row.illustrative = f["source"], f["url"], f.get("illustrative", True)
        row.subtype, row.method = f["subtype"], f["method"]
        db.session.add(row)
    db.session.commit()


def create_app(overrides=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if overrides:
        app.config.update(overrides)
    CORS(app, origins=app.config["CORS_ORIGINS"])
    db.init_app(app)

    from .routes.api import bp
    app.register_blueprint(bp)

    @app.errorhandler(CalculationError)
    def bad_input(err):
        return jsonify({"error": str(err)}), 400

    @app.errorhandler(HTTPException)
    def http_error(err):
        return jsonify({"error": err.description or err.name}), err.code

    @app.errorhandler(Exception)
    def unexpected(err):
        app.logger.exception("Unhandled error")
        return jsonify({"error": "Something went wrong on the server."}), 500

    with app.app_context():
        from . import models  # noqa: F401
        db.create_all()
        seed_factors()
    return app
