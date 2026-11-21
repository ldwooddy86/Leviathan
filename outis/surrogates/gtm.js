/* Outis stand-in for Google Tag Manager (gtm.js). Loads nothing and sends nothing; it only runs the callbacks pages
   attach to dataLayer pushes (eventCallback), so links and forms that wait for "the tag fired" still work. */
(function () {
  'use strict';
  var w = window, name = 'dataLayer';
  try {
    var src = document.currentScript && document.currentScript.src;
    var m = src && /[?&]l=([^&#]+)/.exec(src);
    if (m) name = decodeURIComponent(m[1]);
  } catch (e) { /* default name */ }
  var run = function (o) {
    if (o && typeof o === 'object' && typeof o.eventCallback === 'function') {
      var cb = o.eventCallback;
      setTimeout(function () { try { cb('GTM-0000000'); } catch (e) { /* page code */ } }, 0);
    }
  };
  var dl = w[name] = w[name] || [];
  for (var i = 0; i < dl.length; i++) run(dl[i]);
  var push = dl.push;
  dl.push = function () {
    for (var j = 0; j < arguments.length; j++) run(arguments[j]);
    return push.apply(this, arguments);
  };
  w.google_tag_manager = w.google_tag_manager || {};
})();
