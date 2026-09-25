const form = document.querySelector('#race-form');
const resultList = document.querySelector('#results-list');
const chart = document.querySelector('#chart');

const tracks = {
  monza: { laps: 53, pace: 88.0, pit: 22, wear: 1.0 },
  silverstone: { laps: 52, pace: 91.5, pit: 25, wear: 1.1 },
  monaco: { laps: 78, pace: 74.0, pit: 18, wear: 0.75 },
};

const controls = {
  laps: { input: document.querySelector('#laps'), output: document.querySelector('#laps-out'), format: value => `${value} laps` },
  pace: { input: document.querySelector('#pace'), output: document.querySelector('#pace-out'), format: value => `${Number(value).toFixed(1)} s` },
  pit: { input: document.querySelector('#pit-loss'), output: document.querySelector('#pit-out'), format: value => `${value} s` },
  wear: { input: document.querySelector('#wear'), output: document.querySelector('#wear-out'), format: value => value < 0.9 ? 'Low' : value > 1.4 ? 'High' : 'Standard' },
};

Object.values(controls).forEach(({ input, output, format }) => {
  input.addEventListener('input', () => { output.textContent = format(input.value); });
});

document.querySelector('#track').addEventListener('change', event => {
  const track = tracks[event.target.value];
  Object.entries({ laps: track.laps, pace: track.pace, pit: track.pit, wear: track.wear }).forEach(([key, value]) => {
    controls[key].input.value = value;
    controls[key].output.textContent = controls[key].format(value);
  });
  runSimulation();
});

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = (seconds % 60).toFixed(1).padStart(4, '0');
  return `${minutes}:${remainder}`;
}

function renderResults(results) {
  resultList.innerHTML = results.map((strategy, index) => {
    const stintTrack = strategy.stints.map(stint => {
      const compound = stint.compound.toLowerCase();
      return `<span class="stint-segment compound-${compound}" style="width:${(stint.length / Number(controls.laps.input.value) * 100).toFixed(1)}%" title="${stint.compound}: laps ${stint.start}–${stint.end}"></span>`;
    }).join('');
    const delta = index === 0 ? '<span class="best-tag">FASTEST</span>' : `<span class="strategy-gap"><b>+${strategy.gap.toFixed(1)} s</b> vs fastest</span>`;
    return `<article class="strategy-card ${index === 0 ? 'best' : ''}">
      <div class="strategy-main"><span class="position">0${index + 1}</span><span class="strategy-title">${strategy.name}</span>${delta}</div>
      <div class="strategy-time">${formatTime(strategy.total_seconds)}</div>
      <div class="strategy-sub">${strategy.description} <span>·</span> ${strategy.stops} ${strategy.stops === 1 ? 'STOP' : 'STOPS'} <span>·</span> ${strategy.average_lap.toFixed(3)} AVG</div>
      <div class="stint-track">${stintTrack}</div>
    </article>`;
  }).join('');

  const max = Math.max(...results.map(item => item.total_seconds));
  chart.innerHTML = results.map((strategy, index) => {
    const width = (strategy.total_seconds / max) * 100;
    return `<div class="chart-bar" style="width:${width.toFixed(2)}%;height:5px;margin-bottom:3px" title="${strategy.name}: ${formatTime(strategy.total_seconds)}"></div>`;
  }).join('');
}

async function runSimulation(event) {
  if (event) event.preventDefault();
  const button = form.querySelector('button');
  button.disabled = true;
  button.querySelector('span:first-child').textContent = 'CALCULATING…';
  try {
    const response = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        laps: controls.laps.input.value,
        base_pace: controls.pace.input.value,
        pit_loss: controls.pit.input.value,
        wear_scale: controls.wear.input.value,
      }),
    });
    if (!response.ok) throw new Error('The simulator could not calculate this setup.');
    const data = await response.json();
    renderResults(data.results);
    document.querySelector('.updated-label').innerHTML = '<span class="live-dot"></span> JUST UPDATED';
  } catch (error) {
    resultList.innerHTML = `<p class="demo-note">${error.message} Refresh the page and try again.</p>`;
  } finally {
    button.disabled = false;
    button.querySelector('span:first-child').textContent = 'RUN SIMULATION';
  }
}

form.addEventListener('submit', runSimulation);
runSimulation();
