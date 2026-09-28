// ==========================================================================
// KETOTRACK APP CLIENT ENGINE
// Soporte 100% Offline, IA Nutricional, Garmin Health Connect & Peso
// ==========================================================================

// App State
let state = {
  status: null,
  meals: [],
  weights: [],
  ketoneLogs: [],
  settings: {}
};

// DOM Navigation Tabs
const tabs = document.querySelectorAll('.nav-tab');
const tabPanes = document.querySelectorAll('.tab-pane');

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => t.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const target = document.getElementById(tab.dataset.tab);
    if (target) target.classList.add('active');

    if (tab.dataset.tab === 'tab-weight') {
      loadWeights();
      setTimeout(() => {
        if (typeof renderWeightComparison === 'function') renderWeightComparison();
      }, 50);
    }
    if (tab.dataset.tab === 'tab-charts') {
      if (typeof renderChartsView === 'function') renderChartsView();
    }
    if (tab.dataset.tab === 'tab-tracking') {
      const cIn = Math.round(state.status?.macros?.totals?.calories || 0);
      const cOut = Math.round(state.status?.garmin?.total_calories || ((state.status?.garmin?.bmr_calories || 0) + (state.status?.garmin?.active_calories || 0)) || 0);
      if (typeof renderDeficitAccumulation === 'function') renderDeficitAccumulation(cIn, cOut, state.status?.garmin || {});
    }
  });
});

