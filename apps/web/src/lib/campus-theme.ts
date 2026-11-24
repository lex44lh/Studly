export const CAMPUS_THEME_KEY = "studly:campus-theme";

// Apply the saved choice before the shell is painted, even without hydration.
export const campusThemeBootstrap = `try {
  const theme = localStorage.getItem(${JSON.stringify(CAMPUS_THEME_KEY)});
  if (theme === "light" || theme === "dark") document.documentElement.dataset.studlyTheme = theme;
} catch {}`;
