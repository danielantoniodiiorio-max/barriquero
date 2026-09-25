# 🥑 KetoTrack + Garmin

Prototipo funcional de aplicación web local orientada a móviles y PC para el **control cetogénico integral**, seguimiento de **macronutrientes (carbohidratos netos)** y aceleración de cetosis mediante los datos de gasto calórico de tu **reloj Garmin**.

---

## 🚀 Cómo Iniciar la Aplicación

### Opción 1: Con doble clic (Windows)
Haz doble clic sobre el archivo:
`start.bat`
Esto abrirá automáticamente tu navegador en `http://localhost:8000`.

### Opción 2: Desde terminal / PowerShell
```powershell
& "C:\Users\diioriod\AppData\Roaming\Antigravity\bin\agy-node.cmd" src\server.js
```

---

## 📱 Cómo Usarla Desde Tu Teléfono Android

1. Asegúrate de que tu PC y tu teléfono Android estén conectados a la **misma red Wi-Fi**.
2. Abre la consola en tu PC y escribe `ipconfig` para conocer tu dirección IPv4 local (ejemplo: `192.168.1.45`).
3. En el navegador Chrome de tu teléfono Android, ingresa:
   `http://192.168.1.45:8000`
4. En Chrome para Android, pulsa el menú de 3 puntos y elige **"Agregar a la pantalla principal"** para usarla como una aplicación nativa (PWA).

---

## ⚡ Características Principales

1. **📸 Escáner de Comidas con IA Vision (Cámara del Celular)**:
   * Al pulsar **"Tomar Foto al Plato"**, tu móvil Android abre directamente la cámara nativa.
   * La imagen se procesa con **Gemini Vision (IA Multimodal)**, reconociendo ingredientes, porciones y densidad calórica.
   * Autorrellena automáticamente: Carbohidratos totales, Fibra, **Carbohidratos Netos**, Grasas, Proteínas y Calorías, indicando si el plato es 100% compatible con la cetosis.
   * Funciona inmediatamente tanto en modo demostración como en vivo configurando tu clave gratuita de Google AI Studio en Ajustes (⚙️).
2. **Contador y Fases de Cetosis en Tiempo Real**:
   * **Fase 1**: Digestión y uso de glucosa primaria (> 60g de glucógeno hepático).
   * **Fase 2**: Depleción acelerada de glucógeno (20g - 60g).
   * **Fase 3**: Inicio de cetogénesis (5g - 20g, acetoacetato y beta-hidroxibutirato en aumento).
   * **Fase 4**: Cetosis nutricional óptima (< 5g, máxima lipólisis y cetonas estables $\ge 1.0\text{ mmol/L}$).
3. **Acelerador Metabólico con Garmin**:
   * Cada 100 kcal activas registradas por Garmin aceleran el vaciado del glucógeno hepático y muscular en el equivalente a ~3.2g de glucógeno (~1 hora menos de ayuno para alcanzar cetosis profunda).
   * Visualizador dinámico del tiempo y horas ahorradas.
4. **Registro de Macronutrientes Keto-Focus**:
   * Cálculo automático de **Carbohidratos Netos** ($\text{Carbos Totales} - \text{Fibra}$).
   * Alerta visual cuando se supera el límite diario (por defecto 25g).
   * Distribución calórica keto: 70–75% grasas, 20–25% proteínas, 5–10% carbohidratos netos.
   * Botones rápidos (*chips*) de alimentos keto clásicos (huevos, bife con ensalada, palta, café bulletproof).
5. **Registro de Biomarcadores**:
   * Guarda mediciones reales de tiras de orina, medidores en sangre (mmol/L) o aliento.

---

## 📱 Sincronización Automática en Android 15 (Health Connect)

En Android 15, la sincronización entre tu reloj Garmin y KetoTrack es **100% automática, oficial y gratuita**:

### 1. Activar Health Connect en tu Teléfono (Solo una vez)
1. Abre la aplicación **Garmin Connect** en tu teléfono Android 15.
2. Toca **Más (o menú ☰)** > **Configuración** > **Aplicaciones Conectadas**.
3. Selecciona **Health Connect**.
4. Activa el interruptor **"Permitir todo"** (Pasos, Calorías Activas, Ritmo Cardíaco).

A partir de ese momento, cada vez que tu reloj sincroniza con Garmin, Garmin actualiza Health Connect en tu teléfono al instante.

### 2. Cómo funciona KetoTrack en tu Android
* Al abrir la app KetoTrack, solicitará el permiso del sistema para leer Health Connect.
* Cada vez que abras la app (o vuelvas a ella), leerá tus pasos y calorías en milisegundos sin pedir contraseñas ni pasar por Cloudflare.
* El motor metabólico recalcula el tiempo a cetosis al instante con tus datos reales.

---

## 📦 Compilación del APK para Android 15

El proyecto ya cuenta con un flujo automatizado de compilación en la nube mediante **GitHub Actions** (`.github/workflows/build-apk.yml`):

1. Sube este repositorio a tu cuenta de GitHub (puede ser privado).
2. En GitHub, ve a la pestaña **Actions** y ejecuta el flujo **"Compilar APK Android (KetoTrack)"**.
3. En menos de 3 minutos, se genera el archivo **`app-debug.apk`** listo para descargar e instalar en tu teléfono Android 15.
4. Alternativamente, si tienes Android Studio, puedes abrir la carpeta `android/` y presionar **Run**.