document.getElementById('btnOpenAddMeal')?.addEventListener('click', () => {
  document.querySelector('[data-tab="tab-meals"]')?.click();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Settings Modal
const settingsModal = document.getElementById('settingsModal');
document.getElementById('btnSettingsModal')?.addEventListener('click', () => {
  loadSettings();
  settingsModal.classList.add('show');
  document.body.classList.add('modal-open');
});
document.getElementById('btnCloseSettingsModal')?.addEventListener('click', () => {
  settingsModal.classList.remove('show');
  document.body.classList.remove('modal-open');
  document.body.classList.remove('modal-open');
});

// Science Modal Handlers
const scienceModal = document.getElementById('scienceModal');
document.getElementById('btnOpenScienceModal')?.addEventListener('click', () => {
  if (scienceModal) scienceModal.classList.add('show');
    document.body.classList.add('modal-open');
});
document.getElementById('btnCloseScienceModal')?.addEventListener('click', () => {
  if (scienceModal) scienceModal.classList.remove('show');
  document.body.classList.remove('modal-open');
});


// Helper de escape HTML
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Formateador amigable de Fecha y Hora
function formatDateTime(isoString) {
  if (!isoString) return 'Hoy';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Hoy';
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) {
    return 'Hoy, ' + timeStr;
  }
  const dateStr = d.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  return dateStr + ', ' + timeStr;
}

// Obtiene la clave de fecha local YYYY-MM-DD sin desfasaje UTC
function getLocalDateKey(dateInput = new Date()) {
  if (!dateInput) return new Date().toISOString().slice(0, 10);
  const d = (typeof dateInput === 'string' || typeof dateInput === 'number') ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Consolida días pasados en el historial permanente (ketotrack_daily_history)
function consolidatePastDaysIntoHistory(todayKey) {
  const allMeals = JSON.parse(localStorage.getItem('ketotrack_meals') || '[]');
  let history = JSON.parse(localStorage.getItem('ketotrack_daily_history') || '[]');
  const savedGarmin = JSON.parse(localStorage.getItem('ketotrack_garmin') || '{}');
  const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  // Agrupar comidas pasadas estrictamente por su fecha local
  const mealsByDate = {};
  for (const m of allMeals) {
    const dKey = getLocalDateKey(m.timestamp);
    if (dKey < todayKey) {
      if (!mealsByDate[dKey]) mealsByDate[dKey] = [];
      mealsByDate[dKey].push(m);
    }
  }

  // Recolectar todas las fechas pasadas que deben documentarse
  const pastDates = new Set(Object.keys(mealsByDate));
  if (savedGarmin.date && savedGarmin.date < todayKey) {
    pastDates.add(savedGarmin.date);
  }
  for (const h of history) {
    if (h.date < todayKey) pastDates.add(h.date);
  }

  const sortedPastDates = Array.from(pastDates).sort();

  for (const dKey of sortedPastDates) {
    const dayMeals = mealsByDate[dKey] || [];
    let netCarbs = 0, fat = 0, protein = 0, calIn = 0;
    for (const m of dayMeals) {
      netCarbs += Number(m.net_carbs || 0);
      fat += Number(m.fat || 0);
      protein += Number(m.protein || 0);
      calIn += Number(m.calories || 0);
    }

    const dObj = new Date(dKey + 'T12:00:00');
    const dayLabel = daysOfWeek[dObj.getDay()] + ' ' + String(dObj.getDate()).padStart(2, '0') + '/' + String(dObj.getMonth() + 1).padStart(2, '0');

    const existingIdx = history.findIndex(h => h.date === dKey);
    const pastRecord = existingIdx !== -1 ? history[existingIdx] : null;

    let steps = pastRecord?.steps || 0;
    let caloriesOut = pastRecord?.calories_out || 0;
    let activeCal = pastRecord?.active_calories || 0;
    let exercises = pastRecord?.exercises || [];

    if (savedGarmin.date === dKey) {
      steps = Number(savedGarmin.steps || steps);
      caloriesOut = Number(savedGarmin.total_calories || caloriesOut);
      activeCal = Number(savedGarmin.active_calories || activeCal);
      if (Array.isArray(savedGarmin.exercises)) exercises = savedGarmin.exercises;
    }

    const consolidatedRecord = {
      date: dKey,
      day_label: dayLabel,
      steps,
      calories_out: caloriesOut,
      active_calories: activeCal,
      calories_in: Math.round(calIn),
      net_carbs: Math.round(netCarbs * 10) / 10,
      fat: Math.round(fat * 10) / 10,
      protein: Math.round(protein * 10) / 10,
      ketones: pastRecord?.ketones || 0.2,
      exercises
    };

    if (existingIdx !== -1) {
      history[existingIdx] = consolidatedRecord;
    } else {
      history.push(consolidatedRecord);
    }
  }

  history.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem('ketotrack_daily_history', JSON.stringify(history));
  return history;
}

// Verifica si cambió el día (a medianoche o apertura) y ejecuta el rollover automático
function checkAndPerformDailyRollover() {
  const now = new Date();
  const todayKey = getLocalDateKey(now);
  const lastActiveDate = localStorage.getItem('ketotrack_last_active_date');

  if (!lastActiveDate) {
    localStorage.setItem('ketotrack_last_active_date', todayKey);
    return false;
  }

  if (lastActiveDate !== todayKey) {
    console.log(`🌅 Rollover Diario: Cerrando ${lastActiveDate} e iniciando ${todayKey}`);
    consolidatePastDaysIntoHistory(todayKey);

    // Reiniciar métricas de Garmin si pertenecían a un día anterior
    const savedGarmin = JSON.parse(localStorage.getItem('ketotrack_garmin') || '{}');
    if (savedGarmin.date && savedGarmin.date !== todayKey) {
      const elapsedHours = Math.max(0.1, now.getHours() + (now.getMinutes() / 60));
      const dailyBmr = 2192;
      const restingSoFar = Math.round((dailyBmr / 24) * elapsedHours);
      const freshGarmin = {
        date: todayKey,
        steps: 0,
        active_calories: 0,
        step_calories: 0,
        exercise_calories: 0,
        exercises: [],
        resting_hr: savedGarmin.resting_hr || 60,
        bmr_calories: restingSoFar,
        daily_bmr: dailyBmr,
        total_calories: restingSoFar,
        source: savedGarmin.source || 'Health Connect (Garmin)',
        timestamp: now.toISOString()
      };
      localStorage.setItem('ketotrack_garmin', JSON.stringify(freshGarmin));
      if (state.status) state.status.garmin = freshGarmin;
    }

    localStorage.setItem('ketotrack_last_active_date', todayKey);
    return true;
  }

  return false;
}

// ==========================================================================
// 1. CÁLCULO DE MACRONUTRIENTES PERSONALIZADOS SEGÚN PESO Y EDAD
// ==========================================================================
function calculatePersonalizedTargets(profile) {
  const weightKg = Number(profile?.weight || 80);
  const goalWeight = Number(profile?.goal_weight || (weightKg > 5 ? weightKg - 5 : weightKg));
  const age = Number(profile?.age || 35);
  const heightCm = Number(profile?.height || 175);
  const gender = profile?.gender || 'male';
  const netCarbTarget = Number(profile?.net_carbs_target || 25);

  // Fórmula Mifflin-St Jeor para Tasa Metabólica Basal (BMR)
  let bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * age);
  bmr += (gender === 'female' ? -161 : 5);

  // Gasto Energético Total Diario (TDEE base en reposo / actividad leve)
  const tdeeBase = Math.round(bmr * 1.25);

  // Cálculo de déficit según el peso a disminuir (OMS / ACSM)
  const weightToLose = Math.max(0, Math.round((weightKg - goalWeight) * 10) / 10);
  let deficitRatio = 0;
  if (weightToLose >= 10) {
    deficitRatio = 0.20; // 20% déficit para pérdida sostenida (aprox 450-500 kcal)
  } else if (weightToLose > 0) {
    deficitRatio = 0.15; // 15% déficit para pérdida moderada (aprox 300-380 kcal)
  }

  // Pisos de seguridad clínica internacional (OMS / ACSM)
  const minSafeCalories = gender === 'female' ? 1200 : 1450;
  let targetCalories = Math.round(tdeeBase * (1 - deficitRatio));
  targetCalories = Math.max(minSafeCalories, targetCalories);
  const dailyDeficit = Math.max(0, tdeeBase - targetCalories);

  // Macronutrientes cetogénicos
  // Proteína: 1.8g / kg para preservar musculatura en déficit calórico (Phinney & Volek, AJCN)
  const proteinGrams = Math.round(weightKg * 1.8);
  const proteinCalories = proteinGrams * 4;
  const carbCalories = netCarbTarget * 4;
  const fatCalories = Math.max(0, targetCalories - proteinCalories - carbCalories);
  const fatGrams = Math.round(fatCalories / 9);

  // Recalibrar calorías finales exactas con los gramos redondeados
  const finalCalories = Math.round((fatGrams * 9) + proteinCalories + carbCalories);

  return {
    weight: weightKg,
    goalWeight,
    weightToLose,
    age,
    height: heightCm,
    gender,
    bmr: Math.round(bmr),
    tdee: tdeeBase,
    deficit: dailyDeficit,
    deficitRatio: Math.round(deficitRatio * 100),
    netCarbs: netCarbTarget,
    protein: proteinGrams,
    fat: fatGrams,
    calories: finalCalories
  };
}

// ==========================================================================
// 2. MOTOR DE INTELIGENCIA ARTIFICIAL NUTRICIONAL (AI MEAL ESTIMATOR)
// ==========================================================================
// Base de Conocimiento Nutricional Ampliada con +80 Categorías de Platos, Postres, Bebidas y Alimentos
const FOOD_AI_DATABASE = [
  // --- POSTRES Y DULCES ---
  {
    id: 'flan_mixto',
    match: ['flan mixto', 'flan con dulce de leche y crema', 'flan con crema y dulce de leche', 'flan con dulce y crema'],
    name: 'Flan mixto (con DDL y crema)',
    unit: 'porción', baseGrams: 0,
    carbs: 44, fiber: 0, protein: 7.5, fat: 16, calories: 350,
    category: 'postre'
  },
  {
    id: 'flan_ddl',
    match: ['flan con dulce de leche', 'flan con ddl', 'flan con dulce'],
    name: 'Flan con dulce de leche',
    unit: 'porción', baseGrams: 0,
    carbs: 42, fiber: 0, protein: 7, fat: 7, calories: 260,
    category: 'postre'
  },
  {
    id: 'flan_crema',
    match: ['flan con crema'],
    name: 'Flan con crema',
    unit: 'porción', baseGrams: 0,
    carbs: 26, fiber: 0, protein: 6.5, fat: 14, calories: 255,
    category: 'postre'
  },
  {
    id: 'flan',
    match: ['flan casero', 'flan'],
    name: 'Flan casero',
    unit: 'porción', baseGrams: 0,
    carbs: 24, fiber: 0, protein: 6, fat: 5, calories: 165,
    category: 'postre'
  },
  {
    id: 'chocotorta',
    match: ['chocotorta'],
    name: 'Chocotorta',
    unit: 'porción', baseGrams: 0,
    carbs: 46, fiber: 1.5, protein: 6, fat: 24, calories: 425,
    category: 'postre'
  },
  {
    id: 'tiramisu',
    match: ['tiramisu'],
    name: 'Tiramisú',
    unit: 'porción', baseGrams: 0,
    carbs: 38, fiber: 1, protein: 6, fat: 18, calories: 340,
    category: 'postre'
  },
  {
    id: 'cheesecake',
    match: ['cheesecake', 'tarta de queso dulce'],
    name: 'Cheesecake',
    unit: 'porción', baseGrams: 0,
    carbs: 34, fiber: 1, protein: 7, fat: 22, calories: 365,
    category: 'postre'
  },
  {
    id: 'lemon_pie',
    match: ['lemon pie', 'tarta de limon'],
    name: 'Lemon pie',
    unit: 'porción', baseGrams: 0,
    carbs: 45, fiber: 1, protein: 5, fat: 14, calories: 330,
    category: 'postre'
  },
  {
    id: 'torta_chocolate',
    match: ['torta de chocolate', 'pastel de chocolate', 'brownie', 'marquise de chocolate', 'marquise'],
    name: 'Torta de chocolate / Brownie',
    unit: 'porción', baseGrams: 0,
    carbs: 52, fiber: 2.5, protein: 5, fat: 19, calories: 400,
    category: 'postre'
  },
  {
    id: 'torta_generica',
    match: ['porcion de torta dulce', 'porcion de torta', 'torta dulce', 'torta'],
    name: 'Porción de torta dulce',
    unit: 'porción', baseGrams: 0,
    carbs: 48, fiber: 1, protein: 4.5, fat: 16, calories: 360,
    category: 'postre'
  },
  {
    id: 'helado_cuarto',
    match: ['1/4 de helado', '1/4 helado', 'cuarto de helado', 'cuarto kilo de helado', '250g helado', '250g de helado', 'cuarto helado'],
    name: '1/4 kg de helado',
    unit: '1/4 kg', baseGrams: 250,
    carbs: 68, fiber: 1.5, protein: 9, fat: 26, calories: 545,
    category: 'postre'
  },
  {
    id: 'helado',
    match: ['bocha de helado', 'bochas de helado', 'cucurucho de helado', 'cucurucho', 'helado'],
    name: 'Helado',
    unit: 'bocha', baseGrams: 0,
    carbs: 22, fiber: 0.5, protein: 3, fat: 8.5, calories: 175,
    category: 'postre'
  },
  {
    id: 'panqueque_ddl',
    match: ['panqueque con dulce de leche', 'panqueque de dulce de leche', 'panqueque con ddl', 'panqueques con dulce de leche', 'waffle con dulce de leche'],
    name: 'Panqueque con dulce de leche',
    unit: 'unidad', baseGrams: 0,
    carbs: 36, fiber: 1, protein: 5, fat: 6.5, calories: 225,
    category: 'postre'
  },
  {
    id: 'medialuna_ddl',
    match: ['medialuna con dulce de leche', 'medialunas con dulce de leche', 'medialuna rellena', 'medialunas rellenas'],
    name: 'Medialuna con dulce de leche',
    unit: 'unidad', baseGrams: 0,
    carbs: 38, fiber: 1, protein: 5, fat: 9.5, calories: 260,
    category: 'panaderia'
  },
  {
    id: 'medialuna_manteca',
    match: ['medialuna de manteca', 'medialunas de manteca', 'medialuna dulce', 'medialunas dulces'],
    name: 'Medialuna de manteca',
    unit: 'unidad', baseGrams: 0,
    carbs: 26, fiber: 1, protein: 4, fat: 8.5, calories: 195,
    category: 'panaderia'
  },
  {
    id: 'medialuna_grasa',
    match: ['medialuna de grasa', 'medialunas de grasa', 'medialuna salada', 'medialunas saladas'],
    name: 'Medialuna de grasa',
    unit: 'unidad', baseGrams: 0,
    carbs: 22, fiber: 0.8, protein: 3.5, fat: 7, calories: 165,
    category: 'panaderia'
  },
  {
    id: 'medialuna',
    match: ['medialunas', 'medialuna'],
    name: 'Medialuna',
    unit: 'unidad', baseGrams: 0,
    carbs: 25, fiber: 1, protein: 4, fat: 8, calories: 188,
    category: 'panaderia'
  },
  {
    id: 'factura',
    match: ['facturas', 'factura', 'vigilante', 'cañoncito'],
    name: 'Factura de panadería',
    unit: 'unidad', baseGrams: 0,
    carbs: 30, fiber: 1, protein: 4, fat: 9, calories: 220,
    category: 'panaderia'
  },
  {
    id: 'alfajor_maicena',
    match: ['alfajor de maicena', 'alfajores de maicena'],
    name: 'Alfajor de maicena',
    unit: 'unidad', baseGrams: 0,
    carbs: 40, fiber: 1.5, protein: 4, fat: 11, calories: 280,
    category: 'dulce'
  },
  {
    id: 'alfajor',
    match: ['alfajor de chocolate', 'alfajores', 'alfajor'],
    name: 'Alfajor de chocolate',
    unit: 'unidad', baseGrams: 0,
    carbs: 42, fiber: 2, protein: 5, fat: 12, calories: 300,
    category: 'dulce'
  },
  {
    id: 'conito_ddl',
    match: ['conito de dulce de leche', 'conito havanna', 'conito de chocolate'],
    name: 'Conito de dulce de leche',
    unit: 'unidad', baseGrams: 0,
    carbs: 26, fiber: 1, protein: 3, fat: 7, calories: 180,
    category: 'dulce'
  },
  {
    id: 'chocolate_amargo',
    match: ['chocolate amargo', 'chocolate negro', 'chocolate 70%', 'chocolate 80%', 'chocolate 85%', 'chocolate puro'],
    name: 'Chocolate amargo 70%+',
    unit: 'porción 30g', baseGrams: 30,
    carbs: 10, fiber: 3.5, protein: 2.5, fat: 14, calories: 175,
    category: 'dulce_keto'
  },
  {
    id: 'chocolate',
    match: ['chocolate con leche', 'chocolate blanco', 'barra de chocolate', 'chocolate'],
    name: 'Chocolate con leche',
    unit: 'porción 40g', baseGrams: 40,
    carbs: 24, fiber: 1, protein: 3.2, fat: 13, calories: 225,
    category: 'dulce'
  },
  {
    id: 'galletitas',
    match: ['galletitas dulces', 'galletitas', 'galletas dulces', 'galletas', 'oreo', 'chocolinas', 'pepas'],
    name: 'Galletitas dulces (porción)',
    unit: 'porción', baseGrams: 0,
    carbs: 26, fiber: 1, protein: 2.5, fat: 7, calories: 180,
    category: 'dulce'
  },
  {
    id: 'dulce_de_leche',
    match: ['dulce de leche', 'ddl'],
    name: 'Dulce de leche (1 cda)',
    unit: 'cucharada (25g)', baseGrams: 25,
    carbs: 14, fiber: 0, protein: 1.5, fat: 2, calories: 80,
    category: 'dulce'
  },

  // --- BEBIDAS (ALCOHÓLICAS Y ANALCOHÓLICAS) ---
  {
    id: 'fernet_coca_zero',
    match: ['fernet con coca zero', 'fernet con coca light', 'fernet zero'],
    name: 'Fernet con Coca Zero',
    unit: 'vaso', baseGrams: 0,
    carbs: 0.5, fiber: 0, protein: 0, fat: 0, calories: 140,
    category: 'alcohol_keto'
  },
  {
    id: 'fernet_coca',
    match: ['fernet con coca cola', 'fernet con coca', 'fernet'],
    name: 'Fernet con Coca Cola común',
    unit: 'vaso', baseGrams: 0,
    carbs: 36, fiber: 0, protein: 0, fat: 0, calories: 290,
    category: 'alcohol_azucar'
  },
  {
    id: 'gin_tonic_zero',
    match: ['gin tonic zero', 'gin tonic light', 'gin con tonica zero'],
    name: 'Gin Tonic con tónica Zero',
    unit: 'trago', baseGrams: 0,
    carbs: 0.2, fiber: 0, protein: 0, fat: 0, calories: 110,
    category: 'alcohol_keto'
  },
  {
    id: 'gin_tonic',
    match: ['gin tonic', 'gin con tonica'],
    name: 'Gin Tonic tradicional',
    unit: 'trago', baseGrams: 0,
    carbs: 18, fiber: 0, protein: 0, fat: 0, calories: 195,
    category: 'alcohol'
  },
  {
    id: 'campari',
    match: ['campari con naranja', 'campari'],
    name: 'Campari con jugo de naranja',
    unit: 'trago', baseGrams: 0,
    carbs: 26, fiber: 0.2, protein: 0.5, fat: 0, calories: 210,
    category: 'alcohol_azucar'
  },
  {
    id: 'aperol',
    match: ['aperol spritz', 'aperol'],
    name: 'Aperol Spritz',
    unit: 'copa', baseGrams: 0,
    carbs: 16, fiber: 0, protein: 0.1, fat: 0, calories: 155,
    category: 'alcohol'
  },
  {
    id: 'cerveza_pinta',
    match: ['pinta de cerveza artesanal', 'pinta de cerveza', 'pinta de birra', 'pinta'],
    name: 'Pinta de cerveza (500ml)',
    unit: 'pinta', baseGrams: 0,
    carbs: 19, fiber: 0, protein: 2, fat: 0, calories: 215,
    category: 'alcohol'
  },
  {
    id: 'cerveza',
    match: ['lata de cerveza', 'porron de cerveza', 'vaso de cerveza', 'cerveza artesanal', 'cerveza', 'birra', 'lata cerveza', 'porron'],
    name: 'Cerveza (lata / porrón 354ml)',
    unit: 'lata/vaso', baseGrams: 0,
    carbs: 13, fiber: 0, protein: 1.5, fat: 0, calories: 150,
    category: 'alcohol'
  },
  {
    id: 'vino',
    match: ['copa de vino tinto', 'copa de vino blanco', 'copa de vino', 'vino tinto', 'vino blanco', 'copa vino', 'malbec', 'cabernet', 'vino'],
    name: 'Copa de vino (150ml)',
    unit: 'copa', baseGrams: 0,
    carbs: 2.5, fiber: 0, protein: 0.1, fat: 0, calories: 125,
    category: 'alcohol_keto'
  },
  {
    id: 'champagne',
    match: ['copa de champagne', 'champagne', 'espumante', 'prosecco'],
    name: 'Copa de champagne / espumante',
    unit: 'copa', baseGrams: 0,
    carbs: 2.8, fiber: 0, protein: 0.1, fat: 0, calories: 115,
    category: 'alcohol_keto'
  },
  {
    id: 'whisky',
    match: ['whisky', 'vodka', 'ron', 'tequila', 'gin puro'],
    name: 'Destilado puro (50ml)',
    unit: 'medida', baseGrams: 0,
    carbs: 0, fiber: 0, protein: 0, fat: 0, calories: 110,
    category: 'alcohol_keto'
  },
  {
    id: 'coca_zero',
    match: ['coca cola zero', 'coca zero', 'coca light', 'pepsi black', 'sprite zero', '7up free', 'gaseosa zero', 'gaseosa light'],
    name: 'Gaseosa Zero / Light (354ml)',
    unit: 'lata/vaso', baseGrams: 0,
    carbs: 0, fiber: 0, protein: 0, fat: 0, calories: 1,
    category: 'bebida_keto'
  },
  {
    id: 'coca_cola',
    match: ['coca cola', 'pepsi', 'sprite', 'fanta', '7up', 'gaseosa regular', 'gaseosa comun', 'gaseosa', 'coca'],
    name: 'Gaseosa regular con azúcar (354ml)',
    unit: 'lata/vaso', baseGrams: 0,
    carbs: 37, fiber: 0, protein: 0, fat: 0, calories: 145,
    category: 'bebida_azucar'
  },
  {
    id: 'jugo_naranja',
    match: ['jugo de naranja exprimido', 'naranja exprimida', 'jugo de naranja natural', 'jugo de naranja', 'vaso de naranja exprimida'],
    name: 'Jugo de naranja natural (250ml)',
    unit: 'vaso', baseGrams: 0,
    carbs: 26, fiber: 0.5, protein: 1.8, fat: 0.2, calories: 115,
    category: 'bebida_azucar'
  },
  {
    id: 'jugo_fruta',
    match: ['jugo de manzana', 'jugo de frutas', 'jugo cepita', 'jugo'],
    name: 'Jugo de frutas (250ml)',
    unit: 'vaso', baseGrams: 0,
    carbs: 28, fiber: 0, protein: 0.5, fat: 0, calories: 120,
    category: 'bebida_azucar'
  },
  {
    id: 'limonada_casera',
    match: ['limonada con menta y jengibre', 'limonada sin azucar', 'limonada keto'],
    name: 'Limonada natural sin azúcar',
    unit: 'vaso', baseGrams: 0,
    carbs: 1.5, fiber: 0, protein: 0, fat: 0, calories: 10,
    category: 'bebida_keto'
  },
  {
    id: 'limonada',
    match: ['limonada'],
    name: 'Limonada tradicional (con azúcar)',
    unit: 'vaso', baseGrams: 0,
    carbs: 22, fiber: 0, protein: 0, fat: 0, calories: 90,
    category: 'bebida'
  },
  {
    id: 'licuado_banana',
    match: ['licuado de banana con leche', 'licuado de banana', 'batido de banana'],
    name: 'Licuado de banana con leche',
    unit: 'vaso', baseGrams: 0,
    carbs: 36, fiber: 2.5, protein: 6.5, fat: 5, calories: 220,
    category: 'bebida'
  },
  {
    id: 'cafe_bulletproof',
    match: ['cafe bulletproof', 'bulletproof', 'cafe con manteca', 'cafe keto'],
    name: 'Café Bulletproof (con manteca/MCT)',
    unit: 'taza', baseGrams: 0,
    carbs: 0.2, fiber: 0, protein: 0.5, fat: 24, calories: 220,
    category: 'keto_puro'
  },
  {
    id: 'cafe_leche',
    match: ['cafe con leche', 'latte', 'cafe con leche y espuma'],
    name: 'Café con leche (200ml)',
    unit: 'taza', baseGrams: 0,
    carbs: 6, fiber: 0, protein: 4, fat: 4, calories: 80,
    category: 'infusion'
  },
  {
    id: 'cortado',
    match: ['cafe cortado', 'cortado', 'macchiato'],
    name: 'Café cortado',
    unit: 'pocillo', baseGrams: 0,
    carbs: 2, fiber: 0, protein: 1.5, fat: 1.5, calories: 28,
    category: 'infusion'
  },
  {
    id: 'capuchino',
    match: ['capuchino', 'cappuccino'],
    name: 'Capuchino',
    unit: 'taza', baseGrams: 0,
    carbs: 8, fiber: 0, protein: 5, fat: 5, calories: 100,
    category: 'infusion'
  },
  {
    id: 'cafe',
    match: ['cafe solo', 'cafe negro', 'espresso', 'cafe'],
    name: 'Café negro / espresso',
    unit: 'pocillo', baseGrams: 0,
    carbs: 0.2, fiber: 0, protein: 0.2, fat: 0, calories: 3,
    category: 'infusion_keto'
  },
  {
    id: 'mate_dulce',
    match: ['mate dulce', 'mate con azucar'],
    name: 'Mate con azúcar (ronda)',
    unit: 'termo', baseGrams: 0,
    carbs: 24, fiber: 0, protein: 0, fat: 0, calories: 96,
    category: 'infusion'
  },
  {
    id: 'mate',
    match: ['mate amargo', 'mate'],
    name: 'Mate amargo',
    unit: 'ronda', baseGrams: 0,
    carbs: 0.5, fiber: 0, protein: 0.5, fat: 0, calories: 5,
    category: 'infusion_keto'
  },
  {
    id: 'te',
    match: ['te verde', 'te negro', 'te rojo', 'te'],
    name: 'Té',
    unit: 'taza', baseGrams: 0,
    carbs: 0.2, fiber: 0, protein: 0, fat: 0, calories: 2,
    category: 'infusion_keto'
  },
  {
    id: 'agua',
    match: ['agua con gas', 'soda', 'agua mineral', 'agua'],
    name: 'Agua / Soda',
    unit: 'vaso', baseGrams: 0,
    carbs: 0, fiber: 0, protein: 0, fat: 0, calories: 0,
    category: 'bebida_keto'
  },

  // --- PLATOS Y COMIDAS ELABORADAS ---
  {
    id: 'pastel_papas',
    match: ['porcion de pastel de papas', 'porcion de pastel de papa', 'pastel de papas', 'pastel de papa', 'pastel de carne'],
    name: 'Pastel de papas con carne',
    unit: 'porción', baseGrams: 0,
    carbs: 32, fiber: 2.5, protein: 22, fat: 16, calories: 360,
    category: 'plato'
  },
  {
    id: 'milanesa_napolitana',
    match: ['milanesa napolitana', 'suprema napolitana', 'milanesa a la napolitana'],
    name: 'Milanesa napolitana (jamón, queso, salsa)',
    unit: 'unidad grande', baseGrams: 0,
    carbs: 22, fiber: 1.5, protein: 36, fat: 22, calories: 430,
    category: 'plato'
  },
  {
    id: 'milanesa',
    match: ['milanesa de carne', 'milanesa de ternera', 'milanesa de pollo', 'suprema de pollo', 'suprema', 'milanesa'],
    name: 'Milanesa (carne/pollo rebozada)',
    unit: 'unidad', baseGrams: 0,
    carbs: 18, fiber: 1, protein: 26, fat: 14, calories: 300,
    category: 'plato'
  },
  {
    id: 'empanada_carne',
    match: ['empanadas de carne', 'empanada de carne'],
    name: 'Empanada de carne',
    unit: 'unidad', baseGrams: 0,
    carbs: 22, fiber: 1.5, protein: 8.5, fat: 9.5, calories: 210,
    category: 'plato'
  },
  {
    id: 'empanada_jyq',
    match: ['empanadas de jamon y queso', 'empanada de jamon y queso'],
    name: 'Empanada de jamón y queso',
    unit: 'unidad', baseGrams: 0,
    carbs: 20, fiber: 1, protein: 8, fat: 10, calories: 205,
    category: 'plato'
  },
  {
    id: 'empanada_pollo',
    match: ['empanadas de pollo', 'empanada de pollo'],
    name: 'Empanada de pollo',
    unit: 'unidad', baseGrams: 0,
    carbs: 21, fiber: 1, protein: 8.5, fat: 7.5, calories: 185,
    category: 'plato'
  },
  {
    id: 'empanada_verdura',
    match: ['empanadas de verdura', 'empanada de verdura', 'empanada de acelga'],
    name: 'Empanada de verdura',
    unit: 'unidad', baseGrams: 0,
    carbs: 22, fiber: 2.5, protein: 5.5, fat: 7, calories: 175,
    category: 'plato'
  },
  {
    id: 'empanada',
    match: ['empanadas', 'empanada'],
    name: 'Empanada',
    unit: 'unidad', baseGrams: 0,
    carbs: 22, fiber: 1.5, protein: 8, fat: 9, calories: 200,
    category: 'plato'
  },
  {
    id: 'pizza_fugazzeta',
    match: ['pizza fugazzeta', 'fugazzeta con queso', 'fugazzeta rellena', 'fugazzeta'],
    name: 'Pizza fugazzeta (cebolla y queso)',
    unit: 'porción', baseGrams: 0,
    carbs: 30, fiber: 2, protein: 13, fat: 13, calories: 290,
    category: 'plato'
  },
  {
    id: 'pizza',
    match: ['pizza de muzzarella', 'pizza muzzarella', 'pizza napolitana', 'pizza especial', 'porciones de pizza', 'porcion de pizza', 'pizza'],
    name: 'Pizza (porción)',
    unit: 'porción', baseGrams: 0,
    carbs: 28, fiber: 1.8, protein: 12, fat: 11, calories: 260,
    category: 'plato'
  },
  {
    id: 'faina',
    match: ['faina'],
    name: 'Fainá',
    unit: 'porción', baseGrams: 0,
    carbs: 24, fiber: 3, protein: 6, fat: 8, calories: 195,
    category: 'plato'
  },
  {
    id: 'pancho',
    match: ['superpancho', 'pancho con papas pay', 'pancho', 'hot dog'],
    name: 'Pancho / Hot Dog',
    unit: 'unidad', baseGrams: 0,
    carbs: 28, fiber: 1, protein: 9, fat: 14, calories: 275,
    category: 'comida_rapida'
  },
  {
    id: 'bife_chorizo',
    match: ['bife de chorizo', 'ojo de bife', 'bife de lomo', 'bife', 'lomo', 'churrasco', 'entrecot', 'colita de cuadril'],
    name: 'Bife de carne vacuna (250g)',
    unit: 'porción 250g', baseGrams: 250,
    carbs: 0, fiber: 0, protein: 65, fat: 35, calories: 580,
    category: 'carne_keto'
  },
  {
    id: 'asado_carne',
    match: ['asado de tira', 'tira de asado', 'asado', 'vacio', 'entrana', 'entraña', 'costillas de asado', 'matambre de carne', 'matambre'],
    name: 'Asado / Vacío a la parrilla (250g)',
    unit: 'porción 250g', baseGrams: 250,
    carbs: 0, fiber: 0, protein: 62, fat: 48, calories: 680,
    category: 'carne_keto'
  },
  {
    id: 'choripan',
    match: ['choripan con chimichurri', 'choripan', 'chori'],
    name: 'Choripán con chimichurri',
    unit: 'unidad', baseGrams: 0,
    carbs: 36, fiber: 2, protein: 16, fat: 26, calories: 440,
    category: 'comida_rapida'
  },
  {
    id: 'chorizo',
    match: ['chorizo de cerdo', 'chorizo', 'morcilla'],
    name: 'Chorizo / Morcilla',
    unit: 'unidad', baseGrams: 0,
    carbs: 1.5, fiber: 0, protein: 14, fat: 24, calories: 280,
    category: 'carne_keto'
  },
  {
    id: 'lomito_completo',
    match: ['lomito completo', 'sandwich de lomo completo', 'sandwich de lomo'],
    name: 'Lomito completo con pan',
    unit: 'sándwich', baseGrams: 0,
    carbs: 46, fiber: 2.5, protein: 36, fat: 24, calories: 550,
    category: 'comida_rapida'
  },
  {
    id: 'tostado',
    match: ['tostado de jamon y queso', 'tostado', 'carlitos', 'sandwich tostado'],
    name: 'Tostado de jamón y queso',
    unit: 'sándwich', baseGrams: 0,
    carbs: 32, fiber: 1.5, protein: 16, fat: 14, calories: 320,
    category: 'comida_rapida'
  },
  {
    id: 'hamburguesa_completa',
    match: ['hamburguesa completa', 'hamburguesa con queso y bacon', 'doble cuarto de libra', 'big mac', 'hamburguesa con papas', 'hamburguesa con queso', 'hamburguesa'],
    name: 'Hamburguesa con pan',
    unit: 'sándwich', baseGrams: 0,
    carbs: 38, fiber: 2, protein: 34, fat: 36, calories: 615,
    category: 'comida_rapida'
  },
  {
    id: 'hamburguesa_plato',
    match: ['hamburguesa al plato', 'hamburguesa casera', 'medallon de carne'],
    name: 'Hamburguesa casera al plato',
    unit: 'unidad', baseGrams: 0,
    carbs: 1, fiber: 0, protein: 24, fat: 18, calories: 265,
    category: 'carne_keto'
  },
  {
    id: 'pollo_pechuga',
    match: ['pechuga de pollo', 'pechuga'],
    name: 'Pechuga de pollo (200g)',
    unit: 'porción 200g', baseGrams: 200,
    carbs: 0, fiber: 0, protein: 62, fat: 7.2, calories: 330,
    category: 'ave_keto'
  },
  {
    id: 'pollo_pata_muslo',
    match: ['pata y muslo', 'pata muslo', 'muslo de pollo', 'alitas de pollo', 'pollo al horno', 'pollo a la parrilla', 'pollo'],
    name: 'Pollo (al horno / parrilla 200g)',
    unit: 'porción 200g', baseGrams: 200,
    carbs: 0, fiber: 0, protein: 48, fat: 22, calories: 400,
    category: 'ave_keto'
  },
  {
    id: 'cerdo_bondiola',
    match: ['bondiola', 'costillita de cerdo', 'costillitas de cerdo', 'pechito de cerdo', 'carre de cerdo', 'cerdo'],
    name: 'Carne de cerdo / Bondiola (200g)',
    unit: 'porción 200g', baseGrams: 200,
    carbs: 0, fiber: 0, protein: 48, fat: 36, calories: 520,
    category: 'carne_keto'
  },
  {
    id: 'salmon',
    match: ['salmon rosado', 'salmon'],
    name: 'Salmón rosado (200g)',
    unit: 'porción 200g', baseGrams: 200,
    carbs: 0, fiber: 0, protein: 44, fat: 26, calories: 420,
    category: 'pescado_keto'
  },
  {
    id: 'pescado_blanco',
    match: ['merluza', 'lenguado', 'corvina', 'pejerrey', 'pescado'],
    name: 'Filet de pescado (200g)',
    unit: 'porción 200g', baseGrams: 200,
    carbs: 0, fiber: 0, protein: 40, fat: 4, calories: 200,
    category: 'pescado_keto'
  },
  {
    id: 'atun',
    match: ['atun al natural', 'lata de atun', 'atun en aceite', 'atun'],
    name: 'Lata de atún',
    unit: 'lata', baseGrams: 170,
    carbs: 0, fiber: 0, protein: 28, fat: 4, calories: 150,
    category: 'pescado_keto'
  },
  {
    id: 'mariscos',
    match: ['camarones', 'langostinos', 'mejillones', 'mariscos', 'rabas'],
    name: 'Mariscos / Rabas (porción)',
    unit: 'porción', baseGrams: 0,
    carbs: 6, fiber: 0.5, protein: 26, fat: 6, calories: 185,
    category: 'pescado_keto'
  },
  {
    id: 'carne_picada',
    match: ['carne picada', 'albondigas', 'carne vacuna', 'carne molida', 'carne'],
    name: 'Carne vacuna (200g)',
    unit: 'porción 200g', baseGrams: 200,
    carbs: 0, fiber: 0, protein: 52, fat: 30, calories: 480,
    category: 'carne_keto'
  },
  {
    id: 'panceta',
    match: ['panceta', 'bacon', 'tocino'],
    name: 'Panceta / Bacon (3 fetas)',
    unit: 'porción 40g', baseGrams: 40,
    carbs: 0.5, fiber: 0, protein: 12, fat: 16, calories: 195,
    category: 'carne_keto'
  },
  {
    id: 'jamon',
    match: ['jamon crudo', 'jamon cocido', 'jamon'],
    name: 'Jamón (fetas)',
    unit: 'porción 50g', baseGrams: 50,
    carbs: 0.5, fiber: 0, protein: 11, fat: 5, calories: 95,
    category: 'carne_keto'
  },
  {
    id: 'huevos_fritos',
    match: ['huevos fritos', 'huevo frito'],
    name: 'Huevos fritos',
    unit: 'unidad', baseGrams: 0,
    carbs: 0.5, fiber: 0, protein: 6.5, fat: 8.5, calories: 105,
    category: 'huevo_keto'
  },
  {
    id: 'huevos',
    match: ['huevos revueltos', 'huevo revuelto', 'huevo duro', 'huevos duros', 'huevos', 'huevo', 'omelette'],
    name: 'Huevos (revueltos/duros/omelette)',
    unit: 'unidad', baseGrams: 0,
    carbs: 0.5, fiber: 0, protein: 6.5, fat: 5.2, calories: 75,
    category: 'huevo_keto'
  },

  // --- PASTAS, ARROCES Y GUISOS ---
  {
    id: 'noquis',
    match: ['plato de noquis', 'plato de ñoquis', 'noquis', 'ñoquis'],
    name: 'Ñoquis de papa',
    unit: 'plato', baseGrams: 0,
    carbs: 68, fiber: 3, protein: 9, fat: 4, calories: 350,
    category: 'pasta'
  },
  {
    id: 'fideos',
    match: ['fideos', 'spaghetti', 'tallarines', 'pasta'],
    name: 'Fideos / Pasta',
    unit: 'plato', baseGrams: 0,
    carbs: 65, fiber: 3.5, protein: 12, fat: 3, calories: 340,
    category: 'pasta'
  },
  {
    id: 'ravioles',
    match: ['ravioles', 'sorrentinos', 'capeletis', 'canelones', 'pasta rellena'],
    name: 'Pastas rellenas (ravioles/sorrentinos)',
    unit: 'plato', baseGrams: 0,
    carbs: 62, fiber: 3, protein: 16, fat: 8, calories: 385,
    category: 'pasta'
  },
  {
    id: 'lasagna',
    match: ['lasagna', 'lasana'],
    name: 'Lasaña de carne y queso',
    unit: 'porción', baseGrams: 0,
    carbs: 48, fiber: 3.5, protein: 26, fat: 22, calories: 495,
    category: 'pasta'
  },
  {
    id: 'salsa_bolognesa',
    match: ['salsa bolognesa', 'bolognesa', 'tuco con carne'],
    name: 'Salsa bolognesa con carne',
    unit: 'porción', baseGrams: 0,
    carbs: 8, fiber: 1.5, protein: 14, fat: 10, calories: 180,
    category: 'salsa'
  },
  {
    id: 'salsa_tuco',
    match: ['salsa de tomate', 'filetto', 'tuco'],
    name: 'Salsa de tomate / tuco',
    unit: 'porción', baseGrams: 0,
    carbs: 6, fiber: 1.5, protein: 1.5, fat: 3, calories: 60,
    category: 'salsa'
  },
  {
    id: 'arroz_pollo',
    match: ['arroz con pollo', 'guiso de arroz con pollo'],
    name: 'Arroz con pollo',
    unit: 'plato', baseGrams: 0,
    carbs: 48, fiber: 2, protein: 28, fat: 11, calories: 405,
    category: 'plato'
  },
  {
    id: 'risotto',
    match: ['risotto', 'paella'],
    name: 'Risotto / Paella',
    unit: 'plato', baseGrams: 0,
    carbs: 52, fiber: 2, protein: 18, fat: 13, calories: 395,
    category: 'plato'
  },
  {
    id: 'arroz',
    match: ['arroz blanco', 'arroz'],
    name: 'Arroz blanco',
    unit: 'plato (180g)', baseGrams: 180,
    carbs: 50, fiber: 1, protein: 4.5, fat: 1, calories: 230,
    category: 'guarnicion'
  },
  {
    id: 'guiso_lentejas',
    match: ['guiso de lentejas', 'lentejas', 'guiso'],
    name: 'Guiso de lentejas con carne',
    unit: 'plato hondo', baseGrams: 0,
    carbs: 44, fiber: 9, protein: 22, fat: 10, calories: 360,
    category: 'plato'
  },
  {
    id: 'estofado',
    match: ['estofado de carne', 'estofado'],
    name: 'Estofado de carne con papas',
    unit: 'plato', baseGrams: 0,
    carbs: 26, fiber: 3, protein: 28, fat: 14, calories: 345,
    category: 'plato'
  },
  {
    id: 'locro',
    match: ['locro'],
    name: 'Locro tradicional',
    unit: 'plato hondo', baseGrams: 0,
    carbs: 48, fiber: 6, protein: 24, fat: 18, calories: 455,
    category: 'plato'
  },
  {
    id: 'tarta_jyq',
    match: ['tarta de jamon y queso', 'tarta de jamon'],
    name: 'Tarta de jamón y queso',
    unit: 'porción', baseGrams: 0,
    carbs: 28, fiber: 1.5, protein: 15, fat: 18, calories: 335,
    category: 'plato'
  },
  {
    id: 'tarta_verdura',
    match: ['tarta de verdura', 'tarta de acelga', 'tarta de espinaca', 'pascualina', 'tarta pascualina'],
    name: 'Tarta pascualina / verdura',
    unit: 'porción', baseGrams: 0,
    carbs: 26, fiber: 3.5, protein: 9, fat: 13, calories: 260,
    category: 'plato'
  },
  {
    id: 'tortilla_papas',
    match: ['tortilla de papas', 'tortilla de papa', 'tortilla espanola'],
    name: 'Tortilla de papas',
    unit: 'porción', baseGrams: 0,
    carbs: 26, fiber: 2, protein: 8, fat: 14, calories: 265,
    category: 'plato'
  },
  {
    id: 'tortilla_verdura',
    match: ['tortilla de acelga', 'tortilla de espinaca', 'tortilla de verduras'],
    name: 'Tortilla de acelga / espinaca',
    unit: 'porción', baseGrams: 0,
    carbs: 7, fiber: 3, protein: 9, fat: 8, calories: 140,
    category: 'plato_keto'
  },
  {
    id: 'revuelto_gramajo',
    match: ['revuelto gramajo', 'gramajo'],
    name: 'Revuelto gramajo',
    unit: 'porción', baseGrams: 0,
    carbs: 28, fiber: 2.5, protein: 18, fat: 22, calories: 385,
    category: 'plato'
  },
  {
    id: 'sushi',
    match: ['piezas de sushi', 'rolls de sushi', 'roll de sushi', 'piezas sushi', 'sushi'],
    name: 'Sushi (roll tradicional)',
    unit: 'pieza', baseGrams: 0,
    carbs: 5.5, fiber: 0.4, protein: 2, fat: 1.5, calories: 44,
    category: 'plato'
  },
  {
    id: 'sopa_verduras',
    match: ['sopa de verduras', 'sopa de vegetales', 'sopa crema', 'sopa'],
    name: 'Sopa de verduras',
    unit: 'plato', baseGrams: 0,
    carbs: 12, fiber: 3, protein: 3, fat: 1, calories: 70,
    category: 'sopa'
  },
  {
    id: 'caldo',
    match: ['caldo de huesos', 'caldo de pollo', 'caldo de carne', 'caldo'],
    name: 'Caldo nutritivo',
    unit: 'taza', baseGrams: 0,
    carbs: 0.5, fiber: 0, protein: 4, fat: 1, calories: 28,
    category: 'sopa_keto'
  },

  // --- GUARNICIONES, ENSALADAS Y PAPAS ---
  {
    id: 'papas_fritas',
    match: ['papas fritas', 'papa frita', 'fritas'],
    name: 'Papas fritas (porción)',
    unit: 'porción', baseGrams: 0,
    carbs: 44, fiber: 4, protein: 4, fat: 19, calories: 365,
    category: 'guarnicion'
  },
  {
    id: 'pure_papas',
    match: ['pure de papas', 'pure de papa', 'pure'],
    name: 'Puré de papas',
    unit: 'porción', baseGrams: 0,
    carbs: 26, fiber: 2, protein: 3, fat: 6, calories: 170,
    category: 'guarnicion'
  },
  {
    id: 'papa_horno',
    match: ['papas al horno', 'papa al horno', 'papa rustica'],
    name: 'Papa al horno',
    unit: 'unidad', baseGrams: 0,
    carbs: 30, fiber: 2.5, protein: 3, fat: 1, calories: 145,
    category: 'guarnicion'
  },
  {
    id: 'pure_calabaza',
    match: ['pure de calabaza', 'calabaza al horno', 'zapallo'],
    name: 'Puré de calabaza',
    unit: 'porción', baseGrams: 0,
    carbs: 15, fiber: 2.5, protein: 2, fat: 3, calories: 95,
    category: 'guarnicion'
  },
  {
    id: 'ensalada_cesar',
    match: ['ensalada cesar', 'cesar salad', 'caesar'],
    name: 'Ensalada César con pollo',
    unit: 'porción', baseGrams: 0,
    carbs: 10, fiber: 2, protein: 24, fat: 18, calories: 300,
    category: 'ensalada'
  },
  {
    id: 'ensalada_rusa',
    match: ['ensalada rusa'],
    name: 'Ensalada rusa con mayonesa',
    unit: 'porción', baseGrams: 0,
    carbs: 25, fiber: 3, protein: 3.5, fat: 14, calories: 245,
    category: 'ensalada'
  },
  {
    id: 'ensalada_mixta',
    match: ['ensalada mixta', 'ensalada verde', 'lechuga y tomate', 'rucula y tomate', 'lechuga', 'ensalada'],
    name: 'Ensalada verde mixta',
    unit: 'porción', baseGrams: 0,
    carbs: 5, fiber: 2.5, protein: 1.5, fat: 0.5, calories: 32,
    category: 'ensalada_keto'
  },
  {
    id: 'palta',
    match: ['palta', 'aguacate', 'guacamole'],
    name: 'Palta / Aguacate',
    unit: 'unidad', baseGrams: 0,
    carbs: 12, fiber: 9.2, protein: 2.8, fat: 22, calories: 240,
    category: 'grasa_keto'
  },
  {
    id: 'aceitunas',
    match: ['aceitunas verdes', 'aceitunas negras', 'aceitunas'],
    name: 'Aceitunas (porción 50g)',
    unit: 'porción 50g', baseGrams: 50,
    carbs: 1.5, fiber: 1.2, protein: 0.5, fat: 8, calories: 75,
    category: 'grasa_keto'
  },
  {
    id: 'verduras_keto',
    match: ['brocoli', 'coliflor', 'esparragos', 'espinaca', 'acelga', 'champinon', 'champinones', 'zucchini'],
    name: 'Verduras verdes keto (brócoli/espinaca)',
    unit: 'porción 150g', baseGrams: 150,
    carbs: 6, fiber: 4, protein: 3.5, fat: 0.5, calories: 42,
    category: 'verdura_keto'
  },

  // --- LÁCTEOS, GRASAS, CONDIMENTOS Y FRUTOS SECOS ---
  {
    id: 'queso_rallado',
    match: ['queso rallado', 'parmesano', 'queso sardo', 'queso duro'],
    name: 'Queso rallado (parmesano 30g)',
    unit: 'porción 30g', baseGrams: 30,
    carbs: 0.8, fiber: 0, protein: 10, fat: 9, calories: 125,
    category: 'lacteo_keto'
  },
  {
    id: 'queso_muzzarella',
    match: ['queso muzzarella', 'muzzarella', 'queso cremoso', 'queso cheddar', 'queso dambo', 'queso cuartirolo', 'queso'],
    name: 'Queso (muzzarella/cremoso 60g)',
    unit: 'porción 60g', baseGrams: 60,
    carbs: 1.5, fiber: 0, protein: 14, fat: 16, calories: 210,
    category: 'lacteo_keto'
  },
  {
    id: 'queso_crema',
    match: ['queso untable', 'queso crema', 'casancrem', 'philadelphia'],
    name: 'Queso crema / untable (30g)',
    unit: 'cucharada (30g)', baseGrams: 30,
    carbs: 1.2, fiber: 0, protein: 2.5, fat: 8, calories: 88,
    category: 'lacteo_keto'
  },
  {
    id: 'crema_leche',
    match: ['crema de leche', 'crema doble'],
    name: 'Crema de leche (50ml)',
    unit: 'porción (50ml)', baseGrams: 50,
    carbs: 1.4, fiber: 0, protein: 1.2, fat: 18, calories: 175,
    category: 'lacteo_keto'
  },
  {
    id: 'manteca',
    match: ['manteca', 'mantequilla', 'ghee'],
    name: 'Manteca / Mantequilla (15g)',
    unit: 'porción', baseGrams: 15,
    carbs: 0.1, fiber: 0, protein: 0.1, fat: 12.5, calories: 110,
    category: 'grasa_keto'
  },
  {
    id: 'aceite_oliva',
    match: ['aceite de oliva', 'aceite de coco', 'aceite mct', 'aceite'],
    name: 'Aceite de oliva / coco (1 cda)',
    unit: 'cda', baseGrams: 15,
    carbs: 0, fiber: 0, protein: 0, fat: 14, calories: 120,
    category: 'grasa_keto'
  },
  {
    id: 'mayonesa',
    match: ['mayonesa'],
    name: 'Mayonesa (1 cda)',
    unit: 'cda (20g)', baseGrams: 20,
    carbs: 0.5, fiber: 0, protein: 0.3, fat: 15, calories: 135,
    category: 'grasa_keto'
  },
  {
    id: 'frutos_secos',
    match: ['frutos secos', 'nueces', 'almendras', 'mani', 'avellanas', 'castanas', 'pistachos'],
    name: 'Frutos secos (puñado 35g)',
    unit: 'puñado', baseGrams: 35,
    carbs: 5, fiber: 3, protein: 6.5, fat: 19, calories: 215,
    category: 'fruto_keto'
  },
  {
    id: 'banana',
    match: ['banana', 'platano'],
    name: 'Banana mediana',
    unit: 'unidad', baseGrams: 0,
    carbs: 27, fiber: 3, protein: 1.2, fat: 0.3, calories: 105,
    category: 'fruta'
  },
  {
    id: 'manzana',
    match: ['manzana', 'pera'],
    name: 'Manzana / Pera',
    unit: 'unidad', baseGrams: 0,
    carbs: 22, fiber: 4, protein: 0.5, fat: 0.3, calories: 95,
    category: 'fruta'
  },
  {
    id: 'frutillas',
    match: ['frutos rojos', 'frutillas', 'arandanos', 'frambuesas'],
    name: 'Frutillas / Frutos rojos (150g)',
    unit: 'taza', baseGrams: 150,
    carbs: 11, fiber: 3.5, protein: 1, fat: 0.5, calories: 52,
    category: 'fruta_keto'
  },
  {
    id: 'leche',
    match: ['vaso de leche', 'taza de leche', 'leche'],
    name: 'Vaso de leche (200ml)',
    unit: 'vaso', baseGrams: 200,
    carbs: 10, fiber: 0, protein: 6.5, fat: 6, calories: 120,
    category: 'lacteo'
  },
  {
    id: 'yogur_griego',
    match: ['yogur griego sin azucar', 'yogur griego natural', 'yogur griego'],
    name: 'Yogur griego natural (150g)',
    unit: 'pote (150g)', baseGrams: 150,
    carbs: 4.5, fiber: 0, protein: 12, fat: 6, calories: 120,
    category: 'lacteo_keto'
  },
  {
    id: 'yogur',
    match: ['yogur con cereales', 'yogur', 'yogurt'],
    name: 'Pote de yogur regular',
    unit: 'pote', baseGrams: 0,
    carbs: 18, fiber: 0.5, protein: 6, fat: 4, calories: 135,
    category: 'lacteo'
  },
  {
    id: 'pan_tostada',
    match: ['tostadas', 'tostada', 'rodajas de pan', 'pan blanco', 'pan'],
    name: 'Pan / Tostada',
    unit: 'unidad', baseGrams: 0,
    carbs: 16, fiber: 1, protein: 2.5, fat: 0.8, calories: 85,
    category: 'panaderia'
  }
];

// Aplanamiento de reglas ordenadas estrictamente por longitud descendente de frase clave
const FLATTENED_FOOD_RULES = [];
for (const item of FOOD_AI_DATABASE) {
  for (const kw of item.match) {
    const kwNorm = kw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    FLATTENED_FOOD_RULES.push({
      item,
      kwNorm,
      len: kwNorm.length
    });
  }
}
FLATTENED_FOOD_RULES.sort((a, b) => b.len - a.len);

// Extractor bidireccional de cantidades numéricas, porciones y gramos (hacia adelante y hacia atrás)
function extractFoodQuantityBidirectional(fullText, matchStart, matchEnd) {
  // 1. Revisar sufijo (justo después del alimento, ej: "bife de chorizo 400g" o "vino 2 copas")
  const suffix = fullText.slice(matchEnd, Math.min(fullText.length, matchEnd + 25));
  const gramSuffix = suffix.match(/^\s*(?:de\s+)?(\d+(?:\.\d+)?)\s*(?:g|gr|gramos)\b/i);
  if (gramSuffix) {
    const grams = parseFloat(gramSuffix[1]);
    const endPad = matchEnd + gramSuffix[0].length;
    return { multiplier: grams / 100, isGrams: true, grams, startPad: matchStart, endPad };
  }

  const unitSuffix = suffix.match(/^\s*(?:x\s*)?(\d+(?:\.\d+)?)\s*(?:unidades?|porciones?|fetas?|rodajas?|vasos?|copas?|latas?|platos?|bochas?|piezas?)?\b/i);
  if (unitSuffix) {
    const val = parseFloat(unitSuffix[1]);
    if (!isNaN(val) && val > 0 && val < 50) {
      const endPad = matchEnd + unitSuffix[0].length;
      return { multiplier: val, isGrams: false, startPad: matchStart, endPad };
    }
  }

  // 2. Revisar prefijo (justo antes del alimento, ej: "400g de bife" o "2 empanadas")
  const prefixStart = Math.max(0, matchStart - 25);
  const prefix = fullText.slice(prefixStart, matchStart);

  const gramPrefix = prefix.match(/(\d+(?:\.\d+)?)\s*(?:g|gr|gramos)(?:\s+de)?\s*$/i);
  if (gramPrefix) {
    const grams = parseFloat(gramPrefix[1]);
    const startPad = matchStart - gramPrefix[0].length;
    return { multiplier: grams / 100, isGrams: true, grams, startPad, endPad: matchEnd };
  }

  if (prefix.match(/(?:1\/2|media|medio)\s*(?:de\s+)?$/i)) {
    const startPad = matchStart - (prefix.match(/(?:1\/2|media|medio)\s*(?:de\s+)?$/i)[0].length);
    return { multiplier: 0.5, isGrams: false, startPad, endPad: matchEnd };
  }
  if (prefix.match(/(?:1\/4|cuarto)\s*(?:de\s+)?$/i)) {
    const startPad = matchStart - (prefix.match(/(?:1\/4|cuarto)\s*(?:de\s+)?$/i)[0].length);
    return { multiplier: 0.25, isGrams: false, startPad, endPad: matchEnd };
  }

  const numPrefix = prefix.match(/\b(\d+(?:\.\d+)?)\s*(?:unidades?|porciones?|fetas?|rodajas?|vasos?|copas?|latas?|platos?|bochas?|botellas?|tazas?|piezas?)?(?:\s+de)?\s*$/i);
  if (numPrefix) {
    const val = parseFloat(numPrefix[1]);
    if (!isNaN(val) && val > 0 && val < 50) {
      const startPad = matchStart - numPrefix[0].length;
      return { multiplier: val, isGrams: false, startPad, endPad: matchEnd };
    }
  }

  const wordMap = [
    { regex: /\b(?:una|un|uno)\s*(?:de\s+)?$/i, val: 1 },
    { regex: /\b(?:dos)\s*(?:de\s+)?$/i, val: 2 },
    { regex: /\b(?:tres)\s*(?:de\s+)?$/i, val: 3 },
    { regex: /\b(?:cuatro)\s*(?:de\s+)?$/i, val: 4 },
    { regex: /\b(?:cinco)\s*(?:de\s+)?$/i, val: 5 },
    { regex: /\b(?:seis)\s*(?:de\s+)?$/i, val: 6 },
    { regex: /\b(?:diez)\s*(?:de\s+)?$/i, val: 10 },
    { regex: /\b(?:doce)\s*(?:de\s+)?$/i, val: 12 }
  ];

  for (const w of wordMap) {
    const matchW = prefix.match(w.regex);
    if (matchW) {
      const startPad = matchStart - matchW[0].length;
      return { multiplier: w.val, isGrams: false, startPad, endPad: matchEnd };
    }
  }

  return { multiplier: 1, isGrams: false, startPad: matchStart, endPad: matchEnd };
}

// Función Principal de Estimación Inteligente con Procesamiento de Lenguaje Natural
function estimateMealMacrosAI(input) {
  if (!input || !input.trim()) return null;
  
  let raw = input.toLowerCase().trim();
  let text = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // Normalizar separadores y conjunciones
  text = text.replace(/,/g, ' y ')
             .replace(/\+/g, ' y ')
             .replace(/;/g, ' y ')
             .replace(/\s+/g, ' ');

  let workingText = text;
  let totalCarbs = 0;
  let totalFiber = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCalories = 0;
  let detectedList = [];
  const matchedItemIds = new Set();

  for (const rule of FLATTENED_FOOD_RULES) {
    if (matchedItemIds.has(rule.item.id)) continue;

    const regex = new RegExp('(?:^|\\s)(' + rule.kwNorm.replace(/\s+/g, '\\s+') + ')(?:$|\\s)', 'i');
    const match = workingText.match(regex);
    if (match) {
      const matchStart = match.index + (match[0].startsWith(' ') ? 1 : 0);
      const matchEnd = matchStart + match[1].length;

      const q = extractFoodQuantityBidirectional(workingText, matchStart, matchEnd);
      let mult = q.multiplier;

      let itemCarbs = rule.item.carbs;
      let itemFiber = rule.item.fiber;
      let itemProtein = rule.item.protein;
      let itemFat = rule.item.fat;
      let itemCal = rule.item.calories;

      if (q.isGrams && rule.item.baseGrams > 0) {
        const factor = q.grams / rule.item.baseGrams;
        itemCarbs *= factor;
        itemFiber *= factor;
        itemProtein *= factor;
        itemFat *= factor;
        itemCal *= factor;
      } else {
        itemCarbs *= mult;
        itemFiber *= mult;
        itemProtein *= mult;
        itemFat *= mult;
        itemCal *= mult;
      }

      totalCarbs += itemCarbs;
      totalFiber += itemFiber;
      totalProtein += itemProtein;
      totalFat += itemFat;
      totalCalories += itemCal;

      matchedItemIds.add(rule.item.id);

      const qtyLabel = q.isGrams ? (q.grams + 'g ') : (mult === 1 ? '' : (mult + 'x '));
      detectedList.push(qtyLabel + rule.item.name + ' (' + Math.round(itemCarbs - itemFiber) + 'g carbos)');

      // Consumir el texto emparejado y la cantidad para evitar subcoincidencias duplicadas
      const padLen = q.endPad - q.startPad;
      workingText = workingText.substring(0, q.startPad) + ' '.repeat(padLen) + workingText.substring(q.endPad);
    }
  }

  // Heurística de Rescate Nutricional si no hubo coincidencia directa
  if (detectedList.length === 0) {
    if (text.includes('dulce') || text.includes('postre') || text.includes('torta') || text.includes('azucar') || text.includes('chocolate')) {
      totalCarbs = 45; totalFiber = 1; totalProtein = 5; totalFat = 16; totalCalories = 340;
      detectedList.push('Postre / Dulce tradicional (estimado)');
    } else if (text.includes('cerveza') || text.includes('vino') || text.includes('trago') || text.includes('alcohol') || text.includes('fernet')) {
      totalCarbs = 18; totalFiber = 0; totalProtein = 1; totalFat = 0; totalCalories = 170;
      detectedList.push('Bebida / Trago alcohólico (estimado)');
    } else if (text.includes('gaseosa') || text.includes('jugo') || text.includes('refresco')) {
      totalCarbs = 32; totalFiber = 0; totalProtein = 0; totalFat = 0; totalCalories = 130;
      detectedList.push('Bebida dulce / Gaseosa (estimado)');
    } else if (text.includes('pasta') || text.includes('arroz') || text.includes('fideo') || text.includes('pizza') || text.includes('empanada') || text.includes('pan')) {
      totalCarbs = 54; totalFiber = 3; totalProtein = 12; totalFat = 11; totalCalories = 360;
      detectedList.push('Plato de carbohidratos tradicional (estimado)');
    } else if (text.includes('carne') || text.includes('pollo') || text.includes('pescado') || text.includes('asado') || text.includes('bife')) {
      totalCarbs = 2; totalFiber = 0.5; totalProtein = 45; totalFat = 28; totalCalories = 440;
      detectedList.push('Plato proteico / Carne (estimado)');
    } else {
      totalCarbs = 22; totalFiber = 2; totalProtein = 20; totalFat = 14; totalCalories = 295;
      detectedList.push('Plato mixto elaborado (estimado)');
    }
  }

  const netCarbs = Math.max(0, Math.round((totalCarbs - totalFiber) * 10) / 10);
  const roundedCarbs = Math.round(totalCarbs * 10) / 10;
  const roundedFiber = Math.round(totalFiber * 10) / 10;
  const roundedProtein = Math.round(totalProtein * 10) / 10;
  const roundedFat = Math.round(totalFat * 10) / 10;
  let roundedCalories = Math.round(totalCalories);
  if (roundedCalories === 0) {
    roundedCalories = Math.round((roundedFat * 9) + (roundedProtein * 4) + (netCarbs * 4));
  }

  // Evaluación de impacto Cetogénico y cálculo fisiológico de pasos compensatorios Garmin
  let ketoStatus = 'ok';
  let ketoBadge = '🥑 100% Keto Compatible';
  let ketoNote = 'Bajo en carbohidratos netos. Tu cuerpo permanece en cetosis.';
  
  if (netCarbs > 25) {
    ketoStatus = 'exceeded';
    ketoBadge = '🚨 Alto en Carbohidratos (+' + netCarbs + 'g)';
    const approxSteps = Math.round((netCarbs - 25) * 292);
    ketoNote = 'Supera el límite keto diario. Generará ~' + approxSteps.toLocaleString() + ' pasos compensatorios en tu reloj Garmin para vaciar el glucógeno.';
  } else if (netCarbs > 8) {
    ketoStatus = 'moderate';
    ketoBadge = '⚠️ Moderado en Carbohidratos (' + netCarbs + 'g)';
    ketoNote = 'Consume parte del límite diario keto (25g). Prioriza grasas y proteínas en la siguiente comida.';
  }

  return {
    name: input.trim(),
    carbs: roundedCarbs,
    fiber: roundedFiber,
    net_carbs: netCarbs,
    protein: roundedProtein,
    fat: roundedFat,
    calories: roundedCalories,
    detected: detectedList.join(" + "),
    ketoStatus,
    ketoBadge,
    ketoNote
  };
}

// Botón de Cálculo IA en el Formulario de Comida
document.getElementById('btnAiCalc')?.addEventListener('click', async () => {
  const mealName = (document.getElementById('inputMealName')?.value || '').trim();
  if (!mealName) {
    alert('Escribe el plato, postre o bebida que consumiste (ej. 2 empanadas de carne y una cerveza, flan mixto, bife de chorizo con ensalada).');
    document.getElementById('inputMealName')?.focus();
    return;
  }

  const feedback = document.getElementById('aiCalcFeedback');
  if (feedback) {
    feedback.style.display = 'block';
    feedback.innerHTML = '<span>🤖</span> <em>Analizando plato y calculando macronutrientes con IA...</em>';
  }

  const result = estimateMealMacrosAI(mealName);
  if (result) {
    document.getElementById('inputCarbs').value = result.carbs;
    document.getElementById('inputFiber').value = result.fiber;
    document.getElementById('inputProtein').value = result.protein;
    document.getElementById('inputFat').value = result.fat;
    document.getElementById('inputCalories').value = result.calories;

    if (feedback) {
      let badgeColor = result.ketoStatus === 'exceeded' ? '#ef4444' : (result.ketoStatus === 'moderate' ? '#f59e0b' : '#10b981');
      let bgColor = result.ketoStatus === 'exceeded' ? 'rgba(239, 68, 68, 0.14)' : (result.ketoStatus === 'moderate' ? 'rgba(245, 158, 11, 0.14)' : 'rgba(16, 185, 129, 0.14)');
      feedback.style.borderLeft = `4px solid ${badgeColor}`;
      feedback.style.background = bgColor;
      feedback.innerHTML = `
        <div style="font-size:0.86rem; font-weight:800; color:${badgeColor}; margin-bottom:4px;">
          ${result.ketoBadge}
        </div>
        <div style="font-size:0.82rem; color:var(--text-main); margin-bottom:4px;">
          <strong>✨ Detectado:</strong> ${result.detected}
        </div>
        <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:4px;">
          👉 <strong>${result.net_carbs}g carbos netos</strong> (${result.carbs}g tot / ${result.fiber}g fibra) • <strong>${result.fat}g grasa</strong> • <strong>${result.protein}g prot</strong> • <strong>${result.calories} kcal</strong>
        </div>
        <div style="font-size:0.76rem; color:${badgeColor}; font-style:italic;">
          💡 ${result.ketoNote}
        </div>
      `;
    }
  }
});

// ==========================================================================
// 3. MOTOR DE CETOSIS Y MACROS CLIENTE
// ==========================================================================
function calculateDailyMacrosClient(meals, settings, targetDateKey = null) {
  const targetKey = targetDateKey || getLocalDateKey(new Date());
  // Filtrar ESTRICTAMENTE las comidas que corresponden a la fecha consultada (por defecto HOY)
  const filteredMeals = (meals || []).filter(m => getLocalDateKey(m.timestamp) === targetKey);

  let totalNetCarbs = 0;
  let totalCarbs = 0;
  let totalFiber = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCalories = 0;

  for (const m of filteredMeals) {
    totalCarbs += Number(m.carbs || 0);
    totalFiber += Number(m.fiber || 0);
    totalNetCarbs += Number(m.net_carbs || 0);
    totalProtein += Number(m.protein || 0);
    totalFat += Number(m.fat || 0);
    totalCalories += Number(m.calories || 0);
  }

  const fatCalories = totalFat * 9;
  const proteinCalories = totalProtein * 4;
  const carbCalories = totalNetCarbs * 4;
  const macroCaloriesSum = fatCalories + proteinCalories + carbCalories;

  const fatRatio = macroCaloriesSum > 0 ? Math.round((fatCalories / macroCaloriesSum) * 100) : 0;
  const proteinRatio = macroCaloriesSum > 0 ? Math.round((proteinCalories / macroCaloriesSum) * 100) : 0;
  const carbRatio = macroCaloriesSum > 0 ? Math.round((carbCalories / macroCaloriesSum) * 100) : 0;

  const netCarbTarget = Number(settings?.net_carbs_target || 25);
  const proteinTarget = Number(settings?.protein_target || 140);
  const fatTarget = Number(settings?.fat_target || 150);
  const calorieTarget = Number(settings?.calories_target || 2000);

  const carbLimitExceeded = totalNetCarbs > netCarbTarget;
  const carbRemaining = Math.max(0, Math.round((netCarbTarget - totalNetCarbs) * 10) / 10);

  return {
    date: targetKey,
    mealCount: filteredMeals.length,
    totals: {
      carbs: Math.round(totalCarbs * 10) / 10,
      fiber: Math.round(totalFiber * 10) / 10,
      netCarbs: Math.round(totalNetCarbs * 10) / 10,
      protein: Math.round(totalProtein * 10) / 10,
      fat: Math.round(totalFat * 10) / 10,
      calories: Math.round(totalCalories)
    },
    ratios: { fat: fatRatio, protein: proteinRatio, carbs: carbRatio },
    targets: { netCarbs: netCarbTarget, protein: proteinTarget, fat: fatTarget, calories: calorieTarget },
    status: {
      carbLimitExceeded,
      carbRemaining,
      isKetoCompliant: !carbLimitExceeded && (fatRatio >= 60 || totalCalories === 0)
    }
  };
}

// ==========================================================================
// CÁLCULO LONGITUDINAL DE CETOSIS Y MODELO CLÍNICO MULTI-DÍA (CAHILL / AJCN)
// ==========================================================================
function formatPredictionTarget(targetDate) {
  if (!targetDate || isNaN(targetDate.getTime())) return 'Calculando...';
  const now = new Date();
  const diffHours = (targetDate.getTime() - now.getTime()) / (3600 * 1000);
  
  const timeStr = targetDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const isToday = targetDate.toDateString() === now.toDateString();
  
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = targetDate.toDateString() === tomorrow.toDateString();
  
  let dayLabel = '';
  if (isToday) {
    dayLabel = 'Hoy';
  } else if (isTomorrow) {
    dayLabel = 'Mañana';
  } else {
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    dayLabel = days[targetDate.getDay()] + ' ' + targetDate.getDate() + ' de ' + months[targetDate.getMonth()];
  }

  const hoursRounded = Math.max(0.2, Math.round(diffHours * 10) / 10);
  return dayLabel + ' a las ' + timeStr + ' hs (en ~' + hoursRounded + 'h)';
}

function calculateKetosisStateClient(meals, garmin, settings) {
  const now = new Date();
  const netCarbTarget = Number(settings?.net_carbs_target || 25);
  const activeCalories = Number(garmin?.active_calories || 0);
  const steps = Number(garmin?.steps || 0);

  // 1. FECHA DE INICIO DEL PROTOCOLO Y DÍA (DÍA 1, 2, 3...)
  const sortedMeals = [...(meals || [])].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  let startDateStr = settings?.keto_start_date;
  if (!startDateStr) {
    if (sortedMeals.length > 0) {
      startDateStr = sortedMeals[0].timestamp;
    } else {
      startDateStr = now.toISOString();
    }
  }

  const startDate = new Date(startDateStr);
  const startDayTime = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
  const todayTime = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diffDays = Math.floor((todayTime - startDayTime) / (24 * 3600 * 1000));
  const currentProtocolDay = Math.max(1, diffDays + 1);
  const totalProtocolHours = Math.max(0.1, (now.getTime() - startDate.getTime()) / (3600 * 1000));

  // 2. CARBOHIDRATOS NETOS EN ÚLTIMAS 24H Y TIEMPO DE AYUNO
  let lastCarbTimestamp = null;
  let totalNetCarbsLast24h = 0;
  const oneDayAgo = now.getTime() - (24 * 60 * 60 * 1000);

  for (const meal of sortedMeals) {
    const mealTime = new Date(meal.timestamp).getTime();
    if (mealTime >= oneDayAgo) {
      totalNetCarbsLast24h += Number(meal.net_carbs || 0);
    }
    if (Number(meal.net_carbs) >= 8) {
      lastCarbTimestamp = new Date(meal.timestamp);
    }
  }

  let hoursSinceCarbs = 18;
  if (lastCarbTimestamp) {
    hoursSinceCarbs = Math.max(0, (now.getTime() - lastCarbTimestamp.getTime()) / (3600 * 1000));
  } else {
    hoursSinceCarbs = Math.min(totalProtocolHours, 72);
  }

  // 3. MODELO DE DEPLECIÓN GLUCOGÉNICA (George Cahill, 2006 & ACSM)
  // Reservorio inicial promedio: 110g de glucógeno hepático.
  // Depleción basal en reposo: ~3.8 g/hora.
  // Gasto por Garmin:
  // 1 paso = 0.0342 kcal -> 40% gasto de glucógeno (RER ~0.80) = ~0.00342 g de glucógeno por paso.
  const garminStepGlycogenBurn = steps * 0.00342; // Ej: 16,370 pasos = 56g quemados
  const garminCalorieBurn = (activeCalories / 100) * 2.5;
  const totalGarminGlycogenBurn = Math.min(85, garminStepGlycogenBurn + garminCalorieBurn);

  const basalGlycogenBurn = Math.min(100, hoursSinceCarbs * 3.8);
  const netCarbsAdded = Math.min(120, totalNetCarbsLast24h);

  // Glucógeno hepático restante (0 a 110g)
  let remainingGlycogen = Math.max(0, Math.min(110, 105 + netCarbsAdded - basalGlycogenBurn - totalGarminGlycogenBurn));

  // Penalización si se sobrepasó la meta de carbohidratos
  const excessCarbs = Math.max(0, totalNetCarbsLast24h - netCarbTarget);
  if (excessCarbs > 0) {
    remainingGlycogen = Math.min(110, remainingGlycogen + (excessCarbs * 1.2));
  }

  // Tasa de quema horaria combinada (Basal 3.8 g/h + Garmin)
  const currentBurnRatePerHour = Math.max(3.8, 3.8 + (steps > 0 ? (steps / 16) * 0.00342 : 0) + ((activeCalories / 16) / 100) * 2.5);

  // 4. ESTADIOS FISIOLÓGICOS Y PREDICCIÓN DE ENTRADA (Cahill 2006 / Phinney 2011)
  let phase = 1;
  let phaseName = 'Día 1: En Proceso (Vaciado de Glucógeno)';
  let phaseDesc = 'Depósitos hepáticos (~100-120g) en vaciado. La insulina desciende para permitir la liberación de grasas.';
  let estimatedKetones = 0.2;
  let statusColor = '#0284c7';
  let isKetosisActive = false;
  let timeToThresholdHours = null;
  let targetKetoDate = null;

  if (excessCarbs >= 25) {
    // Ruptura de cetosis por carbohidratos
    phase = 1;
    phaseName = 'Pausa Metabólica: Exceso de Carbohidratos';
    phaseDesc = 'Consumiste ' + totalNetCarbsLast24h + 'g de carbos netos. La insulina inhibió la lipólisis. Quémalos con pasos para reanudar la cetosis.';
    estimatedKetones = 0.2;
    statusColor = '#ef4444';
    isKetosisActive = false;
    timeToThresholdHours = Math.round((remainingGlycogen / currentBurnRatePerHour) * 10) / 10;
    targetKetoDate = new Date(now.getTime() + (timeToThresholdHours * 3600 * 1000));
  } else if (currentProtocolDay === 1) {
    // FASE 1: DÍA 1 - EN PROCESO (Sin cetosis aún, George Cahill 2006)
    // El cuerpo humano consume glucógeno hepático (100-120g) y la insulina desciende gradualmente
    phase = 1;
    phaseName = 'Día 1: En Proceso (Vaciado de Glucógeno)';
    phaseDesc = 'Depósitos hepáticos (~100-120g) en vaciado. La insulina desciende gradualmente para permitir la lipólisis celular.';
    estimatedKetones = Math.round((0.15 + (Math.min(24, totalProtocolHours) / 24) * 0.15) * 10) / 10;
    statusColor = '#0284c7';
    isKetosisActive = false;
    const gramsToDrop = Math.max(5, remainingGlycogen - 10);
    timeToThresholdHours = Math.round((gramsToDrop / currentBurnRatePerHour) * 10) / 10;
    targetKetoDate = new Date(now.getTime() + (timeToThresholdHours * 3600 * 1000));
  } else if (currentProtocolDay === 2 && totalGarminGlycogenBurn < 45 && steps < 12000) {
    // FASE 2: DÍA 2 - CETOSIS INICIAL (Inducción hepática estándar)
    // Glucógeno casi agotado, CPT-1 activada, beta-oxidación acelerándose hacia el umbral de 0.5 mmol/L
    phase = 2;
    phaseName = 'Día 2: Cetosis Inicial (Inducción Hepática)';
    phaseDesc = 'Glucógeno hepático residual < 30g. El hígado activa la enzima CPT-1 e inicia la síntesis acelerada de cuerpos cetónicos.';
    estimatedKetones = Math.round((0.32 + Math.min(0.15, (totalProtocolHours - 24) * 0.008)) * 10) / 10;
    estimatedKetones = Math.min(0.48, estimatedKetones); // Sub-umbral clínico (< 0.5)
    statusColor = '#f59e0b';
    isKetosisActive = false;
    const gramsToDrop = Math.max(2, remainingGlycogen);
    timeToThresholdHours = Math.round((gramsToDrop / currentBurnRatePerHour) * 10) / 10;
    targetKetoDate = new Date(now.getTime() + (timeToThresholdHours * 3600 * 1000));
  } else if (currentProtocolDay < 5) {
    // FASE 3: DÍAS 3 A 4 (o Día 2 acelerado con Garmin) - CETOSIS INTERMEDIA (Umbral 0.5+ mmol/L Superado)
    phase = 3;
    const isAccelerated = currentProtocolDay === 2;
    phaseName = isAccelerated 
      ? 'Día 2: Cetosis Intermedia (Acelerada por Garmin)' 
      : 'Día ' + currentProtocolDay + ': Cetosis Intermedia (Umbral Clínico)';
    phaseDesc = '¡Umbral clínico de 0.5 mmol/L superado! Glucógeno agotado. Tu cerebro y músculos queman cetonas de alta pureza (Phinney & Volek).';
    estimatedKetones = Math.round((0.65 + Math.min(0.7, (totalProtocolHours - 36) * 0.02) + (garminStepGlycogenBurn > 30 ? 0.2 : 0)) * 10) / 10;
    estimatedKetones = Math.max(0.5, Math.min(1.4, estimatedKetones));
    statusColor = '#10b981';
    isKetosisActive = true;
    timeToThresholdHours = 0;
  } else {
    // FASE 4: DÍA 5+ - CETOSIS AVANZADA / CETO-ADAPTADA (Phinney & Volek, AJCN)
    phase = 4;
    phaseName = 'Día ' + currentProtocolDay + ': Cetosis Avanzada (Ceto-Adaptado)';
    phaseDesc = '¡Ceto-adaptación lograda! Biogénesis mitocondrial muscular y transporte de MCT1 al cerebro en niveles óptimos sin fatiga.';
    estimatedKetones = Math.round((1.5 + Math.min(1.3, (currentProtocolDay - 5) * 0.15)) * 10) / 10;
    estimatedKetones = Math.min(3.0, estimatedKetones);
    statusColor = '#10b981';
    isKetosisActive = true;
    timeToThresholdHours = 0;
  }

  // Horas ahorradas gracias al Garmin
  const hoursSavedByGarmin = Math.round((totalGarminGlycogenBurn / 3.8) * 10) / 10;

  return {
    protocolDay: currentProtocolDay,
    protocolStartDate: startDateStr,
    totalProtocolHours: Math.round(totalProtocolHours * 10) / 10,
    phase,
    phaseName,
    phaseDesc,
    estimatedKetones,
    isKetosisActive,
    glycogenRemainingGrams: Math.round(remainingGlycogen * 10) / 10,
    glycogenPercentage: Math.round((remainingGlycogen / 110) * 100),
    hoursFastingOrKeto: Math.round(hoursSinceCarbs * 10) / 10,
    timeToThresholdHours,
    targetKetoDate,
    targetKetoDateFormatted: targetKetoDate ? formatPredictionTarget(targetKetoDate) : null,
    statusColor,
    garminImpact: {
      steps,
      activeCalories,
      extraGlycogenBurnGrams: Math.round(totalGarminGlycogenBurn * 10) / 10,
      hoursSaved: hoursSavedByGarmin
    }
  };
}

function recalculateClientState() {
  checkAndPerformDailyRollover();

  const savedSettings = JSON.parse(localStorage.getItem('ketotrack_settings') || '{}');
  const savedGarmin = JSON.parse(localStorage.getItem('ketotrack_garmin') || '{}');
  const savedMeals = JSON.parse(localStorage.getItem('ketotrack_meals') || '[]');

  state.settings = { ...state.settings, ...savedSettings };
  state.meals = savedMeals;
  
  const todayKey = getLocalDateKey(new Date());

  // Validar fecha de Garmin: si los datos guardados son de ayer o previos, reiniciar métricas de hoy
  let garmin = state.status?.garmin || savedGarmin;
  if (!garmin.date || garmin.date !== todayKey) {
    const now = new Date();
    const elapsedHours = Math.max(0.1, now.getHours() + (now.getMinutes() / 60));
    const dailyBmr = 2192;
    const restingSoFar = Math.round((dailyBmr / 24) * elapsedHours);
    garmin = {
      date: todayKey,
      active_calories: 0,
      step_calories: 0,
      exercise_calories: 0,
      exercises: [],
      steps: 0,
      resting_hr: garmin.resting_hr || 60,
      bmr_calories: restingSoFar,
      daily_bmr: dailyBmr,
      total_calories: restingSoFar,
      source: garmin.source || 'Health Connect (Garmin)',
      timestamp: now.toISOString()
    };
    localStorage.setItem('ketotrack_garmin', JSON.stringify(garmin));
  }

  const macros = calculateDailyMacrosClient(state.meals, state.settings, todayKey);
  const ketosis = calculateKetosisStateClient(state.meals, garmin, state.settings);

  state.status = {
    macros,
    ketosis,
    garmin
  };

  renderDashboard(state.status);
  renderGarminView(garmin);
}

// Expuesto globalmente para que health-connect.js lo invoque directamente
window.applyGarminMetrics = function(arg1, arg2, arg3, arg4, arg5) {
  let steps = 0, activeCalories = 0, restingHr = 60, source = 'Health Connect (Garmin)';
  let exercisesFromSync = null;
  let explicitBmr = null;
  let explicitTotal = null;
  let isCloudOfficial = false;

  if (typeof arg1 === 'object' && arg1 !== null) {
    steps = arg1.steps || 0;
    activeCalories = arg1.activeCalories || arg1.active_calories || 0;
    restingHr = arg1.heartRate || arg1.resting_hr || 60;
    source = arg1.source || 'Health Connect (Garmin)';
    exercisesFromSync = arg1.exercises || null;
    explicitBmr = arg1.bmrCalories || arg1.bmr_calories || null;
    explicitTotal = arg1.totalCalories || arg1.total_calories || null;
    isCloudOfficial = arg1.isOfficial === true;
  } else {
    steps = arg1 || 0;
    activeCalories = arg2 || 0;
    restingHr = arg3 || 60;
    source = arg4 || 'Health Connect (Garmin)';
    exercisesFromSync = Array.isArray(arg5) ? arg5 : null;
  }

  const now = new Date();
  const todayKey = getLocalDateKey(now);
  const currentGarmin = JSON.parse(localStorage.getItem('ketotrack_garmin') || '{}');
  
  // Mantener los ejercicios cargados previamente hoy
  let todayExercises = (currentGarmin.date === todayKey && Array.isArray(currentGarmin.exercises)) 
    ? [...currentGarmin.exercises] 
    : [];

  // Si la sincronización trajo ejercicios de Health Connect, incorporarlos sin duplicar
  if (Array.isArray(exercisesFromSync)) {
    for (const ex of exercisesFromSync) {
      const exists = todayExercises.some(e => 
        (e.id && e.id === ex.id) || 
        (e.title === ex.title && Math.abs(new Date(e.time || 0) - new Date(ex.time || 0)) < 30 * 60 * 1000)
      );
      if (!exists) todayExercises.push(ex);
    }
  }

  // Suma de calorías de entrenamientos / musculación / gimnasio
  const exerciseCalSum = todayExercises.reduce((sum, e) => sum + (Number(e.calories) || 0), 0);
  
  // Calorías estimadas por pasos (~0.03184 kcal/paso)
  const stepCalEstimated = Math.round((Number(steps) || 0) * 0.03184);

  // Las calorías activas totales deben contemplar AMBOS: pasos + musculación/gimnasio
  let totalActive = Math.max(Number(activeCalories) || 0, stepCalEstimated + exerciseCalSum);
  if (totalActive === 0 && (Number(steps) > 0 || exerciseCalSum > 0)) {
    totalActive = stepCalEstimated + exerciseCalSum;
  }

  const elapsedHours = Math.max(0.1, now.getHours() + (now.getMinutes() / 60));
  const dailyBmr = Number(state.settings?.garmin_daily_bmr) || 1865; // Calibrado según Garmin Instinct (~1.865 kcal/día)
  const isOfficial = isCloudOfficial || (currentGarmin.date === todayKey && currentGarmin.is_official === true);

  // Si el usuario o Garmin Cloud ya fijaron valores oficiales, respetarlos con prioridad
  if (isOfficial && Number(activeCalories) > 0) {
    totalActive = Number(activeCalories);
  } else if (isOfficial && Number(currentGarmin.active_calories) > 0) {
    totalActive = Math.max(totalActive, Number(currentGarmin.active_calories));
  }

  const restingSoFar = (explicitBmr && Number(explicitBmr) > 0)
    ? Number(explicitBmr)
    : ((isOfficial && Number(currentGarmin.bmr_calories) > 0)
      ? Number(currentGarmin.bmr_calories)
      : Math.round((dailyBmr / 24) * elapsedHours));

  const totalCaloriesSoFar = (explicitTotal && Number(explicitTotal) > 0)
    ? Number(explicitTotal)
    : ((isOfficial && Number(currentGarmin.total_calories) > 0)
      ? Number(currentGarmin.total_calories)
      : (restingSoFar + totalActive));

  const garmin = {
    date: todayKey,
    active_calories: totalActive,
    step_calories: stepCalEstimated,
    exercise_calories: exerciseCalSum,
    exercises: todayExercises,
    steps: Number(steps) || 0,
    resting_hr: Number(restingHr) || 60,
    bmr_calories: restingSoFar,
    daily_bmr: dailyBmr,
    total_calories: totalCaloriesSoFar,
    is_official: isOfficial,
    source: isCloudOfficial ? 'Garmin Connect Oficial (Nube)' : (isOfficial ? 'Garmin Connect Web Oficial' : source),
    timestamp: now.toISOString()
  };

  if (!state.status) state.status = {};
  state.status.garmin = garmin;
  localStorage.setItem('ketotrack_garmin', JSON.stringify(garmin));
  recalculateClientState();

  // Actualizar indicador superior
  const syncTimeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const headerPill = document.getElementById('txtHeaderSync');
  if (headerPill) headerPill.textContent = 'Garmin Sincronizado (' + syncTimeStr + ')';

  const lastSyncGarmin = document.getElementById('garminLastSyncTime');
  if (lastSyncGarmin) lastSyncGarmin.textContent = 'Sincronizado hoy a las ' + syncTimeStr;
};

// Registrar ejercicio/musculación manualmente desde el reloj Garmin
window.addGarminExercise = function(exercise) {
  const now = new Date();
  const todayKey = getLocalDateKey(now);
  let garmin = JSON.parse(localStorage.getItem('ketotrack_garmin') || '{}');
  
  if (garmin.date !== todayKey) {
    garmin.date = todayKey;
    garmin.steps = 0;
    garmin.step_calories = 0;
    garmin.exercises = [];
  }
  if (!Array.isArray(garmin.exercises)) garmin.exercises = [];

  const calories = Math.round(Number(exercise.calories) || 0);
  if (calories <= 0) {
    alert('Por favor ingresa una cantidad válida de calorías.');
    return;
  }

  const newExercise = {
    id: 'ex_' + Date.now(),
    title: exercise.title || 'Musculación / Gimnasio',
    calories: calories,
    duration: Number(exercise.duration) || 0,
    time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    timestamp: now.toISOString(),
    source: 'Reloj Garmin (Manual)'
  };

  garmin.exercises.unshift(newExercise);
  window.applyGarminMetrics(garmin);
  syncTodayToDailyHistory();
  renderChartsView();
  alert('¡Entrenamiento registrado!\nSe sumaron ' + calories + ' kcal activas de tu reloj a tu gasto total de hoy.');
};

window.deleteGarminExercise = function(id) {
  if (!confirm('¿Deseas eliminar este entrenamiento registrado?')) return;
  const garmin = JSON.parse(localStorage.getItem('ketotrack_garmin') || '{}');
  if (Array.isArray(garmin.exercises)) {
    garmin.exercises = garmin.exercises.filter(e => String(e.id) !== String(id));
    window.applyGarminMetrics(garmin);
    syncTodayToDailyHistory();
    renderChartsView();
  }
};


// ==========================================================================
// CÁLCULO DE PASOS PARA MANTENER LA CETOSIS EN CASO DE EXCESO DE CARBOHIDRATOS (ACSM)
// ==========================================================================
function calculateStepsForKetosis(totalNetCarbs, garminSteps, netCarbTarget) {
  const stepsDone = Number(garminSteps || 0);
  const netCarbs = Number(totalNetCarbs || 0);
  const carbLimit = Number(netCarbTarget || 25);

  // Exceso de carbohidratos consumidos sobre el límite keto
  const excessCarbs = Math.max(0, Math.round((netCarbs - carbLimit) * 10) / 10);

  // Si NO hay exceso: 0 pasos necesarios para compensar
  if (excessCarbs === 0) {
    return {
      stepsDone,
      totalTargetSteps: 0,
      stepsRemaining: 0,
      percent: 100,
      excessCarbs: 0,
      status: 'no_excess',
      badgeText: '🥑 Cetosis Protegida',
      badgeColor: '#10b981',
      title: '✨ Carbohidratos Bajo Control (0 pasos necesarios)',
      desc: 'Has consumido ' + netCarbs + 'g de tu límite diario de ' + carbLimit + 'g. No tienes exceso de carbohidratos, por lo que no requieres pasos compensatorios para mantener la cetosis.' + 
            (stepsDone > 0 ? ' Llevas ' + stepsDone.toLocaleString() + ' pasos caminados hoy con tu Garmin.' : '')
    };
  }

  // Si HAY exceso de carbohidratos:
  // 1g carbohidrato = 4 kcal de glucógeno.
  // En marcha aeróbica (ACSM), 40% del gasto proviene de glucógeno.
  // Gasto por paso en Garmin Instinct = 0.0342 kcal/paso.
  // Pasos necesarios = 4 / (0.0342 * 0.40) ≈ 292 pasos por gramo excedente.
  const compensatoryStepsNeeded = Math.round(excessCarbs * 292);
  const stepsRemaining = Math.max(0, compensatoryStepsNeeded - stepsDone);
  const percent = Math.min(100, Math.round((stepsDone / compensatoryStepsNeeded) * 100));

  if (stepsDone >= compensatoryStepsNeeded) {
    return {
      stepsDone,
      totalTargetSteps: compensatoryStepsNeeded,
      stepsRemaining: 0,
      percent: 100,
      excessCarbs,
      status: 'neutralized',
      badgeText: '🔥 Exceso Neutralizado ✓',
      badgeColor: '#10b981',
      title: '✅ Exceso de Carbohidratos Neutralizado',
      desc: 'Tus ' + stepsDone.toLocaleString() + ' pasos de hoy con tu Garmin ya quemaron por completo los ' + excessCarbs + 'g de carbohidratos excedentes. ¡Tu cetosis sigue protegida!'
    };
  }

  // Falta compensar
  const minWalk = Math.round(stepsRemaining / 100);
  return {
    stepsDone,
    totalTargetSteps: compensatoryStepsNeeded,
    stepsRemaining,
    percent,
    excessCarbs,
    status: 'compensation_needed',
    badgeText: '⚠️ ' + stepsRemaining.toLocaleString() + ' pasos pendientes',
    badgeColor: '#ef4444',
    title: '⚠️ Pasos Necesarios: +' + excessCarbs + 'g de Exceso',
    desc: 'Te excediste en ' + excessCarbs + 'g de carbohidratos (' + netCarbs + 'g consumidos / ' + carbLimit + 'g límite). Necesitas caminar ' + stepsRemaining.toLocaleString() + ' pasos (~' + minWalk + ' min de caminata) para quemar esa glucosa y evitar salir de cetosis.'
  };
}

// ==========================================================================
// 4. RENDER DASHBOARD (CON FUEGO O CUENTA REGRESIVA)
// ==========================================================================
function renderDashboard(data) {
  const { ketosis, macros, garmin } = data;

  const cardKetosis = document.getElementById('cardKetosisStatus');
  const flameBox = document.getElementById('ketosisFlameBox');
  const countdownBox = document.getElementById('ketosisCountdownBox');

  // 1. BADGE DE FASE Y PROTOCOLO
  const badgePhase = document.getElementById('badgePhase');
  if (badgePhase) {
    badgePhase.textContent = 'Día ' + ketosis.protocolDay + (ketosis.phase >= 3 ? ' • En Cetosis 🔥' : ' • En Proceso');
    badgePhase.style.backgroundColor = ketosis.statusColor;
  }

  const elKetones = document.getElementById('valEstimatedKetones');
  if (elKetones) elKetones.textContent = ketosis.estimatedKetones.toFixed(1);

  const elPhaseTitle = document.getElementById('txtPhaseTitle');
  if (elPhaseTitle) {
    elPhaseTitle.textContent = ketosis.phase >= 3 
      ? '¡Cetosis Nutricional Activa!' 
      : (ketosis.phase === 2 ? 'Cetosis Inicial (Inducción)' : 'En Proceso de Inducción');
  }

  const elPhaseDesc = document.getElementById('txtPhaseDesc');
  if (elPhaseDesc) {
    elPhaseDesc.textContent = ketosis.phase >= 3
      ? 'Tu cuerpo y cerebro queman cetonas de alta pureza a pleno rendimiento.'
      : 'Vaciando depósitos para cruzar al umbral de quema de grasa.';
  }

  // Velocímetro metabólico circular
  const gaugePercent = Math.min(100, Math.max(10, (ketosis.estimatedKetones / 2.5) * 100));
  const gaugeDeg = Math.round((gaugePercent / 100) * 360);
  const gaugeCircle = document.getElementById('gaugeCircle');
  if (gaugeCircle) {
    gaugeCircle.style.background = 'conic-gradient(' + ketosis.statusColor + ' 0deg ' + gaugeDeg + 'deg, var(--card-border) ' + gaugeDeg + 'deg 360deg)';
    gaugeCircle.style.boxShadow = '0 0 16px ' + ketosis.statusColor + '44';
  }

  // Lógica de Fuego vs Pronóstico
  const forecastBox = document.getElementById('boxKetoForecast');

  if (ketosis.isKetosisActive) {
    if (flameBox) flameBox.style.display = 'flex';
    if (forecastBox) forecastBox.style.display = 'none';
    if (cardKetosis) {
      cardKetosis.style.border = '1px solid rgba(245, 158, 11, 0.6)';
      cardKetosis.style.boxShadow = '0 0 20px rgba(245, 158, 11, 0.15)';
    }
  } else {
    if (flameBox) flameBox.style.display = 'none';
    if (forecastBox) forecastBox.style.display = 'block';
    if (cardKetosis) {
      cardKetosis.style.border = '1px solid ' + (ketosis.phase === 1 ? 'rgba(2, 132, 199, 0.35)' : 'rgba(245, 158, 11, 0.35)');
      cardKetosis.style.boxShadow = 'none';
    }

    const valTargetDate = document.getElementById('valKetoTargetDate');
    if (valTargetDate) {
      valTargetDate.textContent = ketosis.targetKetoDateFormatted || 'Calculando pronóstico...';
    }
  }

  // 2. BALANCE CALÓRICO HERO Y PROGRESO DEL PLAN (CON GASTO GARMIN)
  const caloriesIn = Math.round(macros.totals.calories || 0);
  const baseTargetCalories = Math.round(macros.targets.calories || 1800);
  const activeCalories = Number(garmin.active_calories || 0);
  const totalBurn = Math.round(garmin.total_calories || ((garmin.bmr_calories || 0) + activeCalories) || 0);
  const caloriesOut = totalBurn;

  // Al agregarle el gasto activo de Garmin a la meta del plan, la meta aumenta (modelo MyFitnessPal / ACSM)
  const adjustedTargetCalories = baseTargetCalories + activeCalories;
  const calRemaining = adjustedTargetCalories - caloriesIn;
  const isOverLimit = caloriesIn > adjustedTargetCalories;
  const calPercent = adjustedTargetCalories > 0 ? Math.round((caloriesIn / adjustedTargetCalories) * 100) : 0;

  // Déficit real frente al gasto total del reloj:
  const netDeficitToday = totalBurn - caloriesIn;
  const isRealDeficit = netDeficitToday >= 0;
  const fatLossTodayGrams = Math.round(Math.abs(netDeficitToday) / 7.7);

  const elCalIn = document.getElementById('valCalIn');
  if (elCalIn) elCalIn.innerHTML = caloriesIn.toLocaleString() + ' <small>kcal</small>';

  const elCalTarget = document.getElementById('valCalTarget');
  const lblCalTarget = document.getElementById('lblCalTarget');
  if (elCalTarget) {
    elCalTarget.innerHTML = adjustedTargetCalories.toLocaleString() + ' <small>kcal</small>';
    if (lblCalTarget) {
      lblCalTarget.textContent = activeCalories > 0 ? `Meta (+${activeCalories.toLocaleString()} Garmin)` : 'Meta Diaria';
    }
  }

  const elCalRemaining = document.getElementById('valCalRemaining');
  const lblCalNet = document.getElementById('lblCalNet');
  const cardCalNet = document.getElementById('cardCalNet');
  if (elCalRemaining) {
    if (isOverLimit) {
      elCalRemaining.textContent = '+' + Math.abs(calRemaining).toLocaleString() + ' kcal';
      if (lblCalNet) lblCalNet.textContent = 'Exceso';
      if (cardCalNet) cardCalNet.classList.add('over-limit');
    } else {
      elCalRemaining.textContent = calRemaining.toLocaleString() + ' kcal';
      if (lblCalNet) lblCalNet.textContent = 'Restantes';
      if (cardCalNet) cardCalNet.classList.remove('over-limit');
    }
  }

  // Barra de progreso del plan ajustado con el gasto de Garmin
  const elThermoPercent = document.getElementById('valThermometerPercent');
  if (elThermoPercent) {
    if (isOverLimit) {
      elThermoPercent.textContent = '⚠️ ¡' + calPercent + '%! (Exceso +' + Math.abs(calRemaining) + ' kcal)';
      elThermoPercent.style.color = '#ef4444';
    } else {
      elThermoPercent.textContent = calPercent + '% (' + calRemaining.toLocaleString() + ' kcal rest.)';
      elThermoPercent.style.color = calPercent >= 80 ? '#f59e0b' : '#38bdf8';
    }
  }

  const elThermoFill = document.getElementById('barThermometerFill');
  if (elThermoFill) {
    elThermoFill.style.width = Math.min(100, Math.max(3, calPercent)) + '%';
    elThermoFill.className = 'thermometer-minimal-fill ' + (isOverLimit ? 'danger' : (calPercent >= 80 ? 'warning' : 'optimal'));
  }

  const lblGarmin = document.getElementById('lblGarminBurned');
  if (lblGarmin) {
    const actNote = activeCalories > 0 ? ` (${activeCalories.toLocaleString()} activas)` : '';
    if (isRealDeficit) {
      lblGarmin.textContent = `⌚ Garmin: ${totalBurn.toLocaleString()} kcal${actNote} • Déficit real: +${netDeficitToday.toLocaleString()} kcal (≈ -${fatLossTodayGrams}g grasa)`;
      lblGarmin.style.color = 'var(--text-muted)';
    } else {
      lblGarmin.textContent = `⌚ Garmin: ${totalBurn.toLocaleString()} kcal${actNote} • Superávit: ${netDeficitToday.toLocaleString()} kcal (≈ +${fatLossTodayGrams}g grasa)`;
      lblGarmin.style.color = '#f87171';
    }
  }

  const badgeCalFeedback = document.getElementById('badgeCalFeedback');
  if (badgeCalFeedback) {
    if (isOverLimit) {
      badgeCalFeedback.textContent = '🚨 Exceso Plan';
      badgeCalFeedback.className = 'feedback-badge badge-danger';
    } else if (isRealDeficit) {
      badgeCalFeedback.textContent = '✅ En Déficit Óptimo';
      badgeCalFeedback.className = 'feedback-badge badge-optimal';
    } else {
      badgeCalFeedback.textContent = '⚡ Equilibrio Calórico';
      badgeCalFeedback.className = 'feedback-badge badge-warning';
    }
  }

  // Subtítulo de macros
  const sWeight = Number(state.settings?.weight || 80);
  const sGoal = Number(state.settings?.goal_weight || 75);
  const sWeightToLose = Math.max(0, Math.round((sWeight - sGoal) * 10) / 10);
  
  const badgeDeficit = document.getElementById('badgeCalorieDeficit');
  if (badgeDeficit) {
    if (isOverLimit) {
      badgeDeficit.textContent = '⚠️ Excedido';
      badgeDeficit.style.color = '#ef4444';
    } else if (sWeightToLose > 0) {
      badgeDeficit.textContent = 'Meta: -' + sWeightToLose + ' kg';
      badgeDeficit.style.color = '#a855f7';
    } else {
      badgeDeficit.textContent = 'Mantenimiento';
      badgeDeficit.style.color = 'var(--accent-green)';
    }
  }

  const txtMacroPers = document.getElementById('txtMacroPersonalized');
  if (txtMacroPers) {
    txtMacroPers.textContent = sWeightToLose > 0 
      ? 'Objetivo: Perder ' + sWeightToLose + ' kg (' + sWeight + ' kg -> ' + sGoal + ' kg)'
      : 'Peso actual: ' + sWeight + ' kg';
  }

  // 3. WIDGET DE PASOS (EN PESTAÑA GARMIN)
  const stepData = calculateStepsForKetosis(macros.totals.netCarbs, garmin.steps, macros.targets.netCarbs);
  
  const elCurrentSteps = document.getElementById('valCurrentStepsKeto');
  const elTargetSteps = document.getElementById('valTargetStepsKeto');
  const elUnit = document.getElementById('stepUnitText');

  if (stepData.excessCarbs === 0) {
    if (elCurrentSteps) elCurrentSteps.textContent = '0';
    if (elTargetSteps) elTargetSteps.textContent = '0';
    if (elUnit) elUnit.textContent = 'pasos requeridos';
  } else {
    if (elCurrentSteps) elCurrentSteps.textContent = stepData.stepsDone.toLocaleString();
    if (elTargetSteps) elTargetSteps.textContent = stepData.totalTargetSteps.toLocaleString();
    if (elUnit) elUnit.textContent = 'pasos requeridos';
  }

  const elStepPct = document.getElementById('valStepPercent');
  if (elStepPct) {
    elStepPct.textContent = stepData.excessCarbs === 0 ? 'En Meta' : (stepData.percent + '%');
    elStepPct.style.color = stepData.badgeColor;
  }

  const elBarStep = document.getElementById('barStepProgress');
  if (elBarStep) {
    elBarStep.style.width = (stepData.excessCarbs === 0 ? 100 : stepData.percent) + '%';
    elBarStep.style.background = stepData.status === 'compensation_needed'
      ? 'linear-gradient(90deg, #f59e0b, #ef4444)'
      : 'linear-gradient(90deg, #10b981, #059669)';
  }

  const badgeStep = document.getElementById('badgeStepStatus');
  if (badgeStep) {
    badgeStep.textContent = stepData.badgeText;
    badgeStep.style.backgroundColor = stepData.badgeColor;
  }

  const txtStepTitle = document.getElementById('txtStepFeedbackTitle');
  if (txtStepTitle) {
    txtStepTitle.textContent = stepData.title;
    txtStepTitle.style.color = stepData.badgeColor;
  }

  const txtStepDesc = document.getElementById('txtStepFeedbackDesc');
  if (txtStepDesc) txtStepDesc.textContent = stepData.desc;


    // 8. BARRAS DE MACRONUTRIENTES
  const elValNetCarbs = document.getElementById('valNetCarbs');
  if (elValNetCarbs) elValNetCarbs.textContent = macros.totals.netCarbs;
  const elTargetCarbs = document.getElementById('targetNetCarbs');
  if (elTargetCarbs) elTargetCarbs.textContent = macros.targets.netCarbs;
  const carbPct = Math.min(100, (macros.totals.netCarbs / (macros.targets.netCarbs || 1)) * 100);
  const barNetCarbs = document.getElementById('barNetCarbs');
  if (barNetCarbs) barNetCarbs.style.width = carbPct + '%';
  
  const badgeCarb = document.getElementById('badgeCarbStatus');
  if (badgeCarb) {
    if (macros.status.carbLimitExceeded) {
      badgeCarb.textContent = '¡Límite Superado!';
      badgeCarb.style.color = 'var(--accent-red)';
      if (barNetCarbs) barNetCarbs.style.background = 'var(--accent-red)';
    } else {
      badgeCarb.textContent = macros.status.carbRemaining + 'g restantes';
      badgeCarb.style.color = 'var(--accent-green)';
      if (barNetCarbs) barNetCarbs.style.background = 'var(--accent-amber)';
    }
  }

  const elValFat = document.getElementById('valFat');
  if (elValFat) elValFat.textContent = macros.totals.fat;
  const elTargetFat = document.getElementById('targetFat');
  if (elTargetFat) elTargetFat.textContent = macros.targets.fat;
  const barFat = document.getElementById('barFat');
  if (barFat) barFat.style.width = Math.min(100, (macros.totals.fat / (macros.targets.fat || 1)) * 100) + '%';

  const elValProtein = document.getElementById('valProtein');
  if (elValProtein) elValProtein.textContent = macros.totals.protein;
  const elTargetProtein = document.getElementById('targetProtein');
  if (elTargetProtein) elTargetProtein.textContent = macros.targets.protein;
  const barProtein = document.getElementById('barProtein');
  if (barProtein) barProtein.style.width = Math.min(100, (macros.totals.protein / (macros.targets.protein || 1)) * 100) + '%';

  // Ratios calóricos
  const elRatioFat = document.getElementById('ratioFat');
  if (elRatioFat) elRatioFat.textContent = macros.ratios.fat + '%';
  const elRatioProtein = document.getElementById('ratioProtein');
  if (elRatioProtein) elRatioProtein.textContent = macros.ratios.protein + '%';
  const elRatioCarbs = document.getElementById('ratioCarbs');
  if (elRatioCarbs) elRatioCarbs.textContent = macros.ratios.carbs + '%';

  // 9. DÉFICIT REAL DIARIO Y ACUMULACIÓN HISTÓRICA CON PÉRDIDA DE PESO
  renderDeficitAccumulation(caloriesIn, caloriesOut, garmin);
}

// ==========================================================================
// 4.1 MOTOR DE DÉFICIT ACUMULADO Y CORRELACIÓN BIOFISIOLÓGICA DE PESO
// ==========================================================================
function renderDeficitAccumulation(caloriesIn, caloriesOut, garmin) {
  const tabTracking = document.getElementById('tab-tracking');
  if (!tabTracking) return;

  const now = new Date();
  const todayKey = getLocalDateKey(now);

  const netDeficitToday = caloriesOut - caloriesIn;
  const fatLossTodayGrams = Math.round(netDeficitToday / 7.7);

  // 1. Historial de días y consolidación de acumulación
  let rawHistory = [];
  try {
    rawHistory = JSON.parse(localStorage.getItem('ketotrack_daily_history') || '[]');
  } catch (e) {
    rawHistory = [];
  }

  // Descartar entradas que no sean pasadas estrictas
  const pastDays = (rawHistory || []).filter(h => h && h.date && h.date < todayKey);

  // Registro de HOY en tiempo real
  const todayEntry = {
    date: todayKey,
    day_label: 'Hoy (' + ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][now.getDay()] + ' ' + String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth() + 1).padStart(2, '0') + ')',
    calories_in: caloriesIn,
    calories_out: caloriesOut
  };

  const allDays = [...pastDays, todayEntry];
  allDays.sort((a, b) => a.date.localeCompare(b.date));

  // Determinar inicio del protocolo
  const sDateStr = state.settings?.keto_start_date;
  let protocolStartKey = '';
  if (sDateStr) {
    const d = new Date(sDateStr);
    if (!isNaN(d.getTime())) protocolStartKey = getLocalDateKey(d);
  }
  if (!protocolStartKey && allDays.length > 0) {
    protocolStartKey = allDays[0].date;
  }

  const protocolDays = protocolStartKey ? allDays.filter(d => d.date >= protocolStartKey) : allDays;
  const protocolCount = Math.max(1, protocolDays.length);

  const elBadgeAccumDays = document.getElementById('badgeProtocolAccumDays');
  if (elBadgeAccumDays) {
    elBadgeAccumDays.textContent = 'Día ' + protocolCount + ' Protocolo';
  }

  // 2. Grid de 3 periodos: Hoy, 7 Días, 30 Días
  // A. HOY
  const elPeriodDeficitToday = document.getElementById('valPeriodDeficitToday');
  const elPeriodLossToday = document.getElementById('valPeriodLossToday');
  const elBadgePeriodToday = document.getElementById('badgePeriodTodayStatus');

  if (elPeriodDeficitToday) {
    elPeriodDeficitToday.innerHTML = (netDeficitToday >= 0 ? '+' : '') + netDeficitToday.toLocaleString() + ' <small>kcal</small>';
    elPeriodDeficitToday.style.color = netDeficitToday >= 0 ? '#34d399' : '#f87171';
  }
  if (elPeriodLossToday) {
    elPeriodLossToday.textContent = (netDeficitToday >= 0 ? '-' : '+') + Math.abs(fatLossTodayGrams) + ' g';
    elPeriodLossToday.style.color = netDeficitToday >= 0 ? '#34d399' : '#f87171';
  }
  if (elBadgePeriodToday) {
    elBadgePeriodToday.textContent = netDeficitToday >= 0 ? 'En Déficit' : 'Superávit';
    elBadgePeriodToday.style.color = netDeficitToday >= 0 ? '#34d399' : '#f87171';
  }

  // B. 7 DÍAS (SEMANA)
  const d7Ago = new Date(now);
  d7Ago.setDate(now.getDate() - 6);
  const d7AgoKey = getLocalDateKey(d7Ago);
  const weekDays = allDays.filter(d => d.date >= d7AgoKey);
  const deficitWeek = weekDays.reduce((sum, d) => sum + (Number(d.calories_out || 0) - Number(d.calories_in || 0)), 0);
  const lossWeekKg = Math.round((deficitWeek / 7700) * 100) / 100;
  const daysInWeek = Math.max(1, weekDays.length);
  const projectedWeeklyLossKg = Math.round(((deficitWeek / daysInWeek) * 7 / 7700) * 10) / 10;

  const elPeriodDeficitWeek = document.getElementById('valPeriodDeficitWeek');
  const elPeriodLossWeek = document.getElementById('valPeriodLossWeek');
  const elBadgeWeeklyPace = document.getElementById('badgeWeeklyPaceRate');

  if (elPeriodDeficitWeek) {
    elPeriodDeficitWeek.innerHTML = (deficitWeek >= 0 ? '+' : '') + deficitWeek.toLocaleString() + ' <small>kcal</small>';
    elPeriodDeficitWeek.style.color = deficitWeek >= 0 ? '#38bdf8' : '#f87171';
  }
  if (elPeriodLossWeek) {
    elPeriodLossWeek.textContent = (lossWeekKg >= 0 ? '-' : '+') + Math.abs(lossWeekKg).toFixed(2) + ' kg';
    elPeriodLossWeek.style.color = lossWeekKg >= 0 ? '#38bdf8' : '#f87171';
  }
  if (elBadgeWeeklyPace) {
    elBadgeWeeklyPace.textContent = (projectedWeeklyLossKg >= 0 ? '-' : '+') + Math.abs(projectedWeeklyLossKg).toFixed(1) + ' kg/sem';
  }

  // C. 30 DÍAS (MES)
  const d30Ago = new Date(now);
  d30Ago.setDate(now.getDate() - 29);
  const d30AgoKey = getLocalDateKey(d30Ago);
  const monthDays = allDays.filter(d => d.date >= d30AgoKey);
  const deficitMonth = monthDays.reduce((sum, d) => sum + (Number(d.calories_out || 0) - Number(d.calories_in || 0)), 0);
  const lossMonthKg = Math.round((deficitMonth / 7700) * 100) / 100;

  const elPeriodDeficitMonth = document.getElementById('valPeriodDeficitMonth');
  const elPeriodLossMonth = document.getElementById('valPeriodLossMonth');

  if (elPeriodDeficitMonth) {
    elPeriodDeficitMonth.innerHTML = (deficitMonth >= 0 ? '+' : '') + deficitMonth.toLocaleString() + ' <small>kcal</small>';
    elPeriodDeficitMonth.style.color = deficitMonth >= 0 ? '#c084fc' : '#f87171';
  }
  if (elPeriodLossMonth) {
    elPeriodLossMonth.textContent = (lossMonthKg >= 0 ? '-' : '+') + Math.abs(lossMonthKg).toFixed(2) + ' kg';
    elPeriodLossMonth.style.color = lossMonthKg >= 0 ? '#c084fc' : '#f87171';
  }

  // 3. Proyección hacia el Objetivo de Peso
  const currentWeight = Number(state.settings?.weight || 80);
  const goalWeight = Number(state.settings?.goal_weight || (currentWeight > 4 ? currentWeight - 4 : currentWeight));
  const weightToLose = Math.max(0, Math.round((currentWeight - goalWeight) * 10) / 10);
  const totalKcalNeeded = Math.round(weightToLose * 7700);

  // Déficit total acumulado en todo el protocolo
  const totalProtocolDeficit = protocolDays.reduce((sum, d) => sum + (Number(d.calories_out || 0) - Number(d.calories_in || 0)), 0);
  const effectiveAccumDeficit = Math.max(0, totalProtocolDeficit);

  const elGoalWeightDiff = document.getElementById('lblGoalWeightDiff');
  const elGoalProgressPercent = document.getElementById('lblGoalProgressPercent');
  const elBarGoalProgress = document.getElementById('barGoalProgressFill');
  const elGoalTotalNeeded = document.getElementById('lblGoalTotalNeeded');
  const elGoalTotalAccum = document.getElementById('lblGoalTotalAccum');
  const elGoalKgRemaining = document.getElementById('lblGoalKgRemaining');
  const elGoalDaysEstimate = document.getElementById('lblGoalDaysEstimate');

  if (elGoalWeightDiff) {
    if (weightToLose > 0) {
      elGoalWeightDiff.textContent = 'Perder ' + weightToLose.toFixed(1) + ' kg (' + currentWeight.toFixed(1) + ' kg → ' + goalWeight.toFixed(1) + ' kg)';
    } else {
      elGoalWeightDiff.textContent = 'Mantenimiento (' + currentWeight.toFixed(1) + ' kg)';
    }
  }

  if (totalKcalNeeded > 0) {
    const progressPct = Math.min(100, Math.max(0, Math.round((effectiveAccumDeficit / totalKcalNeeded) * 100)));
    const remainingKcal = Math.max(0, totalKcalNeeded - effectiveAccumDeficit);
    const remainingKg = Math.max(0, Math.round((remainingKcal / 7700) * 10) / 10);

    if (elGoalProgressPercent) elGoalProgressPercent.textContent = progressPct + '%';
    if (elBarGoalProgress) elBarGoalProgress.style.width = progressPct + '%';
    if (elGoalTotalNeeded) elGoalTotalNeeded.textContent = totalKcalNeeded.toLocaleString() + ' kcal';
    if (elGoalTotalAccum) {
      elGoalTotalAccum.textContent = (totalProtocolDeficit >= 0 ? '+' : '') + totalProtocolDeficit.toLocaleString() + ' kcal';
      elGoalTotalAccum.style.color = totalProtocolDeficit >= 0 ? '#34d399' : '#f87171';
    }
    if (elGoalKgRemaining) elGoalKgRemaining.textContent = remainingKg.toFixed(1) + ' kg rest.';

    // Estimación de días restantes según ritmo reciente
    const avgRecentDailyDeficit = daysInWeek > 0 && (deficitWeek / daysInWeek) > 100 
      ? (deficitWeek / daysInWeek) 
      : (netDeficitToday > 100 ? netDeficitToday : 0);

    if (elGoalDaysEstimate) {
      if (remainingKcal === 0) {
        elGoalDaysEstimate.textContent = '¡Meta lograda!';
      } else if (avgRecentDailyDeficit > 100) {
        const estDays = Math.ceil(remainingKcal / avgRecentDailyDeficit);
        elGoalDaysEstimate.textContent = '~' + estDays + ' días';
      } else {
        elGoalDaysEstimate.textContent = '-- días';
      }
    }
  } else {
    if (elGoalProgressPercent) elGoalProgressPercent.textContent = '100%';
    if (elBarGoalProgress) elBarGoalProgress.style.width = '100%';
    if (elGoalTotalNeeded) elGoalTotalNeeded.textContent = '0 kcal';
    if (elGoalTotalAccum) elGoalTotalAccum.textContent = (totalProtocolDeficit >= 0 ? '+' : '') + totalProtocolDeficit.toLocaleString() + ' kcal';
    if (elGoalKgRemaining) elGoalKgRemaining.textContent = '0.0 kg';
    if (elGoalDaysEstimate) elGoalDaysEstimate.textContent = 'En meta';
  }

  // 4. Renderizar Historial Día a Día (#trackingDaysHistoryList)
  const elHistoryList = document.getElementById('trackingDaysHistoryList');
  if (elHistoryList) {
    const reversedDays = [...allDays].reverse();
    let historyHtml = '';

    for (const d of reversedDays) {
      const cOut = Math.round(Number(d.calories_out || 0));
      const cIn = Math.round(Number(d.calories_in || 0));
      const dDeficit = cOut - cIn;
      const isDayDeficit = dDeficit >= 0;
      const dFatGrams = Math.round(Math.abs(dDeficit) / 7.7);
      const isToday = (d.date === todayKey);

      let label = d.day_label || d.date;
      if (isToday) {
        label = 'Hoy (' + ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][now.getDay()] + ' ' + String(now.getDate()).padStart(2, '0') + '/' + String(now.getMonth() + 1).padStart(2, '0') + ')';
      }

      historyHtml += `
        <div class="tracking-history-row" style="${isToday ? 'border-left: 3px solid #10b981;' : ''}">
          <div class="tracking-day-info">
            <strong class="tracking-day-date">${label}${isToday ? ' • En Curso' : ''}</strong>
            <div class="tracking-day-breakdown">
              <span>⌚ ${cOut.toLocaleString()} kcal</span>
              <span class="math-op">−</span>
              <span>🍽️ ${cIn.toLocaleString()} kcal</span>
            </div>
          </div>
          <div class="tracking-day-result">
            <span class="tracking-day-badge ${isDayDeficit ? 'badge-day-deficit' : 'badge-day-surplus'}">
              ${isDayDeficit ? '+' + dDeficit.toLocaleString() : dDeficit.toLocaleString()} kcal
            </span>
            <span class="tracking-day-fat ${isDayDeficit ? 'green-fat' : 'red-fat'}">
              ${isDayDeficit ? '≈ -' + dFatGrams + ' g grasa' : '≈ +' + dFatGrams + ' g superávit'}
            </span>
          </div>
        </div>
      `;
    }

    if (allDays.length <= 1) {
      historyHtml += `
        <div style="text-align: center; color: var(--text-muted); font-size: 0.72rem; padding: 10px 4px;">
          ✨ A la medianoche, cada jornada se guardará en tu historial permanente con el balance exacto de Garmin y comidas.
        </div>
      `;
    }

    elHistoryList.innerHTML = historyHtml;
  }
}

