/**
 * KETOTRACK v4.0 - MOTOR BIOENERGÉTICO REFACTORIZADO
 * Alineado al consenso de la literatura médica actual (Kevin Hall / NIH, George Cahill, Jørgen Jensen, Brooks & Mercier).
 * 
 * Directivas Implementadas:
 * 1. Desacoplamiento Bicompartimental: Glucógeno Hepático (G_H) vs Muscular (G_M).
 * 2. 0 kcal de bono ficticio: TEF dinámico de macronutrientes reales y densidad de triglicéridos (9.1 kcal/g).
 * 3. Cinética Sigmoidal de Hill para CPT-1 e intervalos de confianza para BOHB en sangre.
 * 4. Módulo GLUT4 para transgresiones (Cheat Meal): Estimación del tiempo de reapertura lipolítica.
 */

class MetabolicBioenergeticsV4 {

  /**
   * MÓDULO 1: Metabolismo Basal (BMR) y TDEE Dinámico
   */
  static calculateEnergyExpenditure(profile, mealsToday, garminActiveCalories, daysInDeficit = 0) {
    const weightKg = Number(profile.weight || 80.0);
    const heightCm = Number(profile.height || 175.0);
    const ageYears = Number(profile.age || 35);
    const gender = profile.gender || 'male';
    const bodyFatPct = profile.body_fat_pct != null ? Number(profile.body_fat_pct) : null;

    // 1.1 Gasto Metabólico Basal (BMR)
    let bmr = 0;
    if (bodyFatPct !== null && bodyFatPct > 3 && bodyFatPct < 60) {
      // Ecuación de Katch-McArdle basada en Masa Libre de Grasa (FFM)
      const ffmKg = weightKg * (1 - (bodyFatPct / 100));
      bmr = 370 + (21.6 * ffmKg);
    } else {
      // Ecuación de Mifflin-St Jeor (1990)
      bmr = (10 * weightKg) + (6.25 * heightCm) - (5 * ageYears) + (gender === 'female' ? -161 : 5);
    }

    // 1.2 Efecto Térmico de los Alimentos (TEF Dinámico)
    let totalP = 0, totalC = 0, totalF = 0, totalCalIn = 0;
    for (const m of (mealsToday || [])) {
      totalP += Number(m.protein || 0);
      totalC += Number(m.net_carbs != null ? m.net_carbs : (m.netCarbs != null ? m.netCarbs : (Number(m.carbs || 0) - Number(m.fiber || 0))));
      totalF += Number(m.fat || 0);
      totalCalIn += Number(m.calories || 0);
    }

    // Coeficientes TEF: Proteína 25%, Carbohidratos 8%, Grasas 2%
    const tef = (totalP * 4 * 0.25) + (totalC * 4 * 0.08) + (totalF * 9 * 0.02);

    // 1.3 Termogénesis Adaptativa (Kevin Hall NIH 2011/2012)
    // Reducción adaptativa progresiva de hasta 15% tras déficits crónicos sostenidos (> 14 días)
    const adaptationFactor = daysInDeficit > 14 ? Math.min(0.15, (daysInDeficit - 14) * 0.005) : 0;
    const metabolicAdaptationKcal = bmr * adaptationFactor;

    // 1.4 Gasto Total Dinámico (TDEE)
    const activeCal = Math.max(0, Number(garminActiveCalories || 0));
    const tdee = bmr + activeCal + tef - metabolicAdaptationKcal;

    return {
      bmr: Math.round(bmr),
      tef: Math.round(tef * 10) / 10,
      metabolicAdaptationKcal: Math.round(metabolicAdaptationKcal * 10) / 10,
      garminActiveCalories: activeCal,
      tdee: Math.round(tdee),
      caloriesIn: Math.round(totalCalIn),
      energyBalanceKcal: Math.round(tdee - totalCalIn),
      macronutrientsConsumed: { protein: totalP, netCarbs: totalC, fat: totalF }
    };
  }

