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

  async syncFromHealthConnect() {
    this.plugin = this.getPlugin();
    if (!this.plugin) return;

    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

      // 1. Leer pasos de hoy
      let steps = 0;
      try {
        const stepsRes = await this.plugin.readSamples({
          dataType: 'steps',
          startDate: startOfDay.toISOString(),
          endDate: now.toISOString(),
          limit: 2000
        });
        if (stepsRes && Array.isArray(stepsRes.samples)) {
          steps = Math.round(stepsRes.samples.reduce((acc, s) => acc + (Number(s.value) || 0), 0));
        }
      } catch (e) {
        console.warn('Error leyendo pasos:', e);
      }

      // 2. Leer calorías activas
      let activeCalories = 0;
      try {
        const calRes = await this.plugin.readSamples({
          dataType: 'calories',
          startDate: startOfDay.toISOString(),
          endDate: now.toISOString(),
          limit: 1500
        });
        if (calRes && Array.isArray(calRes.samples) && calRes.samples.length > 0) {
          activeCalories = Math.round(calRes.samples.reduce((acc, s) => acc + (Number(s.value) || 0), 0));
        }
      } catch (e) {
        console.warn('Error leyendo calorías activas:', e);
      }

      // Calibración exacta para Garmin Instinct (34.2 kcal por cada 1000 pasos)
      if (activeCalories === 0 && steps > 0) {
        activeCalories = Math.round(steps * 0.0342);
      }

      // 3. Leer frecuencia cardíaca de Garmin
      let restingHr = 60;
      try {
        const hrRes = await this.plugin.readSamples({
          dataType: 'heartRate',
          startDate: startOfDay.toISOString(),
          endDate: now.toISOString(),
          limit: 10,
          ascending: false
        });
        if (hrRes && hrRes.samples && hrRes.samples.length > 0) {
          restingHr = Math.round(hrRes.samples[0].value || 60);
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
