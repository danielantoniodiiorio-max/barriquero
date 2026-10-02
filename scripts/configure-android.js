const fs = require('fs');
const path = require('path');

console.log('--- Configurando Android Gradle con Firma Permanente ---');

// Leer capacitor.config.json para obtener appId y appName
const capConfigPath = path.join(__dirname, '..', 'capacitor.config.json');
let appId = 'com.barriketo.multidiet';
let appName = 'Barriketo Multi';
if (fs.existsSync(capConfigPath)) {
  try {
    const capConfig = JSON.parse(fs.readFileSync(capConfigPath, 'utf8'));
    if (capConfig.appId) appId = capConfig.appId;
    if (capConfig.appName) appName = capConfig.appName;
  } catch (e) {}
}
console.log(`Configurando aplicación para: appId=${appId}, appName=${appName}`);

const buildGradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
if (!fs.existsSync(buildGradlePath)) {
  console.error('No se encontró android/app/build.gradle');
  process.exit(1);
}

let content = fs.readFileSync(buildGradlePath, 'utf8');

// 1. Incrementar versionCode y versionName
content = content.replace(/versionCode\s+\d+/, 'versionCode 30');
content = content.replace(/versionName\s+["'][^"']*["']/, 'versionName "1.30.0"');

// 2. Inyectar bloque signingConfigs permanente
const signingConfigsBlock = `
    signingConfigs {
        release {
            storeFile file('ketotrack.keystore')
            storePassword 'ketotrack2026'
            keyAlias 'ketotrack'
            keyPassword 'ketotrack2026'
        }
    }
`;
content = content.replace(/android\s*\{/, 'android {\n' + signingConfigsBlock);

// 3. Asignar signingConfig tanto para debug como para release
content = content.replace(/buildTypes\s*\{/, `buildTypes {
        debug {
            signingConfig signingConfigs.release
        }`);
content = content.replace(/buildTypes\s*\{[\s\S]*?release\s*\{/, (match) => {
  return match + '\n            signingConfig signingConfigs.release';
});

// 4. Java 21 y Desugaring
if (content.includes('compileOptions {')) {
  content = content.replace(
    /compileOptions\s*\{[\s\S]*?\}/,
    `compileOptions {
        sourceCompatibility JavaVersion.VERSION_21
        targetCompatibility JavaVersion.VERSION_21
        coreLibraryDesugaringEnabled true
    }`
  );
} else {
  content = content.replace(
    /android\s*\{/,
    `android {
    compileOptions {
        sourceCompatibility JavaVersion.VERSION_21
        targetCompatibility JavaVersion.VERSION_21
        coreLibraryDesugaringEnabled true
    }`
  );
}

if (!content.includes('desugar_jdk_libs')) {
  content = content.replace(
    /dependencies\s*\{/,
    `dependencies {
    coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.1.4'`
  );
}

fs.writeFileSync(buildGradlePath, content, 'utf8');
console.log('android/app/build.gradle actualizado correctamente con firma permanente ketotrack.keystore');

// 5. Configurar MainActivity.java dinámicamente con soporte de botón Atrás seguro
function findMainActivity(dir) {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      const found = findMainActivity(fullPath);
      if (found) return found;
    } else if (file === 'MainActivity.java') {
      return fullPath;
    }
  }
  return null;
}

const javaSrcDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java');
const mainActivityPath = findMainActivity(javaSrcDir);
if (mainActivityPath) {
  const mainActivityCode = `package ${appId};

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onBackPressed() {
        WebView webView = this.bridge != null ? this.bridge.getWebView() : null;
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        if (webView != null && webView.getUrl() != null && !webView.getUrl().contains("localhost")) {
            webView.loadUrl("https://localhost");
            return;
        }
        super.onBackPressed();
    }
}
`;
  fs.writeFileSync(mainActivityPath, mainActivityCode, 'utf8');
  console.log(`MainActivity.java configurado correctamente en ${mainActivityPath} con package ${appId}`);
}

// 6. Configurar strings.xml con el nombre oficial
const stringsPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
if (fs.existsSync(stringsPath)) {
  let stringsXml = fs.readFileSync(stringsPath, 'utf8');
  stringsXml = stringsXml.replace(/<string name="app_name">.*?<\/string>/, `<string name="app_name">${appName}</string>`);
  stringsXml = stringsXml.replace(/<string name="title_activity_main">.*?<\/string>/, `<string name="title_activity_main">${appName}</string>`);
  fs.writeFileSync(stringsPath, stringsXml, 'utf8');
  console.log(`strings.xml actualizado con nombre ${appName}`);
}
