// App State
let state = {
  status: null,
  meals: [],
  ketoneLogs: [],
  settings: {}
};

// DOM Elements
const tabs = document.querySelectorAll('.nav-tab');
const tabPanes = document.querySelectorAll('.tab-pane');

// Navigation Tabs
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const target = document.getElementById(tab.dataset.tab);
    if (target) target.classList.add('active');
  });
});

document.getElementById('btnOpenAddMeal')?.addEventListener('click', () => {
  document.querySelector('[data-tab="tab-meals"]').click();
});

// Settings Modal
const settingsModal = document.getElementById('settingsModal');
document.getElementById('btnSettingsModal')?.addEventListener('click', () => {
  loadSettings();
  settingsModal.classList.add('show');
});
document.getElementById('btnCloseSettingsModal')?.addEventListener('click', () => {
  settingsModal.classList.remove('show');
});

// Load Full Status
async function loadStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    state.status = data;
    renderDashboard(data);
    renderGarminView(data.garmin);
  } catch (err) {
    console.error('Error al cargar status:', err);
  }
}

// Render Dashboard
function renderDashboard(data) {
  const { ketosis, macros, garmin } = data;

  // Ketosis Gauge & Phase
  document.getElementById('badgePhase').textContent = `Fase ${ketosis.phase}`;
  document.getElementById('badgePhase').style.backgroundColor = ketosis.statusColor;

  document.getElementById('timerFasting').textContent = `⏱️ ${ketosis.hoursFastingOrKeto}h en keto / ayuno`;
  document.getElementById('valEstimatedKetones').textContent = ketosis.estimatedKetones.toFixed(1);
  document.getElementById('txtPhaseTitle').textContent = ketosis.phaseName;
  document.getElementById('txtPhaseDesc').textContent = ketosis.phaseDesc;

  // Gauge gradient circle
  const gaugePercent = Math.min(100, Math.max(10, (ketosis.estimatedKetones / 2.5) * 100));
  const gaugeDeg = Math.round((gaugePercent / 100) * 360);
  const gaugeCircle = document.getElementById('gaugeCircle');
  gaugeCircle.style.background = `conic-gradient(${ketosis.statusColor} 0deg ${gaugeDeg}deg, var(--card-border) ${gaugeDeg}deg 360deg)`;
  gaugeCircle.style.boxShadow = `0 0 16px ${ketosis.statusColor}44`;

  // Time to next phase
  const wrapNext = document.getElementById('wrapTimeToNext');
  if (ketosis.phase >= 4) {
    wrapNext.innerHTML = `<span>Estado:</span> <strong style="color:var(--accent-green)">En Cetosis Óptima</strong>`;
  } else if (ketosis.timeToNextPhaseHours) {
    wrapNext.innerHTML = `<span>Tiempo est. a siguiente fase:</span> <strong>~${ketosis.timeToNextPhaseHours} horas</strong>`;
  }

  // Garmin boost banner
  const impact = ketosis.garminImpact;
  document.getElementById('txtGarminImpactDesc').textContent = 
    `+${impact.activeCalories} kcal activas hoy (${impact.extraGlycogenBurnGrams}g glucógeno quemado) -> ¡Ahorraste ~${impact.hoursSaved}h para entrar en cetosis!`;

  // Macros
  document.getElementById('valNetCarbs').textContent = macros.totals.netCarbs;
  document.getElementById('targetNetCarbs').textContent = macros.targets.netCarbs;
  const carbPct = Math.min(100, (macros.totals.netCarbs / macros.targets.netCarbs) * 100);
  const barNetCarbs = document.getElementById('barNetCarbs');
  barNetCarbs.style.width = `${carbPct}%`;
  
  const badgeCarb = document.getElementById('badgeCarbStatus');
  if (macros.status.carbLimitExceeded) {
    badgeCarb.textContent = '¡Límite Superado!';
    badgeCarb.style.color = 'var(--accent-red)';
    barNetCarbs.style.background = 'var(--accent-red)';
  } else {
    badgeCarb.textContent = `${macros.status.carbRemaining}g restantes`;
    badgeCarb.style.color = 'var(--accent-green)';
    barNetCarbs.style.background = 'var(--accent-amber)';
  }

  document.getElementById('valFat').textContent = macros.totals.fat;
  document.getElementById('targetFat').textContent = macros.targets.fat;
  document.getElementById('barFat').style.width = `${Math.min(100, (macros.totals.fat / macros.targets.fat) * 100)}%`;

  document.getElementById('valProtein').textContent = macros.totals.protein;
  document.getElementById('targetProtein').textContent = macros.targets.protein;
  document.getElementById('barProtein').style.width = `${Math.min(100, (macros.totals.protein / macros.targets.protein) * 100)}%`;

  // Caloric ratios
  document.getElementById('ratioFat').textContent = `${macros.ratios.fat}%`;
  document.getElementById('ratioProtein').textContent = `${macros.ratios.protein}%`;
  document.getElementById('ratioCarbs').textContent = `${macros.ratios.carbs}%`;
}

