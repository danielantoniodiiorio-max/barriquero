const fs = require('fs');
const path = require('path');

console.log('--- Configurando Android Gradle con Firma Permanente ---');

const buildGradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
if (!fs.existsSync(buildGradlePath)) {
  console.error('No se encontró android/app/build.gradle');
  process.exit(1);
}

let content = fs.readFileSync(buildGradlePath, 'utf8');

// 1. Incrementar versionCode a 26 y versionName a 1.25.0
content = content.replace(/versionCode\s+\d+/, 'versionCode 26');
content = content.replace(/versionName\s+["'][^"']*["']/, 'versionName "1.25.0"');

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

// 5. Configurar MainActivity.java con soporte de botón Atrás seguro
const mainActivityPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'java', 'com', 'ketotrack', 'garmin', 'MainActivity.java');
if (fs.existsSync(path.dirname(mainActivityPath))) {
  const mainActivityCode = `package com.ketotrack.garmin;

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
  console.log('MainActivity.java configurado correctamente con navegación y botón Atrás seguro');
}

// 6. Configurar strings.xml con el nombre oficial Barriketo
const stringsPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml');
if (fs.existsSync(stringsPath)) {
  let stringsXml = fs.readFileSync(stringsPath, 'utf8');
  stringsXml = stringsXml.replace(/<string name="app_name">.*?<\/string>/, '<string name="app_name">Barriketo</string>');
  stringsXml = stringsXml.replace(/<string name="title_activity_main">.*?<\/string>/, '<string name="title_activity_main">Barriketo</string>');
  fs.writeFileSync(stringsPath, stringsXml, 'utf8');
  console.log('strings.xml actualizado con nombre Barriketo');
}
