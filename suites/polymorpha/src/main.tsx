import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { initFirebase, type FirebaseConfig } from "./config/firebase";
import { readStorageJson, writeStorageValue } from "./lib/storage";
import {
  fallbackAppSettings,
  useConfigStore,
  type RuntimeAppSettings,
} from "./store/useConfigStore";
import { initAuthListener } from "./store/useAuthStore";

import "./index.css";

type RuntimeAppSettingsInput = Partial<RuntimeAppSettings> & {
  firebase?: FirebaseConfig;
};

const APPSETTINGS_CACHE_KEY = "Polymorpha:appsettings-cache:v1";

let _authUnsubscribe: (() => void) | null = null;

function readCachedAppSettings(): RuntimeAppSettingsInput | null {
  return readStorageJson<RuntimeAppSettingsInput | null>(
    APPSETTINGS_CACHE_KEY,
    null,
  );
}

function writeCachedAppSettings(value: RuntimeAppSettingsInput): void {
  writeStorageValue(APPSETTINGS_CACHE_KEY, JSON.stringify(value));
}

async function fetchRuntimeSettings(): Promise<RuntimeAppSettingsInput | null> {
  const requestUrl = `/appsettings.json?v=${Date.now()}`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(requestUrl, { cache: "no-store" });
      if (!response.ok) continue;
      const json = (await response.json()) as RuntimeAppSettingsInput;
      writeCachedAppSettings(json);
      return json;
    } catch {
      // Retry once before using cached settings.
    }
  }
  return readCachedAppSettings();
}

async function bootstrap() {
  let settings: RuntimeAppSettings = fallbackAppSettings;

  try {
    const json = await fetchRuntimeSettings();
    if (json) {
      const mergedFeatures = {
        ...fallbackAppSettings.features,
        ...json.features,
      };

      settings = {
        ...fallbackAppSettings,
        ...json,
        about: {
          ...fallbackAppSettings.about,
          ...json.about,
        },
        features: mergedFeatures,
      };
    }
  } catch {
    settings = fallbackAppSettings;
  }

  useConfigStore.getState().setSettings(settings);

  // Initialize Firebase if config is provided
  if ((settings as unknown as { firebase?: FirebaseConfig }).firebase) {
    const fbConfig = (settings as unknown as { firebase: FirebaseConfig })
      .firebase;
    initFirebase(fbConfig);
  }

  // Clean up previous listener before creating new one (handles HMR / re-bootstrap)
  if (_authUnsubscribe) _authUnsubscribe();
  _authUnsubscribe = initAuthListener();

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
}

void bootstrap();
