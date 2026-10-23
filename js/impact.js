const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

async function loadImpact() {
  const response = await fetch('data/impact.json');
  if (!response.ok) throw new Error('Impact data could not be loaded.');
  return response.json();
}

function formatDate(dateText) {
  return new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(`${dateText}T12:00:00`));
}

function buildCanopy(percent) {
  const canopy = document.querySelector('[data-canopy]');
  const filled = Math.round(percent / 2);
  canopy.innerHTML = Array.from({ length: 50 }, (_, index) => `<span class="leaf ${index < filled ? 'filled' : ''}"></span>`).join('');
  document.querySelector('[data-impact-tamarin]').style.transform = `translateX(${Math.min(100, percent) * 4.4}%)`;
}

function updateSandbox(data) {
  const amount = Number(document.querySelector('[data-sandbox-amount]').value);
  const rates = {};
  document.querySelectorAll('[data-rate]').forEach((input) => {
    rates[input.dataset.rate] = Math.max(1, Number(input.value));
  });
  document.querySelector('[data-sandbox-output]').textContent = currency.format(amount);
  document.querySelector('[data-scenario="seedlings"]').textContent = Math.floor(amount / rates.seedlingCareShare).toLocaleString();
  document.querySelector('[data-scenario="crossing"]').textContent = `${Math.round((amount / rates.canopyCrossingShare) * 100)}%`;
  document.querySelector('[data-scenario="monitoring"]').textContent = Math.floor(amount / rates.monitoringDayShare).toLocaleString();
}

function render(data) {
  document.querySelector('[data-updated]').textContent = `Data updated ${formatDate(data.lastUpdated)}`;
  document.querySelector('[data-total-received]').textContent = currency.format(data.stages.received);
  document.querySelector('[data-goal-label]').textContent = `Goal: ${currency.format(data.goal)}`;
  const percent = data.goal > 0 ? Math.min(100, Math.round((data.stages.received / data.goal) * 100)) : 0;
  document.querySelector('[data-goal-fill]').style.width = `${percent}%`;
  document.querySelector('[data-goal-percent]').textContent = `${percent}% received`;
  buildCanopy(percent);

  for (const [stage, amount] of Object.entries(data.stages)) {
    document.querySelector(`[data-stage="${stage}"]`).textContent = currency.format(amount);
  }
  const totalOutcomes = Object.values(data.fieldOutcomes).reduce((sum, value) => sum + Number(value), 0);
  document.querySelector('[data-stage="outcomes"]').textContent = totalOutcomes > 0 ? 'Reported' : 'Pending';
  for (const [outcome, value] of Object.entries(data.fieldOutcomes)) {
    document.querySelector(`[data-outcome="${outcome}"]`).textContent = Number(value).toLocaleString();
  }

  document.querySelectorAll('[data-rate]').forEach((input) => {
    input.value = data.planningAssumptions[input.dataset.rate];
    input.addEventListener('input', () => updateSandbox(data));
  });
  document.querySelector('[data-sandbox-amount]').addEventListener('input', () => updateSandbox(data));
  document.querySelector('[data-notes]').innerHTML = data.notes.map((note) => `<li>${note}</li>`).join('');
  updateSandbox(data);
}

loadImpact().then(render).catch((error) => {
  document.querySelector('[data-updated]').textContent = 'Data unavailable';
  document.querySelector('[data-notes]').innerHTML = `<li>${error.message} Try running the site through its local server.</li>`;
});
