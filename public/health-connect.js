/**
 * Cliente de Sincronización Automática con Google Health Connect (Android 14 y 15)
 * Lee pasos, calorías activas, ritmo cardíaco y peso directamente de Garmin a través de Health Connect.
 */

class HealthConnectManager {
  constructor() {
    this.isNative = false;
    this.plugin = null;
    this.lastDiagnostics = {
      timestamp: null,
      permissions: null,
      stepsFound: 0,
      stepsValue: 0,
      stepsSources: [],
      caloriesValue: 0,
      restingHr: null,
      weightValue: null,
      errors: {}
    };
    this.init();
  }

  getPlugin() {
    if (window.Capacitor) {
      if (window.Capacitor.Plugins && window.Capacitor.Plugins.Health) {
        return window.Capacitor.Plugins.Health;
      }
      if (typeof window.Capacitor.registerPlugin === 'function') {
        try {
          return window.Capacitor.registerPlugin('Health');
        } catch (e) {
          console.warn('Error al invocar registerPlugin("Health"):', e);
        }
      }
    }
    return null;
  }

  async init() {
    if (window.Capacitor) {
      this.isNative = typeof window.Capacitor.isNativePlatform === 'function' 
        ? window.Capacitor.isNativePlatform() 
        : true;
      this.plugin = this.getPlugin();
    }

    this.bindUI();

    if (this.isNative) {
      console.log('📱 Modo Nativo Android detectado. Iniciando Health Connect...');
      this.updateUIStatus('Modo Nativo Android detectado. Sincronizando con Garmin...');
      setTimeout(async () => {
        this.plugin = this.getPlugin();
        await this.setupAutoSync();
      }, 500);
    } else {
      console.log('💻 Modo Web detectado.');
      this.updateUIStatus('Modo navegador web (Health Connect se activa en la app Android).');
    }
  }

  bindUI() {
    const btnConnect = document.getElementById('btnConnectHealthConnect');
    if (btnConnect) {
      btnConnect.addEventListener('click', async () => {
        btnConnect.disabled = true;
        btnConnect.textContent = '⏳ Sincronizando...';
        await this.requestPermissionAndSync(false);
        btnConnect.disabled = false;
        btnConnect.innerHTML = '🔄 Sincronizar Ahora';
      });
    }

    const btnDirect = document.getElementById('btnSyncHealthConnectDirect');
    if (btnDirect) {
      btnDirect.addEventListener('click', async () => {
        btnDirect.disabled = true;
        btnDirect.textContent = '⏳ Sincronizando Garmin...';
        await this.requestPermissionAndSync(false);
        btnDirect.disabled = false;
        btnDirect.innerHTML = '🔄 Sincronizar Ahora (Garmin)';
      });
    }

    // Permitir ver diagnóstico tocando el texto de estado
    const statusTextEl = document.getElementById('healthConnectStatusText');
    if (statusTextEl) {
      statusTextEl.style.cursor = 'pointer';
      statusTextEl.title = 'Toca para ver el diagnóstico de Health Connect';
      statusTextEl.addEventListener('click', () => {
        this.showDiagnosticsModal();
      });
    }

    const heroSync = document.getElementById('garminHeroSyncStatus');
    if (heroSync) {
      heroSync.style.cursor = 'pointer';
      heroSync.addEventListener('click', () => {
        this.showDiagnosticsModal();
      });
    }
  }

