/* Legacy static entry retained for backward-compatible direct references. */
(function () {
  if (window.__GXA_TOOLBOX_APP_LOADED__) return;
  var script = document.createElement('script');
  script.src = 'public_html/assets/app.js';
  document.head.appendChild(script);
})();
