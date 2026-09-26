/**
 * Cliente de Sincronización Automática con Google Health Connect (Android 15)
 * Lee pasos, calorías activas, ritmo cardíaco y peso directamente de Garmin a través de Health Connect.
 */

class HealthConnectManager {
  constructor() {
    this.isNative = false;
    this.plugin = null;
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
      console.log('📱 Modo Nativo Android detectado. Verificando Health Connect...');
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
        await this.requestPermissionAndSync();
        btnConnect.disabled = false;
        btnConnect.innerHTML = '🔄 Sincronizar Ahora';
      });
    }
  }

  async setupAutoSync() {
    await this.requestPermissionAndSync(true);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.syncFromHealthConnect();
      }
    });

    setInterval(() => {
      if (!document.hidden) {
        this.syncFromHealthConnect();
      }
    }, 3 * 60 * 1000);
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

      this.updateUIStatus('Solicitando permisos a Google Health Connect...');
      try {
        await this.plugin.requestAuthorization({
          read: ['steps', 'calories', 'heartRate', 'weight'],
          write: []
        });
      } catch (authErr) {
        console.warn('Fallo con permisos ampliados, solicitando pasos y calorías:', authErr);
        await this.plugin.requestAuthorization({
          read: ['steps', 'calories'],
          write: []
        });
      }

      this.updateUIStatus('Permisos concedidos. Leyendo métricas de Garmin...');
      await this.syncFromHealthConnect();
      return true;

    } catch (err) {
      console.error('Error al conectar con Health Connect:', err);
      this.updateUIStatus('Error al conectar: ' + (err.message || err));
      return false;
    }
  }

  /**
   * Extrae de forma estricta las métricas de Garmin evitando sumar múltiples fuentes
   * (Google Fit, Samsung Health o podómetro del teléfono) que duplican o triplican los pasos.
   */
  extractGarminMetric(samples) {
    if (!Array.isArray(samples) || samples.length === 0) return 0;

    // 1. Filtrar por Garmin Connect (paquete com.garmin.android.apps.connectmobile o dispositivo Garmin)
    const garminSamples = samples.filter(s => {
      const src = ((s.sourceId || '') + ' ' + (s.sourceName || '')).toLowerCase();
      return src.includes('garmin') || src.includes('connectmobile');
    });

    const targetList = garminSamples.length > 0 ? garminSamples : null;

    if (targetList) {
      // Deduplicar registros con mismo rango de tiempo para evitar sumas duplicadas
      const seenRanges = new Set();
      let total = 0;
      for (const s of targetList) {
        const key = (s.startDate || '') + '_' + (s.endDate || '');
        if (key && seenRanges.has(key)) continue;
        if (key) seenRanges.add(key);
        total += Number(s.value) || 0;
      }
      return Math.round(total);
    }

    // 2. Si no hay etiqueta explícita de Garmin, agrupar por origen único y tomar el origen principal (NUNCA sumarlos todos juntos)
    const bySource = {};
    for (const s of samples) {
      const src = s.sourceId || s.sourceName || 'default';
      bySource[src] = (bySource[src] || 0) + (Number(s.value) || 0);
    }

    const sourceTotals = Object.values(bySource);
    return Math.round(Math.max(0, ...sourceTotals));
  }

  async syncFromHealthConnect() {
    this.plugin = this.getPlugin();
    if (!this.plugin) return;

    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

      // 1. Leer pasos de hoy (Filtrado estricto para Garmin Connect)
      let steps = 0;
      try {
        const stepsRes = await this.plugin.readSamples({
          dataType: 'steps',
          startDate: startOfDay.toISOString(),
          endDate: now.toISOString(),
          limit: 3000
        });
        if (stepsRes && Array.isArray(stepsRes.samples)) {
          steps = this.extractGarminMetric(stepsRes.samples);
        }
      } catch (e) {
        console.warn('Error leyendo pasos:', e);
      }

      // 2. Leer calorías activas (Filtrado estricto para Garmin Connect)
      let activeCalories = 0;
      try {
        const calRes = await this.plugin.readSamples({
          dataType: 'calories',
          startDate: startOfDay.toISOString(),
          endDate: now.toISOString(),
          limit: 2000
        });
        if (calRes && Array.isArray(calRes.samples) && calRes.samples.length > 0) {
          activeCalories = this.extractGarminMetric(calRes.samples);
        }
      } catch (e) {
        console.warn('Error leyendo calorías activas:', e);
      }

      // Si Garmin no exportó muestras de calorías activas en Health Connect,
      // calcular con el factor real verificado de Garmin (~31.84 kcal por cada 1.000 pasos: 27.015 pasos = 860 kcal)
      if (activeCalories === 0 && steps > 0) {
        activeCalories = Math.round(steps * 0.03184);
      }

      // 3. Leer frecuencia cardíaca en reposo de Garmin
      let restingHr = 52;
      try {
        const hrRes = await this.plugin.readSamples({
          dataType: 'heartRate',
          startDate: startOfDay.toISOString(),
          endDate: now.toISOString(),
          limit: 100,
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
            // El RHR (resting heart rate) corresponde a los valores más bajos en reposo del día
            const lowIdx = Math.min(2, bpmValues.length - 1);
            restingHr = Math.round(bpmValues[lowIdx]);
          }
        }
      } catch (e) {
        console.warn('Error leyendo ritmo cardíaco:', e);
      }

      // 4. Leer peso corporal de balanza inteligente si está disponible
      try {
        const weightRes = await this.plugin.readSamples({
          dataType: 'weight',
          startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: now.toISOString(),
          limit: 1,
          ascending: false
        });
        if (weightRes && weightRes.samples && weightRes.samples.length > 0) {
          const wKg = weightRes.samples[0].value;
          if (window.applyGarminWeight) {
            window.applyGarminWeight(wKg, 'Health Connect (Garmin)');
          }
        }
      } catch (e) {
        console.warn('Error leyendo peso:', e);
      }

      // 5. Actualizar estado y recalcular motor de cetosis inmediatamente
      if (window.applyGarminMetrics) {
        window.applyGarminMetrics(steps, activeCalories, restingHr, 'Google Health Connect (Garmin)');
      }

      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.updateUIStatus('Sincronizado: ' + timeStr + ' • ' + steps.toLocaleString() + ' pasos y ' + activeCalories + ' kcal de Garmin.');

    } catch (err) {
      console.error('Fallo en sincronización con Health Connect:', err);
      this.updateUIStatus('Error al sincronizar datos: ' + (err.message || err));
    }
  }

  updateUIStatus(msg) {
    const el = document.getElementById('healthConnectStatusText');
    if (el) {
      el.textContent = msg;
    }
  }
}

// Instancia global
window.healthConnectManager = new HealthConnectManager();
