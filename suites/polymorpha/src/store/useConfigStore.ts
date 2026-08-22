import { create } from "zustand";

export type FeatureFlags = {
  showAuth: boolean;
  showStella: boolean;
  betaAllPremium: boolean;
};

export type RuntimeAppSettings = {
  about: {
    title: string;
    summary: string;
    startupBlurb: string;
    linkedinUrl: string;
    websiteUrl: string;
  };
  features: FeatureFlags;
};

const defaultSettings: RuntimeAppSettings = {
  about: {
    title: "About Polymorpha",
    summary:
      "Learn what Polymorpha is about, what inspired it, how it is being built, and the team behind it.",
    startupBlurb:
      "Polymorpha is an early-stage startup focused on making statistical workflows faster and easier for students, researchers, and teams.",
    linkedinUrl: "https://www.linkedin.com/in/shawn-michael-m-7034b7272/",
    websiteUrl: "https://shawnflorida-website.web.app/",
  },
  features: {
    showAuth: false,
    showStella: false,
    betaAllPremium: false,
  },
};

type ConfigStore = {
  settings: RuntimeAppSettings;
  setSettings: (settings: RuntimeAppSettings) => void;
};

export const useConfigStore = create<ConfigStore>((set) => ({
  settings: defaultSettings,
  setSettings: (settings) => set({ settings }),
}));

export const fallbackAppSettings = defaultSettings;