  /**
   * MÓDULO 2: Cinética Bicompartimental de Glucógeno (G_H vs G_M)
   */
  static simulateGlycogenCompartments(inputs) {
    const {
      prevHepaticGlycogen = 105.0, // Capacidad máx 110g
      prevMuscularGlycogen = 380.0, // Capacidad máx 450g
      netCarbsConsumed = 0.0,
      hoursElapsed = 1.0,
      garminActiveCalories = 0.0,
      exerciseIntensity = 'low' // 'low' (0.30), 'moderate' (0.45), 'high' (0.80)
    } = inputs;

    // 2.1 Partición de Carbohidratos Absorbidos
    // El 25% de carbohidratos netos es captado por el hígado (primer paso esplácnico)
    // El 75% es derivado a circulación sistémica y captado por el músculo
    const hepaticCarbIntake = netCarbsConsumed * 0.25;
    const muscularCarbIntake = netCarbsConsumed * 0.75;

    // 2.2 Balance Hepático (G_H) - Mantenimiento exclusivo de Euglucemia
    // Tasa neta SNC = 2.5 g/h (3.8 g/h consumo basal SNC/eritrocitos - 1.3 g/h gluconeogénesis endógena)
    const hepaticBasalConsumption = 2.5 * hoursElapsed;
    const hepaticGlycogen = Math.max(0, Math.min(110.0, prevHepaticGlycogen + hepaticCarbIntake - hepaticBasalConsumption));

    // 2.3 Balance Muscular (G_M) - Consumo locomotor local (Garmin)
    const glycolyticFractions = { low: 0.30, moderate: 0.45, high: 0.80 };
    const fraction = glycolyticFractions[exerciseIntensity] || 0.40;
    const muscularLocomotorConsumption = (garminActiveCalories * fraction) / 4.0; // 4 kcal por gramo de glucosa

    const muscularGlycogen = Math.max(0, Math.min(450.0, prevMuscularGlycogen + muscularCarbIntake - muscularLocomotorConsumption));

    return {
      hepaticGlycogen: Math.round(hepaticGlycogen * 10) / 10,
      muscularGlycogen: Math.round(muscularGlycogen * 10) / 10,
      totalGlycogen: Math.round((hepaticGlycogen + muscularGlycogen) * 10) / 10,
      hepaticDepletionRateGramsPerHour: 2.5,
      muscularBurnGrams: Math.round(muscularLocomotorConsumption * 10) / 10
    };
  }

  /**
   * MÓDULO 3: Estimación Sigmoidal y Probabilística de Cetonas (BOHB)
   */
  static estimateCirculatingBOHB(hepaticGlycogen, hoursSinceLastCarbMeal, mealCarbsGrams = 0) {
    const G_H = Math.max(0, Number(hepaticGlycogen || 0));

    // 3.1 Desinhibición de CPT-1 (Cinética de Hill n=3, K=20g)
    // Cuando G_H > 40g, F_CPT1 tiende a 0. Cuando G_H < 15g, F_CPT1 sube exponencialmente a 1.
    const K_half = 20.0;
    const hillExponent = 3.0;
    const F_CPT1 = 1.0 / (1.0 + Math.pow(G_H / K_half, hillExponent));

    // 3.2 Latencia Insulínica por Ingesta Glucídica
    let insulinSuppressionHours = 0;
    if (mealCarbsGrams > 15.0) {
      insulinSuppressionHours = 2.0 + ((mealCarbsGrams - 15.0) / 15.0);
    }

    // 3.3 Modulador Dinámico de Tiempo de Ayuno
    const effectiveFastingHours = Math.max(0, hoursSinceLastCarbMeal - insulinSuppressionHours);
    const tauRecovery = 6.0; // constante de tiempo exponencial hacia estado estacionario
    const fastingModulator = 1.0 - Math.exp(-effectiveFastingHours / tauRecovery);

    // 3.4 Concentración Central e Intervalo de Confianza del 95%
    const bohbCenter = 0.15 + (F_CPT1 * 2.2 * fastingModulator);
    const confidenceMargin = 0.25; // Error estándar experimental
    const bohbMin = Math.max(0.10, Math.round((bohbCenter - confidenceMargin) * 100) / 100);
    const bohbMax = Math.min(3.50, Math.round((bohbCenter + confidenceMargin) * 100) / 100);

    return {
      F_CPT1: Math.round(F_CPT1 * 1000) / 1000,
      insulinSuppressed: hoursSinceLastCarbMeal < insulinSuppressionHours,
      insulinSuppressionDurationHours: Math.round(insulinSuppressionHours * 10) / 10,
      bohbCenter: Math.round(bohbCenter * 100) / 100,
      bohbInterval: [bohbMin, bohbMax],
      formattedRange: `${bohbMin.toFixed(1)} - ${bohbMax.toFixed(1)} mmol/L`
    };
  }

