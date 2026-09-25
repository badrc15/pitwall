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

const compounds = {
  soft: { pace: 0, wear: 0.095, label: 'Soft' },
  medium: { pace: 0.55, wear: 0.06, label: 'Medium' },
  hard: { pace: 1.15, wear: 0.038, label: 'Hard' },
};
const circuits = {
  monza: { label: 'Monza', wingEffect: 0.09 },
  silverstone: { label: 'Silverstone', wingEffect: -0.04 },
  monaco: { label: 'Monaco', wingEffect: -0.12 },
};
const rivalProfiles = [
  ['M. Vale', 'Apex GP', -0.34, -0.08], ['L. Kim', 'Northstar', -0.25, 0.12],
  ['A. Costa', 'Scuderia Nova', -0.16, -0.18], ['J. Okafor', 'Velocity', -0.08, 0.04],
  ['S. Laurent', 'Apex GP', 0.05, -0.10], ['R. Patel', 'Northstar', 0.13, 0.15],
  ['T. Fischer', 'Scuderia Nova', 0.21, -0.05], ['N. Haddad', 'Velocity', 0.29, 0.08],
  ['E. Rossi', 'Apex GP', 0.38, -0.14], ['P. Singh', 'Northstar', 0.47, 0.02],
];

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

function currentSettings() {
  return {
    laps: Number(controls.laps.input.value), basePace: Number(controls.pace.input.value),
    pitLoss: Number(controls.pit.input.value), wearScale: Number(controls.wear.input.value),
    track: trackSelect.value, stopTyre: selectedCompound, wingClicks: Number(wingInput.value),
    damage: damageInput.checked, repair: damageInput.checked && repairInput.checked,
  };
}

function createStints(laps, plan) {
  const lengths = plan.slice(0, -1).map(([, share]) => Math.round(laps * share));
  lengths.push(laps - lengths.reduce((sum, length) => sum + length, 0));
  let start = 1;
  const stints = plan.map(([compound], index) => {
    const length = Math.max(1, lengths[index]);
    const stint = { compound, length, start };
    start += length;
    return stint;
  });
  stints.at(-1).length += laps - stints.reduce((sum, stint) => sum + stint.length, 0);
  return stints;
}

function calculateStrategies(settings) {
  const { laps, basePace, pitLoss, wearScale } = settings;
  const track = circuits[settings.track] ? settings.track : 'monza';
  const stopTyre = compounds[settings.stopTyre] ? settings.stopTyre : 'hard';
  const wingClicks = Math.max(-2, Math.min(2, settings.wingClicks));
  const wingEffect = wingClicks * circuits[track].wingEffect;
  const plans = [
    ['The Undercut', [['medium', 0.55], ['hard', 0.45]]],
    ['The Long Game', [['hard', 0.58], ['medium', 0.42]]],
    ['The Aggressor', [['soft', 0.28], ['medium', 0.34], ['hard', 0.38]]],
  ];
  const results = plans.map(([name, plan]) => {
    const stints = createStints(laps, plan);
    const stops = stints.length - 1;
    let baselineTrack = 0;
    let adjustedTrack = 0;
    const stintResults = stints.map((stint, index) => {
      const original = compounds[stint.compound];
      const key = index === 1 ? stopTyre : stint.compound;
      const tyre = compounds[key];
      let ageTime = 0;
      let baselineAge = 0;
      for (let age = 0; age < stint.length; age += 1) {
        ageTime += age * tyre.wear * wearScale;
        baselineAge += age * original.wear * wearScale;
      }
      const baselineStint = stint.length * (basePace + original.pace) + baselineAge;
      const damageLaps = settings.damage && !(settings.repair && index > 0) ? stint.length : 0;
      const setup = index > 0 ? wingEffect : 0;
      const adjustedStint = stint.length * (basePace + tyre.pace + setup) + ageTime + damageLaps * 0.42;
      baselineTrack += baselineStint;
      adjustedTrack += adjustedStint;
      return {
        compound: tyre.label, compound_key: key, start: stint.start,
        end: stint.start + stint.length - 1, length: stint.length,
        average_lap: Number((adjustedStint / stint.length).toFixed(3)),
      };
    });
    const wingService = stops ? Math.abs(wingClicks) * 0.6 : 0;
    const repairService = settings.damage && settings.repair && stops ? 7 : 0;
    const baselineTrackTime = baselineTrack + (settings.damage ? laps * 0.42 : 0);
    const baselineTotal = baselineTrackTime + stops * pitLoss;
    const total = adjustedTrack + stops * pitLoss + wingService + repairService;
    const opening = compounds[stints[0].compound];
    const firstStopPace = basePace + opening.pace + (stints[0].length - 1) * opening.wear * wearScale + (settings.damage ? 0.42 : 0);
    const postStopPace = basePace + compounds[stopTyre].pace + wingEffect + (settings.damage && !settings.repair ? 0.42 : 0);
    return {
      name, stops, total_seconds: Number(total.toFixed(1)), baseline_seconds: Number(baselineTotal.toFixed(1)),
      race_delta: Number((total - baselineTotal).toFixed(1)), average_lap: Number((adjustedTrack / laps).toFixed(3)),
      baseline_average_lap: Number((baselineTrackTime / laps).toFixed(3)),
      first_stop_lap: stints[0].length, first_stop_lap_time: Number(firstStopPace.toFixed(3)),
      post_stop_lap_time: Number(postStopPace.toFixed(3)),
      extra_service_seconds: Number((wingService + repairService).toFixed(1)), stints: stintResults,
    };
  }).sort((a, b) => a.total_seconds - b.total_seconds);
  const fastest = results[0].total_seconds;
  return results.map(result => ({ ...result, gap: Number((result.total_seconds - fastest).toFixed(1)) }));
}

