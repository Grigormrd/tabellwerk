import { THEME_ATTRIBUTE } from "@tabellwerk/tokens";
import { useEffect, useId, useState } from "react";

type Theme = "system" | "light" | "dark";
const KEY = "tabellwerk-demo-theme";

function storedTheme(): Theme {
  try {
    const value = localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

/** System, light or dark; remembered in this browser only. */
export function ThemeSelect() {
  const id = useId();
  const [theme, setTheme] = useState<Theme>(storedTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute(THEME_ATTRIBUTE);
    else root.setAttribute(THEME_ATTRIBUTE, theme);
    try {
      if (theme === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, theme);
    } catch {
      // Storage can be unavailable (private windows, blocked site data).
    }
  }, [theme]);

  return (
    <span className="demo-theme">
      <label htmlFor={id}>Theme</label>
      <select id={id} value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
        <option value="system">System</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </select>
    </span>
  );
}
