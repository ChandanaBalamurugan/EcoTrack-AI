"""Load demo activities and a target: python -m app.seed_demo  (add --reset to clear first)"""
import sys

from app import create_app
from app.services.demo_data import clear_all, load_demo

if __name__ == "__main__":
    app = create_app()
    with app.app_context():
        if "--reset" in sys.argv:
            clear_all()
        print(f"Added {load_demo()} demo activities.")