// Render Garmin View
function renderGarminView(garmin) {
  document.getElementById('garminActiveCal').textContent = garmin.active_calories || 0;
  document.getElementById('garminSteps').textContent = (garmin.steps || 0).toLocaleString();
  document.getElementById('garminRestingHr').textContent = `${garmin.resting_hr || '--'} bpm`;
  document.getElementById('garminTotalCal').textContent = garmin.total_calories || 0;

  const sourceBadge = document.getElementById('garminSourceBadge');
  if (garmin.source === 'garmin_cloud') {
    sourceBadge.textContent = 'Garmin Cloud ✓';
    sourceBadge.style.backgroundColor = 'var(--accent-green)';
  } else if (garmin.source === 'garmin_manual') {
    sourceBadge.textContent = 'Garmin Real ✓';
    sourceBadge.style.backgroundColor = 'var(--accent-green)';
  } else {
    sourceBadge.textContent = 'Modo Simulado';
    sourceBadge.style.backgroundColor = 'var(--accent-cyan)';
  }

  // Pre-cargar valores en formulario manual si están vacíos
  const inCal = document.getElementById('inputManualActiveCal');
  const inSteps = document.getElementById('inputManualSteps');
  const inHr = document.getElementById('inputManualRestingHr');
  if (inCal && !inCal.value && garmin.active_calories) inCal.value = garmin.active_calories;
  if (inSteps && !inSteps.value && garmin.steps) inSteps.value = garmin.steps;
  if (inHr && !inHr.value && garmin.resting_hr) inHr.value = garmin.resting_hr;
}

// Load & Render Meals
async function loadMeals() {
  try {
    const res = await fetch('/api/meals');
    const data = await res.json();
    state.meals = data.meals || [];
    renderMealsList(state.meals);
  } catch (err) {
    console.error('Error al cargar comidas:', err);
  }
}

function renderMealsList(meals) {
  const container = document.getElementById('mealsList');
  if (!meals || meals.length === 0) {
    container.innerHTML = '<p class="text-muted text-center">No hay comidas registradas hoy.</p>';
    return;
  }

  container.innerHTML = meals.map(m => `
    <div class="meal-item">
      <div>
        <div class="meal-title">${escapeHtml(m.name)}</div>
        <div class="meal-sub">
          <strong>${m.net_carbs}g carbos netos</strong> (${m.carbs}g tot - ${m.fiber}g fib) • 
          ${m.fat}g grasa • ${m.protein}g prot • ${m.calories} kcal
        </div>
      </div>
      <button class="meal-del-btn" onclick="deleteMeal(${m.id})" title="Eliminar">🗑️</button>
    </div>
  `).join('');
}

async function deleteMeal(id) {
  if (!confirm('¿Eliminar esta comida?')) return;
  try {
    await fetch(`/api/meals/${id}`, { method: 'DELETE' });
    await loadMeals();
    await loadStatus();
  } catch (err) {
    alert('Error al eliminar comida');
  }
}

// Meal Form Submission
document.getElementById('formMeal')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('inputMealName').value;
  const carbs = parseFloat(document.getElementById('inputCarbs').value) || 0;
  const fiber = parseFloat(document.getElementById('inputFiber').value) || 0;
  const protein = parseFloat(document.getElementById('inputProtein').value) || 0;
  const fat = parseFloat(document.getElementById('inputFat').value) || 0;
  let calories = parseFloat(document.getElementById('inputCalories').value);

  const netCarbs = Math.max(0, carbs - fiber);
  if (isNaN(calories) || calories === 0) {
    calories = Math.round((fat * 9) + (protein * 4) + (netCarbs * 4));
  }

  try {
    await fetch('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, carbs, fiber, protein, fat, calories })
    });

    // Reset Form
    e.target.reset();
    document.getElementById('inputCarbs').value = '0';
    document.getElementById('inputFiber').value = '0';
    document.getElementById('inputProtein').value = '0';
    document.getElementById('inputFat').value = '0';

    await loadMeals();
    await loadStatus();

    // Switch to Dashboard
    document.querySelector('[data-tab="tab-dashboard"]').click();
  } catch (err) {
    alert('Error al guardar la comida');
  }
});

// AI Vision Camera Capture & Analysis
const btnTriggerCamera = document.getElementById('btnTriggerCamera');
const cameraInput = document.getElementById('cameraInput');
const photoAnalysisLoading = document.getElementById('photoAnalysisLoading');
const photoPreviewWrap = document.getElementById('photoPreviewWrap');
const imgMealPreview = document.getElementById('imgMealPreview');
const aiAdviceBanner = document.getElementById('aiAdviceBanner');

