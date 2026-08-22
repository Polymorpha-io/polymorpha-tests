import { useState, useCallback, useEffect } from "react";
import { Palette, Check, Monitor } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  CardTitle,
  CardDescription,
} from "@/components/shadcn/card";
import { Button } from "@/components/shadcn/button";
import { usePreferences } from "@/pages/profile-v2/hooks/usePreferences";
import ThemePreview from "@/pages/profile-v2/components/AppearanceSection/components/ThemePreview";
import { THEME_OPTIONS } from "@/constants/theme";
import type { Theme } from "@/constants/theme";

export function AppearanceSection() {
  const {
    theme,
    setTheme,
    hasPreferenceChanges,
    handleSavePreferences,
    prefsSaved,
    prefsSaving,
    prefsError,
  } = usePreferences();

  const [localTheme, setLocalTheme] = useState<Theme>(
    (theme as Theme) || THEME_OPTIONS.SYSTEM,
  );

  const handleSelectTheme = useCallback(
    (t: Theme) => {
      setLocalTheme(t);
      setTheme(t);
    },
    [setTheme],
  );

  const handleSave = useCallback(() => {
    handleSavePreferences();
    toast.success("Preferences saved");
  }, [handleSavePreferences]);

  const handleReset = useCallback(() => {
    handleSelectTheme(THEME_OPTIONS.SYSTEM);
    toast.success("Reset to system default");
  }, [handleSelectTheme]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const themes: Theme[] = [
        THEME_OPTIONS.LIGHT,
        THEME_OPTIONS.DARK,
        THEME_OPTIONS.SYSTEM,
      ];
      const currentIndex = themes.indexOf(localTheme);

      const keyMap: Record<string, number> = {
        ArrowRight: (currentIndex + 1) % themes.length,
        ArrowDown: (currentIndex + 1) % themes.length,
        ArrowLeft: (currentIndex - 1 + themes.length) % themes.length,
        ArrowUp: (currentIndex - 1 + themes.length) % themes.length,
        Home: 0,
        End: themes.length - 1,
      };

      const newIndex = keyMap[e.key];
      if (newIndex === undefined) return;

      e.preventDefault();
      handleSelectTheme(themes[newIndex]);
      document.getElementById(`theme-${themes[newIndex]}`)?.focus();
    },
    [localTheme, handleSelectTheme],
  );

  useEffect(() => {
    if (prefsError) {
      toast.error(prefsError);
    }
  }, [prefsError]);

  return (
    <Card className="max-w-md">
      <CardHeader className="border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 dark:bg-primary flex items-center justify-center text-primary dark:text-primary-foreground shrink-0">
            <Palette className="w-5 h-5" />
          </div>
          <div>
            <CardTitle className="text-base font-semibold text-(--text-h)">
              Theme
            </CardTitle>
            <CardDescription className="text-sm text-(--text-dim) mt-0.5">
              Select your preferred color scheme
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        <label className="block text-sm font-medium text-(--text-h) mb-3">
          Theme
        </label>
        <div
          className="grid grid-cols-3 gap-3"
          role="radiogroup"
          aria-label="Theme selection"
          onKeyDown={handleKeyDown}
        >
          {(
            [
              THEME_OPTIONS.LIGHT,
              THEME_OPTIONS.DARK,
              THEME_OPTIONS.SYSTEM,
            ] as Theme[]
          ).map((t) => {
            const isSelected = localTheme === t;
            return (
              <button
                key={t}
                id={`theme-${t}`}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => handleSelectTheme(t)}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all duration-150 hover:-translate-y-px focus:outline-none ${
                  isSelected
                    ? "border-primary shadow-[0_0_0_3px_var(--primary)] bg-primary/5"
                    : "border-border bg-(--surface)"
                }`}
              >
                <ThemePreview variant={t} />
                <span className="text-xs font-medium text-(--text-h) capitalize">
                  {t}
                </span>
              </button>
            );
          })}
        </div>

        {localTheme === THEME_OPTIONS.SYSTEM && (
          <div className="mt-3 flex items-center gap-2 text-xs text-(--text-dim)">
            <Monitor className="w-3.5 h-3.5" />
            <span>
              Following your device:{" "}
              <strong className="text-(--text-h)">
                {theme === THEME_OPTIONS.DARK ? "Dark" : "Light"}
              </strong>
            </span>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex-col sm:flex-row items-stretch sm:items-center gap-2.5 pt-4">
        <Button
          onClick={handleSave}
          disabled={prefsSaving || !hasPreferenceChanges}
          className="w-full sm:w-auto"
        >
          <Check className="w-4 h-4" />
          {prefsSaving ? "Saving…" : prefsSaved ? "Saved" : "Save Preferences"}
        </Button>
        <Button
          variant="outline"
          onClick={handleReset}
          className="w-full sm:w-auto"
        >
          Reset
        </Button>
      </CardFooter>
    </Card>
  );
}
