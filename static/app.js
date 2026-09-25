const form = document.querySelector('#race-form');
const resultList = document.querySelector('#results-list');
const impactChart = document.querySelector('#impact-chart');
const trackSelect = document.querySelector('#track');
const damageInput = document.querySelector('#damage');
const repairInput = document.querySelector('#repair');
const repairRow = document.querySelector('#repair-row');
const wingInput = document.querySelector('#wing');
const strategyChoice = document.querySelector('#strategy-choice');
const currentLapInput = document.querySelector('#current-lap');
const raceButton = document.querySelector('#run-race');
let selectedCompound = 'hard';
let simulationTimer;
let raceTimer;

const trackProfiles = {
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

function wingLabel(value) {
  const setting = Number(value);
  if (setting < 0) return `${Math.abs(setting)} click${setting === -1 ? '' : 's'} · less wing`;
  if (setting > 0) return `${setting} click${setting === 1 ? '' : 's'} · more wing`;
  return 'Neutral';
}

function updateCarPreview() {
  const color = { soft: '#ed4a3b', medium: '#f0c34f', hard: '#e8e9e6' }[selectedCompound];
  const carStage = document.querySelector('.car-stage');
  carStage.style.setProperty('--tyre-color', color);
  document.querySelector('#car-compound-label').textContent = selectedCompound.toUpperCase();
  const wing = Number(wingInput.value);
  document.querySelector('#car-wing-label').textContent = `FRONT WING: ${wingLabel(wing).toUpperCase()}`;
  document.querySelector('#wing-out').textContent = wingLabel(wing);
  carStage.classList.toggle('damaged', damageInput.checked);
  document.querySelector('#damage-mark').setAttribute('display', damageInput.checked ? 'inline' : 'none');
  document.querySelector('#car-status-label').textContent = damageInput.checked ? 'DAMAGE MARKED' : 'READY IN THE BOX';
}

function refreshOutputs() {
  Object.values(controls).forEach(({ input, output, format }) => {
    output.textContent = format(input.value);
  });
  updateCarPreview();
  updateRaceLapControl();
}

function scheduleSimulation() {
  window.clearTimeout(simulationTimer);
  window.clearInterval(raceTimer);
  document.querySelector('#current-position').textContent = '—';
  document.querySelector('#projected-position').textContent = '—';
  document.querySelector('#current-position-copy').textContent = 'Settings changed';
  document.querySelector('#projected-position-copy').textContent = 'Run the race again';
  document.querySelector('#race-leaderboard').innerHTML = '<div class="leaderboard-empty">Race settings changed. Run the simulation again for an updated projection.</div>';
  document.querySelector('#race-progress-text').textContent = 'READY ON THE GRID';
  document.querySelector('#race-progress-bar').style.width = '0%';
  simulationTimer = window.setTimeout(() => runSimulation(), 180);
}

Object.values(controls).forEach(({ input }) => {
  input.addEventListener('input', () => {
    refreshOutputs();
    scheduleSimulation();
  });
});

document.querySelectorAll('.compound-option').forEach(button => {
  button.addEventListener('click', () => {
    selectedCompound = button.dataset.compound;
    document.querySelectorAll('.compound-option').forEach(option => {
      const selected = option === button;
      option.classList.toggle('selected', selected);
      option.setAttribute('aria-pressed', String(selected));
    });
    updateCarPreview();
    scheduleSimulation();
  });
});

trackSelect.addEventListener('change', () => {
  const profile = trackProfiles[trackSelect.value];
  Object.entries({ laps: profile.laps, pace: profile.pace, pit: profile.pit, wear: profile.wear }).forEach(([key, value]) => {
    controls[key].input.value = value;
  });
  refreshOutputs();
  scheduleSimulation();
});

wingInput.addEventListener('input', () => {
  updateCarPreview();
  scheduleSimulation();
});

damageInput.addEventListener('change', () => {
  repairRow.classList.toggle('hidden', !damageInput.checked);
  if (!damageInput.checked) repairInput.checked = false;
  updateCarPreview();
  scheduleSimulation();
});
repairInput.addEventListener('change', scheduleSimulation);

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = (seconds % 60).toFixed(1).padStart(4, '0');
  return `${minutes}:${remainder}`;
}

function signedSeconds(seconds) {
  if (Math.abs(seconds) < 0.05) return 'No change';
  return `${seconds < 0 ? '−' : '+'}${Math.abs(seconds).toFixed(1)} s`;
}