// ==========================================================================
// 5. RENDER GARMIN VIEW (LIMPIO, MINIMALISTA Y AUTOMATIZADO)
// ==========================================================================
function renderGarminView(garmin) {
  const activeCal = Number(garmin.active_calories || 0);
  const steps = Number(garmin.steps || 0);
  const stepCal = Number(garmin.step_calories || Math.round(steps * 0.03184));
  const exerciseCal = Number(garmin.exercise_calories || 0);
  const exercises = Array.isArray(garmin.exercises) ? garmin.exercises : [];

  const elActive = document.getElementById('garminActiveCal');
  if (elActive) elActive.textContent = activeCal.toLocaleString();

  const elSteps = document.getElementById('garminSteps');
  if (elSteps) elSteps.textContent = steps.toLocaleString();

  const elHr = document.getElementById('garminRestingHr');
  if (elHr) elHr.textContent = (garmin.resting_hr || '--') + ' bpm';

  const elTotal = document.getElementById('garminTotalCal');
  if (elTotal) elTotal.textContent = (garmin.total_calories || 0).toLocaleString();

  const sourceBadge = document.getElementById('garminSourceBadge');
  if (sourceBadge) {
    if (garmin.is_official) {
      sourceBadge.textContent = 'Oficial Garmin Web ✓';
      sourceBadge.style.backgroundColor = '#0284c7';
    } else {
      sourceBadge.textContent = (garmin.source || 'Health Connect (Garmin)') + ' ✓';
      sourceBadge.style.backgroundColor = '#10b981';
    }
  }

  // Pre-cargar valores en los campos de entrada directa de Garmin
  const inDirectActive = document.getElementById('inputDirectActiveCal');
  const inDirectResting = document.getElementById('inputDirectRestingCal');
  const lblDirectTotal = document.getElementById('lblDirectTotalCalPreview');
  if (inDirectActive && (!inDirectActive.value || inDirectActive.value === '0')) {
    if (activeCal > 0) inDirectActive.value = activeCal;
  }
  if (inDirectResting && (!inDirectResting.value || inDirectResting.value === '0')) {
    if (garmin.bmr_calories > 0) inDirectResting.value = garmin.bmr_calories;
  }
  if (lblDirectTotal) {
    const act = parseFloat(inDirectActive?.value) || activeCal || 0;
    const rest = parseFloat(inDirectResting?.value) || garmin.bmr_calories || 0;
    lblDirectTotal.textContent = (Math.round(act + rest)).toLocaleString() + ' kcal';
  }

  // Desglose de calorías activas (Pasos vs Musculación)
  const elBreakdown = document.getElementById('garminActiveBreakdown');
  if (elBreakdown) {
    elBreakdown.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-size:0.83rem; color:#94a3b8; padding: 4px 0;">
        <span>🚶‍♂️ Marcha / Pasos (${steps.toLocaleString()} pasos):</span>
        <strong style="color:#e2e8f0;">~${stepCal} kcal</strong>
      </div>
      <div style="display:flex; justify-content:space-between; font-size:0.83rem; color:#94a3b8; padding: 4px 0;">
        <span>🏋️ Musculación & Entrenamientos (${exercises.length} sesiones):</span>
        <strong style="color:#38bdf8;">${exerciseCal} kcal</strong>
      </div>
    `;
  }

  // Lista de actividades y entrenamientos de hoy
  const exList = document.getElementById('garminExercisesList');
  if (exList) {
    if (exercises.length === 0) {
      exList.innerHTML = `
        <div style="text-align:center; padding: 14px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.08); border-radius: 10px;">
          <p class="text-muted" style="margin: 0; font-size: 0.84rem;">
            Sin sesiones de musculación o gimnasio cargadas hoy.<br>
            Toca el botón abajo para cargar la actividad registrada en tu reloj.
          </p>
        </div>
      `;
    } else {
      exList.innerHTML = exercises.map(ex => `
        <div class="exercise-item-row" style="display:flex; align-items:center; justify-content:space-between; padding: 10px 14px; background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 10px; margin-bottom: 8px;">
          <div style="display:flex; align-items:center; gap: 10px;">
            <span style="font-size: 1.4rem;">🏋️</span>
            <div>
              <div style="font-weight: 600; font-size: 0.92rem; color: #f8fafc;">${escapeHtml(ex.title)}</div>
              <div class="small text-muted" style="font-size: 0.78rem;">
                ${ex.time || ''} ${ex.duration ? '• ' + ex.duration + ' min' : ''} • <span style="color:#38bdf8">${ex.calories} kcal quemadas</span>
              </div>
            </div>
          </div>
          <button onclick="window.deleteGarminExercise('${ex.id}')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size: 1.1rem; padding: 4px;" title="Eliminar entrenamiento">
            🗑️
          </button>
        </div>
      `).join('');
    }
  }
}

// ==========================================================================
// 6. HISTORIAL DE COMIDAS CON FECHA, HORA Y BORRADO DIRECTO
// ==========================================================================
async function loadMeals() {
  checkAndPerformDailyRollover();
  const localMeals = JSON.parse(localStorage.getItem('ketotrack_meals') || '[]');
  state.meals = localMeals;
  renderMealsList(state.meals);

  try {
    const res = await fetch('/api/meals');
    if (res.ok) {
      const data = await res.json();
      if (data.meals && Array.isArray(data.meals) && data.meals.length > 0) {
        state.meals = data.meals;
        localStorage.setItem('ketotrack_meals', JSON.stringify(state.meals));
        renderMealsList(state.meals);
      }
    }
  } catch (err) {}
}

function renderMealsList(meals) {
  const container = document.getElementById('mealsList');
  if (!container) return;

  const todayKey = getLocalDateKey(new Date());
  const allMeals = meals || [];
  const todayMeals = allMeals.filter(m => getLocalDateKey(m.timestamp) === todayKey);
  const pastMeals = allMeals.filter(m => getLocalDateKey(m.timestamp) !== todayKey);

  // 1. Comidas Registradas HOY
  if (todayMeals.length === 0) {
    container.innerHTML = `
      <div class="empty-meals-box" style="text-align:center; padding:24px 14px; background:rgba(255,255,255,0.03); border:1px dashed rgba(255,255,255,0.12); border-radius:12px;">
        <span style="font-size: 2rem;">🍽️</span>
        <p style="margin: 8px 0 4px 0; font-weight: 600; color: #f8fafc;">No hay comidas registradas hoy</p>
        <p class="text-muted" style="font-size: 0.84rem; margin: 0;">El contador se actualizó a cero para el día de hoy. Usa el formulario arriba para registrar tu comida.</p>
      </div>
    `;
  } else {
    container.innerHTML = todayMeals.map(m => {
      const timeFormatted = formatDateTime(m.timestamp);
      return `
        <div class="meal-item-card">
          <div class="meal-item-left">
            <div class="meal-header-row">
              <span class="meal-title-text">${escapeHtml(m.name)}</span>
              <span class="meal-time-tag">📅 ${timeFormatted}</span>
            </div>
            <div class="meal-macros-chips">
              <span class="macro-chip macro-chip-carb">${m.net_carbs}g carbos</span>
              <span class="macro-chip macro-chip-fat">${m.fat}g grasa</span>
              <span class="macro-chip macro-chip-prot">${m.protein}g prot</span>
              <span class="macro-chip macro-chip-cal">${m.calories} kcal</span>
            </div>
          </div>
          <button class="btn-delete-meal" onclick="window.deleteMeal('${m.id}')" title="Eliminar comida">
            🗑️
          </button>
        </div>
      `;
    }).join('');
  }

  // 2. Historial de días anteriores (guardado y documentado en memoria)
  let pastContainer = document.getElementById('pastMealsContainer');
  if (!pastContainer) {
    pastContainer = document.createElement('div');
    pastContainer.id = 'pastMealsContainer';
    container.parentElement.appendChild(pastContainer);
  }

  if (pastMeals.length > 0) {
    const pastByDate = {};
    for (const m of pastMeals) {
      const dKey = getLocalDateKey(m.timestamp);
      if (!pastByDate[dKey]) pastByDate[dKey] = [];
      pastByDate[dKey].push(m);
    }
    const sortedDates = Object.keys(pastByDate).sort().reverse();
    const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    pastContainer.innerHTML = `
      <details class="past-meals-details" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px 14px; margin-top: 18px;">
        <summary style="cursor: pointer; font-weight: 600; color: #94a3b8; font-size: 0.9rem; user-select: none;">
          📁 Historial de Días Anteriores (${pastMeals.length} comidas documentadas)
        </summary>
        <div style="margin-top: 14px; display: flex; flex-direction: column; gap: 14px;">
          ${sortedDates.map(dKey => {
            const dObj = new Date(dKey + 'T12:00:00');
            const dLabel = daysOfWeek[dObj.getDay()] + ' ' + String(dObj.getDate()).padStart(2, '0') + '/' + String(dObj.getMonth() + 1).padStart(2, '0');
            const dayList = pastByDate[dKey];
            const dayCal = dayList.reduce((acc, c) => acc + (Number(c.calories) || 0), 0);
            const dayCarbs = Math.round(dayList.reduce((acc, c) => acc + (Number(c.net_carbs) || 0), 0) * 10) / 10;
            return `
              <div style="border-left: 3px solid #64748b; padding-left: 10px;">
                <div style="font-size: 0.84rem; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">
                  📅 ${dLabel} (${dKey}) — <span style="color:#f59e0b">${dayCarbs}g carbos</span> • <span style="color:#10b981">${dayCal} kcal</span>
                </div>
                ${dayList.map(m => `
                  <div style="font-size: 0.8rem; color: #94a3b8; display:flex; justify-content:space-between; align-items:center; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <span>${escapeHtml(m.name)} <small style="color:#64748b">(${formatDateTime(m.timestamp)})</small></span>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <span>${m.net_carbs || 0}g C • ${m.calories || 0} kcal</span>
                      <button onclick="window.deleteMeal('${m.id}')" style="background:none; border:none; color:#ef4444; cursor:pointer; font-size:0.85rem;" title="Eliminar">🗑️</button>
                    </div>
                  </div>
                `).join('')}
              </div>
            `;
          }).join('')}
        </div>
      </details>
    `;
  } else {
    pastContainer.innerHTML = '';
  }
}

window.deleteMeal = function(id) {
  if (!confirm('¿Deseas eliminar esta comida del registro?')) return;
  const localMeals = JSON.parse(localStorage.getItem('ketotrack_meals') || '[]');
  state.meals = localMeals.filter(m => String(m.id) !== String(id));
  localStorage.setItem('ketotrack_meals', JSON.stringify(state.meals));
  renderMealsList(state.meals);
  recalculateClientState();

  try {
    fetch('/api/meals/' + id, { method: 'DELETE' }).catch(() => {});
  } catch (e) {}
};

// Formulario de Ingreso de Comida
document.getElementById('formMeal')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = (document.getElementById('inputMealName')?.value || '').trim();
  if (!name) return alert('Por favor ingresa un nombre para la comida');

  let carbs = parseFloat(document.getElementById('inputCarbs')?.value) || 0;
  let fiber = parseFloat(document.getElementById('inputFiber')?.value) || 0;
  let protein = parseFloat(document.getElementById('inputProtein')?.value) || 0;
  let fat = parseFloat(document.getElementById('inputFat')?.value) || 0;
  let calories = parseFloat(document.getElementById('inputCalories')?.value);

  // Si los macros están todos en 0 pero el usuario escribió un plato, autocalcular con IA automáticamente
  if (carbs === 0 && fiber === 0 && protein === 0 && fat === 0) {
    const aiAuto = estimateMealMacrosAI(name);
    if (aiAuto) {
      carbs = aiAuto.carbs;
      fiber = aiAuto.fiber;
      protein = aiAuto.protein;
      fat = aiAuto.fat;
      calories = aiAuto.calories;
    }
  }

  const netCarbs = Math.max(0, Math.round((carbs - fiber) * 10) / 10);
  if (isNaN(calories) || calories === 0) {
    calories = Math.round((fat * 9) + (protein * 4) + (netCarbs * 4));
  }

  const newMeal = {
    id: Date.now(),
    name,
    carbs,
    fiber,
    net_carbs: netCarbs,
    protein,
    fat,
    calories,
    timestamp: new Date().toISOString()
  };

  const localMeals = JSON.parse(localStorage.getItem('ketotrack_meals') || '[]');
  localMeals.unshift(newMeal);
  localStorage.setItem('ketotrack_meals', JSON.stringify(localMeals));
  state.meals = localMeals;

  if (!state.settings.keto_start_date) {
    state.settings.keto_start_date = newMeal.timestamp;
    localStorage.setItem('ketotrack_settings', JSON.stringify(state.settings));
  }

  e.target.reset();
  ['inputCarbs', 'inputFiber', 'inputProtein', 'inputFat'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '0';
  });
  const feedback = document.getElementById('aiCalcFeedback');
  if (feedback) feedback.style.display = 'none';

  renderMealsList(state.meals);
  recalculateClientState();

  try {
    fetch('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, carbs, fiber, protein, fat, calories })
    }).catch(() => {});
  } catch (e) {}

  alert('¡Comida guardada exitosamente!: ' + name + ' (' + netCarbs + 'g carbos netos)');
  document.querySelectorAll('.nav-tab')[0]?.click(); // Volver al Estado
});

// ==========================================================================
// 7. SEGUIMIENTO DE PESO CORPORAL (WEIGHT TRACKER)
// ==========================================================================
function loadWeights() {
  const localWeights = JSON.parse(localStorage.getItem('ketotrack_weights') || '[]');
  state.weights = localWeights;
  renderWeightView();
  if (typeof renderWeightComparison === 'function') {
    renderWeightComparison();
  }
}

function renderWeightView() {
  const weights = state.weights || [];
  const settings = state.settings || {};
  const currentWeight = Number(settings.weight || (weights[0] && weights[0].weight) || 80.0);
  const goalWeight = Number(settings.goal_weight || 75.0);
  const heightCm = Number(settings.height || 175);

  const goalEl = document.getElementById('valGoalWeight');
  if (goalEl) goalEl.textContent = goalWeight.toFixed(1) + ' kg';

  const currentEl = document.getElementById('valCurrentWeight');
  if (currentEl) currentEl.textContent = currentWeight.toFixed(1);

  const diff = Math.round((currentWeight - goalWeight) * 10) / 10;
  const diffEl = document.getElementById('valWeightDiff');
  if (diffEl) {
    if (diff > 0) {
      diffEl.textContent = '+' + diff.toFixed(1) + ' kg a la meta';
      diffEl.className = 'text-warning';
    } else if (diff < 0) {
      diffEl.textContent = diff.toFixed(1) + ' kg de la meta';
      diffEl.className = 'text-success';
    } else {
      diffEl.textContent = '¡En peso meta!';
      diffEl.className = 'text-success';
    }
  }

  // IMC
  if (heightCm > 0) {
    const heightM = heightCm / 100;
    const bmi = currentWeight / (heightM * heightM);
    const bmiEl = document.getElementById('valWeightBmi');
    if (bmiEl) bmiEl.textContent = bmi.toFixed(1);
  }

  // Badge de Tendencia
  const trendBadge = document.getElementById('weightTrendBadge');
  if (trendBadge) {
    if (diff > 0) {
      trendBadge.textContent = 'Déficit a Meta: ' + goalWeight.toFixed(1) + ' kg';
      trendBadge.className = 'badge badge-cyan';
    } else if (diff === 0) {
      trendBadge.textContent = '¡Meta Lograda!';
      trendBadge.className = 'badge badge-success';
    } else {
      trendBadge.textContent = 'Mantenimiento';
      trendBadge.className = 'badge badge-purple';
    }
  }

  // Lista de pesajes
  const listContainer = document.getElementById('weightLogsList');
  if (listContainer) {
    if (weights.length === 0) {
      listContainer.innerHTML = '<p class="text-muted text-center" style="padding:16px 0;">Aún no hay registros de peso.</p>';
      return;
    }

    listContainer.innerHTML = weights.map(w => {
      const timeFormatted = formatDateTime(w.date || w.timestamp);
      return `
        <div class="weight-item-card">
          <div class="weight-item-left">
            <span class="weight-item-val">${Number(w.weight).toFixed(1)} kg</span>
            <span class="weight-item-date">📅 ${timeFormatted} ${w.source ? '(' + w.source + ')' : ''}</span>
          </div>
          <button class="btn-delete-meal" onclick="window.deleteWeight('${w.id}')" title="Eliminar pesaje">
            🗑️
          </button>
        </div>
      `;
    }).join('');
  }
}

window.deleteWeight = function(id) {
  if (!confirm('¿Deseas eliminar este registro de peso?')) return;
  state.weights = (state.weights || []).filter(w => String(w.id) !== String(id));
  localStorage.setItem('ketotrack_weights', JSON.stringify(state.weights));
  renderWeightView();
  if (typeof renderWeightComparison === 'function') {
    renderWeightComparison();
  }
};

window.applyGarminWeight = function(weightKg, source) {
  if (!weightKg || isNaN(weightKg)) return;
  const numWeight = Math.round(Number(weightKg) * 10) / 10;
  const localWeights = JSON.parse(localStorage.getItem('ketotrack_weights') || '[]');

  // Sincronizar pesaje de hoy
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  const existingToday = localWeights.find(w => (w.date || w.timestamp || '').slice(0, 10) === todayKey);
  if (existingToday) {
    existingToday.weight = numWeight;
    existingToday.source = source || 'Health Connect (Balanza)';
  } else {
    localWeights.unshift({
      id: Date.now(),
      weight: numWeight,
      date: now.toISOString(),
      source: source || 'Health Connect (Balanza)'
    });
  }
  localStorage.setItem('ketotrack_weights', JSON.stringify(localWeights));
  state.weights = localWeights;

  // Actualizar configuración y recalcular macros
  state.settings.weight = numWeight;
  localStorage.setItem('ketotrack_settings', JSON.stringify(state.settings));
  recalculateClientState();
  renderWeightView();
  if (typeof renderWeightComparison === 'function') {
    renderWeightComparison();
  }
};

// Formulario de pesaje manual
document.getElementById('formWeightLog')?.addEventListener('submit', (e) => {
  e.preventDefault();
  const weightVal = parseFloat(document.getElementById('inputWeightValue')?.value);
  if (!weightVal || isNaN(weightVal)) return alert('Ingresa un peso válido');

  const dateInput = document.getElementById('inputWeightDate')?.value;
  const dateObj = dateInput ? new Date(dateInput) : new Date();

  const newEntry = {
    id: Date.now(),
    weight: Math.round(weightVal * 10) / 10,
    date: dateObj.toISOString(),
    source: 'Manual'
  };

  const localWeights = JSON.parse(localStorage.getItem('ketotrack_weights') || '[]');
  localWeights.unshift(newEntry);
  localStorage.setItem('ketotrack_weights', JSON.stringify(localWeights));
  state.weights = localWeights;

  // Actualizar también el perfil y macros
  state.settings.weight = newEntry.weight;
  localStorage.setItem('ketotrack_settings', JSON.stringify(state.settings));

  e.target.reset();
  const nowInput = new Date().toISOString().slice(0, 16);
  const inDate = document.getElementById('inputWeightDate');
  if (inDate) inDate.value = nowInput;

  renderWeightView();
  recalculateClientState();
  if (typeof renderWeightComparison === 'function') {
    renderWeightComparison();
  }
  alert('¡Pesaje guardado!: ' + newEntry.weight + ' kg. Tus metas calóricas y proteicas fueron reajustadas.');
});

// Pre-llenar fecha y hora actual en formulario de peso
const inWeightDate = document.getElementById('inputWeightDate');
if (inWeightDate && !inWeightDate.value) {
  inWeightDate.value = new Date().toISOString().slice(0, 16);
}


// ==========================================================================
// 7.B CONTRASTE DE PESO REAL VS. CURVA IDEAL & MEDIDA SEMANAL
// Algoritmo Wishnofsky / ACSM / OMS: 1 kg grasa = 7.700 kcal de déficit
// ==========================================================================
let activeWeightChartRange = '14';

// Asegura que existan datos de pesaje históricos consistentes para la comparativa
function ensureWeightHistory(weights, settings, dailyHistory) {
  const currentWeight = Number(settings.weight || 80.0);
  const now = new Date();
  let generated = [...(weights || [])];

  const todayStr = now.toISOString().slice(0, 10);
  const existingToday = generated.find(w => (w.date || w.timestamp || '').slice(0, 10) === todayStr);
  if (existingToday) {
    existingToday.weight = currentWeight;
  } else {
    generated.unshift({
      id: Date.now(),
      weight: currentWeight,
      date: now.toISOString(),
      source: 'Registrado'
    });
  }

  generated.sort((a, b) => new Date(b.date || b.timestamp) - new Date(a.date || a.timestamp));
  return generated;
}

// Función auxiliar para interpolación lineal de pesos entre fechas conocidas
function getInterpolatedWeight(targetDateKey, weightMap, fallbackStart, fallbackEnd) {
  const dates = Object.keys(weightMap).sort();
  if (dates.length === 0) return fallbackEnd;
  if (targetDateKey <= dates[0]) return weightMap[dates[0]];
  if (targetDateKey >= dates[dates.length - 1]) return weightMap[dates[dates.length - 1]];

  for (let k = 0; k < dates.length - 1; k++) {
    if (targetDateKey >= dates[k] && targetDateKey <= dates[k + 1]) {
      const d1 = new Date(dates[k]).getTime();
      const d2 = new Date(dates[k + 1]).getTime();
      const dt = new Date(targetDateKey).getTime();
      const frac = d2 > d1 ? (dt - d1) / (d2 - d1) : 0;
      return weightMap[dates[k]] + frac * (weightMap[dates[k + 1]] - weightMap[dates[k]]);
    }
  }
  return fallbackEnd;
}

// Calcula las trayectorias día a día (Real vs Ideal)
function calculateWeightTrajectories(range) {
  const dailyHistory = syncTodayToDailyHistory();
  const settings = state.settings || {};
  
  const profileWeight = Number(settings.weight || 80.0);
  const goalWeight = Number(settings.goal_weight || 75.0);
  const heightCm = Number(settings.height || 175);
  const age = Number(settings.age || 35);
  const gender = settings.gender || 'male';

  // Sincronizar pesajes con settings
  let weights = ensureWeightHistory(state.weights || [], settings, dailyHistory);
  state.weights = weights;

  // Mapear pesajes reales por día YYYY-MM-DD
  const weightMap = {};
  weights.forEach(w => {
    const dStr = (w.date || w.timestamp || '').slice(0, 10);
    if (dStr && !weightMap[dStr]) {
      weightMap[dStr] = Number(w.weight);
    }
  });

  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);
  if (!weightMap[todayKey]) {
    weightMap[todayKey] = profileWeight;
  }

  // BMR Mifflin-St Jeor
  const bmrBase = (10 * profileWeight) + (6.25 * heightCm) - (5 * age) + (gender === 'female' ? -161 : 5);

  // Gasto activo promedio según Garmin
  const garmin = state.status?.garmin || JSON.parse(localStorage.getItem('ketotrack_garmin') || '{}');
  const garminActiveCal = Number(garmin.active_calories || 450);
  const tdee = Math.round(bmrBase + garminActiveCal);

  // Déficit calórico diario saludable (ACSM / OMS: ~400-600 kcal/día = ~0.4 - 0.6 kg/semana)
  const targetCal = Number(settings.calories_target || (tdee - 500));
  const dailyDeficit = Math.max(300, Math.min(1000, tdee - targetCal));
  const dailyLossKg = dailyDeficit / 7700; // ~0.065 kg/día = 0.455 kg/sem

  // Determinar horizonte en días según el rango
  let horizonDays = 14;
  if (range === '30') {
    horizonDays = 30;
  } else if (range === 'all') {
    const kgToGoal = Math.abs(profileWeight - goalWeight);
    const estDays = Math.ceil(kgToGoal / Math.max(0.02, dailyLossKg));
    horizonDays = Math.max(30, Math.min(90, estDays + 3));
  } else {
    horizonDays = 14;
  }

  // Fecha de inicio: la fecha del protocolo o primer día de historial, pero no posterior a hoy
  let startDate = now;
  const sDate = settings.keto_start_date ? new Date(settings.keto_start_date) : null;
  if (sDate && !isNaN(sDate.getTime()) && sDate <= now) {
    startDate = sDate;
  }
  const startDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0);

  // Determinar peso inicial
  const startDayKey = startDay.toISOString().slice(0, 10);
  let startWeight = weightMap[startDayKey] || profileWeight;

  // Construir la lista de fechas, puntos ideales y puntos reales
  const dates = [];
  const idealPoints = [];
  const realPoints = [];

  // Mapear historial diario por fecha para pasos y calorías
  const dailyHistoryMap = {};
  (dailyHistory || []).forEach(h => {
    if (h.date) dailyHistoryMap[h.date] = h;
  });

  // Generar día por día desde startDay hasta startDay + horizonDays - 1
  for (let i = 0; i < horizonDays; i++) {
    const curDate = new Date(startDay.getTime() + (i * 86400000));
    const curDateKey = curDate.toISOString().slice(0, 10);
    dates.push(curDateKey);

    // 1. Curva Ideal (Proyección Wishnofsky / ACSM hacia la meta)
    let idealW;
    if (goalWeight < startWeight) {
      idealW = Math.max(goalWeight, startWeight - (i * dailyLossKg));
    } else if (goalWeight > startWeight) {
      idealW = Math.min(goalWeight, startWeight + (i * dailyLossKg));
    } else {
      idealW = goalWeight;
    }
    idealPoints.push(Math.round(idealW * 100) / 100);

    // 2. Curva Real (Pesos registrados hasta la fecha actual)
    if (curDateKey <= todayKey) {
      let realW = weightMap[curDateKey];
      const isExplicit = (realW !== undefined);
      if (realW === undefined) {
        if (curDateKey === todayKey) {
          realW = profileWeight;
        } else {
          realW = getInterpolatedWeight(curDateKey, weightMap, startWeight, profileWeight);
        }
      }
      realPoints.push({
        weight: Math.round(realW * 10) / 10,
        isExplicit: isExplicit,
        hasData: true,
        date: curDateKey
      });
    } else {
      // Día futuro: todavía no ocurrió
      realPoints.push({
        weight: null,
        isExplicit: false,
        hasData: false,
        date: curDateKey
      });
    }
  }

  // Traer el último peso real conocido
  const recordedReals = realPoints.filter(p => p.hasData && p.weight !== null);
  const currentReal = recordedReals.length > 0 ? recordedReals[recordedReals.length - 1].weight : profileWeight;
  const currentIdeal = idealPoints[recordedReals.length > 0 ? (recordedReals.length - 1) : 0];

  return {
    dates,
    dailyHistoryMap,
    idealPoints,
    realPoints,
    goalWeight,
    startWeight,
    currentReal,
    currentIdeal,
    profileWeight,
    horizonDays,
    dailyLossKg,
    range
  };
}

// Agrupa en bloques de 7 días y contrarresta el avance semanal
function calculateWeeklyComparison(trajectories) {
  const { dates, idealPoints, realPoints, dailyHistoryMap, startWeight, currentReal, goalWeight } = trajectories;
  const weeks = [];
  const totalDays = dates.length;
  const numWeeks = Math.ceil(totalDays / 7);
  const now = new Date();
  const todayKey = now.toISOString().slice(0, 10);

  for (let w = 0; w < numWeeks; w++) {
    const startIdx = w * 7;
    const endIdx = Math.min(totalDays - 1, (w + 1) * 7 - 1);
    const daysInWeek = endIdx - startIdx + 1;

    const startDate = dates[startIdx];
    const endDate = dates[endIdx];

    // Puntos ideales de la semana
    const weekIdealStart = idealPoints[startIdx];
    const weekIdealEnd = idealPoints[endIdx];
    const deltaIdeal = Math.round((weekIdealEnd - weekIdealStart) * 10) / 10;

    // Puntos reales de la semana
    const weekRealPoints = realPoints.slice(startIdx, endIdx + 1).filter(p => p.hasData && p.weight !== null);
    
    let isCurrentWeek = false;
    let isFutureWeek = false;
    if (startDate > todayKey) {
      isFutureWeek = true;
    } else if (endDate >= todayKey && startDate <= todayKey) {
      isCurrentWeek = true;
    }

    let weekRealStart = weekRealPoints.length > 0 ? weekRealPoints[0].weight : (w === 0 ? startWeight : weeks[w - 1]?.endReal || currentReal);
    let weekRealEnd = weekRealPoints.length > 0 ? weekRealPoints[weekRealPoints.length - 1].weight : weekRealStart;
    let deltaReal = Math.round((weekRealEnd - weekRealStart) * 10) / 10;

    // Pasos y calorías de la semana
    let weekSteps = 0;
    let weekActiveCal = 0;
    for (let d = startIdx; d <= endIdx; d++) {
      const dKey = dates[d];
      const h = dailyHistoryMap[dKey];
      if (h) {
        weekSteps += Number(h.steps || 0);
        weekActiveCal += Number(h.calories_out || 0);
      } else {
        const garmin = state.status?.garmin || {};
        weekSteps += Number(garmin.steps || 8000);
        weekActiveCal += Number(garmin.active_calories || 400);
      }
    }

    let statusText = 'En Meta Óptima';
    let statusBadgeClass = 'badge-success';
    let statusIcon = '🎯';

    if (isFutureWeek) {
      statusText = 'Proyección a Meta';
      statusBadgeClass = 'badge-cyan';
      statusIcon = '🏁';
    } else if (isCurrentWeek) {
      statusText = 'Semana en Curso';
      statusBadgeClass = 'badge-success';
      statusIcon = '⚡';
    } else if (deltaReal <= deltaIdeal - 0.2) {
      statusText = 'Adelantado al Ideal';
      statusBadgeClass = 'badge-cyan';
      statusIcon = '⚡';
    } else if (deltaReal >= deltaIdeal + 0.3) {
      statusText = 'Ajuste Sugerido';
      statusBadgeClass = 'badge-warning';
      statusIcon = '⚠️';
    }

    weeks.push({
      weekNum: w + 1,
      startDate,
      endDate,
      daysInWeek,
      isCurrentWeek,
      isFutureWeek,
      startReal: weekRealStart,
      endReal: isFutureWeek ? weekIdealEnd : weekRealEnd,
      endIdeal: weekIdealEnd,
      deltaReal: isFutureWeek ? deltaIdeal : deltaReal,
      deltaIdeal,
      weekSteps,
      weekActiveCal,
      statusText,
      statusBadgeClass,
      statusIcon
    });
  }

  return weeks;
}

// Dibuja en HTML5 Canvas la doble curva de alta definición (Real vs Ideal)
function renderWeightCompareChart(trajectories) {
  const canvas = document.getElementById('canvasWeightCompareChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  const w = rect.width > 0 ? rect.width : (canvas.parentElement?.clientWidth || 340);
  const h = rect.height > 0 ? rect.height : 220;

  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  const padLeft = 48;
  const padRight = 24;
  const padTop = 24;
  const padBottom = 32;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  ctx.clearRect(0, 0, w, h);

  const { dates, idealPoints, realPoints, goalWeight, startWeight } = trajectories;
  const recordedReals = realPoints.filter(p => p.hasData && p.weight !== null);
  const realVals = recordedReals.map(r => r.weight);

  // Escala Y dinámica abarcando meta, ideal y real
  const allVals = [...realVals, ...idealPoints, goalWeight, startWeight];
  let minVal = Math.min(...allVals) - 0.4;
  let maxVal = Math.max(...allVals) + 0.4;
  minVal = Math.floor(minVal * 2) / 2;
  maxVal = Math.ceil(maxVal * 2) / 2;
  const valRange = Math.max(1, maxVal - minVal);

  // Guías horizontales
  const gridSteps = 4;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;

  for (let i = 0; i <= gridSteps; i++) {
    const yVal = maxVal - (valRange / gridSteps) * i;
    const y = padTop + (plotH / gridSteps) * i;

    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(yVal.toFixed(1) + ' kg', padLeft - 6, y + 3);
  }

  // Línea horizontal de Meta (Goal Weight)
  const yGoal = padTop + plotH - ((goalWeight - minVal) / valRange) * plotH;
  if (yGoal >= padTop && yGoal <= padTop + plotH) {
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(padLeft, yGoal);
    ctx.lineTo(w - padRight, yGoal);
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 9px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Meta ' + goalWeight.toFixed(1) + ' kg', w - padRight - 4, yGoal - 5);
    ctx.restore();
  }

  const numPoints = dates.length;
  const stepX = numPoints > 1 ? plotW / (numPoints - 1) : plotW;

  // 1. Dibujar Curva Ideal (Violeta luminoso punteado suave a lo largo de los días)
  const idealCoords = [];
  for (let i = 0; i < idealPoints.length; i++) {
    const px = padLeft + i * stepX;
    const py = padTop + plotH - ((idealPoints[i] - minVal) / valRange) * plotH;
    idealCoords.push({ x: px, y: py, val: idealPoints[i] });
  }

  if (idealCoords.length >= 2) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(idealCoords[0].x, idealCoords[0].y);
    for (let i = 0; i < idealCoords.length - 1; i++) {
      const p0 = i === 0 ? idealCoords[0] : idealCoords[i - 1];
      const p1 = idealCoords[i];
      const p2 = idealCoords[i + 1];
      const p3 = i + 2 >= idealCoords.length ? idealCoords[i + 1] : idealCoords[i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 4]);
    ctx.stroke();

    // Marcador final en la meta proyectada
    const lastIdeal = idealCoords[idealCoords.length - 1];
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(lastIdeal.x, lastIdeal.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#c084fc';
    ctx.fill();
    ctx.restore();
  }

  // 2. Dibujar Curva Real (Esmeralda #10b981)
  const realCoords = [];
  for (let i = 0; i < realPoints.length; i++) {
    if (realPoints[i].hasData && realPoints[i].weight !== null) {
      const px = padLeft + i * stepX;
      const py = padTop + plotH - ((realPoints[i].weight - minVal) / valRange) * plotH;
      realCoords.push({
        x: px,
        y: py,
        val: realPoints[i].weight,
        isExplicit: realPoints[i].isExplicit,
        idx: i
      });
    }
  }

  if (realCoords.length >= 2) {
    // Área con degradado esmeralda
    const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
    grad.addColorStop(0, 'rgba(16, 185, 129, 0.32)');
    grad.addColorStop(1, 'rgba(16, 185, 129, 0.00)');

    ctx.beginPath();
    ctx.moveTo(realCoords[0].x, realCoords[0].y);
    for (let i = 0; i < realCoords.length - 1; i++) {
      const p0 = i === 0 ? realCoords[0] : realCoords[i - 1];
      const p1 = realCoords[i];
      const p2 = realCoords[i + 1];
      const p3 = i + 2 >= realCoords.length ? realCoords[i + 1] : realCoords[i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
    ctx.lineTo(realCoords[realCoords.length - 1].x, padTop + plotH);
    ctx.lineTo(realCoords[0].x, padTop + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Línea continua sólida
    ctx.beginPath();
    ctx.moveTo(realCoords[0].x, realCoords[0].y);
    for (let i = 0; i < realCoords.length - 1; i++) {
      const p0 = i === 0 ? realCoords[0] : realCoords[i - 1];
      const p1 = realCoords[i];
      const p2 = realCoords[i + 1];
      const p3 = i + 2 >= realCoords.length ? realCoords[i + 1] : realCoords[i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Puntos/nodos
    for (const p of realCoords) {
      ctx.beginPath();
      const radius = p.isExplicit ? 5 : 3.5;
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = p.isExplicit ? '#10b981' : '#047857';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();
    }
  } else if (realCoords.length === 1) {
    // Un solo pesaje (inicio / hoy): Dibujar nodo destacado con anillo luminoso y badge
    const p = realCoords[0];
    
    // Anillo de brillo exterior
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
    ctx.fill();

    // Círculo exterior
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#10b981';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();

    // Etiqueta flotante con el peso actual
    ctx.save();
    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 10px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(p.val.toFixed(1) + ' kg (Hoy)', p.x + 12, p.y + 4);
    ctx.restore();
  }

  // Eje X fechas
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  const labelSkip = numPoints > 10 ? Math.ceil(numPoints / 6) : (numPoints > 5 ? 2 : 1);

  for (let i = 0; i < numPoints; i++) {
    if (i % labelSkip === 0 || i === numPoints - 1) {
      const parts = dates[i].split('-');
      const label = parts[2] + '/' + parts[1];
      const px = padLeft + i * stepX;
      ctx.fillText(label, px, h - 8);
    }
  }
}

// Renderiza las tarjetas de resumen y desglose semanal
function renderWeightWeeklyView(trajectories, weeks) {
  const container = document.getElementById('weightWeeklyBreakdown');
  const { startWeight, currentReal, goalWeight, idealPoints, range, dailyLossKg } = trajectories;

  // 1. Métricas Hero
  const totalRealLoss = Math.round((currentReal - startWeight) * 10) / 10;
  
  // Pérdida ideal acumulada/proyectada para el horizonte seleccionado
  const idealEndWeight = idealPoints[idealPoints.length - 1];
  const targetIdealLoss = Math.round((idealEndWeight - startWeight) * 10) / 10;

  const elRealLoss = document.getElementById('valWeightRealLoss');
  const subRealLoss = document.getElementById('subWeightRealLoss');
  if (elRealLoss) {
    elRealLoss.textContent = (totalRealLoss <= 0 ? '' : '+') + totalRealLoss.toFixed(1) + ' kg';
    elRealLoss.className = totalRealLoss <= 0 ? 'w-val text-success' : 'w-val text-warning';
  }
  if (subRealLoss) {
    subRealLoss.textContent = weeks[0]?.isCurrentWeek && weeks.length === 1 ? 'En inicio de plan' : 'Desde el inicio';
  }

  const elIdealLoss = document.getElementById('valWeightIdealLoss');
  const subIdealLoss = document.getElementById('subWeightIdealLoss');
  if (elIdealLoss) {
    elIdealLoss.textContent = (targetIdealLoss <= 0 ? '' : '+') + targetIdealLoss.toFixed(1) + ' kg';
  }
  if (subIdealLoss) {
    const rangeLabel = range === '14' ? '14 Días' : (range === '30' ? '30 Días' : 'Meta');
    subIdealLoss.textContent = 'Meta proyectada (' + rangeLabel + ')';
  }

  // Ritmo semanal promedio
  const weeklyRateTarget = -Math.round(dailyLossKg * 7 * 10) / 10; // ~ -0.5 kg/sem
  const pastWeeks = weeks.filter(w => !w.isFutureWeek);
  const avgWeeklyRate = pastWeeks.length > 0 && pastWeeks[0].deltaReal !== 0
    ? pastWeeks[pastWeeks.length - 1].deltaReal
    : weeklyRateTarget;

  const elWeeklyRate = document.getElementById('valWeightWeeklyRate');
  if (elWeeklyRate) {
    elWeeklyRate.textContent = (avgWeeklyRate <= 0 ? '' : '+') + avgWeeklyRate.toFixed(1) + ' kg/sem';
  }

  // Estado Metabólico y Diferencia
  const elStatus = document.getElementById('valWeightPaceStatus');
  const elDiff = document.getElementById('subWeightPaceDiff');
  const diffToGoal = Math.round((currentReal - goalWeight) * 10) / 10;

  if (elStatus && elDiff) {
    if (diffToGoal <= 0) {
      elStatus.textContent = '🏆 ¡Meta Lograda!';
      elStatus.style.color = '#10b981';
      elDiff.textContent = 'En peso objetivo (' + goalWeight.toFixed(1) + ' kg)';
    } else {
      elStatus.textContent = '🎯 En Ritmo';
      elStatus.style.color = '#10b981';
      elDiff.textContent = 'A ' + diffToGoal.toFixed(1) + ' kg de la meta';
    }
  }

  // Actualizar Badge de Tendencia Superior
  const trendBadge = document.getElementById('weightTrendBadge');
  if (trendBadge) {
    if (diffToGoal > 0) {
      trendBadge.textContent = 'Déficit a Meta: ' + goalWeight.toFixed(1) + ' kg';
      trendBadge.className = 'badge badge-cyan';
    } else if (diffToGoal === 0) {
      trendBadge.textContent = '¡Meta Lograda!';
      trendBadge.className = 'badge badge-success';
    } else {
      trendBadge.textContent = 'Mantenimiento';
      trendBadge.className = 'badge badge-purple';
    }
  }

  const badgeWeeks = document.getElementById('badgeTotalWeeks');
  if (badgeWeeks) {
    badgeWeeks.textContent = weeks.length === 1 ? '1 Semana de Plan' : (weeks.length + ' Semanas de Plan');
  }

  const legendGoal = document.getElementById('txtLegendGoalWeight');
  if (legendGoal) legendGoal.textContent = goalWeight.toFixed(1) + ' kg';

  // 2. Renderizar Tarjetas Semanales
  if (!container) return;
  if (weeks.length === 0) {
    container.innerHTML = '<div class="loading-placeholder">Calculando desglose semanal...</div>';
    return;
  }

  container.innerHTML = weeks.map(w => {
    const sParts = w.startDate.split('-');
    const eParts = w.endDate.split('-');
    const rangeText = sParts[2] + '/' + sParts[1] + ' al ' + eParts[2] + '/' + eParts[1];

    const deltaSign = w.deltaReal <= 0 ? '' : '+';
    const idealDeltaSign = w.deltaIdeal <= 0 ? '' : '+';

    let weekSubtitle = '';
    if (w.isCurrentWeek) weekSubtitle = '<small style="color:#38bdf8">(En curso)</small>';
    else if (w.isFutureWeek) weekSubtitle = '<small style="color:#c084fc">(Proyección)</small>';

    return `
      <div class="weekly-card">
        <div class="weekly-card-header">
          <div class="weekly-card-title">
            <strong>Semana ${w.weekNum} ${weekSubtitle}</strong>
            <span>📅 ${rangeText}</span>
          </div>
          <span class="badge ${w.statusBadgeClass}">${w.statusIcon} ${w.statusText}</span>
        </div>

        <div class="weekly-card-body">
          <div class="weekly-col">
            <span class="weekly-col-lbl">${w.isFutureWeek ? 'Meta Cierre' : 'Peso Cierre'}</span>
            <strong class="weekly-col-val">${w.endReal.toFixed(1)} kg</strong>
          </div>
          <div class="weekly-col">
            <span class="weekly-col-lbl">${w.isFutureWeek ? 'Δ Proyectado' : 'Δ Peso Real'}</span>
            <strong class="weekly-col-val" style="color: ${w.deltaReal <= 0 ? '#10b981' : '#f59e0b'};">
              ${deltaSign}${w.deltaReal.toFixed(1)} kg
            </strong>
          </div>
          <div class="weekly-col">
            <span class="weekly-col-lbl">Δ Ideal (Keto)</span>
            <strong class="weekly-col-val" style="color: #c084fc;">
              ${idealDeltaSign}${w.deltaIdeal.toFixed(1)} kg
            </strong>
          </div>
        </div>

        <div class="weekly-garmin-strip">
          <span>⌚ <strong>Garmin:</strong> ${w.weekSteps.toLocaleString()} pasos</span>
          <span>🔥 <strong>${w.weekActiveCal.toLocaleString()} kcal</strong> activas quemadas</span>
        </div>
      </div>
    `;
  }).join('');
}

// Orquestador de la comparativa de peso
function renderWeightComparison() {
  const trajectories = calculateWeightTrajectories(activeWeightChartRange);
  const weeks = calculateWeeklyComparison(trajectories);
  renderWeightCompareChart(trajectories);
  renderWeightWeeklyView(trajectories, weeks);
}

// Configura listeners de la pestaña de peso
function setupWeightChartListeners() {
  document.getElementById('btnWeightRange14')?.addEventListener('click', () => {
    activeWeightChartRange = '14';
    document.getElementById('btnWeightRange14')?.classList.add('active');
    document.getElementById('btnWeightRange30')?.classList.remove('active');
    document.getElementById('btnWeightRangeAll')?.classList.remove('active');
    renderWeightComparison();
  });

  document.getElementById('btnWeightRange30')?.addEventListener('click', () => {
    activeWeightChartRange = '30';
    document.getElementById('btnWeightRange30')?.classList.add('active');
    document.getElementById('btnWeightRange14')?.classList.remove('active');
    document.getElementById('btnWeightRangeAll')?.classList.remove('active');
    renderWeightComparison();
  });

  document.getElementById('btnWeightRangeAll')?.addEventListener('click', () => {
    activeWeightChartRange = 'all';
    document.getElementById('btnWeightRangeAll')?.classList.add('active');
    document.getElementById('btnWeightRange14')?.classList.remove('active');
    document.getElementById('btnWeightRange30')?.classList.remove('active');
    renderWeightComparison();
  });

  window.addEventListener('resize', () => {
    const tabWeight = document.getElementById('tab-weight');
    if (tabWeight && tabWeight.classList.contains('active')) {
      renderWeightComparison();
    }
  });
}


// ==========================================================================
// 8. CONFIGURACIÓN, PERFIL Y RECALCULAR METAS
// ==========================================================================
function loadSettings() {
  const localSettings = JSON.parse(localStorage.getItem('ketotrack_settings') || '{}');
  state.settings = { ...state.settings, ...localSettings };

  const s = state.settings;
  const inWeight = document.getElementById('setProfileWeight');
  if (inWeight) inWeight.value = s.weight || 80;

  const inAge = document.getElementById('setProfileAge');
  if (inAge) inAge.value = s.age || 35;

  const inHeight = document.getElementById('setProfileHeight');
  if (inHeight) inHeight.value = s.height || 175;

  const inGender = document.getElementById('setProfileGender');
  if (inGender) inGender.value = s.gender || 'male';

  const inGoal = document.getElementById('setGoalWeight');
  if (inGoal) inGoal.value = s.goal_weight || 75.0;
  updateGoalWeightFeedback();

  const inCarbs = document.getElementById('setNetCarbs');
  if (inCarbs) inCarbs.value = s.net_carbs_target || 25;

  const inProt = document.getElementById('setProtein');
  if (inProt) inProt.value = s.protein_target || 140;

  const inFat = document.getElementById('setFat');
  if (inFat) inFat.value = s.fat_target || 150;

  const inCal = document.getElementById('setCalories');
  if (inCal) inCal.value = s.calories_target || 2000;

  const inStartDate = document.getElementById('setKetoStartDate');
  if (inStartDate) {
    const sDate = s.keto_start_date ? new Date(s.keto_start_date) : new Date();
    const tzOffset = sDate.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(sDate.getTime() - tzOffset)).toISOString().slice(0, 16);
    inStartDate.value = localISOTime;
  }
}

function updateGoalWeightFeedback() {
  const curWeight = parseFloat(document.getElementById('setProfileWeight')?.value) || 80;
  const goalWeight = parseFloat(document.getElementById('setGoalWeight')?.value) || 75;
  const diff = Math.round((curWeight - goalWeight) * 10) / 10;
  const fb = document.getElementById('txtGoalWeightFeedback');
  if (fb) {
    if (diff > 0) {
      fb.textContent = '🎯 Meta: Disminuir ' + diff + ' kg de peso corporal';
      fb.style.color = '#38bdf8';
    } else if (diff < 0) {
      fb.textContent = '🎯 Meta: Ganar ' + Math.abs(diff) + ' kg de peso';
      fb.style.color = '#f59e0b';
    } else {
      fb.textContent = '🎯 Meta: Mantenimiento de peso actual';
      fb.style.color = '#10b981';
    }
  }
}

document.getElementById('setProfileWeight')?.addEventListener('input', updateGoalWeightFeedback);
document.getElementById('setGoalWeight')?.addEventListener('input', updateGoalWeightFeedback);

document.getElementById('btnAutoCalculateMacros')?.addEventListener('click', () => {
  const weight = parseFloat(document.getElementById('setProfileWeight')?.value) || 80;
  const goalWeight = parseFloat(document.getElementById('setGoalWeight')?.value) || 75;
  const age = parseFloat(document.getElementById('setProfileAge')?.value) || 35;
  const height = parseFloat(document.getElementById('setProfileHeight')?.value) || 175;
  const gender = document.getElementById('setProfileGender')?.value || 'male';
  const carbs = parseFloat(document.getElementById('setNetCarbs')?.value) || 25;

  const calculated = calculatePersonalizedTargets({
    weight,
    goal_weight: goalWeight,
    age,
    height,
    gender,
    net_carbs_target: carbs
  });

  document.getElementById('setProtein').value = calculated.protein;
  document.getElementById('setFat').value = calculated.fat;
  document.getElementById('setCalories').value = calculated.calories;
  updateGoalWeightFeedback();

  let msg = '¡Metas recalculadas automáticamente!\n' +
    '• Peso actual: ' + weight + ' kg | Meta: ' + goalWeight + ' kg\n';
  if (calculated.weightToLose > 0) {
    msg += '• Objetivo: Bajar ' + calculated.weightToLose + ' kg (Déficit saludable: -' + calculated.deficit + ' kcal / día)\n';
  } else {
    msg += '• Objetivo: Mantenimiento de peso\n';
  }
  msg += '• Calorías necesarias calculadas: ' + calculated.calories + ' kcal\n' +
    '• Proteínas: ' + calculated.protein + 'g (1.8g/kg para proteger músculo)\n' +
    '• Grasas: ' + calculated.fat + 'g\n' +
    '• Carbos: ' + calculated.netCarbs + 'g';

  alert(msg);
});

document.getElementById('formSettings')?.addEventListener('submit', (e) => {
  e.preventDefault();

  const inStartDate = document.getElementById('setKetoStartDate');
  const startDateIso = inStartDate && inStartDate.value ? new Date(inStartDate.value).toISOString() : (state.settings.keto_start_date || new Date().toISOString());

  const newSettings = {
    weight: parseFloat(document.getElementById('setProfileWeight')?.value) || 80,
    age: parseFloat(document.getElementById('setProfileAge')?.value) || 35,
    height: parseFloat(document.getElementById('setProfileHeight')?.value) || 175,
    gender: document.getElementById('setProfileGender')?.value || 'male',
    goal_weight: parseFloat(document.getElementById('setGoalWeight')?.value) || 75.0,
    net_carbs_target: parseFloat(document.getElementById('setNetCarbs')?.value) || 25,
    protein_target: parseFloat(document.getElementById('setProtein')?.value) || 140,
    fat_target: parseFloat(document.getElementById('setFat')?.value) || 150,
    calories_target: parseFloat(document.getElementById('setCalories')?.value) || 2000,
    keto_start_date: startDateIso
  };

  state.settings = { ...state.settings, ...newSettings };
  localStorage.setItem('ketotrack_settings', JSON.stringify(state.settings));

  // Sincronizar pesaje de hoy en ketotrack_weights
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  let localWeights = JSON.parse(localStorage.getItem('ketotrack_weights') || '[]');
  const existingToday = localWeights.find(w => (w.date || w.timestamp || '').slice(0, 10) === todayStr);
  if (existingToday) {
    existingToday.weight = newSettings.weight;
    existingToday.source = 'Ajustes Perfil';
  } else {
    localWeights.unshift({
      id: Date.now(),
      weight: newSettings.weight,
      date: now.toISOString(),
      source: 'Ajustes Perfil'
    });
  }
  state.weights = localWeights;
  localStorage.setItem('ketotrack_weights', JSON.stringify(localWeights));

  settingsModal.classList.remove('show');
  document.body.classList.remove('modal-open');
  recalculateClientState();
  renderWeightView();
  if (typeof renderWeightComparison === 'function') {
    renderWeightComparison();
  }

  alert('¡Ajustes y metas guardados con éxito!');
});

// Respaldo y Restauración de Datos
document.getElementById('btnExportData')?.addEventListener('click', () => {
  try {
    const backup = {
      app: 'KetoTrack',
      version: '1.1.0',
      exportDate: new Date().toISOString(),
      meals: JSON.parse(localStorage.getItem('ketotrack_meals') || '[]'),
      dailyHistory: JSON.parse(localStorage.getItem('ketotrack_daily_history') || '[]'),
      settings: JSON.parse(localStorage.getItem('ketotrack_settings') || '{}'),
      weights: JSON.parse(localStorage.getItem('ketotrack_weights') || '[]'),
      biomarkers: JSON.parse(localStorage.getItem('ketotrack_biomarkers') || '[]'),
      garminExercises: JSON.parse(localStorage.getItem('ketotrack_garmin_exercises') || '[]')
    };
    const jsonStr = JSON.stringify(backup, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ketotrack-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    alert('¡Copia de seguridad generada y descargada exitosamente!');
  } catch (err) {
    alert('Error al generar copia de seguridad: ' + err.message);
  }
});

document.getElementById('btnImportData')?.addEventListener('click', () => {
  document.getElementById('inputImportBackupFile')?.click();
});

document.getElementById('inputImportBackupFile')?.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const data = JSON.parse(evt.target.result);
      if (!data || typeof data !== 'object') throw new Error('Formato no válido');
      if (data.meals) localStorage.setItem('ketotrack_meals', JSON.stringify(data.meals));
      if (data.dailyHistory) localStorage.setItem('ketotrack_daily_history', JSON.stringify(data.dailyHistory));
      if (data.settings) localStorage.setItem('ketotrack_settings', JSON.stringify(data.settings));
      if (data.weights) localStorage.setItem('ketotrack_weights', JSON.stringify(data.weights));
      if (data.biomarkers) localStorage.setItem('ketotrack_biomarkers', JSON.stringify(data.biomarkers));
      if (data.garminExercises) localStorage.setItem('ketotrack_garmin_exercises', JSON.stringify(data.garminExercises));
      alert('¡Copia de seguridad restaurada con éxito! La aplicación se recargará ahora.');
      window.location.reload();
    } catch (err) {
      alert('Error al restaurar archivo: ' + err.message);
    }
  };
  reader.readAsText(file);
});

// ==========================================================================
// 9. INICIALIZACIÓN
// ==========================================================================
// Handlers para inicio y reseteo del Protocolo Keto
document.getElementById('btnResetProtocolDay')?.addEventListener('click', () => {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  const localISOTime = (new Date(now.getTime() - tzOffset)).toISOString().slice(0, 16);
  const inStartDate = document.getElementById('setKetoStartDate');
  if (inStartDate) inStartDate.value = localISOTime;
  
  state.settings.keto_start_date = now.toISOString();
  localStorage.setItem('ketotrack_settings', JSON.stringify(state.settings));
  recalculateClientState();
  alert('¡Protocolo reiniciado! Hoy es tu Día 1 (En Proceso: Vaciado de Glucógeno).');
});

document.getElementById('btnQuickEditProtocol')?.addEventListener('click', () => {
  if (settingsModal) {
    settingsModal.classList.add('show');
    const inStartDate = document.getElementById('setKetoStartDate');
    if (inStartDate) inStartDate.focus();
  }
});


// ==========================================================================
// 10. HISTORIAL DIARIO Y MOTOR DE GRÁFICAS SUAVIZADAS (SPLINES BÉZIER)
// ==========================================================================

let activeChartRange = 'week'; // 'week' | 'month'
let activeChartMetric = 'steps'; // 'steps' | 'macros' | 'calories'

// Sincroniza datos de hoy en el historial acumulado
function syncTodayToDailyHistory() {
  const now = new Date();
  const todayKey = getLocalDateKey(now);
  let history = JSON.parse(localStorage.getItem('ketotrack_daily_history') || '[]');

  // Si hay fecha de inicio del protocolo, descartar días anteriores al inicio
  const sDate = state.settings?.keto_start_date ? new Date(state.settings.keto_start_date) : null;
  if (sDate && !isNaN(sDate.getTime())) {
    const startDayKey = getLocalDateKey(sDate);
    history = history.filter(h => h.date >= startDayKey);
  }

  // Filtrar ÚNICAMENTE las comidas de HOY
  const todayMeals = (state.meals || []).filter(m => getLocalDateKey(m.timestamp) === todayKey);
  const garmin = state.status?.garmin || JSON.parse(localStorage.getItem('ketotrack_garmin') || '{}');
  
  let netCarbs = 0, fat = 0, protein = 0, calIn = 0;
  for (const m of todayMeals) {
    netCarbs += Number(m.net_carbs || 0);
    fat += Number(m.fat || 0);
    protein += Number(m.protein || 0);
    calIn += Number(m.calories || 0);
  }

  const steps = Number(garmin.steps || 0);
  const calOut = Number(garmin.total_calories || garmin.active_calories || 0);
  const activeCal = Number(garmin.active_calories || 0);
  const ketones = Number(state.status?.ketosis?.estimatedKetones || 0.2);

  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const dayLabel = 'Hoy (' + days[now.getDay()] + ')';

  const todayIndex = history.findIndex(h => h.date === todayKey);
  const todayRecord = {
    date: todayKey,
    day_label: dayLabel,
    steps,
    calories_out: calOut,
    active_calories: activeCal,
    calories_in: Math.round(calIn),
    net_carbs: Math.round(netCarbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    protein: Math.round(protein * 10) / 10,
    ketones,
    exercises: garmin.exercises || []
  };

  if (todayIndex !== -1) {
    history[todayIndex] = todayRecord;
  } else {
    history.push(todayRecord);
  }

  // Cero datos ficticios. 100% datos reales desde el Día 1.
  history.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem('ketotrack_daily_history', JSON.stringify(history));
  return history;
}

// Cero datos ficticios: devuelve solo registros reales
function ensureSeedHistory(history) {
  return history || [];
}

// Dibuja curvas suaves Bézier (Catmull-Rom Spline) en HTML5 Canvas
function drawSmoothSplineOnCanvas(canvas, seriesList, xLabels, options = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);

  const w = rect.width;
  const h = rect.height;
  const padLeft = 45;
  const padRight = 15;
  const padTop = 20;
  const padBottom = 30;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  ctx.clearRect(0, 0, w, h);

  // Encontrar valor máximo para escala Y
  let maxVal = 0;
  for (const s of seriesList) {
    for (const v of s.values) {
      if (v > maxVal) maxVal = v;
    }
  }
  maxVal = Math.max(10, Math.ceil(maxVal * 1.15));

  // Líneas horizontales de guía (Grid)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
  ctx.lineWidth = 1;
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const y = padTop + (plotH / gridSteps) * i;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(w - padRight, y);
    ctx.stroke();

    const val = Math.round(maxVal - (maxVal / gridSteps) * i);
    ctx.fillStyle = '#64748b';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(options.formatY ? options.formatY(val) : val.toLocaleString(), padLeft - 6, y + 3);
  }

  const numPoints = xLabels.length;
  const stepX = numPoints > 1 ? plotW / (numPoints - 1) : (plotW / 2);

  // Dibujar cada serie con curva Bézier suave
  for (const series of seriesList) {
    const points = [];
    for (let i = 0; i < series.values.length; i++) {
      const px = numPoints === 1 ? (padLeft + plotW / 2) : (padLeft + i * stepX);
      const py = padTop + plotH - (series.values[i] / maxVal) * plotH;
      points.push({ x: px, y: py });
    }

    if (points.length === 1) {
      const p = points[0];
      ctx.save();
      ctx.strokeStyle = series.color + '44';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(padLeft, p.y);
      ctx.lineTo(w - padRight, p.y);
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = series.color;
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#0f172a';
      ctx.stroke();

      ctx.fillStyle = series.color;
      ctx.font = 'bold 11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      const valStr = options.formatY ? options.formatY(series.values[0]) : series.values[0];
      ctx.fillText(valStr, p.x, p.y - 12);
      continue;
    }

    if (points.length < 2) continue;

    // 1. Área con degradado suave
    const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
    grad.addColorStop(0, series.color + '44');
    grad.addColorStop(1, series.color + '00');

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i === 0 ? points[0] : points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i + 2 >= points.length ? points[i + 1] : points[i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
    ctx.lineTo(points[points.length - 1].x, padTop + plotH);
    ctx.lineTo(points[0].x, padTop + plotH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // 2. Línea suavizada principal
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i === 0 ? points[0] : points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i + 2 >= points.length ? points[i + 1] : points[i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
    }
    ctx.strokeStyle = series.color;
    ctx.lineWidth = 3;
    ctx.stroke();

    // 3. Puntos circulares
    for (const p of points) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#0f172a';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = series.color;
      ctx.stroke();
    }
  }

  // Etiquetas del Eje X
  ctx.fillStyle = '#94a3b8';
  ctx.font = '10px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  const labelSkip = numPoints > 10 ? Math.ceil(numPoints / 6) : 1;

  for (let i = 0; i < numPoints; i++) {
    if (i % labelSkip === 0 || i === numPoints - 1) {
      const px = numPoints === 1 ? (padLeft + plotW / 2) : (padLeft + i * stepX);
      ctx.fillText(xLabels[i], px, h - 8);
    }
  }
}

// Renderiza la vista de Gráficas completa
function renderChartsView() {
  const history = syncTodayToDailyHistory();
  const count = activeChartRange === 'week' ? 7 : 30;
  const slice = history.slice(-count);

  const xLabels = slice.map(h => {
    const parts = h.date.split('-');
    return parts[2] + '/' + parts[1];
  });

  const legendEl = document.getElementById('chartLegend');
  const canvas = document.getElementById('canvasKetoChart');
  let seriesList = [];
  let formatY = v => v;

  if (activeChartMetric === 'steps') {
    seriesList = [
      { name: 'Pasos Garmin', color: '#10b981', values: slice.map(h => h.steps) },
      { name: 'Gasto Activo (kcal)', color: '#38bdf8', values: slice.map(h => h.calories_out) }
    ];
    formatY = v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : v;
  } else if (activeChartMetric === 'macros') {
    seriesList = [
      { name: 'Carbos Netos (g)', color: '#f59e0b', values: slice.map(h => h.net_carbs) },
      { name: 'Grasas (g)', color: '#10b981', values: slice.map(h => h.fat) },
      { name: 'Proteínas (g)', color: '#38bdf8', values: slice.map(h => h.protein) }
    ];
    formatY = v => v + 'g';
  } else if (activeChartMetric === 'calories') {
    seriesList = [
      { name: 'Calorías Ingeridas', color: '#f59e0b', values: slice.map(h => h.calories_in) },
      { name: 'Calorías Quemadas Garmin', color: '#10b981', values: slice.map(h => h.calories_out) }
    ];
    formatY = v => v + ' kcal';
  }

  // Leyenda interactiva
  if (legendEl) {
    legendEl.innerHTML = seriesList.map(s => `
      <div class="legend-item">
        <span class="legend-dot" style="background-color: ${s.color}"></span>
        <span>${s.name}</span>
      </div>
    `).join('');
  }

  // Resumen promedio del período
  const avgSteps = Math.round(slice.reduce((acc, c) => acc + c.steps, 0) / slice.length);
  const avgCalOut = Math.round(slice.reduce((acc, c) => acc + c.calories_out, 0) / slice.length);
  const avgCarbs = Math.round((slice.reduce((acc, c) => acc + c.net_carbs, 0) / slice.length) * 10) / 10;

  const elStat1 = document.getElementById('valStat1');
  if (elStat1) elStat1.textContent = avgSteps.toLocaleString();

  const elStat2 = document.getElementById('valStat2');
  if (elStat2) elStat2.textContent = avgCalOut.toLocaleString() + ' kcal';

  const elStat3 = document.getElementById('valStat3');
  if (elStat3) elStat3.textContent = avgCarbs + ' g';

  const badgeCount = document.getElementById('badgeHistoryCount');
  if (badgeCount) badgeCount.textContent = slice.length === 1 ? '1 día registrado' : (slice.length + ' días registrados');

  // Dibujar Canvas
  drawSmoothSplineOnCanvas(canvas, seriesList, xLabels, { formatY });

  // Lista detallada día a día
  const historyListEl = document.getElementById('chartHistoryList');
  if (historyListEl) {
    historyListEl.innerHTML = [...slice].reverse().map(h => `
      <div class="history-day-row">
        <div class="history-day-left">
          <span class="history-day-date">📅 ${h.date} (${h.day_label})</span>
          <span class="history-day-detail">${h.steps.toLocaleString()} pasos • ${h.calories_out.toLocaleString()} kcal Garmin</span>
        </div>
        <div class="history-day-metrics">
          <span style="color:#f59e0b">${h.net_carbs}g C</span>
          <span style="color:#10b981">${h.fat}g G</span>
          <span style="color:#38bdf8">${h.protein}g P</span>
        </div>
      </div>
    `).join('');
  }
}

// Configurar listeners de la pestaña de Gráficas
function setupChartsTabListeners() {
  document.getElementById('btnRangeWeek')?.addEventListener('click', () => {
    activeChartRange = 'week';
    document.getElementById('btnRangeWeek')?.classList.add('active');
    document.getElementById('btnRangeMonth')?.classList.remove('active');
    renderChartsView();
  });

  document.getElementById('btnRangeMonth')?.addEventListener('click', () => {
    activeChartRange = 'month';
    document.getElementById('btnRangeMonth')?.classList.add('active');
    document.getElementById('btnRangeWeek')?.classList.remove('active');
    renderChartsView();
  });

  // Botón directo para vaciar historial de esta pantalla y empezar de cero
  document.getElementById('btnClearChartHistory')?.addEventListener('click', () => {
    const conf = confirm('¿Deseas vaciar todo el historial de esta pantalla para empezar de cero?');
    if (!conf) return;

    const now = new Date();
    const todayKey = now.toISOString().slice(0, 10);
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const freshToday = [{
      date: todayKey,
      day_label: 'Hoy (' + days[now.getDay()] + ')',
      steps: Number(state.status?.garmin?.steps || 0),
      calories_out: Number(state.status?.garmin?.active_calories || 0),
      calories_in: 0,
      net_carbs: 0,
      fat: 0,
      protein: 0,
      ketones: 0.2
    }];
    localStorage.setItem('ketotrack_daily_history', JSON.stringify(freshToday));
    renderChartsView();
    alert('¡Historial vaciado! La pantalla ahora comienza limpia desde hoy en Día 1.');
  });

  document.querySelectorAll('.metric-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.metric-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeChartMetric = btn.dataset.metric || 'steps';
      renderChartsView();
    });
  });

  window.addEventListener('resize', () => {
    const tabCharts = document.getElementById('tab-charts');
    if (tabCharts && tabCharts.classList.contains('active')) {
      renderChartsView();
    }
  });
}

// Configurar modal de Iniciar Proceso seguro
function setupStartProcessModal() {
  const modal = document.getElementById('modalStartProcess');
  const btnOpen = document.getElementById('btnOpenStartProcessModal');
  const btnClose = document.getElementById('btnCloseProcessModal');
  const btnCancel = document.getElementById('btnCancelProcessModal');
  const btnKeep = document.getElementById('btnStartKeepHistory');
  const btnReset = document.getElementById('btnStartResetAll');

  btnOpen?.addEventListener('click', () => {
    if (modal) modal.classList.add('show');
  });

  const closeModal = () => {
    if (modal) modal.classList.remove('show');
  };

  btnClose?.addEventListener('click', closeModal);
  btnCancel?.addEventListener('click', closeModal);

  // Función para reiniciar todo a cero absoluto (Día 1 con historial limpio)
  const resetAllToZero = () => {
    const now = new Date();
    state.meals = [];
    localStorage.setItem('ketotrack_meals', JSON.stringify([]));

    // 1. Borrar TODO el historial de la pantalla de gráficas para empezar de cero
    localStorage.removeItem('ketotrack_daily_history');
    const todayKey = now.toISOString().slice(0, 10);
    const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const freshToday = [{
      date: todayKey,
      day_label: 'Hoy (' + days[now.getDay()] + ')',
      steps: Number(state.status?.garmin?.steps || 0),
      calories_out: Number(state.status?.garmin?.active_calories || 0),
      calories_in: 0,
      net_carbs: 0,
      fat: 0,
      protein: 0,
      ketones: 0.2
    }];
    localStorage.setItem('ketotrack_daily_history', JSON.stringify(freshToday));

    // 2. Reiniciar pesajes dejando solo el peso base actual de hoy
    const currentWeight = Number(state.settings.weight || 80.0);
    state.weights = [{
      id: Date.now(),
      weight: currentWeight,
      date: now.toISOString(),
      source: 'Inicio Día 1'
    }];
    localStorage.setItem('ketotrack_weights', JSON.stringify(state.weights));

    // 3. Reiniciar fecha de inicio a hoy
    state.settings.keto_start_date = now.toISOString();
    localStorage.setItem('ketotrack_settings', JSON.stringify(state.settings));

    closeModal();
    renderMealsList([]);
    recalculateClientState();
    renderChartsView();
    if (typeof renderWeightComparison === 'function') renderWeightComparison();
    alert('¡Proceso iniciado desde cero!\n\nSe ha borrado todo el historial de gráficas, comidas y estadísticas anteriores para arrancar limpio en el Día 1 hoy.');
  };

  // Opción 1: Iniciar Proceso Desde Cero (Recomendado)
  btnReset?.addEventListener('click', () => {
    const conf = confirm('¿Confirmas INICIAR EL PROCESO DESDE CERO?\n\nSe vaciará todo el historial de la pantalla de gráficas, las comidas y comenzarás limpio en el Día 1.');
    if (!conf) return;
    resetAllToZero();
  });

  // Opción 2: Iniciar Día 1 conservando historial
  btnKeep?.addEventListener('click', () => {
    const now = new Date();
    state.settings.keto_start_date = now.toISOString();
    localStorage.setItem('ketotrack_settings', JSON.stringify(state.settings));
    closeModal();
    recalculateClientState();
    renderChartsView();
    alert('¡Proceso iniciado hoy en Día 1!\nSe conservó el historial previo.');
  });
}

function setupGarminExerciseModal() {
  const modal = document.getElementById('modalGarminExercise');
  const btnOpen = document.getElementById('btnOpenAddExercise');
  const btnClose = document.getElementById('btnCloseExerciseModal');
  const form = document.getElementById('formGarminExercise');

  if (btnOpen && modal) {
    btnOpen.addEventListener('click', () => {
      modal.classList.add('show');
    });
  }

  if (btnClose && modal) {
    btnClose.addEventListener('click', () => {
      modal.classList.remove('show');
    });
  }

  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.remove('show');
    });
  }

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const type = document.getElementById('selectExerciseType')?.value || 'Musculación / Gimnasio';
      const calInput = document.getElementById('inputExerciseCalories')?.value;
      const durInput = document.getElementById('inputExerciseDuration')?.value;

      const calories = parseFloat(calInput) || 0;
      const duration = parseFloat(durInput) || 0;

      if (calories <= 0) {
        alert('Por favor ingresa una cantidad válida de calorías.');
        return;
      }

      window.addGarminExercise({
        title: type,
        calories: calories,
        duration: duration
      });

      form.reset();
      modal.classList.remove('show');
    });
  }
}

// Sincronizador Oficial y Calibración Garmin Connect Web
function setupOfficialGarminSync() {
  const inPaste = document.getElementById('inputGarminPasteText');
  const btnExtract = document.getElementById('btnGarminAutoExtract');
  const inActive = document.getElementById('inputDirectActiveCal');
  const inResting = document.getElementById('inputDirectRestingCal');
  const lblTotal = document.getElementById('lblDirectTotalCalPreview');
  const btnSave = document.getElementById('btnSaveOfficialGarmin');
  const linkWeb = document.getElementById('linkGarminWeb');

  // Actualizar enlace con la fecha local de hoy
  if (linkWeb) {
    const todayKey = getLocalDateKey(new Date());
    linkWeb.href = `https://connect.garmin.com/app/calories/${todayKey}/0`;
  }

  const updatePreview = () => {
    const act = parseFloat(inActive?.value) || 0;
    const rest = parseFloat(inResting?.value) || 0;
    const tot = Math.round(act + rest);
    if (lblTotal) lblTotal.textContent = tot.toLocaleString() + ' kcal';
  };

  inActive?.addEventListener('input', updatePreview);
  inResting?.addEventListener('input', updatePreview);

  // Extracción inteligente de texto copiado de Garmin Connect (ej. "779 + 1,058 = 1,837")
  btnExtract?.addEventListener('click', () => {
    const text = inPaste?.value || '';
    if (!text.trim()) {
      alert('Pega primero el texto copiado de Garmin Connect en el campo.');
      return;
    }

    const clean = text.replace(/,/g, '');
    const matches = clean.match(/\b\d{2,6}\b/g);
    if (!matches || matches.length < 2) {
      alert('No se detectaron números. Por favor escribe directamente los valores en los campos.');
      return;
    }

    const nums = matches.map(n => parseInt(n, 10)).filter(n => n >= 50 && n <= 25000);
    let detected = null;

    // Buscar terna A + B ≈ C
    for (let i = 0; i < nums.length; i++) {
      for (let j = 0; j < nums.length; j++) {
        if (i === j) continue;
        for (let k = 0; k < nums.length; k++) {
          if (k === i || k === j) continue;
          if (Math.abs((nums[i] + nums[j]) - nums[k]) <= 3) {
            detected = {
              active: Math.min(nums[i], nums[j]),
              resting: Math.max(nums[i], nums[j]),
              total: nums[k]
            };
            break;
          }
        }
        if (detected) break;
      }
      if (detected) break;
    }

    if (!detected && nums.length >= 2) {
      detected = {
        active: nums[0],
        resting: nums[1],
        total: nums[0] + nums[1]
      };
    }

    if (detected) {
      if (inActive) inActive.value = detected.active;
      if (inResting) inResting.value = detected.resting;
      updatePreview();
      alert(`¡Valores oficiales extraídos de Garmin!\n\n• Activas: ${detected.active.toLocaleString()} kcal\n• Reposo: ${detected.resting.toLocaleString()} kcal\n• Total: ${detected.total.toLocaleString()} kcal`);
    } else {
      alert('No se pudieron extraer los valores con certeza. Ingrésalos manualmente en los campos.');
    }
  });

  btnSave?.addEventListener('click', () => {
    const active = parseFloat(inActive?.value) || 0;
    const resting = parseFloat(inResting?.value) || 0;
    const total = active + resting;

    if (total <= 0) {
      alert('Por favor ingresa al menos las calorías activas o las de reposo.');
      return;
    }

    const now = new Date();
    const todayKey = getLocalDateKey(now);
    const garmin = JSON.parse(localStorage.getItem('ketotrack_garmin') || '{}');

    // Calibrar BMR diario real de Garmin basado en las horas transcurridas
    const elapsedHours = Math.max(0.5, now.getHours() + (now.getMinutes() / 60));
    const estimatedDailyBmr = Math.round((resting / elapsedHours) * 24);
    if (estimatedDailyBmr >= 1200 && estimatedDailyBmr <= 3500) {
      state.settings.garmin_daily_bmr = estimatedDailyBmr;
      localStorage.setItem('ketotrack_settings', JSON.stringify(state.settings));
    }

    garmin.date = todayKey;
    garmin.active_calories = Math.round(active);
    garmin.bmr_calories = Math.round(resting);
    garmin.total_calories = Math.round(total);
    garmin.is_official = true;
    garmin.source = 'Garmin Connect Web Oficial';
    garmin.timestamp = now.toISOString();

    state.status.garmin = garmin;
    localStorage.setItem('ketotrack_garmin', JSON.stringify(garmin));

    recalculateClientState();
    syncTodayToDailyHistory();
    renderGarminView(garmin);
    renderChartsView();

    alert(`✅ ¡Métricas oficiales aplicadas con éxito!\n\n• Calorías Activas: ${Math.round(active).toLocaleString()} kcal\n• En Reposo: ${Math.round(resting).toLocaleString()} kcal\n• Gasto Total: ${Math.round(total).toLocaleString()} kcal\n• BMR Diario Calibrado: ~${estimatedDailyBmr} kcal/día\n\nTu balance calórico y cetosis ya coinciden exactamente con tu reloj.`);
  });
}

async function initApp() {
  checkAndPerformDailyRollover();
  loadSettings();
  loadWeights();
  loadMeals();
  recalculateClientState();
  setupChartsTabListeners();
  setupWeightChartListeners();
  setupStartProcessModal();
  setupGarminExerciseModal();
  setupOfficialGarminSync();
  syncTodayToDailyHistory();
  if (typeof renderWeightComparison === 'function') {
    renderWeightComparison();
  }

  // Intervalo continuo cada 30s y al cambiar visibilidad para detectar medianoche (12 hs / cambio de día)
  setInterval(() => {
    if (checkAndPerformDailyRollover()) {
      recalculateClientState();
      loadMeals();
      renderChartsView();
    }
  }, 30000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      if (checkAndPerformDailyRollover()) {
        recalculateClientState();
        loadMeals();
        renderChartsView();
      }
    }
  });
}

window.addEventListener('DOMContentLoaded', initApp);
try { initApp(); } catch (e) {}