btnTriggerCamera?.addEventListener('click', () => {
  cameraInput.click();
});

cameraInput?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  // Show preview immediately
  const reader = new FileReader();
  reader.onload = async (event) => {
    const rawDataUrl = event.target.result;
    
    // Resize image on canvas to optimize payload size (< 500KB)
    const optimizedBase64 = await resizeImage(rawDataUrl, 1000, 1000, 0.82);
    
    imgMealPreview.src = optimizedBase64;
    photoPreviewWrap.style.display = 'flex';
    photoAnalysisLoading.style.display = 'flex';
    aiAdviceBanner.style.display = 'none';

    try {
      const res = await fetch('/api/meals/analyze-photo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: optimizedBase64,
          mimeType: 'image/jpeg'
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Error al analizar la imagen');
      }

      const a = data.analysis;

      // Populate form
      const nameInput = document.getElementById('inputMealName');
      const carbsInput = document.getElementById('inputCarbs');
      const fiberInput = document.getElementById('inputFiber');
      const proteinInput = document.getElementById('inputProtein');
      const fatInput = document.getElementById('inputFat');
      const calInput = document.getElementById('inputCalories');

      nameInput.value = a.name || 'Comida detectada';
      carbsInput.value = a.carbs !== undefined ? a.carbs : 0;
      fiberInput.value = a.fiber !== undefined ? a.fiber : 0;
      proteinInput.value = a.protein !== undefined ? a.protein : 0;
      fatInput.value = a.fat !== undefined ? a.fat : 0;
      calInput.value = a.calories !== undefined ? a.calories : Math.round((a.fat * 9) + (a.protein * 4) + (a.net_carbs * 4));

      // Visual flash animation
      [nameInput, carbsInput, fiberInput, proteinInput, fatInput, calInput].forEach(inp => {
        inp.classList.remove('input-highlight');
        void inp.offsetWidth; // trigger reflow
        inp.classList.add('input-highlight');
      });

      // Display AI Advice
      const ketoBadge = a.is_keto ? '✅ Compatible Keto' : '⚠️ Atención: Carbohidratos altos';
      aiAdviceBanner.innerHTML = `
        <strong>${ketoBadge}</strong>: ${escapeHtml(a.advice || 'Nutrientes calculados con éxito.')}
        <br><small class="text-muted">Revisa y ajusta los valores si es necesario, luego pulsa <strong>Guardar Comida</strong>.</small>
      `;
      aiAdviceBanner.style.display = 'block';

    } catch (err) {
      alert(`Error en análisis de imagen: ${err.message}`);
    } finally {
      photoAnalysisLoading.style.display = 'none';
      // Reset input so same file can be triggered again if desired
      cameraInput.value = '';
    }
  };
  reader.readAsDataURL(file);
});

// Helper: Resize and compress image client-side using Canvas
function resizeImage(dataUrl, maxWidth, maxHeight, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

// Preset Chips
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.getElementById('inputMealName').value = chip.dataset.name;
    document.getElementById('inputCarbs').value = chip.dataset.c;
    document.getElementById('inputFiber').value = chip.dataset.f;
    document.getElementById('inputProtein').value = chip.dataset.p;
    document.getElementById('inputFat').value = chip.dataset.fat;
    document.getElementById('inputCalories').value = chip.dataset.cal;
  });
});

// Garmin Simulator Controls
const simActiveCal = document.getElementById('simActiveCal');
const lblSimActiveCal = document.getElementById('lblSimActiveCal');
const simSteps = document.getElementById('simSteps');
const lblSimSteps = document.getElementById('lblSimSteps');

simActiveCal?.addEventListener('input', () => {
  lblSimActiveCal.textContent = `${simActiveCal.value} kcal`;
});
simSteps?.addEventListener('input', () => {
  lblSimSteps.textContent = `${simSteps.value} pasos`;
});

document.getElementById('btnApplySimGarmin')?.addEventListener('click', async () => {
  const active_calories = parseInt(simActiveCal.value, 10);
  const steps = parseInt(simSteps.value, 10);

  try {
    const res = await fetch('/api/garmin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'demo',
        custom: { active_calories, steps }
      })
    });
    const data = await res.json();
    if (data.success) {
      await loadStatus();
      alert('¡Métricas Garmin actualizadas! Revisa el acelerador de cetosis.');
    }
  } catch (err) {
    alert('Error al aplicar simulación');
  }
});