function renderResults(results, settings) {
  const ordered = [...results].sort((a, b) => a.total_seconds - b.total_seconds);
  const fastest = ordered[0];
  const previousStrategy = strategyChoice.value;
  strategyChoice.innerHTML = ordered.map(strategy => `<option value="${strategy.name}">${strategy.name} · ${formatTime(strategy.total_seconds)}</option>`).join('');
  strategyChoice.value = ordered.some(strategy => strategy.name === previousStrategy) ? previousStrategy : fastest.name;
  resultList.innerHTML = ordered.map((strategy, index) => {
    const stints = strategy.stints.map(stint => {
      const compound = stint.compound_key;
      return `<span class="stint-segment compound-${compound}" style="width:${(stint.length / Number(controls.laps.input.value) * 100).toFixed(1)}%" title="${stint.compound}: laps ${stint.start}–${stint.end}"></span>`;
    }).join('');
    const impactClass = Math.abs(strategy.race_delta) < 0.05 ? 'neutral' : strategy.race_delta < 0 ? 'gain' : 'loss';
    const impactText = strategy.race_delta < 0 ? `${signedSeconds(strategy.race_delta)} vs plan` : strategy.race_delta > 0 ? `${signedSeconds(strategy.race_delta)} vs plan` : 'Same as plan';
    return `<article class="strategy-card ${index === 0 ? 'best' : ''}">
      <div class="strategy-main"><span class="position">0${index + 1}</span><span class="strategy-title">${strategy.name}</span>${index === 0 ? '<span class="best-tag">QUICKEST</span>' : ''}</div>
      <div class="strategy-time">${formatTime(strategy.total_seconds)}</div>
      <div class="strategy-sub">${strategy.stops} ${strategy.stops === 1 ? 'STOP' : 'STOPS'} · ${strategy.average_lap.toFixed(3)} s average lap</div>
      <div class="strategy-impact ${impactClass}">${impactText}</div>
      <div class="stint-track">${stints}</div>
    </article>`;
  }).join('');

  const maxDelta = Math.max(1, ...ordered.map(item => Math.abs(item.race_delta)));
  impactChart.innerHTML = ordered.map(strategy => {
    const delta = strategy.race_delta;
    const isGain = delta < -0.05;
    const isLoss = delta > 0.05;
    const tone = isGain ? 'gain' : isLoss ? 'loss' : 'neutral';
    const width = Math.abs(delta) < 0.05 ? 0 : Math.max(2, Math.abs(delta) / maxDelta * 48);
    const left = isGain ? 50 - width : 50;
    return `<div class="impact-row"><span class="impact-name">${strategy.name}</span><div class="impact-track"><span class="impact-fill ${tone}" style="left:${left}%;width:${width}%"></span></div><span class="impact-value ${tone}">${signedSeconds(delta)}</span></div>`;
  }).join('');

  document.querySelector('#summary-tyre').textContent = settings.stop_tyre.toUpperCase();
  document.querySelector('#summary-wing').textContent = wingLabel(settings.wing_clicks).toUpperCase();
  document.querySelector('#summary-pace').textContent = `${fastest.post_stop_lap_time.toFixed(3)} s/lap`;
  document.querySelector('#summary-service').textContent = `${fastest.extra_service_seconds.toFixed(1)} s`;
  document.querySelector('.updated-label').innerHTML = '<span class="live-dot"></span> UPDATED JUST NOW';
}

function renderLeaderboard(order, mode, animatedLap, totalLaps) {
  const leaderTime = order[0]?.time ?? 0;
  document.querySelector('#race-leaderboard').innerHTML = '<div class="leaderboard-head"><span>POS</span><span>DRIVER</span><span>TEAM</span><span>GAP</span></div>' + order.map((entry, index) => {
    const gap = index === 0 ? 'LEADER' : `+${(entry.time - leaderTime).toFixed(1)}s`;
    return `<div class="leaderboard-row ${entry.you ? 'your-car' : ''}"><span class="leaderboard-pos">${String(index + 1).padStart(2, '0')}</span><b>${entry.driver}${entry.you ? ' <i>YOU</i>' : ''}</b><span class="leaderboard-team">${entry.team}</span><span class="leaderboard-gap">${gap}</span></div>`;
  }).join('');
  if (mode === 'race') {
    document.querySelector('#race-progress-lap').textContent = `LAP ${animatedLap} / ${totalLaps}`;
    document.querySelector('#race-progress-bar').style.width = `${Math.min(100, animatedLap / totalLaps * 100)}%`;
  }
}

const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms));

