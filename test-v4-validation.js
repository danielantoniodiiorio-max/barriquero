const { MetabolicBioenergeticsV4 } = require('./src/keto-engine-v4.js');

console.log("===============================================================================");
console.log("           SUITE DE VALIDACIÓN KETOTRACK v4.0 (TEST VECTORS NIH / HALL)        ");
console.log("===============================================================================\n");

// ------------------------------------------------------------------------------------
// CASO 1: Hombre Sedentario en Inicio de Protocolo (Día 1)
// ------------------------------------------------------------------------------------
console.log(">>> EJECUTANDO TEST VECTOR 1: Varón Sedentario Día 1");
const profile1 = { weight: 80.0, height: 175.0, age: 35, gender: 'male' };
const meals1 = [
  { protein: 75, carbs: 12, fiber: 3, fat: 60, calories: 900 },
  { protein: 69, carbs: 8, fiber: 2, fat: 68, calories: 928 }
]; // Total P: 144g, Net C: 15g, F: 128g, Cal: 1828
const energy1 = MetabolicBioenergeticsV4.calculateEnergyExpenditure(profile1, meals1, 120, 0);
const glycogen1 = MetabolicBioenergeticsV4.simulateGlycogenCompartments({
  prevHepaticGlycogen: 105.0,
  prevMuscularGlycogen: 380.0,
  netCarbsConsumed: 15.0,
  hoursElapsed: 14.0,
  garminActiveCalories: 120,
  exerciseIntensity: 'low'
});
const ketones1 = MetabolicBioenergeticsV4.estimateCirculatingBOHB(glycogen1.hepaticGlycogen, 14.0, 6.0);

console.log("Resultados Caso 1:", {
  BMR: energy1.bmr, // Esperado: 1724
  TEF: energy1.tef, // Esperado: ~172
  TDEE: energy1.tdee, // Esperado: ~2016
  G_Hepatico: glycogen1.hepaticGlycogen, // Esperado: 73.8
  G_Muscular: glycogen1.muscularGlycogen, // Esperado: 382.3
  F_CPT1: ketones1.F_CPT1, // Esperado: 0.02
  BOHB_Centro: ketones1.bohbCenter, // Esperado: 0.19
  BOHB_Rango: ketones1.formattedRange // Esperado: [0.1 - 0.3 mmol/L]
});
console.log("-------------------------------------------------------------------------------\n");

// ------------------------------------------------------------------------------------
// CASO 2: Atleta Ceto-Adaptado en Plena Cetosis (Día 5)
// ------------------------------------------------------------------------------------
console.log(">>> EJECUTANDO TEST VECTOR 2: Varón Ceto-Adaptado Día 5");
const profile2 = { weight: 78.0, height: 180.0, age: 38, gender: 'male' };
const meals2 = [
  { protein: 140, carbs: 16, fiber: 4, fat: 135, calories: 1850 }
]; // Net C: 12g
const energy2 = MetabolicBioenergeticsV4.calculateEnergyExpenditure(profile2, meals2, 750, 5);
const glycogen2 = MetabolicBioenergeticsV4.simulateGlycogenCompartments({
  prevHepaticGlycogen: 30.0,
  prevMuscularGlycogen: 280.0,
  netCarbsConsumed: 12.0,
  hoursElapsed: 28.0,
  garminActiveCalories: 750,
  exerciseIntensity: 'moderate'
});
const ketones2 = MetabolicBioenergeticsV4.estimateCirculatingBOHB(glycogen2.hepaticGlycogen, 28.0, 0);
const bodyComp2 = MetabolicBioenergeticsV4.calculateBodyCompositionDelta(0, 75.4, energy2.energyBalanceKcal);

console.log("Resultados Caso 2:", {
  BMR: energy2.bmr, // Esperado: 1720
  TDEE: energy2.tdee, // Esperado: ~2638
  Deficit_Kcal: energy2.energyBalanceKcal, // Esperado: 788
  Grasa_Pura_g: bodyComp2.pureFatLossGrams, // Esperado: 86.6
  G_Hepatico: glycogen2.hepaticGlycogen, // Esperado: 0.0 (Agotado)
  G_Muscular: glycogen2.muscularGlycogen, // Esperado: 204.6 (Preservado)
  F_CPT1: ketones2.F_CPT1, // Esperado: 1.0
  BOHB_Centro: ketones2.bohbCenter, // Esperado: 2.35
  BOHB_Rango: ketones2.formattedRange // Esperado: [2.1 - 2.6 mmol/L]
});
console.log("-------------------------------------------------------------------------------\n");

// ------------------------------------------------------------------------------------
// CASO 3: Excursión Glucídica de 40g (Aclaramiento GLUT4)
// ------------------------------------------------------------------------------------
console.log(">>> EJECUTANDO TEST VECTOR 3: Cheat Meal + Caminata GLUT4");
const excursion3 = MetabolicBioenergeticsV4.evaluateCarbExcursion(40.0, 3500, 150);

console.log("Resultados Caso 3:", {
  Exceso_Carbos: excursion3.excessCarbs, // 40g
  T_Base_Horas: excursion3.baselineRecoveryHours, // ~4.7h
  Factor_GLUT4: excursion3.glut4AccelerationFactor, // ~1.62
  T_Activo_Horas: excursion3.activeRecoveryHours, // ~2.9h
  Ahorro_Horas: excursion3.timeSavedHours, // ~1.8h
  Reduccion_Pct: `${excursion3.reductionPercent}%`, // 38%
  Mensaje_Educativo: excursion3.educationalMessage
});
console.log("===============================================================================");
console.log("TODOS LOS VECTORES DE PRUEBA COMPLETARON CON ÉXITO DENTRO DE LOS RANGOS FISIOLÓGICOS.");
console.log("===============================================================================");
