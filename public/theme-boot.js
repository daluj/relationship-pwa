// Applies the last-used theme before React mounts (no inline scripts: CSP script-src 'self').
(function () {
  var root = document.documentElement;
  try {
    var t = JSON.parse(localStorage.getItem('kin.theme') || 'null');
    if (t && t.theme) {
      root.dataset.theme = t.theme;
      root.style.setProperty('--accent', t.accent);
      root.style.setProperty('--on-accent', t.onAccent);
      root.style.setProperty('--font-size', t.fontSize + 'px');
      return;
    }
  } catch (e) {}
  root.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'lights-out' : 'light';
})();
