/* Request rules that depend on settings (declarativeNetRequest dynamic rules). The tracker list and the link
   cleaning are static rulesets switched on and off whole; these are rebuilt on every settings change. */
import { SUBRESOURCE_TYPES } from './trackers.js';

export const ALL_TYPES = ['main_frame', ...SUBRESOURCE_TYPES];

export const RULE = Object.freeze({ GPC: 1, LANGUAGE: 2, HINTS: 3, REFERRER: 4, PAUSE: 10 });
export const PAUSE_PRIORITY = 1000;

export const ACCEPT_LANGUAGE = 'en-US,en;q=0.9';

/* Client hints a site can ask for that pin down the exact OS version, CPU, device model, memory, screen and
   connection. The three Chrome sends to everyone (brand, mobile, platform) stay, so requests look ordinary. */
export const HIGH_ENTROPY_HINTS = ['sec-ch-ua-full-version', 'sec-ch-ua-full-version-list', 'sec-ch-ua-platform-version',
  'sec-ch-ua-arch', 'sec-ch-ua-bitness', 'sec-ch-ua-model', 'sec-ch-ua-wow64', 'sec-ch-ua-form-factors',
  'sec-ch-device-memory', 'device-memory', 'sec-ch-dpr', 'dpr', 'sec-ch-viewport-width', 'viewport-width',
  'sec-ch-viewport-height', 'rtt', 'downlink', 'ect'];

export function dynamicRules(s) {
  const rules = [];
  if (!s.enabled) return rules;
  if (s.gpc) {
    rules.push({
      id: RULE.GPC, priority: 1,
      action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Sec-GPC', operation: 'set', value: '1' }] },
      condition: { resourceTypes: ALL_TYPES }
    });
  }
  if (s.language) {
    rules.push({
      id: RULE.LANGUAGE, priority: 1,
      action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Accept-Language', operation: 'set', value: ACCEPT_LANGUAGE }] },
      condition: { resourceTypes: ALL_TYPES }
    });
  }
  if (s.device) {
    rules.push({
      id: RULE.HINTS, priority: 1,
      action: { type: 'modifyHeaders', requestHeaders: HIGH_ENTROPY_HINTS.map(header => ({ header, operation: 'remove' })) },
      condition: { resourceTypes: ALL_TYPES }
    });
  }
  if (s.referrer) {
    /* Only top-level GET navigations to another site: frames keep theirs (video embeds check it) and form posts
       keep theirs (payment and sign-in returns can check it). */
    rules.push({
      id: RULE.REFERRER, priority: 1,
      action: { type: 'modifyHeaders', requestHeaders: [{ header: 'Referer', operation: 'remove' }] },
      condition: { domainType: 'thirdParty', resourceTypes: ['main_frame'], requestMethods: ['get'] }
    });
  }
  if (s.paused.length) {
    /* Paused sites: everything inside their tabs is allowed and left unmodified, outranking the tracker list,
       the link cleaning and the header rules above. */
    rules.push({
      id: RULE.PAUSE, priority: PAUSE_PRIORITY, action: { type: 'allowAllRequests' },
      condition: { requestDomains: [...s.paused], resourceTypes: ['main_frame', 'sub_frame'] }
    });
  }
  return rules;
}