function calculateRace(settings, currentLap, strategyName) {
  const strategies = calculateStrategies(settings);
  const user = strategies.find(strategy => strategy.name === strategyName) || strategies[0];
  const baseline = strategies.find(strategy => strategy.name === 'The Undercut');
  const reference = calculateStrategies({ ...settings, stopTyre: 'hard', wingClicks: 0, repair: false })
    .find(strategy => strategy.name === 'The Undercut');
  const lap = Math.max(1, Math.min(settings.laps, Number(currentLap)));
  const userLap = (baseline.total_seconds - baseline.stops * settings.pitLoss - baseline.extra_service_seconds) / settings.laps;
  let userCurrent = userLap * lap;
  if (lap >= baseline.first_stop_lap) userCurrent += settings.pitLoss + baseline.extra_service_seconds;
  const field = rivalProfiles.map(([driver, team, pace, racecraft]) => ({
    driver, team,
    current_seconds: Number((userCurrent + pace * lap + racecraft * lap / settings.laps).toFixed(1)),
    finish_seconds: Number((reference.total_seconds + pace * settings.laps + racecraft).toFixed(1)),
    you: false,
  }));
  field.push({ driver: 'YOU', team: 'PITWALL RACING', current_seconds: Number(userCurrent.toFixed(1)), finish_seconds: user.total_seconds, you: true });
  const currentOrder = [...field].sort((a, b) => a.current_seconds - b.current_seconds);
  const finishOrder = [...field].sort((a, b) => a.finish_seconds - b.finish_seconds);
  const currentPosition = currentOrder.findIndex(car => car.you) + 1;
  const projectedPosition = finishOrder.findIndex(car => car.you) + 1;
  const leader = finishOrder[0].finish_seconds;
  finishOrder.forEach((car, index) => {
    car.projected_position = index + 1;
    car.gap_to_leader = Number((car.finish_seconds - leader).toFixed(1));
  });
  return {
    current_position: currentPosition, projected_position: projectedPosition,
    current_lap: lap, laps: settings.laps, strategy: user.name,
    finish_order: finishOrder, current_order: currentOrder, user_finish_seconds: user.total_seconds,
  };
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
    const settings = currentSettings();
    let race;
    try {
      const response = await fetch('/api/race-sim', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laps: settings.laps, base_pace: settings.basePace, pit_loss: settings.pitLoss,
          wear_scale: settings.wearScale, track: settings.track, stop_tyre: settings.stopTyre,
          wing_clicks: settings.wingClicks, front_wing_damage: settings.damage, repair_damage: settings.repair,
          current_lap: currentLapInput.value, strategy: strategyChoice.value,
        }),
      });
      if (response.ok) race = await response.json();
    } catch { /* Public static hosting has no Python API; use the browser model below. */ }
    if (!race) race = calculateRace(settings, currentLapInput.value, strategyChoice.value);
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
    const settings = currentSettings();
    let data;
    try {
      const response = await fetch('/api/simulate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          laps: settings.laps, base_pace: settings.basePace, pit_loss: settings.pitLoss,
          wear_scale: settings.wearScale, track: settings.track, stop_tyre: settings.stopTyre,
          wing_clicks: settings.wingClicks, front_wing_damage: settings.damage, repair_damage: settings.repair,
        }),
      });
      if (response.ok) data = await response.json();
    } catch { /* Public static hosting has no Python API; use the browser model below. */ }
    if (!data) data = {
      results: calculateStrategies(settings),
      settings: {
        track: circuits[settings.track]?.label || circuits.monza.label,
        stop_tyre: compounds[settings.stopTyre]?.label || compounds.hard.label,
        wing_clicks: settings.wingClicks,
        front_wing_damage: settings.damage, repair_damage: settings.repair,
      },
    };
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

