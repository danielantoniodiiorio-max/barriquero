/**
 * Motor de Cálculo Metabólico Cetogénico
 * Integra ingesta de carbohidratos netos con gasto calórico activo de Garmin.
 */

function calculateDailyMacros(meals, settings) {
  let totalNetCarbs = 0;
  let totalCarbs = 0;
  let totalFiber = 0;
  let totalProtein = 0;
  let totalFat = 0;
  let totalCalories = 0;

  for (const m of meals) {
    totalCarbs += Number(m.carbs || 0);
    totalFiber += Number(m.fiber || 0);
    totalNetCarbs += Number(m.net_carbs || 0);
    totalProtein += Number(m.protein || 0);
    totalFat += Number(m.fat || 0);
    totalCalories += Number(m.calories || 0);
  }

  // Calculate caloric contributions from macros
  const fatCalories = totalFat * 9;
  const proteinCalories = totalProtein * 4;
  const carbCalories = totalNetCarbs * 4;
  const macroCaloriesSum = fatCalories + proteinCalories + carbCalories;

  const fatRatio = macroCaloriesSum > 0 ? Math.round((fatCalories / macroCaloriesSum) * 100) : 0;
  const proteinRatio = macroCaloriesSum > 0 ? Math.round((proteinCalories / macroCaloriesSum) * 100) : 0;
  const carbRatio = macroCaloriesSum > 0 ? Math.round((carbCalories / macroCaloriesSum) * 100) : 0;

  const netCarbTarget = Number(settings.net_carbs_target || 25);
  const proteinTarget = Number(settings.protein_target || 90);
  const fatTarget = Number(settings.fat_target || 140);
  const calorieTarget = Number(settings.calories_target || 1800);

  const carbLimitExceeded = totalNetCarbs > netCarbTarget;
  const carbRemaining = Math.max(0, netCarbTarget - totalNetCarbs);

  return {
    totals: {
      carbs: Math.round(totalCarbs * 10) / 10,
      fiber: Math.round(totalFiber * 10) / 10,
      netCarbs: Math.round(totalNetCarbs * 10) / 10,
      protein: Math.round(totalProtein * 10) / 10,
      fat: Math.round(totalFat * 10) / 10,
      calories: Math.round(totalCalories)
    },
    ratios: {
      fat: fatRatio,
      protein: proteinRatio,
      carbs: carbRatio
    },
    targets: {
      netCarbs: netCarbTarget,
      protein: proteinTarget,
      fat: fatTarget,
      calories: calorieTarget
    },
    status: {
      carbLimitExceeded,
      carbRemaining: Math.round(carbRemaining * 10) / 10,
      isKetoCompliant: !carbLimitExceeded && (fatRatio >= 60 || totalCalories === 0)
    }
  };
}

