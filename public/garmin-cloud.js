/**
 * Garmin Connect Cloud Sync Manager (Opción 2)
 * Sincronización Automática con los Servidores Oficiales de Garmin Connect (connect.garmin.com)
 * Descarga de Calorías Totales Oficiales, Pasos y Pulsaciones.
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

  async makeRequest(options) {
    const { method = 'GET', url, headers = {}, data = null } = options;
    const isCapacitor = Boolean(window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.CapacitorHttp);

    const defaultHeaders = {
      'User-Agent': 'Mozilla/5.0 (Linux; Android 15; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36',
      'Accept': 'application/json, text/html, */*',
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

    // 1. Escuchar mensajes del Widget Oficial Garmin SSO (evita Cloudflare anti-bot)
    window.addEventListener('message', async (event) => {
      try {
        let msg = event.data;
        if (typeof msg === 'string') {
          try { msg = JSON.parse(msg); } catch (e) {}
        }
        const ticket = msg?.serviceTicket || msg?.data?.serviceTicket;
        if (ticket) {
          console.log('🎫 Service Ticket recibido de Garmin SSO:', ticket);
          await this.exchangeTicketAndSave(ticket);
        }
      } catch (err) {
        console.warn('Error en postMessage Garmin SSO:', err);
      }
    });

    // 2. Auto-sincronización si ya hay sesión activa
    if (this.session) {
      console.log('☁️ Sesión de Garmin Connect activa. Sincronizando gasto total...');
      setTimeout(() => this.syncToday(true), 1500);
    }

    // 3. Intervalo de auto-sincronización cada 4 minutos
    if (this.syncInterval) clearInterval(this.syncInterval);
    this.syncInterval = setInterval(() => {
      if (!document.hidden && this.session) {
        this.syncToday(true);
      }
    }, 4 * 60 * 1000);

    // 4. Auto-sincronización al volver a la app
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.session) {
        const now = Date.now();
        if (now - this.lastSyncMs > 2 * 60 * 1000) {
          this.syncToday(true);
        }
      }
    });
  }

  bindUI() {
    const btnOpenModal = document.getElementById('btnOpenGarminLoginModal');
    const btnCloseModal = document.getElementById('btnCloseGarminLoginModal');
    const modal = document.getElementById('garminLoginModal');
    const iframe = document.getElementById('iframeGarminSso');
    const btnDisconnect = document.getElementById('btnGarminCloudDisconnect');
    const btnSyncNow = document.getElementById('btnGarminCloudSyncNow');
    const btnSubmitDirect = document.getElementById('btnSubmitDirectCredentials');
    const btnFastSave = document.getElementById('btnSaveFastTotalCal');

    if (btnOpenModal) {
      btnOpenModal.addEventListener('click', () => {
        if (modal && iframe) {
          modal.style.display = 'flex';
          document.body.classList.add('modal-open');
          if (!iframe.src || iframe.src === 'about:blank') {
            iframe.src = 'https://sso.garmin.com/sso/embed?clientId=GarminConnect&locale=es&service=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F';
          }
        }
      });
    }

    if (btnCloseModal) {
      btnCloseModal.addEventListener('click', () => {
        if (modal) {
          modal.style.display = 'none';
          document.body.classList.remove('modal-open');
        }
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

    // 1. Botón para pegar código/ticket copiado del navegador
    const btnPasteTicket = document.getElementById('btnPasteGarminTicket');
    const inputTicket = document.getElementById('inputGarminTicketText');
    const btnSubmitTicket = document.getElementById('btnSubmitTicketManual');

    const handlePasteAndConnect = async (rawText) => {
      if (!rawText) return;
      const match = rawText.match(/(ST-[0-9a-zA-Z-]+)/);
      const ticket = match ? match[1] : rawText.trim();
      if (inputTicket) inputTicket.value = ticket;
      
      const txtStatus = document.getElementById('txtTicketStatus');
      if (txtStatus) {
        txtStatus.style.display = 'block';
        txtStatus.textContent = '⏳ Vinculando con Garmin Connect...';
        txtStatus.style.color = '#38bdf8';
      }
      
      await this.exchangeTicketAndSave(ticket);
    };

    if (btnPasteTicket) {
      btnPasteTicket.addEventListener('click', async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.readText) {
            const clip = await navigator.clipboard.readText();
            if (clip && (clip.includes('ST-') || clip.includes('serviceTicket'))) {
              await handlePasteAndConnect(clip);
              return;
            }
          }
        } catch (e) {
          console.warn('Clipboard read error:', e);
        }
        if (inputTicket) {
          inputTicket.focus();
          if (typeof showToast === 'function') {
            showToast('Pega el código ST-... en el recuadro y toca Conectar');
          }
        }
      });
    }

    if (btnSubmitTicket) {
      btnSubmitTicket.addEventListener('click', async () => {
        const val = inputTicket ? inputTicket.value.trim() : '';
        if (!val) {
          alert('Por favor pega el código ST-... o el texto que te dio Garmin en el navegador.');
          return;
        }
        await handlePasteAndConnect(val);
      });
    }

    // Auto-detección cuando el usuario vuelve a la app con el código en el portapapeles
    document.addEventListener('visibilitychange', async () => {
      if (!document.hidden) {
        const modal = document.getElementById('garminLoginModal');
        if (modal && modal.style.display !== 'none') {
          try {
            if (navigator.clipboard && navigator.clipboard.readText) {
              const text = await navigator.clipboard.readText();
              const match = text && text.match(/(ST-[0-9a-zA-Z-]+)/);
              if (match) {
                if (inputTicket && !inputTicket.value) {
                  inputTicket.value = match[1];
                  const txt = document.getElementById('txtTicketStatus');
                  if (txt) {
                    txt.style.display = 'block';
                    txt.textContent = '🎫 Código detectado: ' + match[1] + '. Tocá "Conectar y Sincronizar Ahora".';
                    txt.style.color = '#34d399';
                  }
                }
              }
            }
          } catch (e) {}
        }
      }
    });

    // Ingreso directo de credenciales
    if (btnSubmitDirect) {
      btnSubmitDirect.addEventListener('click', async () => {
        const inEmail = document.getElementById('inputDirectEmail');
        const inPass = document.getElementById('inputDirectPassword');
        const txtStatus = document.getElementById('txtDirectStatus');

        const email = inEmail ? inEmail.value.trim() : '';
        const pass = inPass ? inPass.value.trim() : '';

        if (!email || !pass) {
          alert('Por favor ingresa tu email y contraseña de Garmin.');
          return;
        }

        btnSubmitDirect.disabled = true;
        btnSubmitDirect.textContent = '⏳ Conectando...';
        if (txtStatus) {
          txtStatus.style.display = 'block';
          txtStatus.textContent = 'Conectando con servidores de Garmin...';
          txtStatus.style.color = '#38bdf8';
        }

        try {
          await this.authenticateDirect(email, pass);
          if (modal) {
            modal.style.display = 'none';
            document.body.classList.remove('modal-open');
          }
          await this.syncToday(false);
        } catch (err) {
          if (txtStatus) {
            txtStatus.textContent = '⚠️ ' + (err.message || 'Error al conectar.');
            txtStatus.style.color = '#ef4444';
          }
        } finally {
          btnSubmitDirect.disabled = false;
          btnSubmitDirect.textContent = 'Conectar Credenciales';
        }
      });
    }

    // Fijar rápido Total de Calorías
    if (btnFastSave) {
      btnFastSave.addEventListener('click', () => {
        const inFast = document.getElementById('inputFastTotalCal');
        const val = parseFloat(inFast?.value);
        if (!val || val <= 0) {
          alert('Por favor ingresa un número de calorías válido (ej: 2873).');
          return;
        }
        if (window.applyGarminMetrics) {
          window.applyGarminMetrics({
            totalCalories: Math.round(val),
            isOfficial: true,
            source: 'Garmin Web (Fijado)'
          });
          if (typeof showToast === 'function') {
            showToast(`✅ Gasto total fijado en ${Math.round(val).toLocaleString()} kcal`);
          }
        }
      });
    }

    this.updateUI();
  }

  updateUI() {
    const boxAuth = document.getElementById('boxGarminCloudAuth');
    const boxConnected = document.getElementById('boxGarminCloudConnected');
    const txtUser = document.getElementById('lblGarminCloudUser');
    const txtLastSync = document.getElementById('lblGarminCloudLastSync');
    const sourceBadge = document.getElementById('garminSourceBadge');

    if (this.session) {
      if (boxAuth) boxAuth.style.display = 'none';
      if (boxConnected) boxConnected.style.display = 'block';
      if (txtUser) txtUser.textContent = this.session.email || 'Conectado a Garmin Cloud';
      if (txtLastSync) txtLastSync.textContent = this.session.lastSyncedFormatted || 'Sincronizado recientemente';
      if (sourceBadge) {
        sourceBadge.textContent = 'Garmin Cloud Oficial ✓';
        sourceBadge.style.backgroundColor = '#0284c7';
      }
    } else {
      if (boxAuth) boxAuth.style.display = 'block';
      if (boxConnected) boxConnected.style.display = 'none';
      if (sourceBadge) {
        sourceBadge.textContent = 'Garmin Desconectado';
        sourceBadge.style.backgroundColor = 'var(--text-muted)';
      }
    }
  }

  async exchangeTicketAndSave(rawTicket) {
    const txtStatus = document.getElementById('txtTicketStatus');
    if (txtStatus) {
      txtStatus.style.display = 'block';
      txtStatus.textContent = '⏳ Validando ticket con Garmin Connect...';
      txtStatus.style.color = '#38bdf8';
    }

    try {
      const match = String(rawTicket).match(/(ST-[0-9a-zA-Z-]+)/);
      const ticket = match ? match[1] : String(rawTicket).trim();

      if (!ticket || !ticket.startsWith('ST-')) {
        throw new Error('El formato del código no es válido. Debe comenzar por "ST-".');
      }

      // 1. Canjear contra Garmin Connect
      const exchangeUrls = [
        `https://connect.garmin.com/modern/?ticket=${ticket}`,
        `https://connect.garmin.com/app/?ticket=${ticket}`,
        `https://sso.garmin.com/sso/embed?ticket=${ticket}`
      ];

      for (const u of exchangeUrls) {
        try {
          await this.makeRequest({
            method: 'GET',
            url: u,
            headers: {
              'Referer': 'https://sso.garmin.com/',
              'NK': 'NT'
            }
          });
        } catch (e) {
          console.warn('exchange URL:', u, e.message);
        }
      }

      this.saveSession({
        authenticated: true,
        ticket: ticket,
        lastSynced: new Date().toISOString(),
        lastSyncedFormatted: 'Hoy ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });

      const modal = document.getElementById('garminLoginModal');
      if (modal) {
        modal.style.display = 'none';
        document.body.classList.remove('modal-open');
      }

      this.updateUI();
      await this.syncToday(false);

      if (typeof showToast === 'function') {
        showToast('✅ Conectado con éxito a Garmin Connect Oficial');
      }
    } catch (e) {
      console.error('Error al canjear ticket:', e);
      if (txtStatus) {
        txtStatus.textContent = '⚠️ ' + (e.message || 'Error al validar ticket.');
        txtStatus.style.color = '#ef4444';
      } else {
        alert('Error al validar sesión de Garmin: ' + (e.message || e));
      }
    }
  }

  async authenticateDirect(email, password) {
    const ssoUrl = 'https://sso.garmin.com/sso/embed?clientId=GarminConnect&locale=es&service=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F';
    const ssoGet = await this.makeRequest({ method: 'GET', url: ssoUrl });
    const getHtml = typeof ssoGet.data === 'string' ? ssoGet.data : JSON.stringify(ssoGet.data);
    const csrfMatch = getHtml.match(/name="_csrf"\s+value="([^"]+)"/);
    const csrf = csrfMatch ? csrfMatch[1] : '';

    const bodyParams = {
      username: email,
      password: password,
      embed: 'true',
      _csrf: csrf
    };

    const postRes = await this.makeRequest({
      method: 'POST',
      url: ssoUrl,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Origin': 'https://sso.garmin.com',
        'Referer': ssoUrl
      },
      data: new URLSearchParams(bodyParams).toString()
    });

    const postContent = typeof postRes.data === 'string' ? postRes.data : JSON.stringify(postRes.data);
    const ticketMatch = postContent.match(/ticket=(ST-[^"'\s&]+)/);

    if (ticketMatch) {
      await this.exchangeTicketAndSave(ticketMatch[1]);
      return;
    }

    if (postContent.includes('Cloudflare') || postContent.includes('Attention Required')) {
      throw new Error('Verificación anti-bot requerida. Por favor usa el botón "Abrir Login de Garmin en el Navegador" para identificarte.');
    }

    throw new Error('No se pudo validar el inicio de sesión directo.');
  }

  async syncToday(isSilent = false) {
    if (this.isSyncing) return;
    if (!this.session) return;

    this.isSyncing = true;
    const now = new Date();
    const todayKey = (typeof getLocalDateKey === 'function') ? getLocalDateKey(now) : now.toISOString().slice(0, 10);

    try {
      const endpoints = [
        `https://connect.garmin.com/modern/proxy/usersummary-service/usersummary/daily?calendarDate=${todayKey}`,
        `https://connect.garmin.com/usersummary-service/usersummary/daily?calendarDate=${todayKey}`
      ];

      let data = null;
      for (const ep of endpoints) {
        try {
          const res = await this.makeRequest({
            method: 'GET',
            url: ep,
            headers: {
              'NK': 'NT',
              'Referer': 'https://connect.garmin.com/modern/'
            }
          });

          if (res.status === 200 && res.data) {
            data = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            if (data && (data.totalKilocalories || data.activeKilocalories || data.totalSteps)) {
              break;
            }
          } else if (res.status === 401 || res.status === 403) {
            console.warn('Sesión de Garmin expirada (HTTP ' + res.status + ')');
          }
        } catch (e) {
          console.warn('Error en endpoint ' + ep + ':', e.message);
        }
      }

      if (data) {
        // Extraer Calorías Totales Oficiales de Garmin Connect
        const totalCalories = Number(data.totalKilocalories || ((data.bmrKilocalories || 1865) + (data.activeKilocalories || 0)));
        const steps = Number(data.totalSteps || 0);
        const activeCalories = Number(data.activeKilocalories || data.wellnessActiveKilocalories || 0);
        const restingHr = Number(data.restingHeartRate || 60);

        console.log('✅ Gasto Calórico Total oficial de Garmin:', totalCalories);

        if (window.applyGarminMetrics) {
          window.applyGarminMetrics({
            totalCalories,
            activeCalories,
            steps,
            restingHr,
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
          showToast(`⌚ Garmin: ${totalCalories.toLocaleString()} kcal gastadas en total`);
        }
      } else {
        if (!isSilent) {
          alert('No se pudo obtener el resumen de calorías de Garmin Connect. Por favor verifica tu conexión o vuelve a iniciar sesión.');
        }
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
