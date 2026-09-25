# Pitwall

Pitwall is a small Python-powered F1 strategy sandbox. It compares three example tyre plans using an intentionally simple pace, wear, and pit-lane-time model. Its numbers are illustrative, not official data or race predictions.

## Run it locally

Requires Python 3.9 or later. The app uses only Python's standard library.

```powershell
cd work/pitwall
python server.py
```

Open <http://localhost:8000>. On a hosting service that provides a `PORT` environment variable, the server uses that port automatically.

## How the pieces fit together

- `server.py` serves the web page and contains the race model. The browser sends the selected values to `POST /api/simulate`.
- `static/index.html` is the page structure and controls.
- `static/styles.css` controls the visual design and responsive layout.
- `static/app.js` reads the controls, calls the Python API, and renders the returned strategies.

## The model

For each stint, the simulator adds a base lap time, a compound pace offset, and a wear penalty that grows with tyre age. It adds pit-lane time for each stop, then ranks strategies by estimated total time. The values are deliberately simplified so the code is approachable and easy to experiment with.

## Learning path

1. Read `simulate()` and trace where one stint's time comes from.
2. Change a tyre's pace or wear values in `COMPOUNDS` and observe how the ranking changes.
3. Add a new strategy shape in `plans` and decide how the race distance should be split across its stints.
4. Add input validation and a small automated test for the lap-time calculation.
5. Replace the illustrative inputs with sourced historical data, recording the source and assumptions in the interface.

The current version intentionally needs no external packages or API keys. A later deployment can run `python server.py` as its start command; we can pick a hosting provider and publish it once you're ready.

