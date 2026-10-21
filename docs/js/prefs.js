// Runs before the page paints so Calm mode never flashes the full decoration first.
try { if (localStorage.getItem('oku-calm') === '1') document.documentElement.classList.add('calm'); } catch { /* storage blocked */ }
