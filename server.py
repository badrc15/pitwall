"""Pitwall: a small, Python-powered race-strategy simulator.

Run with: python server.py
Then open http://localhost:8000 in a browser.
"""

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).parent
PORT = int(os.environ.get("PORT", "8000"))

# Illustrative model values, not official F1 tyre data.
COMPOUNDS = {
    "soft": {"pace": 0.0, "wear": 0.095, "label": "Soft"},
    "medium": {"pace": 0.55, "wear": 0.060, "label": "Medium"},
    "hard": {"pace": 1.15, "wear": 0.038, "label": "Hard"},
}


def make_stints(laps: int, plan: list[tuple[str, float]]) -> list[dict]:
    """Split the race into stints; the final stint absorbs rounding remainder."""
    lengths = [round(laps * share) for _, share in plan[:-1]]
    lengths.append(laps - sum(lengths))
    stints = []
    start_lap = 1
    for (compound, _), length in zip(plan, lengths):
        length = max(1, length)
        stints.append({"compound": compound, "length": length, "start": start_lap})
        start_lap += length
    # Rounding may shift one lap; normalize the last stint to finish on the race lap.
    stints[-1]["length"] += laps - sum(stint["length"] for stint in stints)
    return stints


def simulate(laps: int, base_pace: float, pit_loss: float, wear_scale: float) -> list[dict]:
    """Estimate elapsed time for three fixed strategy shapes."""
    plans = [
        ("The Undercut", "Medium → Hard", [("medium", 0.55), ("hard", 0.45)]),
        ("The Long Game", "Hard → Medium", [("hard", 0.58), ("medium", 0.42)]),
        ("The Aggressor", "Soft → Medium → Hard", [("soft", 0.28), ("medium", 0.34), ("hard", 0.38)]),
    ]
    results = []
    for name, description, plan in plans:
        stints = make_stints(laps, plan)
        total = 0.0
        stint_results = []
        for stint in stints:
            tyre = COMPOUNDS[stint["compound"]]
            # Tyre age starts at zero. Each lap loses pace as the tyre wears.
            ages = range(stint["length"])
            stint_time = sum(base_pace + tyre["pace"] + age * tyre["wear"] * wear_scale for age in ages)
            total += stint_time
            stint_results.append({
                "compound": tyre["label"],
                "start": stint["start"],
                "end": stint["start"] + stint["length"] - 1,
                "length": stint["length"],
            })
        stops = len(stints) - 1
        total += stops * pit_loss
        results.append({
            "name": name,
            "description": description,
            "stops": stops,
            "total_seconds": round(total, 1),
            "average_lap": round(total / laps, 3),
            "stints": stint_results,
        })
    fastest = min(result["total_seconds"] for result in results)
    for result in results:
        result["gap"] = round(result["total_seconds"] - fastest, 1)
    return sorted(results, key=lambda result: result["total_seconds"])


class PitwallHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        path = urlparse(self.path).path
        file_path = ROOT / "static" / ("index.html" if path == "/" else path.lstrip("/"))
        if not file_path.resolve().is_relative_to((ROOT / "static").resolve()) or not file_path.is_file():
            self.send_error(404)
            return
        content_type = "text/html; charset=utf-8" if file_path.suffix == ".html" else "text/plain; charset=utf-8"
        if file_path.suffix == ".css":
            content_type = "text/css; charset=utf-8"
        elif file_path.suffix == ".js":
            content_type = "text/javascript; charset=utf-8"
        body = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if urlparse(self.path).path != "/api/simulate":
            self.send_error(404)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            values = json.loads(self.rfile.read(size))
            laps = max(10, min(100, int(values["laps"])))
            base_pace = max(60.0, min(120.0, float(values["base_pace"])))
            pit_loss = max(10.0, min(60.0, float(values["pit_loss"])))
            wear_scale = max(0.2, min(3.0, float(values["wear_scale"])))
            result = {"results": simulate(laps, base_pace, pit_loss, wear_scale)}
            body = json.dumps(result).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (KeyError, TypeError, ValueError, json.JSONDecodeError):
            self.send_error(400, "Please provide valid simulator values.")

    def log_message(self, format, *args):
        print(f"{self.log_date_time_string()} - {format % args}")


if __name__ == "__main__":
    print(f"Pitwall is running at http://localhost:{PORT}")
    ThreadingHTTPServer(("0.0.0.0", PORT), PitwallHandler).serve_forever()
