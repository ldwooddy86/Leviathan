/* Outis stand-in for Google Analytics (analytics.js). Sends nothing; ga() accepts the usual commands, hands
   ready-callbacks a tracker that does nothing, and runs hitCallback, so pages that wait for a hit still go on. */
(function () {
  'use strict';
  var w = window, name = w.GoogleAnalyticsObject || 'ga';
  var queued = (w[name] && w[name].q) || [];
  var later = function (cb) { setTimeout(function () { try { cb(); } catch (e) { /* page code */ } }, 0); };
  var hit = function (args) {
    for (var i = args.length - 1; i >= 0; i--) {
      var a = args[i];
      if (a && typeof a === 'object' && typeof a.hitCallback === 'function') { later(a.hitCallback); return; }
    }
  };
  var tracker = {
    get: function () { return undefined; },
    set: function () {},
    send: function () { hit(arguments); }
  };
  var ga = function () {
    var a = arguments;
    if (typeof a[0] === 'function') { var f = a[0]; later(function () { f(tracker); }); return; }
    if (typeof a[0] === 'string' && /(^|\.)send$/.test(a[0])) hit(a);
  };
  ga.create = function () { return tracker; };
  ga.getByName = function () { return tracker; };
  ga.getAll = function () { return [tracker]; };
  ga.remove = function () {};
  ga.loaded = true;
  ga.l = +new Date();
  w[name] = ga;
  for (var i = 0; i < queued.length; i++) { try { ga.apply(null, queued[i]); } catch (e) { /* page code */ } }
})();
