/* Outis stand-in for Google's gtag.js. Loads nothing and sends nothing; it runs event_callback for
   gtag('event', ...) calls queued on dataLayer, so links and forms that wait for "the event was sent" still work. */
(function () {
  'use strict';
  var w = window, name = 'dataLayer';
  try {
    var src = document.currentScript && document.currentScript.src;
    var m = src && /[?&]l=([^&#]+)/.exec(src);
    if (m) name = decodeURIComponent(m[1]);
  } catch (e) { /* default name */ }
  var later = function (cb) { setTimeout(function () { try { cb(); } catch (e) { /* page code */ } }, 0); };
  var run = function (o) {
    if (!o || typeof o !== 'object') return;
    if (typeof o.eventCallback === 'function') later(o.eventCallback);
    if (o.length >= 3 && o[0] === 'event' && o[2] && typeof o[2].event_callback === 'function') later(o[2].event_callback);
  };
  var dl = w[name] = w[name] || [];
  for (var i = 0; i < dl.length; i++) run(dl[i]);
  var push = dl.push;
  dl.push = function () {
    for (var j = 0; j < arguments.length; j++) run(arguments[j]);
    return push.apply(this, arguments);
  };
})();