  async setupAutoSync() {
    await this.requestPermissionAndSync(true);

    // Auto-sincronizar al volver a la app (ej. después de sincronizar en Garmin Connect)
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.syncFromHealthConnect();
      }
    });

    // Periódicamente cada 3 minutos
    setInterval(() => {
      if (!document.hidden) {
        this.syncFromHealthConnect();
      }
    }, 3 * 60 * 1000);
  }

  async checkPermissions() {
    this.plugin = this.getPlugin();
    if (!this.plugin || typeof this.plugin.checkAuthorization !== 'function') {
      return { authorized: false, missing: ['steps', 'calories', 'totalCalories', 'heartRate', 'weight'] };
    }

    try {
      const res = await this.plugin.checkAuthorization({
        read: ['steps', 'calories', 'totalCalories', 'heartRate', 'weight'],
        write: []
      });
      const granted = res.readAuthorized || [];
      const denied = res.readDenied || [];
      return {
        authorized: denied.length === 0,
        granted,
        denied
      };
    } catch (e) {
      console.warn('Error al verificar autorización de Health Connect:', e);
      return { authorized: false, granted: [], denied: ['steps', 'calories', 'totalCalories', 'heartRate', 'weight'], error: e.message };
    }
  }

  async requestPermissionAndSync(isSilent = false) {
    this.plugin = this.getPlugin();
    if (!this.plugin) {
      if (!isSilent) {
        alert('El plugin nativo de Health Connect se está iniciando. Reintenta en unos instantes.');
      }
      return false;
    }

    try {
      this.updateUIStatus('Verificando disponibilidad de Health Connect...');
      const availability = await this.plugin.isAvailable().catch(e => ({ available: false, reason: e.message }));
      if (availability && availability.available === false) {
        const msg = availability.reason || 'Health Connect no está activo en este dispositivo.';
        this.updateUIStatus('Aviso: ' + msg);
        return false;
      }

      // 1. Verificar si ya tenemos permisos concedidos
      const authCheck = await this.checkPermissions();
      this.lastDiagnostics.permissions = authCheck;

      if (!authCheck.authorized) {
        if (!isSilent) {
          this.updateUIStatus('Solicitando permisos a Google Health Connect...');
        }
        try {
          await this.plugin.requestAuthorization({
            read: ['steps', 'calories', 'totalCalories', 'exercise', 'nutrition', 'heartRate', 'weight'],
            write: []
          });
        } catch (authErr) {
          console.warn('Error en requestAuthorization extendido:', authErr);
          try {
            await this.plugin.requestAuthorization({
              read: ['steps', 'calories', 'totalCalories', 'heartRate', 'weight'],
              write: []
            });
          } catch (authErr2) {
            console.warn('Error en fallback de requestAuthorization:', authErr2);
          }
        }
      }

      this.updateUIStatus('Leyendo métricas de Garmin desde Health Connect...');
      await this.syncFromHealthConnect();
      return true;

    } catch (err) {
      console.error('Error al conectar con Health Connect:', err);
      this.updateUIStatus('Error al conectar: ' + (err.message || err));
      return false;
    }
  }

  /**
   * Extrae métricas de Garmin evitando duplicar snapshots del mismo intervalo
   * y sumando aditivamente las sesiones discretas de ejercicio (ej. musculación/carrera)
   * con las calorías activas basales (pasos del día).
   */
  extractMetric(samples, now = new Date()) {
    if (!Array.isArray(samples) || samples.length === 0) {
      return { value: 0, count: 0, sources: [], garminFound: false };
    }

    // Delimitar el día local de hoy (00:00:00 a 23:59:59.999 hora del teléfono)
    const startOfTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    const endOfTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

    // 1. Filtrar registros que pertenezcan a la jornada de hoy
    const todaySamples = samples.filter(s => {
      const sStart = s.startDate ? new Date(s.startDate).getTime() : 0;
      const sEnd = s.endDate ? new Date(s.endDate).getTime() : sStart;
      return sStart <= endOfTodayMs && sEnd >= startOfTodayMs;
    });

    if (todaySamples.length === 0) {
      return { value: 0, count: 0, sources: [], garminFound: false };
    }

    // Registrar todas las fuentes presentes
    const sourcesFound = [...new Set(todaySamples.map(s => s.sourceName || s.sourceId || 'desconocido'))];

    // 2. Filtrar por Garmin Connect (paquete com.garmin.android.apps.connectmobile o dispositivo Garmin)
    const garminSamples = todaySamples.filter(s => {
      const src = ((s.sourceId || '') + ' ' + (s.sourceName || '')).toLowerCase();
      return src.includes('garmin') || src.includes('connectmobile');
    });

    const isGarmin = garminSamples.length > 0;
    const targetList = isGarmin ? garminSamples : todaySamples;

    // 3. Procesar y ordenar por fecha de inicio
    const validSamples = targetList
      .map(s => {
        const val = Number(s.value !== undefined ? s.value : (s.count !== undefined ? s.count : (s.energy !== undefined ? s.energy : (s.calories !== undefined ? s.calories : 0)))) || 0;
        const start = s.startDate ? new Date(s.startDate).getTime() : 0;
        const end = s.endDate ? new Date(s.endDate).getTime() : start;
        return { val, start, end, raw: s };
      })
      .filter(s => s.val > 0)
      .sort((a, b) => a.start - b.start || a.end - b.end);

    if (validSamples.length === 0) {
      return { value: 0, count: 0, sources: sourcesFound, garminFound: isGarmin };
    }

    // 4. Deduplicación exacta de intervalos sin agrupar por bloques arbitrarios:
    //    En Health Connect, Garmin registra muestras discretas (ej. cada 1 a 2 minutos).
    //    Identificamos cada intervalo por su ID nativo o por la combinación exacta de timestamps.
    //    Si existe una reescritura del mismo intervalo, nos quedamos con el valor mayor.
    const dedupedMap = new Map();
    for (const s of validSamples) {
      const uniqueKey = s.raw.id ? String(s.raw.id) : `${s.raw.sourceId || ''}_${s.raw.startDate}_${s.raw.endDate}`;
      const existing = dedupedMap.get(uniqueKey);
      if (!existing || s.val > existing.val) {
        dedupedMap.set(uniqueKey, s);
      }
    }

    let intervalSum = 0;
    for (const s of dedupedMap.values()) {
      intervalSum += s.val;
    }

    // Si además existe un registro consolidado acumulativo de todo el día que sea mayor, lo respetamos
    const maxSingle = Math.max(0, ...validSamples.map(s => s.val));
    const finalValue = Math.round(Math.max(intervalSum, maxSingle));

    return {
      value: finalValue,
      count: targetList.length,
      sources: sourcesFound,
      garminFound: isGarmin
    };
  }

  // Sincronizar ingestas de MyFitnessPal leídas desde Health Connect
  syncNutritionFromHealthConnect(samples, now = new Date()) {
    if (!Array.isArray(samples) || samples.length === 0) return;
    try {
      const todayKey = (typeof getLocalDateKey === 'function') 
        ? getLocalDateKey(now) 
        : now.toISOString().slice(0, 10);
        
      const localMeals = JSON.parse(localStorage.getItem('ketotrack_meals') || '[]');
      let deletedIds = [];
      try {
        deletedIds = JSON.parse(localStorage.getItem('ketotrack_deleted_meal_ids') || '[]');
      } catch (e) { deletedIds = []; }
      let protocolStartKey = todayKey;
      const settings = (typeof window.state !== 'undefined' && window.state.settings) 
        ? window.state.settings 
        : JSON.parse(localStorage.getItem('ketotrack_settings') || '{}');
      if (settings && settings.keto_start_date) {
        const d = new Date(settings.keto_start_date);
        if (!isNaN(d.getTime())) {
          protocolStartKey = (typeof getLocalDateKey === 'function') ? getLocalDateKey(d) : d.toISOString().slice(0, 10);
        }
      }

      for (const s of samples) {
        const dateVal = s.startDate || s.date || s.time;
        if (!dateVal) continue;
        const sStart = new Date(dateVal);
        if (isNaN(sStart.getTime())) continue;
        const sKey = (typeof getLocalDateKey === 'function') 
          ? getLocalDateKey(sStart) 
          : sStart.toISOString().slice(0, 10);
        if (sKey < protocolStartKey || sKey > todayKey) continue;

        const mealId = 'mfp_' + sStart.getTime();
        if (deletedIds.includes(mealId)) continue;

        const cal = Math.round(Number(s.calories || s.value || 0));
        const carbs = Math.round((Number(s.carbs || 0)) * 10) / 10;
        const protein = Math.round((Number(s.protein || 0)) * 10) / 10;
        const fat = Math.round((Number(s.fat || 0)) * 10) / 10;
        const fiber = Math.round((Number(s.fiber || 0)) * 10) / 10;
        const netCarbs = Math.max(0, Math.round((carbs - fiber) * 10) / 10);
        const name = s.name || 'Comida (MyFitnessPal)';

        // Evitar duplicados por id o nombre y hora similar
        const exists = localMeals.some(m => 
          (m.id && m.id === mealId) ||
          (m.name === name && Math.abs(new Date(m.timestamp).getTime() - sStart.getTime()) < 15 * 60 * 1000)
        );

        if (!exists && cal > 0) {
          const newMeal = {
            id: mealId,
            timestamp: sStart.toISOString(),
            name: name,
            carbs: carbs,
            fiber: fiber,
            net_carbs: netCarbs,
            protein: protein,
            fat: fat,
            calories: cal,
            source: 'MyFitnessPal'
          };
          localMeals.unshift(newMeal);
          changed = true;
        }
      }

      if (changed) {
        localStorage.setItem('ketotrack_meals', JSON.stringify(localMeals));
        if (typeof loadMeals === 'function') loadMeals();
        if (typeof recalculateClientState === 'function') recalculateClientState();
      }
    } catch (e) {
      console.warn('Error al procesar nutrición de Health Connect:', e);
    }
  }

  async syncFromHealthConnect() {
    this.plugin = this.getPlugin();
    if (!this.plugin) return;

    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

      // Consultar la jornada de hoy (desde las 00:00:00 local hasta 2h en el futuro para tolerancia horaria)
      const queryStart = startOfDay.toISOString();
      const queryEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString();

      let steps = 0;
      let stepsDiagnostic = null;
      let stepsError = null;

      // Lector resiliente para Health Connect
      const safeReadSamples = async (dataType, startIso, endIso, limit = 5000) => {
        try {
          return await this.plugin.readSamples({
            dataType,
            startDate: startIso,
            endDate: endIso,
            limit
          });
        } catch (err) {
          const errMsg = (err && (err.message || String(err))) || '';
          console.warn(`safeReadSamples ${dataType} arrojó: ${errMsg}`);
          // Si el rango contiene un intervalo con count < 1 (inactividad en reposo),
          // consultar la ventana más reciente (últimas 4 horas) para rescatar los intervalos activos del día
          if (errMsg.includes('count must not be less than 1') || errMsg.includes('IllegalArgumentException')) {
            try {
              const recentStart = new Date(Math.max(startOfDay.getTime(), now.getTime() - 4 * 60 * 60 * 1000)).toISOString();
              return await this.plugin.readSamples({
                dataType,
                startDate: recentStart,
                endDate: endIso,
                limit
              });
            } catch (errRecent) {
              console.warn(`Fallback reciente para ${dataType} arrojó:`, errRecent);
            }
          }
          throw err;
        }
      };

      // 1. Leer Pasos de Hoy
      try {
        const stepsRes = await safeReadSamples('steps', queryStart, queryEnd, 5000);
        if (stepsRes && Array.isArray(stepsRes.samples)) {
          stepsDiagnostic = this.extractMetric(stepsRes.samples, now);
          steps = stepsDiagnostic.value;
          this.lastDiagnostics.stepsFound = stepsRes.samples.length;
          this.lastDiagnostics.stepsValue = steps;
          this.lastDiagnostics.stepsSources = stepsDiagnostic.sources;
        }
      } catch (e) {
        stepsError = e.message || String(e);
        this.lastDiagnostics.errors.steps = stepsError;
        console.error('Error leyendo pasos de Health Connect:', e);
      }

      // 2. Leer Calorías Activas de Hoy
      let activeCalories = 0;
      let calError = null;
      try {
        const calRes = await safeReadSamples('calories', queryStart, queryEnd, 3000);
        if (calRes && Array.isArray(calRes.samples) && calRes.samples.length > 0) {
          const calDiag = this.extractMetric(calRes.samples, now);
          activeCalories = calDiag.value;
          this.lastDiagnostics.caloriesValue = activeCalories;
        }
      } catch (e) {
        calError = e.message || String(e);
        this.lastDiagnostics.errors.calories = calError;
        console.warn('Error leyendo calorías activas:', e);
      }

      // 2a. Leer Calorías Totales Quemadas de Health Connect (TotalCaloriesBurnedRecord de Garmin)
      let totalCaloriesHC = 0;
      const elapsedHours = Math.max(0.1, now.getHours() + (now.getMinutes() / 60));
      const dailyBmr = (typeof window.state !== 'undefined' && window.state.settings && window.state.settings.garmin_daily_bmr) 
        ? Number(window.state.settings.garmin_daily_bmr) 
        : 2185;
      const bmrSoFar = Math.round((dailyBmr / 24) * elapsedHours);

      try {
        const totRes = await safeReadSamples('totalCalories', queryStart, queryEnd, 3000);
        if (totRes && Array.isArray(totRes.samples) && totRes.samples.length > 0) {
          const totDiag = this.extractMetric(totRes.samples, now);
          totalCaloriesHC = totDiag.value;
          this.lastDiagnostics.totalCaloriesValue = totalCaloriesHC;

          if (totalCaloriesHC > 0) {
            if (activeCalories === 0 && totalCaloriesHC > bmrSoFar) {
              activeCalories = Math.round(totalCaloriesHC - bmrSoFar);
              this.lastDiagnostics.caloriesValue = activeCalories;
            } else if (activeCalories > 0 && totalCaloriesHC > activeCalories) {
              const impliedActive = Math.round(totalCaloriesHC - bmrSoFar);
              if (impliedActive > activeCalories) {
                activeCalories = impliedActive;
                this.lastDiagnostics.caloriesValue = activeCalories;
              }
            }
          }
        }
      } catch (totErr) {
        console.warn('TotalCalories no disponible en este dispositivo:', totErr);
      }

      // 2b. Leer Sesiones de Ejercicio de Hoy (Gimnasio / Musculación / etc.)
      let detectedExercises = [];
      try {
        const exRes = await safeReadSamples('exercise', queryStart, queryEnd, 50);
        if (exRes && Array.isArray(exRes.samples)) {
          detectedExercises = exRes.samples.map(s => {
            const timeStr = s.startDate ? new Date(s.startDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            return {
              id: 'hc_ex_' + (s.startDate || Date.now()),
              title: s.title || 'Entrenamiento Garmin',
              calories: Math.round(Number(s.calories || s.value || 0)),
              duration: Math.round(Number(s.duration || s.value || 0)),
              time: timeStr,
              timestamp: s.startDate || now.toISOString(),
              source: s.sourceName || 'Garmin Connect'
            };
          });
        }
      } catch (exErr) {
        // Ignorar si el tipo exercise no está disponible en la versión nativa instalada
      }

      // 2c. Leer Nutrición de Health Connect (Sincronización MyFitnessPal)
      try {
        const nutRes = await safeReadSamples('nutrition', queryStart, queryEnd, 50);
        if (nutRes && Array.isArray(nutRes.samples) && nutRes.samples.length > 0) {
          this.syncNutritionFromHealthConnect(nutRes.samples, now);
        }
      } catch (nutErr) {
        // Ignorar si no está disponible o denegado
      }

      // Respetar calorías oficiales de Garmin Web o de ejercicios/musculación ya registradas
      const todayKey = (typeof getLocalDateKey === 'function') ? getLocalDateKey(now) : now.toISOString().slice(0, 10);
      const currentGarmin = JSON.parse(localStorage.getItem('ketotrack_garmin') || '{}');
      const isOfficialToday = (currentGarmin.date === todayKey && currentGarmin.is_official === true);
      const existingExCalories = (currentGarmin.date === todayKey) 
        ? Number(currentGarmin.exercise_calories || 0) 
        : 0;

      if (isOfficialToday && Number(currentGarmin.active_calories) > 0) {
        // Preservar las calorías oficiales cargadas desde Garmin Web
        activeCalories = Math.max(activeCalories, Number(currentGarmin.active_calories));
        this.lastDiagnostics.caloriesValue = activeCalories;
      } else if (activeCalories === 0) {
        const stepEst = steps > 0 ? Math.round(steps * 0.03184) : 0;
        activeCalories = stepEst + existingExCalories;
        this.lastDiagnostics.caloriesValue = activeCalories;
      } else if (existingExCalories > 0 && activeCalories < existingExCalories) {
        // Proteger las calorías de musculación si Health Connect solo registró un fragmento
        activeCalories = Math.max(activeCalories, existingExCalories);
        this.lastDiagnostics.caloriesValue = activeCalories;
      }

      // 3. Leer Frecuencia Cardíaca en Reposo de Garmin
      let restingHr = 55;
      try {
        const hrRes = await this.plugin.readSamples({
          dataType: 'heartRate',
          startDate: queryStart,
          endDate: queryEnd,
          limit: 200,
          ascending: false
        });
        if (hrRes && Array.isArray(hrRes.samples) && hrRes.samples.length > 0) {
          const gHr = hrRes.samples.filter(s => {
            const src = ((s.sourceId || '') + ' ' + (s.sourceName || '')).toLowerCase();
            return src.includes('garmin') || src.includes('connectmobile');
          });
          const pool = gHr.length > 0 ? gHr : hrRes.samples;
          const bpmValues = pool.map(s => Number(s.value)).filter(v => v >= 38 && v <= 180);
          if (bpmValues.length > 0) {
            bpmValues.sort((a, b) => a - b);
            // El RHR (resting heart rate) corresponde a los valores basales en reposo
            const lowIdx = Math.min(2, bpmValues.length - 1);
            restingHr = Math.round(bpmValues[lowIdx]);
            this.lastDiagnostics.restingHr = restingHr;
          }
        }
      } catch (e) {
        this.lastDiagnostics.errors.heartRate = e.message || String(e);
        console.warn('Error leyendo ritmo cardíaco:', e);
      }

      // 4. Leer Peso Corporal si está disponible
      try {
        const weightRes = await this.plugin.readSamples({
          dataType: 'weight',
          startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: queryEnd,
          limit: 1,
          ascending: false
        });
        if (weightRes && weightRes.samples && weightRes.samples.length > 0) {
          const wKg = Number(weightRes.samples[0].value) || 0;
          if (wKg > 0) {
            this.lastDiagnostics.weightValue = wKg;
            if (window.applyGarminWeight) {
              window.applyGarminWeight(wKg, 'Health Connect (Garmin)');
            }
          }
        }
      } catch (e) {
        this.lastDiagnostics.errors.weight = e.message || String(e);
        console.warn('Error leyendo peso:', e);
      }

      // 5. Aplicar métricas a la aplicación y motor metabólico
      const sourceLabel = (stepsDiagnostic && stepsDiagnostic.garminFound) 
        ? 'Google Health Connect (Garmin)' 
        : ((stepsDiagnostic && stepsDiagnostic.sources.length > 0) 
            ? 'Health Connect (' + stepsDiagnostic.sources[0] + ')' 
            : 'Google Health Connect (Garmin)');

      if (window.applyGarminMetrics) {
        window.applyGarminMetrics({
          steps: steps,
          activeCalories: activeCalories,
          totalCalories: totalCaloriesHC,
          restingHr: restingHr,
          heartRate: restingHr,
          source: sourceLabel,
          exercises: detectedExercises
        });
      }

      // 5b. Sincronizar Historial Multi-Día de Garmin (últimos 14 días) para el Déficit Acumulado
      this.syncHistoricalDays(14).catch(e => console.warn('syncHistoricalDays:', e));

      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.lastDiagnostics.timestamp = timeStr;

      // 6. Mensaje de Estado Claro e Informativo para el Usuario
      if (stepsError) {
        this.updateUIStatus('⚠️ Error al leer pasos: ' + stepsError + ' (Toca para reintentar o ver diagnóstico)');
      } else if (steps > 0 || totalCaloriesHC > 0 || activeCalories > 0) {
        const garminTag = (stepsDiagnostic && stepsDiagnostic.garminFound) ? 'de Garmin' : 'de Health Connect';
        const displayTotal = totalCaloriesHC > 0 ? totalCaloriesHC : (activeCalories + bmrSoFar);
        this.updateUIStatus('Sincronizado: ' + timeStr + ' • ' + steps.toLocaleString() + ' pasos y ' + displayTotal.toLocaleString() + ' kcal totales (' + activeCalories + ' activas) ' + garminTag + ' ✓');
      } else {
        // Pasos = 0: explicar la causa exacta
        const auth = await this.checkPermissions();
        if (auth.denied && auth.denied.includes('steps')) {
          this.updateUIStatus('⚠️ Falta permiso de Pasos en Health Connect. Toca "Sincronizar Ahora" para activarlo.');
        } else if (this.lastDiagnostics.stepsFound === 0) {
          this.updateUIStatus('ℹ️ Sincronizado ' + timeStr + ': Sin pasos registrados hoy en Health Connect. Abre Garmin Connect y desliza hacia abajo para sincronizar tu reloj.');
        } else {
          this.updateUIStatus('Sincronizado: ' + timeStr + ' • 0 pasos y ' + activeCalories + ' kcal de Garmin. (Toca para diagnóstico)');
        }
      }

    } catch (err) {
      console.error('Fallo general en sincronización con Health Connect:', err);
      this.updateUIStatus('Error al sincronizar datos: ' + (err.message || err));
    }
  }

  async syncHistoricalDays(numDays = 14) {
    this.plugin = this.getPlugin();
    if (!this.plugin || typeof this.plugin.readSamples !== 'function') return;

    try {
      const now = new Date();
      const todayKey = (typeof getLocalDateKey === 'function') ? getLocalDateKey(now) : now.toISOString().slice(0, 10);

      // 1. Obtener la fecha de inicio del protocolo
      let protocolStartKey = todayKey;
      const settings = (typeof window.state !== 'undefined' && window.state.settings) 
        ? window.state.settings 
        : JSON.parse(localStorage.getItem('ketotrack_settings') || '{}');
      
      if (settings && settings.keto_start_date) {
        const d = new Date(settings.keto_start_date);
        if (!isNaN(d.getTime())) {
          protocolStartKey = (typeof getLocalDateKey === 'function') ? getLocalDateKey(d) : d.toISOString().slice(0, 10);
        }
      } else {
        const localMeals = JSON.parse(localStorage.getItem('ketotrack_meals') || '[]');
        if (localMeals.length > 0) {
          const sorted = [...localMeals].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
          if (sorted[0] && sorted[0].timestamp) {
            const d = new Date(sorted[0].timestamp);
            if (!isNaN(d.getTime())) {
              protocolStartKey = (typeof getLocalDateKey === 'function') ? getLocalDateKey(d) : d.toISOString().slice(0, 10);
            }
          }
        }
      }

      // Limpiar inmediatamente cualquier día previo al protocolo guardado previamente
      let history = [];
      try {
        history = JSON.parse(localStorage.getItem('ketotrack_daily_history') || '[]');
      } catch (e) { history = []; }
      const cleaned = history.filter(h => h && h.date && h.date >= protocolStartKey);
      if (cleaned.length !== history.length) {
        history = cleaned;
        localStorage.setItem('ketotrack_daily_history', JSON.stringify(history));
      }

      // Si el protocolo inició hoy o en el futuro, no consultar días anteriores
      if (protocolStartKey >= todayKey) {
        if (typeof recalculateClientState === 'function') recalculateClientState();
        if (typeof renderChartsView === 'function') renderChartsView();
        return;
      }

      // Consultar estrictamente desde las 00:00:00 del día de inicio del protocolo hasta hoy a las 00:00:00
      const startParts = protocolStartKey.split('-');
      const queryStartDate = new Date(Number(startParts[0]), Number(startParts[1]) - 1, Number(startParts[2]), 0, 0, 0, 0);
      const queryStart = queryStartDate.toISOString();
      const queryEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();

      let histSteps = [];
      let histCal = [];
      let histTotalCal = [];
      let histNutrition = [];
      try {
        const resS = await this.plugin.readSamples({ dataType: 'steps', startDate: queryStart, endDate: queryEnd, limit: 5000 });
        if (resS && Array.isArray(resS.samples)) histSteps = resS.samples;
      } catch (e) {}

      try {
        const resC = await this.plugin.readSamples({ dataType: 'calories', startDate: queryStart, endDate: queryEnd, limit: 5000 });
        if (resC && Array.isArray(resC.samples)) histCal = resC.samples;
      } catch (e) {}

      try {
        const resT = await this.plugin.readSamples({ dataType: 'totalCalories', startDate: queryStart, endDate: queryEnd, limit: 5000 });
        if (resT && Array.isArray(resT.samples)) histTotalCal = resT.samples;
      } catch (e) {}

      try {
        const resN = await this.plugin.readSamples({ dataType: 'nutrition', startDate: queryStart, endDate: queryEnd, limit: 5000 });
        if (resN && Array.isArray(resN.samples)) histNutrition = resN.samples;
      } catch (e) {}

      const getSampleDateKey = (s) => {
        const dVal = s.startDate || s.date || s.time;
        if (!dVal) return null;
        const d = new Date(dVal);
        if (isNaN(d.getTime())) return null;
        return (typeof getLocalDateKey === 'function') ? getLocalDateKey(d) : d.toISOString().slice(0, 10);
      };

      const dayStepsMap = {};
      const dayCalMap = {};
      const dayTotalCalMap = {};
      const daysNutritionMap = {};

      for (const s of histNutrition) {
        const dKey = getSampleDateKey(s);
        if (!dKey || dKey < protocolStartKey || dKey >= todayKey) continue;
        const cal = Math.round(Number(s.calories || s.value || 0));
        if (cal > 0) daysNutritionMap[dKey] = (daysNutritionMap[dKey] || 0) + cal;
      }

      for (const s of histSteps) {
        const dKey = getSampleDateKey(s);
        if (!dKey || dKey < protocolStartKey || dKey >= todayKey) continue;
        const key = s.id ? String(s.id) : `${s.sourceId || ''}_${s.startDate}_${s.endDate}`;
        const val = Number(s.value !== undefined ? s.value : (s.count !== undefined ? s.count : 0)) || 0;
        if (val > 0) {
          if (!dayStepsMap[dKey]) dayStepsMap[dKey] = new Map();
          const cur = dayStepsMap[dKey].get(key) || 0;
          if (val > cur) dayStepsMap[dKey].set(key, val);
        }
      }

      for (const s of histCal) {
        const dKey = getSampleDateKey(s);
        if (!dKey || dKey < protocolStartKey || dKey >= todayKey) continue;
        const key = s.id ? String(s.id) : `${s.sourceId || ''}_${s.startDate}_${s.endDate}`;
        const val = Number(s.value !== undefined ? s.value : (s.energy !== undefined ? s.energy : (s.calories !== undefined ? s.calories : 0))) || 0;
        if (val > 0) {
          if (!dayCalMap[dKey]) dayCalMap[dKey] = new Map();
          const cur = dayCalMap[dKey].get(key) || 0;
          if (val > cur) dayCalMap[dKey].set(key, val);
        }
      }

      for (const s of histTotalCal) {
        const dKey = getSampleDateKey(s);
        if (!dKey || dKey < protocolStartKey || dKey >= todayKey) continue;
        const key = s.id ? String(s.id) : `${s.sourceId || ''}_${s.startDate}_${s.endDate}`;
        const val = Number(s.value !== undefined ? s.value : (s.energy !== undefined ? s.energy : (s.calories !== undefined ? s.calories : 0))) || 0;
        if (val > 0) {
          if (!dayTotalCalMap[dKey]) dayTotalCalMap[dKey] = new Map();
          const cur = dayTotalCalMap[dKey].get(key) || 0;
          if (val > cur) dayTotalCalMap[dKey].set(key, val);
        }
      }

      const allPastKeys = new Set([
        ...Object.keys(dayStepsMap),
        ...Object.keys(dayCalMap),
        ...Object.keys(dayTotalCalMap),
        ...Object.keys(daysNutritionMap)
      ]);

      const localMeals = JSON.parse(localStorage.getItem('ketotrack_meals') || '[]');
      for (const m of localMeals) {
        const mKey = (typeof getLocalDateKey === 'function') ? getLocalDateKey(m.timestamp) : (m.timestamp ? m.timestamp.slice(0, 10) : '');
        if (mKey >= protocolStartKey && mKey < todayKey) {
          allPastKeys.add(mKey);
        }
      }

      const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
      const dailyBmr = (typeof window.state !== 'undefined' && window.state.settings && window.state.settings.garmin_daily_bmr) 
        ? Number(window.state.settings.garmin_daily_bmr) 
        : 2185;

      for (const dKey of allPastKeys) {
        let totalSteps = 0;
        if (dayStepsMap[dKey]) {
          for (const v of dayStepsMap[dKey].values()) totalSteps += v;
        }
        let totalActiveCal = 0;
        if (dayCalMap[dKey]) {
          for (const v of dayCalMap[dKey].values()) totalActiveCal += v;
        }
        let totalBurnFromHc = 0;
        if (dayTotalCalMap[dKey]) {
          for (const v of dayTotalCalMap[dKey].values()) totalBurnFromHc += v;
        }

        const totalBurn = totalBurnFromHc > 0 ? Math.round(totalBurnFromHc) : Math.round(dailyBmr + totalActiveCal);

        const dayMeals = localMeals.filter(m => {
          const mKey = (typeof getLocalDateKey === 'function') ? getLocalDateKey(m.timestamp) : (m.timestamp ? m.timestamp.slice(0, 10) : '');
          return mKey === dKey;
        });

        let dayNetCarbs = 0, dayFat = 0, dayProtein = 0, calInFromMeals = 0;
        for (const m of dayMeals) {
          dayNetCarbs += Number(m.net_carbs || 0);
          dayFat += Number(m.fat || 0);
          dayProtein += Number(m.protein || 0);
          calInFromMeals += Number(m.calories || 0);
        }

        const calIn = Math.max(calInFromMeals, Number(daysNutritionMap[dKey] || 0));
        const dObj = new Date(dKey + 'T12:00:00');
        const dayLabel = daysOfWeek[dObj.getDay()] + ' ' + String(dObj.getDate()).padStart(2, '0') + '/' + String(dObj.getMonth() + 1).padStart(2, '0');

        const existingIdx = history.findIndex(h => h.date === dKey);
        const prev = existingIdx !== -1 ? history[existingIdx] : null;

        const entry = {
          date: dKey,
          day_label: dayLabel,
          steps: Math.round(totalSteps || (prev ? prev.steps : 0)),
          active_calories: Math.round(totalActiveCal || (prev ? prev.active_calories : 0)),
          calories_out: totalBurn || (prev ? prev.calories_out : dailyBmr),
          calories_in: Math.round(calIn || (prev ? prev.calories_in : 0)),
          net_carbs: Math.round(dayNetCarbs * 10) / 10 || (prev ? prev.net_carbs : 0) || 0,
          fat: Math.round(dayFat * 10) / 10 || (prev ? prev.fat : 0) || 0,
          protein: Math.round(dayProtein * 10) / 10 || (prev ? prev.protein : 0) || 0,
          ketones: (prev && prev.ketones) ? prev.ketones : 0.8
        };

        if (existingIdx !== -1) {
          history[existingIdx] = { ...history[existingIdx], ...entry };
        } else {
          history.push(entry);
        }
      }

      // Filtrar estrictamente solo días del protocolo
      history = history.filter(h => h && h.date && h.date >= protocolStartKey);
      history.sort((a, b) => a.date.localeCompare(b.date));
      localStorage.setItem('ketotrack_daily_history', JSON.stringify(history));

      if (typeof recalculateClientState === 'function') {
        recalculateClientState();
      }
      if (typeof renderChartsView === 'function') {
        renderChartsView();
      }
    } catch (err) {
      console.warn('Error en syncHistoricalDays:', err);
    }
  }

  showDiagnosticsModal() {
    const diag = this.lastDiagnostics;
    const permStatus = diag.permissions 
      ? (diag.permissions.authorized ? 'Todos concedidos ✓' : 'Denegados: ' + (diag.permissions.denied || []).join(', '))
      : 'No verificado';

    const sourcesText = (diag.stepsSources && diag.stepsSources.length > 0)
      ? diag.stepsSources.join(', ')
      : 'Ninguna detectada';

    const errorsText = Object.keys(diag.errors).length > 0
      ? Object.entries(diag.errors).map(([k, v]) => k + ': ' + v).join('\n')
      : 'Ninguno ✓';

    const textContent = [
      '📊 DIAGNÓSTICO DE SINCRONIZACIÓN GARMIN / HEALTH CONNECT',
      '────────────────────────────────────────────────────────',
      '• Última sincronización: ' + (diag.timestamp || 'Nunca'),
      '• Permisos Health Connect: ' + permStatus,
      '• Pasos detectados: ' + diag.stepsValue.toLocaleString() + ' (de ' + diag.stepsFound + ' muestras)',
      '• Calorías Activas: ' + diag.caloriesValue + ' kcal',
      '• Calorías Totales Health Connect: ' + (diag.totalCaloriesValue ? diag.totalCaloriesValue + ' kcal' : 'No leídas o 0'),
      '• Ritmo en Reposo: ' + (diag.restingHr ? diag.restingHr + ' bpm' : '--'),
      '• Peso corporal: ' + (diag.weightValue ? diag.weightValue + ' kg' : '--'),
      '• Fuentes detectadas: ' + sourcesText,
      '• Errores registrados: ' + errorsText,
      '────────────────────────────────────────────────────────',
      '💡 SI LAS MÉTRICAS NO APARECEN:',
      '1. Abre la app Garmin Connect en tu teléfono.',
      '2. Desliza hacia abajo en la pantalla principal para que el reloj transfiera los datos a Garmin Connect.',
      '3. En Garmin Connect > Ajustes > Health Connect, verifica que esté Activado.',
      '4. Vuelve a KetoTrack y toca "Sincronizar Ahora".'
    ].join('\n');

    let modalEl = document.getElementById('hcDiagnosticsModal');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'hcDiagnosticsModal';
      modalEl.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:999999;display:flex;align-items:center;justify-content:center;padding:16px;';
      modalEl.innerHTML = `
        <div style="background:#0f172a;border:1px solid #334155;border-radius:14px;max-width:480px;width:100%;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.6);">
          <div style="padding:14px 16px;border-bottom:1px solid #334155;display:flex;justify-content:space-between;align-items:center;">
            <strong style="color:#f8fafc;font-size:0.95rem;">📊 Diagnóstico de Health Connect</strong>
            <button type="button" id="btnCloseHCDiag" style="background:none;border:none;color:#94a3b8;font-size:1.5rem;cursor:pointer;line-height:1;">&times;</button>
          </div>
          <div style="padding:14px 16px;overflow-y:auto;flex:1;">
            <textarea id="txtHCDiagContent" readonly style="width:100%;height:230px;background:#020617;border:1px solid #1e293b;border-radius:8px;color:#e2e8f0;font-family:monospace;font-size:0.75rem;padding:10px;resize:none;box-sizing:border-box;line-height:1.4;"></textarea>
          </div>
          <div style="padding:12px 16px;border-top:1px solid #334155;display:flex;gap:10px;justify-content:flex-end;">
            <button type="button" id="btnCopyHCDiag" class="btn btn-sm btn-outline" style="border-color:#38bdf8;color:#38bdf8;">📋 Copiar</button>
            <button type="button" id="btnDoneHCDiag" class="btn btn-sm btn-primary">Entendido</button>
          </div>
        </div>
      `;
      document.body.appendChild(modalEl);

      const closeFn = () => { modalEl.style.display = 'none'; };
      modalEl.querySelector('#btnCloseHCDiag').addEventListener('click', closeFn);
      modalEl.querySelector('#btnDoneHCDiag').addEventListener('click', closeFn);
      modalEl.querySelector('#btnCopyHCDiag').addEventListener('click', async () => {
        try {
          const txt = modalEl.querySelector('#txtHCDiagContent').value;
          await navigator.clipboard.writeText(txt);
          if (typeof showToast === 'function') showToast('📋 Diagnóstico copiado al portapapeles');
        } catch (e) {
          console.warn('Clipboard write error:', e);
        }
      });
    }

    const txtBox = modalEl.querySelector('#txtHCDiagContent');
    if (txtBox) txtBox.value = textContent;
    modalEl.style.display = 'flex';
  }

  updateUIStatus(msg) {
    const el = document.getElementById('healthConnectStatusText');
    if (el) {
      el.textContent = msg;
    }
    const heroSync = document.getElementById('garminHeroSyncStatus');
    if (heroSync) {
      heroSync.textContent = msg.length > 40 ? (msg.slice(0, 37) + '...') : msg;
      heroSync.title = msg;
    }
  }
}

// Instancia global
window.healthConnectManager = new HealthConnectManager();