async function runRaceSimulation() {
  window.clearInterval(raceTimer);
  raceButton.disabled = true;
  raceButton.querySelector('span:first-child').textContent = 'LIGHTS OUT…';
  document.querySelector('#race-progress-text').textContent = 'RACE IN PROGRESS';
  try {
    const response = await fetch('/api/race-sim', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        laps: controls.laps.input.value, base_pace: controls.pace.input.value,
        pit_loss: controls.pit.input.value, wear_scale: controls.wear.input.value,
        track: trackSelect.value, stop_tyre: selectedCompound, wing_clicks: wingInput.value,
        front_wing_damage: damageInput.checked, repair_damage: damageInput.checked && repairInput.checked,
        current_lap: currentLapInput.value, strategy: strategyChoice.value,
      }),
    });
    if (!response.ok) throw new Error('The race could not be simulated. Please try again.');
    const race = await response.json();
    document.querySelector('#current-position').textContent = `P${race.current_position}`;
    document.querySelector('#current-position-copy').textContent = `Lap ${race.current_lap} · before the call`;
    document.querySelector('#projected-position').textContent = `P${race.projected_position}`;
    document.querySelector('#projected-position-copy').textContent = race.strategy;

    const current = race.current_order.map(item => ({ ...item, time: item.current_seconds }));
    renderLeaderboard(current, 'current', race.current_lap, race.laps);
    const startLap = race.current_lap;
    const steps = Math.min(24, Math.max(8, race.laps - startLap));
    for (let step = 1; step <= steps; step += 1) {
      const progress = step / steps;
      const order = race.finish_order.map(item => ({
        ...item, time: item.current_seconds + (item.finish_seconds - item.current_seconds) * progress,
      })).sort((a, b) => a.time - b.time);
      const lap = Math.min(race.laps, Math.round(startLap + (race.laps - startLap) * progress));
      renderLeaderboard(order, 'race', lap, race.laps);
      await wait(55);
    }
    renderLeaderboard(race.finish_order.map(item => ({ ...item, time: item.finish_seconds })), 'finish', race.laps, race.laps);
    document.querySelector('#race-progress-text').textContent = 'CHEQUERED FLAG · PROJECTED CLASSIFICATION';
    document.querySelector('#projected-position-copy').textContent = `${race.strategy} · ${formatTime(race.user_finish_seconds)}`;
  } catch (error) {
    document.querySelector('#race-progress-text').textContent = 'SIMULATION UNAVAILABLE';
    document.querySelector('#race-leaderboard').innerHTML = `<p class="error-note">${error.message}</p>`;
  } finally {
    raceButton.disabled = false;
    raceButton.querySelector('span:first-child').textContent = 'RUN RACE SIMULATION';
  }
}

function updateRaceLapControl() {
  const laps = Number(controls.laps.input.value);
  const previousMax = Number(currentLapInput.max);
  const current = Number(currentLapInput.value);
  currentLapInput.max = String(laps);
  if (previousMax !== laps || current > laps) currentLapInput.value = String(Math.min(laps, Math.max(1, Math.round(laps / 3))));
  document.querySelector('#current-lap-out').textContent = currentLapInput.value;
}

currentLapInput.addEventListener('input', () => {
  document.querySelector('#current-lap-out').textContent = currentLapInput.value;
  scheduleSimulation();
});
strategyChoice.addEventListener('change', scheduleSimulation);
raceButton.addEventListener('click', runRaceSimulation);

async function runSimulation(event) {
  if (event) event.preventDefault();
  const button = form.querySelector('.simulate-button');
  button.disabled = true;
  button.querySelector('span:first-child').textContent = 'UPDATING YOUR RACE…';
  try {
    const response = await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        laps: controls.laps.input.value,
        base_pace: controls.pace.input.value,
        pit_loss: controls.pit.input.value,
        wear_scale: controls.wear.input.value,
        track: trackSelect.value,
        stop_tyre: selectedCompound,
        wing_clicks: wingInput.value,
        front_wing_damage: damageInput.checked,
        repair_damage: damageInput.checked && repairInput.checked,
      }),
    });
    if (!response.ok) throw new Error('The race setup could not be calculated. Please try again.');
    const data = await response.json();
    renderResults(data.results, data.settings);
  } catch (error) {
    resultList.innerHTML = `<p class="error-note">${error.message} Refresh the page to try again.</p>`;
  } finally {
    button.disabled = false;
    button.querySelector('span:first-child').textContent = 'SEE WHAT HAPPENS';
  }
}

form.addEventListener('submit', runSimulation);
refreshOutputs();
runSimulation();