function calculateKetosisState(recentMeals, garminMetrics, settings) {
  const now = new Date();
  const netCarbTarget = Number(settings.net_carbs_target || 25);
  const activeCalories = Number(garminMetrics.active_calories || 0);

  // Sort meals chronologically ascending
  const sortedMeals = [...recentMeals].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Determine hours since last carb spike (> 10g net carbs) or last meal
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

  // Baseline time elapsed
  let hoursFastingOrKeto = 18; // Default initial assumption if no meals logged
  if (lastCarbTimestamp) {
    const diffMs = now.getTime() - lastCarbTimestamp.getTime();
    hoursFastingOrKeto = Math.max(0, diffMs / (1000 * 60 * 60));
  } else if (sortedMeals.length > 0) {
    const firstMealTime = new Date(sortedMeals[0].timestamp).getTime();
    hoursFastingOrKeto = Math.max(0, (now.getTime() - firstMealTime) / (1000 * 60 * 60));
  }

  // Model: Liver Glycogen depletion
  // Max liver glycogen = ~110g.
  // Basal burn = ~3.8g/hour.
  // Garmin active burn boost: each 100 active kcal burns ~3.2g glycogen equivalent.
  const garminGlycogenBurn = (activeCalories / 100) * 3.2;
  const basalGlycogenBurn = hoursFastingOrKeto * 3.8;
  const netCarbsAdded = Math.min(100, totalNetCarbsLast24h);

  let remainingGlycogen = Math.max(0, Math.min(110, 80 + netCarbsAdded - basalGlycogenBurn - garminGlycogenBurn));

  // If carbs heavily exceeded target today, replenish glycogen
  if (totalNetCarbsLast24h > netCarbTarget * 1.5) {
    remainingGlycogen = Math.min(110, remainingGlycogen + 40);
  }

  let phase = 1;
  let phaseName = 'Digestión / Glucosa Primaria';
  let phaseDesc = 'El cuerpo utiliza glucosa circulante y glucógeno hepático disponible como combustible.';
  let estimatedKetones = 0.2;
  let statusColor = '#f97316'; // orange
  let timeToNextPhase = null;

  const currentBurnRatePerHour = 3.8 + ((activeCalories / 16) / 100) * 3.2; // grams per hour

  if (remainingGlycogen > 60) {
    phase = 1;
    phaseName = 'Fase 1: Digestión / Uso de Glucosa';
    phaseDesc = 'Niveles de glucógeno elevados. Aún no hay producción significativa de cetonas.';
    estimatedKetones = 0.1 + (Math.random() * 0.1);
    statusColor = '#ef4444';
    const gramsToDrop = remainingGlycogen - 60;
    timeToNextPhase = Math.round((gramsToDrop / currentBurnRatePerHour) * 10) / 10;
  } else if (remainingGlycogen > 20) {
    phase = 2;
    phaseName = 'Fase 2: Depleción Activa de Glucógeno';
    phaseDesc = 'Tus reservas de glucógeno hepático se están vaciando aceleradamente gracias a tu gasto basal y pasos de Garmin.';
    estimatedKetones = 0.3 + ((60 - remainingGlycogen) / 40) * 0.2;
    statusColor = '#f59e0b';
    const gramsToDrop = remainingGlycogen - 20;
    timeToNextPhase = Math.round((gramsToDrop / currentBurnRatePerHour) * 10) / 10;
  } else if (remainingGlycogen > 5) {
    phase = 3;
    phaseName = 'Fase 3: Inicio de Cetogénesis';
    phaseDesc = 'Glucógeno casi agotado. Tu hígado está convirtiendo ácidos grasos en beta-hidroxibutirato.';
    estimatedKetones = 0.5 + ((20 - remainingGlycogen) / 15) * 0.5;
    statusColor = '#06b6d4';
    const gramsToDrop = remainingGlycogen - 5;
    timeToNextPhase = Math.round((gramsToDrop / currentBurnRatePerHour) * 10) / 10;
  } else {
    phase = 4;
    phaseName = 'Fase 4: Cetosis Nutricional Óptima';
    phaseDesc = '¡En plena cetosis nutricional! Máxima utilización de grasas como combustible primario y claridad mental.';
    estimatedKetones = 1.0 + Math.min(1.5, (hoursFastingOrKeto - 20) * 0.05);
    statusColor = '#10b981';
    timeToNextPhase = 0; // Objetivo alcanzado
  }

  // Calculate Garmin boost time saved
  // Hours saved = garminGlycogenBurn / 3.8
  const hoursSavedByGarmin = Math.round((garminGlycogenBurn / 3.8) * 10) / 10;

  return {
    phase,
    phaseName,
    phaseDesc,
    estimatedKetones: Math.round(estimatedKetones * 10) / 10,
    glycogenRemainingGrams: Math.round(remainingGlycogen * 10) / 10,
    glycogenPercentage: Math.round((remainingGlycogen / 110) * 100),
    hoursFastingOrKeto: Math.round(hoursFastingOrKeto * 10) / 10,
    timeToNextPhaseHours: timeToNextPhase,
    statusColor,
    garminImpact: {
      activeCalories,
      extraGlycogenBurnGrams: Math.round(garminGlycogenBurn * 10) / 10,
      hoursSaved: hoursSavedByGarmin
    }
  };
}

module.exports = {
  calculateDailyMacros,
  calculateKetosisState
};
