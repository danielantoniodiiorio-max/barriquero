const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const url = require('node:url');

const db = require('./database');
const ketoEngine = require('./keto-engine');
const garminClient = require('./garmin-client');

const PORT = process.env.PORT || 8000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS Preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  // --- API Endpoints ---
  try {
    const today = new Date().toISOString().split('T')[0];

    // GET /api/status - Full snapshot (Keto status, daily macros, Garmin metrics, settings)
    if (pathname === '/api/status' && method === 'GET') {
      const settings = db.getSettings();
      const todayMeals = db.getMealsForDate(today);
      const recentMeals = db.getAllRecentMeals(30);
      const garmin = db.getGarminMetrics(today);

      const macroSummary = ketoEngine.calculateDailyMacros(todayMeals, settings);
      const ketoStatus = ketoEngine.calculateKetosisState(recentMeals, garmin, settings);

      return sendJson(res, 200, {
        date: today,
        macros: macroSummary,
        ketosis: ketoStatus,
        garmin,
        mealsCount: todayMeals.length
      });
    }

    // GET /api/meals
    if (pathname === '/api/meals' && method === 'GET') {
      const date = parsedUrl.query.date || today;
      const meals = db.getMealsForDate(date);
      return sendJson(res, 200, { meals });
    }

    // POST /api/meals
    if (pathname === '/api/meals' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.name) {
        return sendJson(res, 400, { error: 'El nombre de la comida es obligatorio' });
      }

      const newMeal = db.addMeal(body);
      return sendJson(res, 201, { success: true, meal: newMeal });
    }

    // DELETE /api/meals/:id
    if (pathname.startsWith('/api/meals/') && method === 'DELETE') {
      const id = pathname.split('/')[3];
      db.deleteMeal(id);
      return sendJson(res, 200, { success: true });
    }

    // POST /api/meals/analyze-photo (Gemini Vision)
    if (pathname === '/api/meals/analyze-photo' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (!body.image) {
        return sendJson(res, 400, { error: 'Falta la imagen para analizar' });
      }

      const settings = db.getSettings();
      const apiKey = process.env.GEMINI_API_KEY || settings.gemini_api_key || '';

      try {
        const analysis = await analyzeMealWithGemini(body.image, body.mimeType || 'image/jpeg', apiKey);
        return sendJson(res, 200, { success: true, analysis });
      } catch (err) {
        console.error('Error al analizar foto con Gemini:', err.message);
        return sendJson(res, 500, { error: err.message });
      }
    }

    // GET /api/garmin
    if (pathname === '/api/garmin' && method === 'GET') {
      const date = parsedUrl.query.date || today;
      const garmin = db.getGarminMetrics(date);
      return sendJson(res, 200, { garmin });
    }

    // POST /api/garmin/sync
    if (pathname === '/api/garmin/sync' && method === 'POST') {
      const body = await parseJsonBody(req);
      const settings = db.getSettings();
      let metrics;

      if (body.mode === 'real') {
        try {
          metrics = await garminClient.syncRealGarmin(
            settings.garmin_username,
            settings.garmin_password,
            today
          );
        } catch (err) {
          return sendJson(res, 400, { 
            error: err.message, 
            suggestDemo: true 
          });
        }
      } else if (body.mode === 'manual') {
        metrics = garminClient.getDemoMetrics(today, body.custom || {});
        metrics.source = 'garmin_manual';
      } else {
        // Demo sync
        metrics = garminClient.getDemoMetrics(today, body.custom || {});
      }

      const saved = db.saveGarminMetrics(metrics);
      return sendJson(res, 200, { success: true, garmin: saved });
    }

    // GET /api/ketones
    if (pathname === '/api/ketones' && method === 'GET') {
      const logs = db.getKetoneLogs(20);
      return sendJson(res, 200, { logs });
    }

    // POST /api/ketones
    if (pathname === '/api/ketones' && method === 'POST') {
      const body = await parseJsonBody(req);
      if (body.value === undefined || body.value === null) {
        return sendJson(res, 400, { error: 'El valor de medición es obligatorio' });
      }
      const log = db.addKetoneLog(body);
      return sendJson(res, 201, { success: true, log });
    }

    // GET /api/settings
    if (pathname === '/api/settings' && method === 'GET') {
      const settings = db.getSettings();
      // Mask credentials for safety
      if (settings.garmin_password) {
        settings.has_garmin_password = true;
        settings.garmin_password = '••••••••';
      }
      if (settings.gemini_api_key) {
        settings.has_gemini_api_key = true;
        settings.gemini_api_key = '••••••••';
      }
      return sendJson(res, 200, { settings });
    }

    // POST /api/settings
    if (pathname === '/api/settings' && method === 'POST') {
      const body = await parseJsonBody(req);
      for (const [k, v] of Object.entries(body)) {
        if (k === 'garmin_password' && v === '••••••••') continue;
        if (k === 'gemini_api_key' && v === '••••••••') continue;
        db.updateSetting(k, v);
      }
      return sendJson(res, 200, { success: true, message: 'Configuración actualizada' });
    }

    // --- Static File Serving ---
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
    
    // Security check against directory traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403);
      return res.end('Acceso denegado');
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Fallback to index.html for SPA routes
        filePath = path.join(PUBLIC_DIR, 'index.html');
      }

      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      fs.readFile(filePath, (readErr, content) => {
        if (readErr) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          return res.end('404 Not Found');
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      });
    });

  } catch (error) {
    console.error('Server error:', error);
    sendJson(res, 500, { error: 'Error interno del servidor', details: error.message });
  }
});

