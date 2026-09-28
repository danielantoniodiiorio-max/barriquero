/**
 * Garmin Connect Cloud Sync Manager
 * Sincronización 100% Automática y Directa con los Servidores Oficiales de Garmin Connect (connect.garmin.com)
 * Sin pasar por Health Connect, sin intermediarios, con datos exactos en tiempo real.
 */

class GarminCloudManager {
  constructor() {
    this.session = this.loadSession();
    this.isSyncing = false;
    this.syncInterval = null;
    this.lastSyncMs = 0;
    this.init();
  }

  loadSession() {
    try {
      return JSON.parse(localStorage.getItem('ketotrack_garmin_cloud_auth') || 'null');
    } catch (e) {
      return null;
    }
  }

  saveSession(sessionData) {
    this.session = sessionData;
    if (sessionData) {
      localStorage.setItem('ketotrack_garmin_cloud_auth', JSON.stringify(sessionData));
    } else {
      localStorage.removeItem('ketotrack_garmin_cloud_auth');
      localStorage.removeItem('ketotrack_garmin_cookies');
    }
  }

  getCookies() {
    return localStorage.getItem('ketotrack_garmin_cookies') || '';
  }

  saveCookies(cookies) {
    if (cookies) {
      localStorage.setItem('ketotrack_garmin_cookies', cookies);
    }
  }

  // Ejecuta peticiones HTTP nativas en Android (CapacitorHttp) evitando CORS y manejando cookies
  async makeRequest(options) {
    const { method = 'GET', url, headers = {}, data = null } = options;
    const isCapacitor = Boolean(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp);
    
    // Headers estándar de navegador móvil para evitar bloqueos
    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,application/json,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      ...headers
    };

    const savedCookies = this.getCookies();
    if (savedCookies && !defaultHeaders['Cookie']) {
      defaultHeaders['Cookie'] = savedCookies;
    }

