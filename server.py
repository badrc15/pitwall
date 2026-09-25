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
    "soft": {"pace": 0.0, "wear": 0.095, "label": "Soft", "colour": "#ed4a3b"},
    "medium": {"pace": 0.55, "wear": 0.060, "label": "Medium", "colour": "#f0c34f"},
    "hard": {"pace": 1.15, "wear": 0.038, "label": "Hard", "colour": "#e8e9e6"},
}

TRACKS = {
    # Seconds per lap for one front-wing click toward more downforce.
    # These are teaching values, not measured circuit data.
    "monza": {"label": "Monza", "wing_effect": 0.09},
    "silverstone": {"label": "Silverstone", "wing_effect": -0.04},
    "monaco": {"label": "Monaco", "wing_effect": -0.12},
}
ACCIDENT_DAMAGE_PER_LAP = 0.42
REPAIR_TIME = 7.0


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


def simulate(
    laps: int,
    base_pace: float,
    pit_loss: float,
    wear_scale: float,
    track: str = "monza",
    stop_tyre: str = "hard",
    wing_clicks: int = 0,
    front_wing_damage: bool = False,
    repair_damage: bool = False,
) -> list[dict]:
    """Compare default strategies with the user's first-stop service choices."""
    plans = [
        ("The Undercut", [("medium", 0.55), ("hard", 0.45)]),
        ("The Long Game", [("hard", 0.58), ("medium", 0.42)]),
        ("The Aggressor", [("soft", 0.28), ("medium", 0.34), ("hard", 0.38)]),
    ]
    results = []
    track = track if track in TRACKS else "monza"
    stop_tyre = stop_tyre if stop_tyre in COMPOUNDS else "hard"
    wing_clicks = max(-2, min(2, int(wing_clicks)))
    wing_effect = wing_clicks * TRACKS[track]["wing_effect"]

    for name, plan in plans:
        stints = make_stints(laps, plan)
        stops = len(stints) - 1
        first_stop_lap = stints[0]["length"]
        base_track_time = 0.0
        adjusted_track_time = 0.0
        stint_results = []

        for index, stint in enumerate(stints):
            original_tyre = COMPOUNDS[stint["compound"]]
            selected_compound = stop_tyre if index == 1 else stint["compound"]
            tyre = COMPOUNDS[selected_compound]
            age_time = sum(age * tyre["wear"] * wear_scale for age in range(stint["length"]))
            baseline_age_time = sum(age * original_tyre["wear"] * wear_scale for age in range(stint["length"]))
            baseline_stint_time = stint["length"] * (base_pace + original_tyre["pace"]) + baseline_age_time
            setup_delta = wing_effect if index > 0 else 0.0
            damaged_laps = 0
            if front_wing_damage and not (repair_damage and index > 0):
                damaged_laps = stint["length"]
            damage_delta = damaged_laps * ACCIDENT_DAMAGE_PER_LAP
            adjusted_stint_time = stint["length"] * (base_pace + tyre["pace"] + setup_delta) + age_time + damage_delta
            base_track_time += baseline_stint_time
            adjusted_track_time += adjusted_stint_time
            stint_results.append({
                "compound": tyre["label"],
                "compound_key": selected_compound,
                "start": stint["start"],
                "end": stint["start"] + stint["length"] - 1,
                "length": stint["length"],
                "average_lap": round(adjusted_stint_time / stint["length"], 3),
            })

        wing_service_time = abs(wing_clicks) * 0.6 if stops else 0.0
        repair_service_time = REPAIR_TIME if front_wing_damage and repair_damage and stops else 0.0
        baseline_damage_time = laps * ACCIDENT_DAMAGE_PER_LAP if front_wing_damage else 0.0
        baseline_track_time = base_track_time + baseline_damage_time
        baseline_total = baseline_track_time + stops * pit_loss
        total = adjusted_track_time + stops * pit_loss + wing_service_time + repair_service_time
        opening_tyre = COMPOUNDS[stints[0]["compound"]]
        first_stop_lap_time = (
            base_pace
            + opening_tyre["pace"]
            + (stints[0]["length"] - 1) * opening_tyre["wear"] * wear_scale
        )
        if front_wing_damage:
            first_stop_lap_time += ACCIDENT_DAMAGE_PER_LAP
        post_stop_lap_time = base_pace + COMPOUNDS[stop_tyre]["pace"] + wing_effect
        if front_wing_damage and not repair_damage:
            post_stop_lap_time += ACCIDENT_DAMAGE_PER_LAP
        results.append({
            "name": name,
            "stops": stops,
            "total_seconds": round(total, 1),
            "baseline_seconds": round(baseline_total, 1),
            "race_delta": round(total - baseline_total, 1),
            "average_lap": round(adjusted_track_time / laps, 3),
            "baseline_average_lap": round(baseline_track_time / laps, 3),
            "first_stop_lap": first_stop_lap,
            "first_stop_lap_time": round(first_stop_lap_time, 3),
            "post_stop_lap_time": round(post_stop_lap_time, 3),
            "extra_service_seconds": round(wing_service_time + repair_service_time, 1),
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
            track = str(values.get("track", "monza"))
            stop_tyre = str(values.get("stop_tyre", "hard"))
            wing_clicks = int(values.get("wing_clicks", 0))
            front_wing_damage = bool(values.get("front_wing_damage", False))
            repair_damage = bool(values.get("repair_damage", False))
            result = {
                "results": simulate(
                    laps,
                    base_pace,
                    pit_loss,
                    wear_scale,
                    track,
                    stop_tyre,
                    wing_clicks,
                    front_wing_damage,
                    repair_damage,
                ),
                "settings": {
                    "track": TRACKS.get(track, TRACKS["monza"])["label"],
                    "stop_tyre": COMPOUNDS.get(stop_tyre, COMPOUNDS["hard"])["label"],
                    "wing_clicks": max(-2, min(2, wing_clicks)),
                    "front_wing_damage": front_wing_damage,
                    "repair_damage": repair_damage,
                },
            }
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