async function analyzeMealWithGemini(base64Image, mimeType = 'image/jpeg', apiKey) {
  // Strip data:image/...;base64, prefix if present
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');

  if (!apiKey) {
    // Modo Demo cuando aún no hay API Key de Gemini configurada
    return {
      demo: true,
      name: 'Salmón grillado con palta y espárragos (Demo sin API Key)',
      carbs: 4.5,
      fiber: 2.5,
      net_carbs: 2.0,
      protein: 34,
      fat: 26,
      calories: 390,
      is_keto: true,
      advice: 'Plato cetogénico perfecto (~60% grasas, 35% proteínas, 5% carbohidratos netos). Configura tu Gemini API Key en Ajustes para análisis con IA real.'
    };
  }

  const prompt = `Actúa como un nutricionista de élite especializado en dieta cetogénica (keto).
Analiza detalladamente la comida mostrada en esta foto. Estima los ingredientes visibles y sus porciones.
Calcula los macronutrientes aproximados:
- Nombre descriptivo del plato
- Carbohidratos totales (g)
- Fibra (g)
- Carbohidratos netos (g) = Carbohidratos totales - Fibra
- Proteínas (g)
- Grasas (g)
- Calorías totales (kcal)

Responde EXCLUSIVAMENTE con un JSON válido con esta estructura exacta:
{
  "name": "Nombre descriptivo del plato",
  "carbs": 0.0,
  "fiber": 0.0,
  "net_carbs": 0.0,
  "protein": 0.0,
  "fat": 0.0,
  "calories": 0,
  "is_keto": true,
  "advice": "Breve comentario sobre su compatibilidad con la cetosis"
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType || 'image/jpeg',
                data: cleanBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Error de Gemini API (${response.status}): ${errText}`);
  }

  const resJson = await response.json();
  const textOutput = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) {
    throw new Error('Gemini no devolvió texto de análisis');
  }

  try {
    return JSON.parse(textOutput);
  } catch (parseErr) {
    const jsonMatch = textOutput.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('No se pudo interpretar el formato devuelto por la IA');
  }
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(` 🥑 KETO TRACKER + GARMIN SYNC PROTOTYPE`);
  console.log(`=======================================================`);
  console.log(` -> Servidor local:   http://localhost:${PORT}`);
  console.log(` -> Desde tu móvil:   http://<IP-DE-TU-PC>:${PORT}`);
  console.log(` Base de datos lista en /data/keto_tracker.db`);
  console.log(`=======================================================`);
});
