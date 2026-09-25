const db = require('./src/database');
const engine = require('./src/keto-engine');

console.log('--- TEST START ---');

// Test 1: Add a keto meal
const meal1 = db.addMeal({
  name: 'Omelette con queso y panceta',
  carbs: 2,
  fiber: 0.5,
  protein: 24,
  fat: 28,
  calories: 360
});
console.log('Test 1 - Meal Added:', meal1.name, 'Net carbs:', meal1.net_carbs);

// Test 2: Calculate macros
const today = new Date().toISOString().split('T')[0];
const meals = db.getMealsForDate(today);
const settings = db.getSettings();
const macros = engine.calculateDailyMacros(meals, settings);
console.log('Test 2 - Daily Macros Totals:', macros.totals);
console.log('Test 2 - Caloric Ratios:', macros.ratios);

// Test 3: Save Garmin Metrics and calculate ketosis state
const garmin = db.saveGarminMetrics({
  date: today,
  steps: 9200,
  active_calories: 520,
  total_calories: 2150,
  resting_hr: 58,
  source: 'test'
});
console.log('Test 3 - Garmin Metrics:', { steps: garmin.steps, active_calories: garmin.active_calories });

const keto = engine.calculateKetosisState(meals, garmin, settings);
console.log('Test 4 - Ketosis Phase:', keto.phaseName);
console.log('Test 4 - Garmin Impact:', keto.garminImpact);
console.log('--- TEST SUCCESS ---');
