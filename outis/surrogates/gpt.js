/* Outis stand-in for Google Publisher Tag (gpt.js), the ad tag on many news sites. Shows no ads and sends nothing;
   it answers googletag calls so pages that call it directly don't stop with an error, and reports every ad slot as
   rendered empty so layouts that wait for that event carry on. */
(function () {
  'use strict';
  var w = window;
  var gt = w.googletag = w.googletag || {};
  var queued = gt.cmd && typeof gt.cmd.length === 'number' ? Array.prototype.slice.call(gt.cmd) : [];
  var noop = function () {};
  var listeners = {};
  var slots = [];
  var fire = function (type, slot) {
    var l = listeners[type] || [];
    for (var i = 0; i < l.length; i++) {
      try { l[i]({ isEmpty: true, slot: slot, size: null, serviceName: 'publisher_ads', creativeId: null, lineItemId: null }); } catch (e) { /* page code */ }
    }
  };
  function Slot(path, div) { this._path = path; this._div = div; }
  var chain = function (o, names) { for (var i = 0; i < names.length; i++) o[names[i]] = function () { return this; }; };
  chain(Slot.prototype, ['addService', 'clearCategoryExclusions', 'clearTargeting', 'defineSizeMapping', 'set', 'setCategoryExclusion',
    'setClickUrl', 'setCollapseEmptyDiv', 'setConfig', 'setForceSafeFrame', 'setSafeFrameConfig', 'setTargeting', 'updateTargetingFromMap']);
  Slot.prototype.getAdUnitPath = function () { return this._path; };
  Slot.prototype.getSlotElementId = function () { return this._div; };
  Slot.prototype.getTargeting = function () { return []; };
  Slot.prototype.getTargetingKeys = function () { return []; };
  Slot.prototype.getResponseInformation = function () { return null; };
  Slot.prototype.getSizes = function () { return []; };
  Slot.prototype.get = function () { return null; };
  Slot.prototype.getAttributeKeys = function () { return []; };
  Slot.prototype.getCategoryExclusions = function () { return []; };
  var service = function () {
    var s = {};
    chain(s, ['clear', 'clearCategoryExclusions', 'clearTagForChildDirectedTreatment', 'clearTargeting', 'collapseEmptyDivs',
      'disableInitialLoad', 'enableAsyncRendering', 'enableLazyLoad', 'enableSingleRequest', 'enableSyncRendering',
      'enableVideoAds', 'removeEventListener', 'set', 'setCategoryExclusion', 'setCentering', 'setCookieOptions',
      'setForceSafeFrame', 'setLocation', 'setPrivacySettings', 'setPublisherProvidedId', 'setRequestNonPersonalizedAds',
      'setSafeFrameConfig', 'setTagForChildDirectedTreatment', 'setTargeting', 'setVideoContent', 'updateCorrelator',
      'setConfig', 'refresh', 'setRefreshUnfilledSlots']);
    s.addEventListener = function (type, fn) { (listeners[type] = listeners[type] || []).push(fn); return this; };
    s.get = function () { return null; };
    s.getAttributeKeys = function () { return []; };
    s.getTargeting = function () { return []; };
    s.getTargetingKeys = function () { return []; };
    s.getSlots = function () { return slots.slice(); };
    s.isInitialLoadDisabled = function () { return false; };
    s.display = noop;
    return s;
  };
  var pubads = service(), companion = service(), content = service();
  gt.apiReady = true;
  gt.pubadsReady = true;
  gt.defineSlot = function (path, sizes, div) { var x = new Slot(path, div); slots.push(x); return x; };
  gt.defineOutOfPageSlot = function (path, div) { var x = new Slot(path, typeof div === 'string' ? div : null); slots.push(x); return x; };
  gt.destroySlots = function () { slots.length = 0; return true; };
  gt.display = function (div) {
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      if (!div || s._div === div || (div && div.id && s._div === div.id)) setTimeout(fire.bind(null, 'slotRenderEnded', s), 0);
    }
  };
  gt.enableServices = noop;
  gt.disablePublisherConsole = noop;
  gt.openConsole = noop;
  gt.setAdIframeTitle = noop;
  gt.setConfig = noop;
  gt.getVersion = function () { return ''; };
  gt.pubads = function () { return pubads; };
  gt.companionAds = function () { return companion; };
  gt.content = function () { return content; };
  gt.sizeMapping = function () { var b = { addSize: function () { return b; }, build: function () { return []; } }; return b; };
  gt.cmd = { push: function () { for (var i = 0; i < arguments.length; i++) { try { arguments[i].call(w); } catch (e) { /* page code */ } } return 1; } };
  for (var i = 0; i < queued.length; i++) { try { queued[i].call(w); } catch (e) { /* page code */ } }
})();