// Carga Manual Directa de Métricas Garmin
document.getElementById('formManualGarmin')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const active_calories = parseInt(document.getElementById('inputManualActiveCal').value, 10) || 0;
  const steps = parseInt(document.getElementById('inputManualSteps').value, 10) || 0;
  const resting_hr = parseInt(document.getElementById('inputManualRestingHr').value, 10) || 60;

  try {
    const res = await fetch('/api/garmin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'manual',
        custom: { active_calories, steps, resting_hr }
      })
    });
    const data = await res.json();
    if (data.success) {
      await loadStatus();
      alert('¡Métricas de tu reloj guardadas con éxito! El estado de cetosis se ha actualizado con tus datos reales.');
      // Switch to dashboard
      document.querySelector('[data-tab="tab-dashboard"]').click();
    }
  } catch (err) {
    alert('Error al guardar métricas manuales de Garmin');
  }
});

// Garmin Cloud Real Sync
document.getElementById('btnSyncGarminReal')?.addEventListener('click', async () => {
  const btn = document.getElementById('btnSyncGarminReal');
  btn.disabled = true;
  btn.textContent = '⏳ Conectando con Garmin...';

  try {
    const res = await fetch('/api/garmin/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'real' })
    });
    const data = await res.json();
    if (data.success) {
      await loadStatus();
      alert('¡Sincronizado exitosamente con Garmin Connect!');
    } else {
      if (data.error && data.error.includes('Faltan credenciales')) {
        const abrirAjustes = confirm('La sincronización es 100% gratuita usando tu cuenta habitual de Garmin Connect (la misma que usas en tu teléfono).\n\n¿Deseas ingresar tu usuario y contraseña ahora en Ajustes para sincronizar tus pasos y calorías reales?');
        if (abrirAjustes) {
          document.getElementById('btnSettingsModal').click();
        }
      } else {
        alert(`Aviso de Garmin: ${data.error}`);
      }
    }
  } catch (err) {
    alert('No se pudo conectar con Garmin. Puedes usar el modo simulador para probar.');
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Sincronizar con Garmin Cloud';
  }
});

// Ketone Logs
async function loadKetones() {
  try {
    const res = await fetch('/api/ketones');
    const data = await res.json();
    state.ketoneLogs = data.logs || [];
    renderKetoneLogs(state.ketoneLogs);
  } catch (err) {
    console.error('Error al cargar mediciones de cetonas:', err);
  }
}

function renderKetoneLogs(logs) {
  const container = document.getElementById('ketoneLogsList');
  if (!logs || logs.length === 0) {
    container.innerHTML = '<p class="text-muted text-center">Aún no hay mediciones registradas.</p>';
    return;
  }

  container.innerHTML = logs.map(l => {
    const time = new Date(l.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const typeLabel = l.type === 'blood' ? 'Sangre' : l.type === 'urine' ? 'Orina' : 'Aliento';
    return `
      <div class="ketone-item">
        <div>
          <strong>${l.value} ${escapeHtml(l.unit)}</strong> (${typeLabel})
          <div class="text-muted small">${escapeHtml(l.notes || 'Sin notas')} • ${time}</div>
        </div>
      </div>
    `;
  }).join('');
}

document.getElementById('formKetoneLog')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const type = document.getElementById('selKetoneType').value;
  const value = parseFloat(document.getElementById('inputKetoneValue').value);
  const notes = document.getElementById('inputKetoneNotes').value;
  const unit = type === 'blood' ? 'mmol/L' : type === 'urine' ? 'nivel' : 'ppm';

  try {
    await fetch('/api/ketones', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, value, unit, notes })
    });
    e.target.reset();
    await loadKetones();
    alert('Medición guardada');
  } catch (err) {
    alert('Error al guardar medición');
  }
});

// Settings Management
async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    const s = data.settings;
    document.getElementById('setNetCarbs').value = s.net_carbs_target || 25;
    document.getElementById('setProtein').value = s.protein_target || 90;
    document.getElementById('setFat').value = s.fat_target || 140;
    document.getElementById('setCalories').value = s.calories_target || 1800;
    document.getElementById('setGarminUser').value = s.garmin_username || '';
    document.getElementById('setGarminPass').value = s.garmin_password || '';
    document.getElementById('setGeminiKey').value = s.gemini_api_key || '';
  } catch (err) {
    console.error('Error al cargar configuración:', err);
  }
}

document.getElementById('formSettings')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    net_carbs_target: document.getElementById('setNetCarbs').value,
    protein_target: document.getElementById('setProtein').value,
    fat_target: document.getElementById('setFat').value,
    calories_target: document.getElementById('setCalories').value,
    garmin_username: document.getElementById('setGarminUser').value,
    garmin_password: document.getElementById('setGarminPass').value,
    gemini_api_key: document.getElementById('setGeminiKey').value
  };

  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    settingsModal.classList.remove('show');
    await loadStatus();
    alert('¡Configuración guardada!');
  } catch (err) {
    alert('Error al guardar configuración');
  }
});

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

// Initial Boot
loadStatus();
loadMeals();
loadKetones();
