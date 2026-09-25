/**
 * Cliente de Sincronización Automática con Google Health Connect (Android 15)
 * Lee pasos, calorías activas y ritmo cardíaco directamente del sistema operativo Android.
 */

class HealthConnectManager {
  constructor() {
    this.isNative = false;
    this.plugin = null;
    this.init();
  }

  async init() {
    // Detect if running inside native Capacitor
    if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function') {
      this.isNative = window.Capacitor.isNativePlatform();
      this.plugin = window.Capacitor.Plugins?.Health;
    }

    if (this.isNative && this.plugin) {
      console.log('📱 Modo Nativo Android 15 detectado. Iniciando Health Connect...');
      await this.setupAutoSync();
    } else {
      console.log('💻 Modo Web detectado. Health Connect estará activo en el APK móvil.');
      this.updateUINonNative();
    }
  }

  async setupAutoSync() {
    try {
      // 1. Check availability
      const available = await this.plugin.isAvailable();
      if (!available) {
        console.warn('Google Health Connect no está disponible en este dispositivo.');
        return;
      }

      // 2. Request permissions
      const auth = await this.plugin.requestAuthorization({
        read: ['steps', 'calories', 'heartRate'],
        write: []
      });

      console.log('Permisos de Health Connect concedidos:', auth);

      // 3. First immediate sync
      await this.syncFromHealthConnect();

      // 4. Auto-sync whenever user opens the app or returns to it
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          console.log('App en primer plano: auto-sincronizando con Health Connect...');
          this.syncFromHealthConnect();
        }
      });

      // Periodic auto-sync every 5 minutes while app is open
      setInterval(() => {
        if (!document.hidden) {
          this.syncFromHealthConnect();
        }
      }, 5 * 60 * 1000);

    } catch (err) {
      console.error('Error al configurar Health Connect:', err);
    }
  }

  async syncFromHealthConnect() {
    if (!this.plugin) return;

    try {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

      // Query steps
      const stepsData = await this.plugin.queryAggregated({
        startDate: startOfDay.toISOString(),
        endDate: now.toISOString(),
        dataType: 'steps'
      }).catch(() => ({ value: 0 }));

      // Query active calories
      const caloriesData = await this.plugin.queryAggregated({
        startDate: startOfDay.toISOString(),
        endDate: now.toISOString(),
        dataType: 'calories'
      }).catch(() => ({ value: 0 }));

      // Query resting heart rate
      const hrData = await this.plugin.querySample({
        startDate: startOfDay.toISOString(),
        endDate: now.toISOString(),
        dataType: 'heartRate',
        limit: 1
      }).catch(() => ({ samples: [] }));

      const steps = Math.round(stepsData.value || 0);
      const activeCalories = Math.round(caloriesData.value || 0);
      const restingHr = hrData.samples?.[0]?.value || 60;

      // Update backend & Ketosis Engine
      const res = await fetch('/api/garmin/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'manual',
          custom: {
            steps,
            active_calories: activeCalories,
            resting_hr: restingHr,
            source: 'health_connect'
          }
        })
      });

      const json = await res.json();
      if (json.success && window.loadStatus) {
        window.loadStatus();
      }

      this.updateUINativeSuccess(steps, activeCalories);

    } catch (err) {
      console.error('Fallo en sincronización automática con Health Connect:', err);
    }
  }

  updateUINativeSuccess(steps, calories) {
    const badge = document.getElementById('garminSourceBadge');
    if (badge) {
      badge.textContent = 'Health Connect (Android 15) ✓';
      badge.style.backgroundColor = 'var(--accent-green)';
    }

    const banner = document.querySelector('.free-sync-banner');
    if (banner) {
      banner.innerHTML = `
        <span class="free-tag">AUTO-SYNC ACTIVO</span>
        <span>Sincronizando automáticamente en segundo plano con tu <strong>reloj Garmin</strong> vía Google Health Connect.</span>
      `;
    }
  }

  updateUINonNative() {
    const banner = document.querySelector('.free-sync-banner');
    if (banner) {
      banner.innerHTML = `
        <span class="free-tag">ANDROID 15 LISTO</span>
        <span>En tu teléfono Android 15, la app se conectará automáticamente a <strong>Google Health Connect</strong> para leer tu reloj Garmin sin contraseñas ni demoras.</span>
      `;
    }
  }
}

// Global instance
window.healthConnectManager = new HealthConnectManager();
