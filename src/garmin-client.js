const fs = require('node:fs');
const path = require('node:path');

const SESSION_FILE = path.join(__dirname, '..', 'data', 'garmin_session.json');

/**
 * Cliente Garmin Connect
 * Soporta sincronización real con Garmin Connect Cloud (SSO) y modo Demo para pruebas inmediatas.
 */
class GarminClient {
  constructor() {
    this.session = this.loadSession();
  }

  loadSession() {
    try {
      if (fs.existsSync(SESSION_FILE)) {
        return JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      }
    } catch (err) {
      console.error('Error loading Garmin session:', err);
    }
    return null;
  }

  saveSession(sessionData) {
    try {
      fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2), 'utf8');
      this.session = sessionData;
    } catch (err) {
      console.error('Error saving Garmin session:', err);
    }
  }

  /**
   * Sincronización real con Garmin Connect
   */
  async syncRealGarmin(email, password, targetDate) {
    const dateStr = targetDate || new Date().toISOString().split('T')[0];
    
    if (!email || !password) {
      throw new Error('Faltan credenciales de Garmin Connect. Configúralas en Ajustes o usa el modo Demo.');
    }

    try {
      // Step 1: Request SSO ticket
      const ssoUrl = 'https://sso.garmin.com/sso/signin?service=https%3A%2F%2Fconnect.garmin.com%2Fmodern%2F&clientId=GarminConnect&gauthHost=https%3A%2F%2Fsso.garmin.com%2Fsso&consumeServiceTicket=false';
      
      const ssoResponse = await fetch(ssoUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      const cookies = ssoResponse.headers.get('set-cookie') || '';
      
      // Post credentials
      const body = new URLSearchParams({
        username: email,
        password: password,
        embed: 'true',
        _eventId: 'submit'
      });

      const loginRes = await fetch(ssoUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cookie': cookies
        },
        body: body.toString()
      });

      const responseText = await loginRes.text();

      // Check if Cloudflare blocked the request
      if (loginRes.status === 403 || responseText.includes('Cloudflare') || responseText.includes('Attention Required')) {
        throw new Error('Garmin ha bloqueado la conexión automática con su sistema Cloudflare Anti-Bot. Puedes usar la opción de carga directa de tus métricas de hoy o sincronizar vía Health Connect en Android.');
      }

      // Check if ticket returned
      const ticketMatch = responseText.match(/ticket=([^"']+)/);
      if (!ticketMatch) {
        if (responseText.includes('MFACode') || responseText.includes('mfa')) {
          throw new Error('Garmin requiere verificación en dos pasos (MFA). Revisa tu correo de Garmin para el código.');
        }
        throw new Error('No se pudo autenticar con Garmin Connect. Revisa tus credenciales o el estado de tu cuenta.');
      }

      const ticket = ticketMatch[1];

      // Exchange ticket for session
      const exchangeUrl = `https://connect.garmin.com/modern/?ticket=${ticket}`;
      const exchangeRes = await fetch(exchangeUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        },
        redirect: 'manual'
      });

      const authCookies = exchangeRes.headers.get('set-cookie') || cookies;

      // Fetch user summary
      const summaryUrl = `https://connect.garmin.com/modern/proxy/usersummary-service/usersummary/daily?calendarDate=${dateStr}`;
      const summaryRes = await fetch(summaryUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Cookie': authCookies,
          'NK': 'NT'
        }
      });

      if (!summaryRes.ok) {
        throw new Error(`Garmin Connect devolvió código de error HTTP ${summaryRes.status}`);
      }

      const data = await summaryRes.json();

      return {
        date: dateStr,
        steps: data.totalSteps || 0,
        active_calories: data.activeKilocalories || 0,
        bmr_calories: data.bmrKilocalories || 1650,
        total_calories: data.totalKilocalories || ((data.bmrKilocalories || 1650) + (data.activeKilocalories || 0)),
        resting_hr: data.restingHeartRate || 60,
        source: 'garmin_cloud',
        last_synced: new Date().toISOString()
      };

    } catch (err) {
      console.warn('Fallo en sincronización directa con Garmin:', err.message);
      throw err;
    }
  }

  /**
   * Genera o actualiza métricas en Modo Demo / Simulado para pruebas inmediatas
   */
  getDemoMetrics(dateStr, custom = {}) {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];
    const steps = custom.steps !== undefined ? Number(custom.steps) : 8420;
    const activeCal = custom.active_calories !== undefined ? Number(custom.active_calories) : 485;
    const bmr = custom.bmr_calories !== undefined ? Number(custom.bmr_calories) : 1620;
    const totalCal = bmr + activeCal;
    const hr = custom.resting_hr !== undefined ? Number(custom.resting_hr) : 62;

    return {
      date: targetDate,
      steps,
      active_calories: activeCal,
      bmr_calories: bmr,
      total_calories: totalCal,
      resting_hr: hr,
      source: 'demo_simulado',
      last_synced: new Date().toISOString()
    };
  }
}

module.exports = new GarminClient();
