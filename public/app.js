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
function estimateMealMacrosAI(input) {
  if (!input || !input.trim()) return null;
  const text = input.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // normalizar tildes

  let totalCarbs = 0;
  let totalFiber = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCalories = 0;
  let detectedItems = [];

  function extractQty(regex, defaultVal = 1) {
    const match = text.match(regex);
    if (!match) return 0;
    const num = parseFloat(match[1]);
    return isNaN(num) ? defaultVal : num;
  }

  // Huevos
  if (text.includes("huevo") || text.includes("omelette") || text.includes("revuelto")) {
    let count = extractQty(/(\d+)\s*(?:huevos?|claras?)/, 2);
    if (count === 0) count = 2;
    totalProtein += count * 6.5;
    totalFat += count * 5.2;
    totalCarbs += count * 0.6;
    totalCalories += count * 78;
    detectedItems.push(count + " huevos");
  }

  // Milanesas (evaluadas antes de pollo/carne cruda)
  const isMilanesa = text.includes("milanesa") || text.includes("suprema");
  if (isMilanesa) {
    let count = extractQty(/(\d+)\s*milanesas?/, 1);
    if (count === 0) count = 1;
    totalCarbs += count * 18;
    totalFiber += count * 1;
    totalProtein += count * 24;
    totalFat += count * 14;
    totalCalories += count * 310;
    detectedItems.push(count + " milanesa(s)");
  }

  // Carnes Rojas (si no es milanesa de carne)
  if (!isMilanesa && (text.includes("bife") || text.includes("asado") || text.includes("lomo") || text.includes("vacio") || 
      text.includes("carne") || text.includes("entrecot") || text.includes("costilla") || text.includes("hamburguesa"))) {
    let grams = extractQty(/(\d+)\s*(?:g|gr|gramos)\s*(?:de\s*)?(?:bife|carne|lomo|asado)?/, 250);
    if (grams < 30) grams = grams * 100;
    if (grams === 0 || grams > 1500) grams = 250;
    totalProtein += (grams / 100) * 26;
    totalFat += (grams / 100) * 18;
    totalCalories += (grams / 100) * 270;
    detectedItems.push(grams + "g carne vacuna");
  }

  // Pollo / Aves (si no es milanesa de pollo)
  if (!isMilanesa && (text.includes("pollo") || text.includes("pechuga") || text.includes("pata muslo"))) {
    let grams = extractQty(/(\d+)\s*(?:g|gr|gramos)\s*(?:de\s*)?(?:pollo|pechuga)?/, 200);
    if (grams < 20) grams = grams * 100;
    if (grams === 0 || grams > 1500) grams = 200;
    totalProtein += (grams / 100) * 29;
    totalFat += (grams / 100) * 7.5;
    totalCalories += (grams / 100) * 185;
    detectedItems.push(grams + "g pollo");
  }

  // Pescado / Atun / Salmon
  if (text.includes("salmon") || text.includes("atun") || text.includes("pescado") || text.includes("merluza")) {
    let grams = extractQty(/(\d+)\s*(?:g|gr|gramos)/, 180);
    if (grams < 20) grams = grams * 100;
    if (grams === 0 || grams > 1000) grams = 180;
    const isFatty = text.includes("salmon");
    totalProtein += (grams / 100) * 23;
    totalFat += (grams / 100) * (isFatty ? 13 : 2);
    totalCalories += (grams / 100) * (isFatty ? 210 : 110);
    detectedItems.push(grams + "g pescado");
  }

  // Palta / Aguacate
  if (text.includes("palta") || text.includes("aguacate")) {
    let units = 1;
    if (text.includes("media") || text.includes("1/2") || text.includes("medio")) units = 0.5;
    else units = extractQty(/(\d+)\s*(?:paltas?|aguacates?)/, 1);
    totalCarbs += units * 12;
    totalFiber += units * 9.2;
    totalProtein += units * 2.8;
    totalFat += units * 22;
    totalCalories += units * 240;
    detectedItems.push(units + " palta");
  }

  // Queso
  if (text.includes("queso") || text.includes("muzzarella") || text.includes("mozzarella") || text.includes("cheddar") || text.includes("parmesano")) {
    let grams = extractQty(/(\d+)\s*(?:g|gr|gramos)\s*(?:de\s*)?queso/, 60);
    if (grams < 10) grams = grams * 30;
    if (grams === 0 || grams > 500) grams = 60;
    totalProtein += (grams / 100) * 23;
    totalFat += (grams / 100) * 28;
    totalCarbs += (grams / 100) * 1.8;
    totalCalories += (grams / 100) * 350;
    detectedItems.push(grams + "g queso");
  }

  // Manteca / Mantequilla / Ghee
  if (text.includes("manteca") || text.includes("mantequilla") || text.includes("ghee")) {
    let grams = extractQty(/(\d+)\s*(?:g|gr|gramos)\s*(?:de\s*)?manteca/, 20);
    if (grams === 0 || grams > 200) grams = 20;
    totalFat += grams * 0.82;
    totalCalories += grams * 7.2;
    detectedItems.push(grams + "g manteca");
  }

  // Aceite (oliva, coco, mct)
  if (text.includes("aceite") || text.includes("oliva") || text.includes("mct")) {
    let spoons = extractQty(/(\d+)\s*(?:cda|cucharada|cucharadas)/, 1);
    if (spoons === 0) spoons = 1;
    totalFat += spoons * 14;
    totalCalories += spoons * 120;
    detectedItems.push(spoons + " cda aceite");
  }

  // Panceta / Bacon / Jamon
  if (text.includes("panceta") || text.includes("bacon") || text.includes("tocino") || text.includes("jamon")) {
    let grams = extractQty(/(\d+)\s*(?:g|gr|gramos|fetas)/, 50);
    if (grams < 10) grams = grams * 20;
    if (grams === 0 || grams > 300) grams = 50;
    totalProtein += (grams / 100) * 15;
    totalFat += (grams / 100) * 36;
    totalCarbs += (grams / 100) * 1;
    totalCalories += (grams / 100) * 390;
    detectedItems.push(grams + "g panceta/bacon");
  }

  // Ensalada / Verduras de hoja verde
  if (text.includes("ensalada") || text.includes("rucula") || text.includes("lechuga") || text.includes("espinaca") || text.includes("pepino")) {
    totalCarbs += 3.5;
    totalFiber += 2.2;
    totalProtein += 1.5;
    totalFat += 0.4;
    totalCalories += 25;
    detectedItems.push("ensalada verde");
  }

  // Tomate
  if (text.includes("tomate")) {
    totalCarbs += 4.5;
    totalFiber += 1.5;
    totalProtein += 1;
    totalFat += 0.2;
    totalCalories += 22;
    detectedItems.push("tomate");
  }

  // Frutos Secos
  if (text.includes("nuez") || text.includes("nueces") || text.includes("almendra") || text.includes("almendras") || text.includes("mani")) {
    let grams = extractQty(/(\d+)\s*(?:g|gr|gramos)/, 35);
    if (grams === 0 || grams > 200) grams = 35;
    totalCarbs += (grams / 100) * 14;
    totalFiber += (grams / 100) * 7;
    totalProtein += (grams / 100) * 18;
    totalFat += (grams / 100) * 55;
    totalCalories += (grams / 100) * 610;
    detectedItems.push(grams + "g frutos secos");
  }

  // Café Bulletproof
  if (text.includes("bulletproof") || text.includes("cafe con manteca")) {
    totalFat += 24;
    totalCalories += 220;
    detectedItems.push("café bulletproof");
  }

  // Fallback si no hubo coincidencia específica
  if (detectedItems.length === 0) {
    totalCarbs = 2.5;
    totalFiber = 1;
    totalProtein = 28;
    totalFat = 22;
    totalCalories = 320;
    detectedItems.push("plato proteico keto");
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

  return {
    name: input.trim(),
    carbs: roundedCarbs,
    fiber: roundedFiber,
    net_carbs: netCarbs,
    protein: roundedProtein,
    fat: roundedFat,
    calories: roundedCalories,
    detected: detectedItems.join(" + ")
  };
}

// Botón de Cálculo IA en el Formulario de Comida
document.getElementById('btnAiCalc')?.addEventListener('click', async () => {
  const mealName = (document.getElementById('inputMealName')?.value || '').trim();
  if (!mealName) {
    alert('Escribe el nombre o ingredientes de lo que comiste (ej. Bife con ensalada y 2 huevos).');
    document.getElementById('inputMealName')?.focus();
    return;
  }

  const feedback = document.getElementById('aiCalcFeedback');
  if (feedback) {
    feedback.style.display = 'block';
    feedback.innerHTML = '<span>🤖</span> <em>Calculando macronutrientes y calorías con IA...</em>';
  }

  const result = estimateMealMacrosAI(mealName);
  if (result) {
    document.getElementById('inputCarbs').value = result.carbs;
    document.getElementById('inputFiber').value = result.fiber;
    document.getElementById('inputProtein').value = result.protein;
    document.getElementById('inputFat').value = result.fat;
    document.getElementById('inputCalories').value = result.calories;

    if (feedback) {
      feedback.innerHTML = '<strong>✨ IA calculó:</strong> ' + result.detected + '<br>' +
        '<span>👉 ' + result.net_carbs + 'g carbos netos • ' + result.fat + 'g grasa • ' + result.protein + 'g prot • ' + result.calories + ' kcal</span>';
    }
  }
});

// ==========================================================================
// 3. MOTOR DE CETOSIS Y MACROS CLIENTE
// ==========================================================================
function calculateDailyMacrosClient(meals, settings) {
  let totalNetCarbs = 0;
  let totalCarbs = 0;
  let totalFiber = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCalories = 0;

  for (const m of (meals || [])) {
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
  const savedSettings = JSON.parse(localStorage.getItem('ketotrack_settings') || '{}');
  const savedGarmin = JSON.parse(localStorage.getItem('ketotrack_garmin') || '{"active_calories":0,"steps":0,"resting_hr":60,"source":"health_connect"}');
  const savedMeals = JSON.parse(localStorage.getItem('ketotrack_meals') || '[]');

  state.settings = { ...state.settings, ...savedSettings };
  state.meals = savedMeals;
  const garmin = state.status?.garmin || savedGarmin;

  const macros = calculateDailyMacrosClient(state.meals, state.settings);
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
window.applyGarminMetrics = function(arg1, arg2, arg3, arg4) {
  let steps = 0, activeCalories = 0, restingHr = 60, source = 'Health Connect (Garmin)';
  if (typeof arg1 === 'object' && arg1 !== null) {
    steps = arg1.steps || 0;
    activeCalories = arg1.activeCalories || arg1.active_calories || 0;
    restingHr = arg1.heartRate || arg1.resting_hr || 60;
    source = arg1.source || 'Health Connect (Garmin)';
  } else {
    steps = arg1 || 0;
    activeCalories = arg2 || 0;
    restingHr = arg3 || 60;
    source = arg4 || 'Health Connect (Garmin)';
  }

  const now = new Date();
  const elapsedHours = Math.max(0.1, now.getHours() + (now.getMinutes() / 60));
  const dailyBmr = 2192; // Calibrado para Garmin Instinct
  const restingSoFar = Math.round((dailyBmr / 24) * elapsedHours);
  const numActive = Number(activeCalories) || 0;
  const totalCaloriesSoFar = restingSoFar + numActive;

  const garmin = {
    active_calories: numActive,
    steps: Number(steps) || 0,
    resting_hr: Number(restingHr) || 60,
    bmr_calories: restingSoFar,
    daily_bmr: dailyBmr,
    total_calories: totalCaloriesSoFar,
    source: source,
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

  // 2. BALANCE CALÓRICO Y TERMÓMETRO (LIMPIO, SIN DESBORDES)
  const caloriesIn = Math.round(macros.totals.calories || 0);
  const caloriesOut = Math.round(garmin.total_calories || (garmin.bmr_calories + garmin.active_calories) || 0);
  const targetCalories = Math.round(macros.targets.calories || 1800);
  const calRemaining = targetCalories - caloriesIn;
  const isOverLimit = caloriesIn > targetCalories;
  const calPercent = targetCalories > 0 ? Math.round((caloriesIn / targetCalories) * 100) : 0;

  const elCalIn = document.getElementById('valCalIn');
  if (elCalIn) elCalIn.innerHTML = caloriesIn.toLocaleString() + ' <small>kcal</small>';

  const elCalTarget = document.getElementById('valCalTarget');
  if (elCalTarget) elCalTarget.innerHTML = targetCalories.toLocaleString() + ' <small>kcal</small>';

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

  // Termómetro minimalista
  const elThermoPercent = document.getElementById('valThermometerPercent');
  if (elThermoPercent) {
    if (isOverLimit) {
      elThermoPercent.textContent = '⚠️ ¡' + calPercent + '%! (Exceso +' + Math.abs(calRemaining) + ' kcal)';
      elThermoPercent.style.color = '#ef4444';
    } else {
      elThermoPercent.textContent = calPercent + '%';
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
    lblGarmin.textContent = '⌚ Garmin: ' + caloriesOut.toLocaleString() + ' kcal quemadas hoy';
  }

  const badgeCalFeedback = document.getElementById('badgeCalFeedback');
  if (badgeCalFeedback) {
    if (isOverLimit) {
      const extraStepsNeeded = Math.round(Math.abs(calRemaining) / 0.0342);
      badgeCalFeedback.textContent = '🚨 Exceso: +' + Math.abs(calRemaining) + ' kcal (~' + extraStepsNeeded.toLocaleString() + ' pasos Garmin)';
      badgeCalFeedback.className = 'feedback-badge badge-danger';
    } else if (calPercent >= 80) {
      badgeCalFeedback.textContent = '⚡ Cerca del Límite (' + calRemaining + ' kcal)';
      badgeCalFeedback.className = 'feedback-badge badge-warning';
    } else {
      badgeCalFeedback.textContent = '✅ En Déficit Óptimo';
      badgeCalFeedback.className = 'feedback-badge badge-optimal';
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
  document.getElementById('valNetCarbs').textContent = macros.totals.netCarbs;
  document.getElementById('targetNetCarbs').textContent = macros.targets.netCarbs;
  const carbPct = Math.min(100, (macros.totals.netCarbs / macros.targets.netCarbs) * 100);
  const barNetCarbs = document.getElementById('barNetCarbs');
  barNetCarbs.style.width = carbPct + '%';
  
  const badgeCarb = document.getElementById('badgeCarbStatus');
  if (badgeCarb) {
    if (macros.status.carbLimitExceeded) {
      badgeCarb.textContent = '¡Límite Superado!';
      badgeCarb.style.color = 'var(--accent-red)';
      barNetCarbs.style.background = 'var(--accent-red)';
    } else {
      badgeCarb.textContent = macros.status.carbRemaining + 'g restantes';
      badgeCarb.style.color = 'var(--accent-green)';
      barNetCarbs.style.background = 'var(--accent-amber)';
    }
  }

  document.getElementById('valFat').textContent = macros.totals.fat;
  document.getElementById('targetFat').textContent = macros.targets.fat;
  document.getElementById('barFat').style.width = Math.min(100, (macros.totals.fat / macros.targets.fat) * 100) + '%';

  document.getElementById('valProtein').textContent = macros.totals.protein;
  document.getElementById('targetProtein').textContent = macros.targets.protein;
  document.getElementById('barProtein').style.width = Math.min(100, (macros.totals.protein / macros.targets.protein) * 100) + '%';

  // Ratios calóricos
  document.getElementById('ratioFat').textContent = macros.ratios.fat + '%';
  document.getElementById('ratioProtein').textContent = macros.ratios.protein + '%';
  document.getElementById('ratioCarbs').textContent = macros.ratios.carbs + '%';
}

// ==========================================================================
// 5. RENDER GARMIN VIEW (LIMPIO, MINIMALISTA Y AUTOMATIZADO)
// ==========================================================================
function renderGarminView(garmin) {
  document.getElementById('garminActiveCal').textContent = garmin.active_calories || 0;
  document.getElementById('garminSteps').textContent = (garmin.steps || 0).toLocaleString();
  document.getElementById('garminRestingHr').textContent = (garmin.resting_hr || '--') + ' bpm';
  document.getElementById('garminTotalCal').textContent = garmin.total_calories || 0;

  const sourceBadge = document.getElementById('garminSourceBadge');
  if (sourceBadge) {
    sourceBadge.textContent = 'Health Connect (Garmin) ✓';
    sourceBadge.style.backgroundColor = '#10b981';
  }
}

// ==========================================================================
// 6. HISTORIAL DE COMIDAS CON FECHA, HORA Y BORRADO DIRECTO
// ==========================================================================
async function loadMeals() {
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
  if (!meals || meals.length === 0) {
    container.innerHTML = '<p class="text-muted text-center" style="padding:20px 0;">No hay comidas registradas hoy.</p>';
    return;
  }

  container.innerHTML = meals.map(m => {
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

  const carbs = parseFloat(document.getElementById('inputCarbs')?.value) || 0;
  const fiber = parseFloat(document.getElementById('inputFiber')?.value) || 0;
  const protein = parseFloat(document.getElementById('inputProtein')?.value) || 0;
  const fat = parseFloat(document.getElementById('inputFat')?.value) || 0;
  let calories = parseFloat(document.getElementById('inputCalories')?.value);

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
  const todayKey = now.toISOString().slice(0, 10);
  let history = JSON.parse(localStorage.getItem('ketotrack_daily_history') || '[]');

  // Si hay fecha de inicio del protocolo, descartar días anteriores al inicio
  const sDate = state.settings?.keto_start_date ? new Date(state.settings.keto_start_date) : null;
  if (sDate && !isNaN(sDate.getTime())) {
    const startDayKey = sDate.toISOString().slice(0, 10);
    history = history.filter(h => h.date >= startDayKey);
  }

  // Calcular métricas de hoy
  const meals = state.meals || [];
  const garmin = state.status?.garmin || JSON.parse(localStorage.getItem('ketotrack_garmin') || '{}');
  
  let netCarbs = 0, fat = 0, protein = 0, calIn = 0;
  for (const m of meals) {
    netCarbs += Number(m.net_carbs || 0);
    fat += Number(m.fat || 0);
    protein += Number(m.protein || 0);
    calIn += Number(m.calories || 0);
  }

  const steps = Number(garmin.steps || 0);
  const calOut = Number(garmin.total_calories || garmin.active_calories || 0);
  const ketones = Number(state.status?.ketosis?.estimatedKetones || 0.2);

  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const dayLabel = 'Hoy (' + days[now.getDay()] + ')';

  const todayIndex = history.findIndex(h => h.date === todayKey);
  const todayRecord = {
    date: todayKey,
    day_label: dayLabel,
    steps,
    calories_out: calOut,
    calories_in: Math.round(calIn),
    net_carbs: Math.round(netCarbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    protein: Math.round(protein * 10) / 10,
    ketones
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

async function initApp() {
  loadSettings();
  loadWeights();
  loadMeals();
  recalculateClientState();
  setupChartsTabListeners();
  setupWeightChartListeners();
  setupStartProcessModal();
  syncTodayToDailyHistory();
  if (typeof renderWeightComparison === 'function') {
    renderWeightComparison();
  }
}

window.addEventListener('DOMContentLoaded', initApp);
try { initApp(); } catch (e) {}
