// Initialize theme from localStorage
const currentTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', currentTheme);
if (currentTheme === 'light') {
  document.body.classList.add('light-mode');
  updateThemeIcon();
}

function toggleTheme() {
  const body = document.body;
  const themeToggle = document.getElementById('themeToggle');
  
  if (body.classList.contains('light-mode')) {
    // Switch to dark mode
    body.classList.remove('light-mode');
    localStorage.setItem('theme', 'dark');
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    // Switch to light mode
    body.classList.add('light-mode');
    localStorage.setItem('theme', 'light');
    document.documentElement.setAttribute('data-theme', 'light');
  }
  
  updateThemeIcon();
}

// Update theme icon
function updateThemeIcon() {
  const themeToggle = document.getElementById('themeToggle');
  const body = document.body;
  
  if (body.classList.contains('light-mode')) {
    themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  } else {
    themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
  }
}