  /**
   * MÓDULO 4: Balance de Masa Corporal y Tejido Adiposo (Kevin Hall NIH)
   */
  static calculateBodyCompositionDelta(deltaHepaticGlycogen, deltaMuscularGlycogen, caloricDeficitToday) {
    // 4.1 Desacoplamiento de Agua Osmótica Ligada al Glucógeno
    // Cada gramo de glucógeno almacena 3.0 g de agua intracelular (Olsson & Saltin 1970)
    const totalGlycogenLostGrams = Math.max(0, deltaHepaticGlycogen + deltaMuscularGlycogen);
    const osmoticWaterLostGrams = totalGlycogenLostGrams * 3.0;
    const initialTransientWeightLossKg = (totalGlycogenLostGrams + osmoticWaterLostGrams) / 1000.0;

    // 4.2 Pérdida de Tejido Adiposo Real
    // Densidad energética de triglicéridos en tejido adiposo humano: 9.1 kcal/g puro
    // (o 7.7 kcal/g para tejido adiposo bruto hidratado)
    const pureFatLossGrams = caloricDeficitToday > 0 ? (caloricDeficitToday / 9.1) : 0;
    const adiposeTissueLossGrams = caloricDeficitToday > 0 ? (caloricDeficitToday / 7.7) : 0;

    return {
      glycogenLostGrams: Math.round(totalGlycogenLostGrams * 10) / 10,
      osmoticWaterLostGrams: Math.round(osmoticWaterLostGrams * 10) / 10,
      initialTransientWeightLossKg: Math.round(initialTransientWeightLossKg * 100) / 100,
      pureFatLossGrams: Math.round(pureFatLossGrams * 10) / 10,
      adiposeTissueLossGrams: Math.round(adiposeTissueLossGrams * 10) / 10
    };
  }

  /**
   * MÓDULO 5: Gestión de Desviaciones Dietéticas (Aclaramiento GLUT4 Muscular)
   */
  static evaluateCarbExcursion(excessCarbsGrams, postprandialSteps = 0, postprandialActiveCalories = 0) {
    const excess = Math.max(0, Number(excessCarbsGrams || 0));

    if (excess === 0) {
      return {
        excessCarbs: 0,
        status: 'euglucemic_compliant',
        baselineRecoveryHours: 0,
        activeRecoveryHours: 0,
        timeSavedHours: 0,
        glut4AccelerationFactor: 1.0,
        message: 'Consumo dentro de los límites cetogénicos. CPT-1 operativa sin inhibición por insulina.'
      };
    }

    // 5.1 Tiempo de Supresión Lipolítica Basal (en reposo estático)
    // ~2 horas base + 1 hora adicional por cada 15g de carbohidratos excedentes
    const tBaseHours = 2.0 + (excess / 15.0);

    // 5.2 Aceleración por Translocación de GLUT4 Muscular no insulino-dependiente
    // La contracción muscular (pasos / calorías activas) drena glucosa circulante vía AMPK
    const stepsFactor = (postprandialSteps / 5000.0) * 0.6;
    const calFactor = (postprandialActiveCalories / 300.0) * 0.4;
    const glut4AccelerationFactor = 1.0 + Math.min(1.5, stepsFactor + calFactor);

    // 5.3 Tiempo Reducido hacia la Reapertura Lipolítica
    const tActiveHours = tBaseHours / glut4AccelerationFactor;
    const timeSavedHours = tBaseHours - tActiveHours;
    const reductionPercent = Math.round((timeSavedHours / tBaseHours) * 100);

    return {
      excessCarbs: excess,
      status: 'glut4_clearance_active',
      baselineRecoveryHours: Math.round(tBaseHours * 10) / 10,
      activeRecoveryHours: Math.round(tActiveHours * 10) / 10,
      timeSavedHours: Math.round(timeSavedHours * 10) / 10,
      reductionPercent,
      glut4AccelerationFactor: Math.round(glut4AccelerationFactor * 100) / 100,
      educationalMessage: `La caminata y contracción muscular activaron transportadores GLUT4 independientes de insulina, reduciendo la ventana de inhibición lipolítica de ${tBaseHours.toFixed(1)}h a ${tActiveHours.toFixed(1)}h (un ${reductionPercent}% más rápido).`
    };
  }
}

module.exports = { MetabolicBioenergeticsV4 };