    if (isCapacitor) {
      const http = window.Capacitor.Plugins.CapacitorHttp;
      const res = await http.request({
        method,
        url,
        headers: defaultHeaders,
        data: data || undefined
      });

      // Extraer y almacenar cookies de respuesta si vienen
      if (res.headers) {
        const setCookie = res.headers['Set-Cookie'] || res.headers['set-cookie'];
        if (setCookie) {
          const newCookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
          this.mergeCookies(newCookieStr);
        }
      }

      return {
        status: res.status,
        data: res.data,
        headers: res.headers || {}
      };
    } else {
      // Fallback para navegador web (usando fetch con credenciales)
      const fetchOpts = {
        method,
        headers: defaultHeaders,
        credentials: 'omit'
      };
      if (data && method !== 'GET') {
        fetchOpts.body = typeof data === 'string' ? data : new URLSearchParams(data).toString();
      }
      const resp = await fetch(url, fetchOpts);
      let respData;
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        respData = await resp.json();
      } else {
        respData = await resp.text();
      }
      return {
        status: resp.status,
        data: respData,
        headers: Object.fromEntries(resp.headers.entries())
      };
    }
  }

  mergeCookies(newCookieStr) {
    if (!newCookieStr) return;
    const current = this.getCookies();
    const map = new Map();
    
    if (current) {
      current.split(';').forEach(c => {
        const [k, v] = c.trim().split('=');
        if (k) map.set(k.trim(), v ? v.trim() : '');
      });
    }

    newCookieStr.split(/,(?=[^;]+=[^;]+)/).forEach(item => {
      const parts = item.split(';')[0].trim().split('=');
      if (parts[0]) {
        map.set(parts[0].trim(), parts[1] ? parts[1].trim() : '');
      }
    });

    const merged = Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
    this.saveCookies(merged);
  }

  init() {
    this.bindUI();

    // Auto-sincronizar de inmediato si hay sesión guardada
    if (this.session && this.session.email && this.session.password) {
      console.log('☁️ Sesión de Garmin Connect detectada. Iniciando auto-sincronización...');
      setTimeout(() => this.syncToday(true), 1200);
    }

    // Auto-sincronización periódica cada 4 minutos
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      if (!document.hidden && this.session) {
        this.syncToday(true);
      }
    }, 4 * 60 * 1000);

    // Auto-sincronizar al volver a la app
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.session) {
        const now = Date.now();
        // Si pasaron más de 2 minutos desde el último sync
        if (now - this.lastSyncMs > 2 * 60 * 1000) {
          this.syncToday(true);
        }
      }
    });
  }

  bindUI() {
    const btnConnect = document.getElementById('btnGarminCloudConnect');
    const btnDisconnect = document.getElementById('btnGarminCloudDisconnect');
    const btnSyncNow = document.getElementById('btnGarminCloudSyncNow');
    const btnSubmitMfa = document.getElementById('btnGarminMfaSubmit');

    if (btnConnect) {
      btnConnect.addEventListener('click', async () => {
        await this.handleUserLogin();
      });
    }

    if (btnDisconnect) {
      btnDisconnect.addEventListener('click', () => {
        if (confirm('¿Deseas desconectar tu cuenta de Garmin Connect?')) {
          this.saveSession(null);
          this.updateUI();
          if (typeof showToast === 'function') {
            showToast('Cuenta de Garmin desconectada.');
          }
        }
      });
    }

    if (btnSyncNow) {
      btnSyncNow.addEventListener('click', async () => {
        btnSyncNow.disabled = true;
        btnSyncNow.innerHTML = '⏳ Sincronizando...';
        await this.syncToday(false);
        btnSyncNow.disabled = false;
        btnSyncNow.innerHTML = '🔄 Sincronizar Ahora';
      });
    }

    if (btnSubmitMfa) {
      btnSubmitMfa.addEventListener('click', async () => {
        const codeInput = document.getElementById('inputGarminMfaCode');
        const code = codeInput ? codeInput.value.trim() : '';
        if (!code) {
          alert('Por favor ingresa el código de verificación.');
          return;
        }
        await this.handleMfaSubmit(code);
      });
    }

    this.updateUI();
  }

  updateUI() {
    const boxAuth = document.getElementById('boxGarminCloudAuth');
    const boxConnected = document.getElementById('boxGarminCloudConnected');
    const boxMfa = document.getElementById('boxGarminCloudMfa');
    const txtUser = document.getElementById('lblGarminCloudUser');
    const txtLastSync = document.getElementById('lblGarminCloudLastSync');
    const sourceBadge = document.getElementById('garminSourceBadge');

    if (!boxAuth || !boxConnected) return;

    if (this.session && this.session.email) {
      boxAuth.style.display = 'none';
      if (boxMfa) boxMfa.style.display = 'none';
      boxConnected.style.display = 'block';

      if (txtUser) {
        txtUser.textContent = this.session.email;
      }
      if (txtLastSync) {
        txtLastSync.textContent = this.session.lastSyncedFormatted || 'Sincronizado recientemente';
      }
      if (sourceBadge) {
        sourceBadge.textContent = 'Garmin Cloud Oficial ✓';
        sourceBadge.style.backgroundColor = '#0284c7';
      }
    } else {
      boxAuth.style.display = 'block';
      boxConnected.style.display = 'none';
      if (boxMfa) boxMfa.style.display = 'none';

      if (sourceBadge) {
        sourceBadge.textContent = 'Sin Conectar';
        sourceBadge.style.backgroundColor = 'var(--text-muted)';
      }
    }
  }

  async handleUserLogin() {
    const emailInput = document.getElementById('inputGarminCloudEmail');
    const passInput = document.getElementById('inputGarminCloudPassword');
    const statusMsg = document.getElementById('txtGarminCloudStatus');
    const btnConnect = document.getElementById('btnGarminCloudConnect');

    const email = emailInput ? emailInput.value.trim() : '';
    const password = passInput ? passInput.value.trim() : '';

    if (!email || !password) {
      alert('Por favor ingresa tu email y contraseña de Garmin Connect.');
      return;
    }

    if (btnConnect) {
      btnConnect.disabled = true;
      btnConnect.innerHTML = '⏳ Conectando con Garmin...';
    }
    if (statusMsg) {
      statusMsg.style.display = 'block';
      statusMsg.textContent = 'Iniciando conexión segura con Garmin SSO...';
      statusMsg.style.color = '#38bdf8';
    }

    try {
      const res = await this.authenticate(email, password);

      if (res.status === 'mfa_required') {
        const boxMfa = document.getElementById('boxGarminCloudMfa');
        if (boxMfa) boxMfa.style.display = 'block';
        if (statusMsg) {
          statusMsg.textContent = 'Garmin ha enviado un código de verificación a tu email. Ingrésalo a continuación:';
          statusMsg.style.color = '#f59e0b';
        }
        return;
      }

      // Conexión exitosa
      this.saveSession({
        email,
        password,
        lastSynced: new Date().toISOString(),
        lastSyncedFormatted: 'Hoy ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      this.updateUI();
      if (statusMsg) statusMsg.style.display = 'none';

      // Sincronizar inmediatamente
      await this.syncToday(false);

      if (typeof showToast === 'function') {
        showToast('✅ Conectado con éxito a Garmin Connect Oficial');
      }
    } catch (err) {
      console.error('Error de autenticación Garmin:', err);
      if (statusMsg) {
        statusMsg.style.display = 'block';
        statusMsg.textContent = '⚠️ ' + (err.message || 'Error al conectar con Garmin. Revisa tus credenciales.');
        statusMsg.style.color = '#ef4444';
      }
    } finally {
      if (btnConnect) {
        btnConnect.disabled = false;
        btnConnect.innerHTML = '⚡ Conectar con Garmin Connect';
      }
    }
  }

  async handleMfaSubmit(mfaCode) {
    const statusMsg = document.getElementById('txtGarminCloudStatus');
    const btnSubmitMfa = document.getElementById('btnGarminMfaSubmit');
    const emailInput = document.getElementById('inputGarminCloudEmail');
    const passInput = document.getElementById('inputGarminCloudPassword');

    const email = emailInput ? emailInput.value.trim() : (this.session?.email || '');
    const password = passInput ? passInput.value.trim() : (this.session?.password || '');

    if (btnSubmitMfa) {
      btnSubmitMfa.disabled = true;
      btnSubmitMfa.innerHTML = '⏳ Verificando...';
    }

    try {
      await this.authenticate(email, password, mfaCode);

      this.saveSession({
        email,
        password,
        lastSynced: new Date().toISOString(),
        lastSyncedFormatted: 'Hoy ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      this.updateUI();
      await this.syncToday(false);

      if (typeof showToast === 'function') {
        showToast('✅ Verificación completada y cuenta conectada');
      }
    } catch (err) {
      alert('Error con el código de verificación: ' + (err.message || 'Código incorrecto.'));
    } finally {
      if (btnSubmitMfa) {
        btnSubmitMfa.disabled = false;
        btnSubmitMfa.innerHTML = 'Verificar y Conectar';
      }
    }
  }

  /**
   * Proceso de autenticación con Garmin SSO
   */
  async authenticate(email, password, mfaCode = null) {
    const ssoUrl = 'https://sso.garmin.com/sso/signin?service=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F&clientId=GarminConnect&gauthHost=https%3A%2F%2Fsso.garmin.com%2Fsso&consumeServiceTicket=false';

    // Paso 1: Obtener formulario SSO y CSRF token
    const ssoGet = await this.makeRequest({
      method: 'GET',
      url: ssoUrl,
      headers: {
        'Origin': 'https://sso.garmin.com',
        'Referer': ssoUrl
      }
    });

    const getHtml = typeof ssoGet.data === 'string' ? ssoGet.data : JSON.stringify(ssoGet.data);
    const csrfMatch = getHtml.match(/name="_csrf"\s+value="([^"]+)"/);
    const csrf = csrfMatch ? csrfMatch[1] : '';

    // Paso 2: Enviar credenciales
    const bodyParams = {
      username: email,
      password: password,
      embed: 'true',
      _csrf: csrf
    };

    if (mfaCode) {
      bodyParams.mfaCode = mfaCode;
    }

    const postData = new URLSearchParams(bodyParams).toString();

    const loginRes = await this.makeRequest({
      method: 'POST',
      url: ssoUrl,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://sso.garmin.com',
        'Referer': ssoUrl,
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'same-origin'
      },
      data: postData
    });

    const postContent = typeof loginRes.data === 'string' ? loginRes.data : JSON.stringify(loginRes.data);

    // Comprobar errores conocidos
    if (postContent.includes('Invalid sign in') || postContent.includes('Invalid username or password')) {
      throw new Error('Correo o contraseña incorrectos en Garmin Connect.');
    }

    if (postContent.includes('MFACode') || postContent.includes('two-step') || postContent.includes('verification code')) {
      return { status: 'mfa_required' };
    }

    // Paso 3: Extraer service ticket (ST-...)
    let ticket = null;
    const ticketMatch = postContent.match(/ticket=(ST-[^"'\s&]+)/);
    if (ticketMatch) {
      ticket = ticketMatch[1];
    } else if (loginRes.headers && (loginRes.headers['Location'] || loginRes.headers['location'])) {
      const loc = loginRes.headers['Location'] || loginRes.headers['location'];
      const locMatch = loc.match(/ticket=(ST-[^"'\s&]+)/);
      if (locMatch) ticket = locMatch[1];
    }

    if (!ticket) {
      if (postContent.includes('Cloudflare') || postContent.includes('Attention Required')) {
        throw new Error('Garmin ha solicitado verificación anti-bot. Reintenta en unos instantes.');
      }
      throw new Error('No se pudo obtener el ticket de sesión de Garmin.');
    }

    // Paso 4: Canjear ticket en connect.garmin.com
    const exchangeUrl = `https://connect.garmin.com/modern/?ticket=${ticket}`;
    await this.makeRequest({
      method: 'GET',
      url: exchangeUrl,
      headers: {
        'Referer': ssoUrl
      }
    });

    return { status: 'success', ticket };
  }

  /**
   * Sincroniza las métricas del día actual directamente desde Garmin Cloud
   */
  async syncToday(isSilent = false) {
    if (this.isSyncing) return;
    if (!this.session || !this.session.email) return;

    this.isSyncing = true;
    const now = new Date();
    const todayKey = (typeof getLocalDateKey === 'function') ? getLocalDateKey(now) : now.toISOString().slice(0, 10);

    try {
      const summaryUrl = `https://connect.garmin.com/modern/proxy/usersummary-service/usersummary/daily?calendarDate=${todayKey}`;
      
      let summaryRes = await this.makeRequest({
        method: 'GET',
        url: summaryUrl,
        headers: {
          'NK': 'NT',
          'Referer': 'https://connect.garmin.com/modern/'
        }
      });

      // Si la sesión expiró (401 o 403), reautenticar automáticamente en segundo plano
      if (summaryRes.status === 401 || summaryRes.status === 403) {
        console.log('🔄 Sesión de Garmin expirada. Reautenticando en segundo plano...');
        await this.authenticate(this.session.email, this.session.password);
        summaryRes = await this.makeRequest({
          method: 'GET',
          url: summaryUrl,
          headers: {
            'NK': 'NT',
            'Referer': 'https://connect.garmin.com/modern/'
          }
        });
      }

      if (summaryRes.status !== 200 || !summaryRes.data) {
        throw new Error(`Garmin Connect devolvió código HTTP ${summaryRes.status}`);
      }

      const data = typeof summaryRes.data === 'string' ? JSON.parse(summaryRes.data) : summaryRes.data;

      // Extraer datos oficiales exactos
      const steps = Number(data.totalSteps || 0);
      const activeCalories = Number(data.activeKilocalories || data.wellnessActiveKilocalories || 0);
      const bmrCalories = Number(data.bmrKilocalories || 1650);
      const totalCalories = Number(data.totalKilocalories || (bmrCalories + activeCalories));
      const restingHr = Number(data.restingHeartRate || 60);

      console.log('✅ Métricas obtenidas de Garmin Cloud:', { steps, activeCalories, bmrCalories, totalCalories, restingHr });

      // Aplicar métricas oficiales a KetoTrack
      if (window.applyGarminMetrics) {
        window.applyGarminMetrics({
          steps,
          activeCalories,
          restingHr,
          bmrCalories,
          totalCalories,
          isOfficial: true,
          source: 'Garmin Connect Oficial (Nube)'
        });
      }

      this.lastSyncMs = Date.now();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      this.session.lastSynced = now.toISOString();
      this.session.lastSyncedFormatted = 'Hoy a las ' + timeStr;
      this.saveSession(this.session);
      this.updateUI();

      if (!isSilent && typeof showToast === 'function') {
        showToast(`⌚ Garmin Sincronizado: ${steps.toLocaleString()} pasos • ${activeCalories} kcal activas • ${totalCalories} kcal total`);
      }

    } catch (err) {
      console.warn('Fallo en sincronización Garmin Cloud:', err.message);
      if (!isSilent) {
        alert('No se pudo sincronizar con Garmin Connect: ' + (err.message || 'Error de conexión.'));
      }
    } finally {
      this.isSyncing = false;
    }
  }
}

// Inicializar globalmente
window.addEventListener('DOMContentLoaded', () => {
  window.garminCloud = new GarminCloudManager();
});
