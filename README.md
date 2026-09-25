# Pitwall

Pitwall is a Python-powered F1 strategy sandbox. [Open the live simulator](https://badrc15.github.io/pitwall/). Compare three example tyre plans, then change the tyre fitted at the first stop, adjust the front-wing profile, or repair simulated front-wing damage and watch the lap-time and race-time estimates respond. Values are illustrative, not official data or race predictions.

## Run it locally

Requires Python 3.9 or later. The app uses only Python's standard library.

```powershell
cd pitwall
python server.py
```

Open <http://localhost:8000>. On a hosting service that provides a `PORT` environment variable, the server uses that port automatically.

## How the pieces fit together

- `server.py` serves the web page and contains the race model. The browser sends the selected values to `POST /api/simulate`.
- `POST /api/race-sim` compares a chosen strategy with a repeatable field of fictional drivers and returns current and projected positions.
- `static/index.html` is the page structure and controls.
- `static/styles.css` controls the visual design and responsive layout.
- `static/app.js` reads the controls, calls the Python API, and renders the returned strategies.
- `dist/` is the browser-ready static build. `docs/` mirrors that build for GitHub Pages, where the in-browser calculation fallback keeps the simulator interactive; locally, the same screens use the Python API.

## The model

For each stint, the simulator adds a base lap time, a compound pace offset, and a wear penalty that grows with tyre age. At the first stop, your selected compound and wing setting apply to the later stints. The wing model trades straight-line pace for cornering pace using illustrative circuit values. The optional damage scenario adds a lap-time penalty until the damaged front wing is repaired; repairs add service time. Pit-lane work shown here is limited to tyre changes, front-wing profile adjustment, and genuine accident-damage repairs, consistent with the [2026 FIA Sporting Regulations](https://www.fia.com/system/files/documents/fia_2026_f1_regulations_-_section_b_sporting_-_iss_08_-_2026-08-05_7.pdf). The simulator remains a teaching model, not a prediction.

## Learning path

1. Read `simulate()` and trace where one stint's time comes from.
2. Change a tyre's pace or wear values in `COMPOUNDS` and observe how the ranking changes.
3. Trace `wing_effect` to see how the chosen front-wing setting changes the later stints.
4. Add a new strategy shape in `plans` and decide how the race distance should be split across its stints.
5. Replace illustrative inputs with sourced historical data, recording the source and assumptions in the interface.

The public GitHub Pages site serves the browser-ready files from `docs/`. Keep that folder in sync with `dist/` when publishing front-end changes. The current app needs no external packages or API keys; the Python server remains available for local development.

The race grid uses fictional driver and team names with fixed pace profiles. It is repeatable for the same inputs and is intended to explain relative strategy effects, not to predict a real race.

