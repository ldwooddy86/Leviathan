const wait = ms => new Promise(r => setTimeout(r, ms)); const L = window.legion;
for (let i = 0; i < 120 && (L.stage.build.building || !L.crowd || !L.crowd.summary); i++) await wait(500);
document.querySelector('#settings-button').click(); await wait(300); const d = document.querySelector('#settings-dialog'); const t = d.innerText.replace(/\s+/g, ' '); d.close(); return t;
