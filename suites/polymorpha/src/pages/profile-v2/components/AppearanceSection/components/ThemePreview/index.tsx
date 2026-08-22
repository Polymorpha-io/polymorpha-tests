import { THEME_OPTIONS } from "@/constants/theme";
import type { Theme } from "@/constants/theme";

export default function ThemePreview({ variant }: { variant: Theme }) {
  const isLight = variant === THEME_OPTIONS.LIGHT;
  const isSystem = variant === THEME_OPTIONS.SYSTEM;

  return (
    <div
      className={`w-full h-auto rounded-lg overflow-hidden relative ${
        isSystem
          ? "bg-[linear-gradient(135deg,#fff_50%,#111111_50%)] border border-border"
          : isLight
            ? "bg-white border border-border"
            : "bg-[#111111] border border-[#333]"
      }`}
    >
      {/* Header bar - simulates app navigation bar */}
      <div
        className={`h-3 w-full ${
          isSystem
            ? "bg-[linear-gradient(90deg,#f5f5f5_50%,#1a1a1a_50%)] border-b border-[#ccc]"
            : isLight
              ? "bg-[#f4f8ff] border-b border-border"
              : "bg-[#1a1a1a] border-b border-[#333]"
        }`}
      />
      {/* Content area - simulates text lines */}
      <div className="p-1.5 space-y-1.5">
        {/* Long text line */}
        <div
          className={`h-1.5 w-3/4 rounded-full ${
            isSystem
              ? "bg-[linear-gradient(90deg,#dbdbdb_50%,#333_50%)]"
              : isLight
                ? "bg-[#d4d4d4]"
                : "bg-[#333]"
          }`}
        />
        {/* Short text line */}
        <div
          className={`h-1.5 w-1/2 rounded-full ${
            isSystem
              ? "bg-[linear-gradient(90deg,#c8c8c8_50%,#444_50%)]"
              : isLight
                ? "bg-[#555555]"
                : "bg-[#444]"
          }`}
        />
        {/* List item row - accent dot + text line */}
        <div className="flex gap-1 mt-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-primary" />
          <div
            className={`h-1.5 w-2/3 rounded-full ${
              isSystem
                ? "bg-[linear-gradient(90deg,#dbdbdb_50%,#333_50%)]"
                : isLight
                  ? "bg-[#d4d4d4]"
                  : "bg-[#333]"
            }`}
          />
        </div>
      </div>
    </div>
  );
}
