/* ============================================================
   DEVRP — theme.js
   Handles dark/light mode toggle with localStorage persistence
   ============================================================ */

// Initialize theme on page load
const savedTheme = localStorage.getItem("devrp-theme") || "dark";
applyTheme(savedTheme);

function applyTheme(theme) {
  if (theme === "light") {
    document.body.classList.add("light-mode");
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.body.classList.remove("light-mode");
    document.documentElement.setAttribute("data-theme", "dark");
  }
  updateThemeIcon();
}

function toggleTheme() {
  const isLight = document.body.classList.contains("light-mode");
  const next    = isLight ? "dark" : "light";

  localStorage.setItem("devrp-theme", next);

  // Animate button
  const btn = document.getElementById("themeToggle");
  btn.style.transform = "rotate(360deg) scale(1.15)";
  setTimeout(() => { btn.style.transform = ""; }, 400);

  applyTheme(next);
}

function updateThemeIcon() {
  const btn     = document.getElementById("themeToggle");
  const isLight = document.body.classList.contains("light-mode");
  if (btn) {
    btn.innerHTML = isLight
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
  }
}