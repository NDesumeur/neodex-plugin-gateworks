// Gateworks : des portes logiques à poser et à relier à la souris. Interrupteurs, lampes, horloge, 7 portes ; la simulation tourne
// en continu (les bascules marchent), la table de vérité se calcule toute seule, et des exemples montrent additionneurs et mémoires.
const CSS = `
.gwBar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.gwBar .btn{min-width:0;width:auto;margin:0;padding:6px 10px}
.gwBar .f{width:auto;flex:none;margin:0}
.gwBar .hint{align-self:center}
.gwGrid{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:14px}
@media (max-width:900px){.gwGrid{grid-template-columns:minmax(0,1fr)}}
.gwCan{width:100%;display:block;image-rendering:pixelated;background:#0b0816;border:2px solid var(--line);touch-action:none}
.gwTable{font:13px monospace;border-collapse:collapse;width:100%}
.gwTable td,.gwTable th{border:1px solid var(--line);padding:2px 6px;text-align:center}
.gwTable th{color:var(--lilac)}
.gwTable td.on{color:#ffd34f}
.gwTable tr.cur td{background:rgba(var(--pkr),.25)}
.gwScroll{max-height:300px;overflow:auto;margin-top:6px}
.gwHint{font-size:12px;color:var(--lilac);line-height:1.5;margin-top:8px}
`;
// les types : nombre d'entrées, fonction, libellé
const T = {
  IN: [0, null], OUT: [1, null], CLK: [0, null],
  AND: [2, (a, b) => a & b], OR: [2, (a, b) => a | b], XOR: [2, (a, b) => a ^ b], NAND: [2, (a, b) => 1 - (a & b)], NOR: [2, (a, b) => 1 - (a | b)], XNOR: [2, (a, b) => 1 - (a ^ b)], NOT: [1, a => 1 - a],
};
const NAMES = {IN: 'Interrupteur', OUT: 'Lampe', CLK: 'Horloge', AND: 'ET', OR: 'OU', XOR: 'OU exclusif', NAND: 'NON-ET', NOR: 'NON-OU', XNOR: 'NON-OU excl.', NOT: 'NON'};
const SIZE = t => t === 'IN' || t === 'CLK' ? [50, 30] : t === 'OUT' ? [40, 40] : [60, 40];
const pinIn = (c, i) => { const [w, h] = SIZE(c.t), n = T[c.t][0]; return [c.x, c.y + h * (i + 1) / (n + 1)]; };
const pinOut = c => { const [w, h] = SIZE(c.t); return [c.x + w, c.y + h / 2]; };
// la simulation : on recalcule les portes une par une, sur place, jusqu'à ce que rien ne bouge (au plus 64 tours) ;
// sur place et pas toutes en même temps, sinon une bascule partie de 0 oscillerait sans fin
function settle(cs, ws) {
  const by = new Map(cs.map(c => [c.id, c])), inputs = new Map();
  for (const w of ws) inputs.set(w.to + ':' + w.pin, w.from);
  const inVal = (c, i) => { const f = inputs.get(c.id + ':' + i); return f !== undefined && by.get(f) ? by.get(f).v | 0 : 0; };
  for (let k = 0; k < 64; k++) {
    let ch = false;
    for (const c of cs) { if (c.t === 'IN' || c.t === 'CLK') continue; const v = c.t === 'OUT' ? inVal(c, 0) : T[c.t][1](...Array.from({length: T[c.t][0]}, (_, i) => inVal(c, i))); if ((c.v | 0) !== v) { c.v = v; ch = true; } }
    if (!ch) return true;
  }
  return false;  // ça oscille (une boucle NON sur elle-même, par exemple)
}
// la table de vérité : toutes les combinaisons des interrupteurs (6 au plus), en partant de tout à 0
function truth(cs, ws) {
  const ins = cs.filter(c => c.t === 'IN').sort((a, b) => a.y - b.y || a.x - b.x), outs = cs.filter(c => c.t === 'OUT').sort((a, b) => a.y - b.y || a.x - b.x);
  if (!ins.length || !outs.length || ins.length > 6) return null;
  const save = cs.map(c => c.v), rows = [];
  for (let m = 0; m < 1 << ins.length; m++) {
    cs.forEach(c => { if (c.t !== 'IN') c.v = 0; }); ins.forEach((c, i) => c.v = m >> (ins.length - 1 - i) & 1);
    const ok = settle(cs, ws); rows.push([ins.map(c => c.v), outs.map(c => ok ? c.v : '~')]);
  }
  cs.forEach((c, i) => c.v = save[i]);
  return {ins, outs, rows};
}
// les exemples, en coordonnées de grille (20 px)
const EX = {
  'Demi-additionneur': [[['IN', 2, 4, 'A'], ['IN', 2, 10, 'B'], ['XOR', 10, 4], ['AND', 10, 10], ['OUT', 18, 4, 'S'], ['OUT', 18, 10, 'R']], [[0, 2, 0], [1, 2, 1], [0, 3, 0], [1, 3, 1], [2, 4, 0], [3, 5, 0]]],
  'Additionneur complet': [[['IN', 1, 3, 'A'], ['IN', 1, 7, 'B'], ['IN', 1, 13, 'Re'], ['XOR', 8, 4], ['XOR', 16, 8], ['AND', 16, 13], ['AND', 8, 16], ['OR', 24, 14], ['OUT', 31, 8, 'S'], ['OUT', 31, 14, 'Rs']],
    [[0, 3, 0], [1, 3, 1], [3, 4, 0], [2, 4, 1], [3, 5, 0], [2, 5, 1], [0, 6, 0], [1, 6, 1], [5, 7, 0], [6, 7, 1], [4, 8, 0], [7, 9, 0]]],
  'Bascule RS': [[['IN', 2, 4, 'R'], ['IN', 2, 12, 'S'], ['NOR', 12, 4], ['NOR', 12, 11], ['OUT', 22, 4, 'Q'], ['OUT', 22, 11, 'nQ']], [[0, 2, 0], [3, 2, 1], [1, 3, 1], [2, 3, 0], [2, 4, 0], [3, 5, 0]]],
  'Multiplexeur': [[['IN', 1, 3, 'A'], ['IN', 1, 13, 'B'], ['IN', 1, 8, 'Sel'], ['NOT', 8, 5], ['AND', 15, 3], ['AND', 15, 12], ['OR', 23, 7], ['OUT', 30, 7, 'Y']], [[2, 3, 0], [0, 4, 0], [3, 4, 1], [1, 5, 0], [2, 5, 1], [4, 6, 0], [5, 6, 1], [6, 7, 0]]],
  'Clignotant': [[['CLK', 2, 6, 'H'], ['NOT', 10, 6], ['OUT', 18, 3, 'L1'], ['OUT', 18, 9, 'L2']], [[0, 1, 0], [0, 2, 0], [1, 3, 0]]],
};
export default async function (ctx) {
  const view = ctx.view;
  if (!ctx.host) { view.textContent = "Ce plugin doit être approuvé par NeoDex pour s'ouvrir."; return; }
  const { el, toast } = ctx.host;
  ctx.host.addStyle(CSS);
  let cs = [], ws = [], nid = 1;
  function load([comps, wires]) { cs = comps.map(([t, x, y, label], i) => ({id: i + 1, t, x: x * 20, y: y * 20, label: label || '', v: 0})); nid = cs.length + 1; ws = wires.map(([f, t, pin]) => ({from: f + 1, to: t + 1, pin})); settle(cs, ws); }
  // vérification : le demi-additionneur et l'additionneur complet donnent les bonnes sommes, la bascule RS garde sa mémoire
  { load(EX['Additionneur complet']); const tt = truth(cs, ws); console.assert(tt.rows.every(([i, o]) => o[0] * 1 + o[1] * 2 === i[0] + i[1] + i[2]), 'gateworks : additionneur');
    load(EX['Bascule RS']); const [R, S] = cs; S.v = 1; settle(cs, ws); S.v = 0; settle(cs, ws); const q1 = cs[4].v; R.v = 1; settle(cs, ws); R.v = 0; settle(cs, ws); console.assert(q1 === 1 && cs[4].v === 0, 'gateworks : bascule'); }
  let data = null; try { data = await ctx.folder.read('gateworks'); } catch {}
  if (data?.cs?.length) { cs = data.cs; ws = data.ws || []; nid = Math.max(0, ...cs.map(c => c.id)) + 1; settle(cs, ws); } else load(EX['Demi-additionneur']);
  let clockHz = data?.hz || 2, saveT = 0;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => ctx.folder.write('gateworks', {cs: cs.map(({id, t, x, y, label, v}) => ({id, t, x, y, label, v: t === 'IN' ? v : 0})), ws, hz: clockHz}).catch(() => {}), 400); };
  // ---------- l'interface ----------
  view.innerHTML = '';
  const wrap = el('div', 'appWrap'), head = el('div', 'agHead'), bar = el('div', 'gwBar'), bar2 = el('div', 'gwBar'), lay = el('div', 'gwGrid'), main = el('div'), side = el('div', 'sysCard px');
  head.append(el('span', 'label', 'Gateworks · circuits logiques')); lay.append(main, side); wrap.append(head, bar, bar2, lay); view.append(wrap);
  const can = el('canvas', 'gwCan'), g = can.getContext('2d'); can.width = 820; can.height = 480; can.id = 'gw_canvas';
  const hint = el('p', 'gwHint', 'Choisis une pièce puis clique sur la grille pour la poser. Glisse une pièce pour la déplacer, glisse d\'une sortie (à droite) vers une entrée (à gauche) pour la relier. Clic sur un interrupteur : l\'allumer. Clic droit ou Suppr : enlever une pièce ou un fil.');
  main.append(can, hint);
  let tool = null;
  const toolBtns = [];
  for (const t of Object.keys(T)) { const b = el('button', 'btn px', NAMES[t]); b.dataset.tool = t; b.onclick = () => { tool = tool === t ? null : t; toolBtns.forEach(x => x.classList.toggle('main', x.dataset.tool === tool)); }; toolBtns.push(b); bar.append(b); }
  const exSel = el('select', 'f'); exSel.append(el('option', '', 'Exemples…')); for (const k of Object.keys(EX)) { const o = el('option', '', k); o.value = k; exSel.append(o); }
  exSel.onchange = () => { if (!EX[exSel.value]) return; load(EX[exSel.value]); exSel.selectedIndex = 0; save(); refresh(); };
  const clear = el('button', 'btn px', 'Tout effacer'); clear.onclick = async () => { if (cs.length && !(await ctx.host.confirm?.('Effacer tout le circuit ?') ?? true)) return; cs = []; ws = []; save(); refresh(); };
  const hz = el('select', 'f'); for (const v of [0.5, 1, 2, 5, 10]) { const o = el('option', '', v + ' Hz'); o.value = v; if (v === clockHz) o.selected = true; hz.append(o); }
  hz.title = 'Vitesse de l\'horloge'; hz.onchange = () => { clockHz = +hz.value; save(); };
  bar2.append(exSel, clear, el('span', 'hint', 'Horloge'), hz);
  const tTitle = el('span', 'label', 'Table de vérité'), tBox = el('div', 'gwScroll'), status = el('p', 'gwHint');
  tBox.id = 'gw_table'; status.id = 'gw_status'; side.append(tTitle, tBox, status);
  // ---------- le dessin ----------
  const ON = '#ffd34f', OFF = '#3a2f5a';
  function draw() {
    g.fillStyle = '#0b0816'; g.fillRect(0, 0, can.width, can.height);
    g.fillStyle = '#1a1430'; for (let x = 0; x < can.width; x += 20) for (let y = 0; y < can.height; y += 20) g.fillRect(x, y, 2, 2);
    const by = new Map(cs.map(c => [c.id, c]));
    g.lineWidth = 3;
    for (const w of ws) { const a = by.get(w.from), b = by.get(w.to); if (!a || !b) continue; const [x1, y1] = pinOut(a), [x2, y2] = pinIn(b, w.pin), mx = Math.round((x1 + x2) / 2);
      g.strokeStyle = a.v ? ON : OFF; g.beginPath(); g.moveTo(x1, y1); g.lineTo(mx, y1); g.lineTo(mx, y2); g.lineTo(x2, y2); g.stroke(); }
    if (wiring) { g.strokeStyle = '#ff4fb0'; g.setLineDash([4, 4]); g.beginPath(); const [x1, y1] = pinOut(wiring.c); g.moveTo(x1, y1); g.lineTo(wiring.x, wiring.y); g.stroke(); g.setLineDash([]); }
    g.font = 'bold 12px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const c of cs) {
      const [w, h] = SIZE(c.t), sel = c === hover;
      if (c.t === 'OUT') { g.fillStyle = c.v ? ON : '#2a2244'; g.fillRect(c.x + 4, c.y + 4, w - 8, h - 8); g.strokeStyle = sel ? '#ff4fb0' : '#8a7aa8'; g.lineWidth = 2; g.strokeRect(c.x + 4, c.y + 4, w - 8, h - 8); if (c.v) { g.fillStyle = '#fff6c0'; g.fillRect(c.x + 10, c.y + 10, 6, 6); } }
      else if (c.t === 'IN' || c.t === 'CLK') { g.fillStyle = '#1a1430'; g.fillRect(c.x, c.y, w, h); g.strokeStyle = sel ? '#ff4fb0' : '#8a7aa8'; g.lineWidth = 2; g.strokeRect(c.x, c.y, w, h); g.fillStyle = c.v ? ON : '#5a4a8a'; g.fillRect(c.x + 6, c.y + 6, w - 12, h - 12); g.fillStyle = c.v ? '#000' : '#fff'; g.fillText(c.t === 'CLK' ? '⏲' : c.v ? '1' : '0', c.x + w / 2, c.y + h / 2 + 1); }
      else { g.fillStyle = '#241c40'; g.fillRect(c.x, c.y, w, h); g.strokeStyle = sel ? '#ff4fb0' : c.v ? ON : '#8a7aa8'; g.lineWidth = 2; g.strokeRect(c.x, c.y, w, h); g.fillStyle = '#fff'; g.fillText(c.t, c.x + w / 2, c.y + h / 2 + 1); }
      g.fillStyle = '#8a7aa8';
      for (let i = 0; i < T[c.t][0]; i++) { const [px, py] = pinIn(c, i); g.fillRect(px - 4, py - 2, 5, 5); }
      if (c.t !== 'OUT') { const [px, py] = pinOut(c); g.fillStyle = c.v ? ON : '#8a7aa8'; g.fillRect(px - 1, py - 3, 6, 6); }
      if (c.label) { g.fillStyle = '#c8b8f0'; g.font = '11px monospace'; g.fillText(c.label, c.x + w / 2, c.y - 8); g.font = 'bold 12px monospace'; }
    }
    if (tool && ghost) { const [w, h] = SIZE(tool); g.strokeStyle = '#ff4fb0'; g.lineWidth = 1; g.setLineDash([3, 3]); g.strokeRect(ghost[0], ghost[1], w, h); g.setLineDash([]); }
  }
  function drawTable() {
    const tt = truth(cs, ws); tBox.replaceChildren();
    if (!tt) { tBox.append(el('p', 'hint', cs.some(c => c.t === 'IN') && cs.filter(c => c.t === 'IN').length > 6 ? '6 interrupteurs au plus pour la table.' : 'Pose au moins un interrupteur et une lampe.')); return; }
    const tb = el('table', 'gwTable'), hr = el('tr'), name = (c, i, p) => c.label || p + (i + 1);
    tt.ins.forEach((c, i) => hr.append(el('th', '', name(c, i, 'E')))); tt.outs.forEach((c, i) => hr.append(el('th', '', '→ ' + name(c, i, 'L'))));
    tb.append(hr); tb.translate = false;
    const cur = tt.ins.map(c => c.v | 0).join('');
    for (const [i, o] of tt.rows) { const tr = el('tr', i.join('') === cur ? 'cur' : ''); i.forEach(v => tr.append(el('td', v ? 'on' : '', String(v)))); o.forEach(v => tr.append(el('td', v === 1 ? 'on' : '', String(v)))); tb.append(tr); }
    tBox.append(tb);
  }
  function refresh() { const ok = settle(cs, ws); status.replaceChildren(el('span', '', ok ? 'Circuit stable.' : 'Le circuit oscille (une boucle sans fin) : la table l\'indique par ~.'), el('br'), cs.length + ' ', el('span', '', cs.length > 1 ? 'pièces' : 'pièce'), ', ' + ws.length + ' ', el('span', '', ws.length > 1 ? 'fils' : 'fil')); drawTable(); draw(); }
  // ---------- la souris ----------
  const pos = e => { const r = can.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * can.width, (e.clientY - r.top) / r.height * can.height]; };
  const hit = (x, y) => { for (let i = cs.length - 1; i >= 0; i--) { const c = cs[i], [w, h] = SIZE(c.t); if (x >= c.x - 6 && x <= c.x + w + 6 && y >= c.y && y <= c.y + h) return c; } return null; };
  const nearOut = (x, y) => cs.find(c => c.t !== 'OUT' && Math.hypot(x - pinOut(c)[0], y - pinOut(c)[1]) < 9);
  const nearIn = (x, y) => { for (const c of cs) for (let i = 0; i < T[c.t][0]; i++) { const [px, py] = pinIn(c, i); if (Math.hypot(x - px, y - py) < 10) return [c, i]; } return null; };
  const wireAt = (x, y) => { const by = new Map(cs.map(c => [c.id, c])); return ws.find(w => { const a = by.get(w.from), b = by.get(w.to); if (!a || !b) return false; const [x1, y1] = pinOut(a), [x2, y2] = pinIn(b, w.pin), mx = Math.round((x1 + x2) / 2), seg = (ax, ay, bx, by2) => x >= Math.min(ax, bx) - 4 && x <= Math.max(ax, bx) + 4 && y >= Math.min(ay, by2) - 4 && y <= Math.max(ay, by2) + 4; return seg(x1, y1, mx, y1) || seg(mx, y1, mx, y2) || seg(mx, y2, x2, y2); }); };
  let drag = null, wiring = null, hover = null, ghost = null, moved = false;
  const snap = v => Math.round(v / 20) * 20;
  function remove(x, y) { const c = hit(x, y); if (c) { cs = cs.filter(k => k !== c); ws = ws.filter(w => w.from !== c.id && w.to !== c.id); } else { const w = wireAt(x, y); if (!w) return; ws = ws.filter(k => k !== w); } hover = null; save(); refresh(); }
  can.oncontextmenu = e => { e.preventDefault(); remove(...pos(e)); };
  can.onpointerdown = e => {
    if (e.button !== 0) return; const [x, y] = pos(e); try { can.setPointerCapture(e.pointerId); } catch {} moved = false;
    const o = nearOut(x, y); if (o && !tool) { wiring = {c: o, x, y}; return; }
    const c = hit(x, y);
    if (c && !tool) { drag = {c, dx: x - c.x, dy: y - c.y}; return; }
    if (tool) { const [w, h] = SIZE(tool), t = tool, n = cs.filter(k => k.t === t).length;
      cs.push({id: nid++, t, x: Math.max(0, Math.min(can.width - w, snap(x - w / 2))), y: Math.max(20, Math.min(can.height - h, snap(y - h / 2))), label: t === 'IN' ? String.fromCharCode(65 + n % 26) : t === 'OUT' ? 'L' + (n + 1) : t === 'CLK' ? 'H' + (n + 1) : '', v: 0}); save(); refresh(); }
  };
  can.onpointermove = e => {
    const [x, y] = pos(e);
    if (wiring) { wiring.x = x; wiring.y = y; draw(); return; }
    if (drag) { moved = true; const [w, h] = SIZE(drag.c.t); drag.c.x = Math.max(0, Math.min(can.width - w, snap(x - drag.dx))); drag.c.y = Math.max(20, Math.min(can.height - h, snap(y - drag.dy))); draw(); return; }
    const hv = hit(x, y); ghost = tool ? (() => { const [w, h] = SIZE(tool); return [snap(x - w / 2), snap(y - h / 2)]; })() : null;
    if (hv !== hover || tool) { hover = hv; draw(); }
    can.style.cursor = nearOut(x, y) && !tool ? 'crosshair' : '';
  };
  can.onpointerup = e => {
    const [x, y] = pos(e);
    if (wiring) { const t = nearIn(x, y); if (t && t[0] !== wiring.c) { ws = ws.filter(w => !(w.to === t[0].id && w.pin === t[1])); ws.push({from: wiring.c.id, to: t[0].id, pin: t[1]}); save(); } wiring = null; refresh(); return; }
    if (drag) { const c = drag.c; drag = null; if (!moved && c.t === 'IN') c.v = 1 - (c.v | 0); save(); refresh(); }
  };
  can.onpointerleave = () => { ghost = null; draw(); };
  const onKey = e => { if (!view.isConnected) return; if ((e.key === 'Delete' || e.key === 'Backspace') && hover && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) { cs = cs.filter(k => k !== hover); ws = ws.filter(w => w.from !== hover.id && w.to !== hover.id); hover = null; save(); refresh(); } if (e.key === 'Escape') { tool = null; toolBtns.forEach(x => x.classList.remove('main')); draw(); } };
  document.addEventListener('keydown', onKey);
  // l'horloge
  let last = 0, alive = true;
  (function loop(t) { if (!alive) return; if (!view.isConnected) { document.removeEventListener('keydown', onKey); alive = false; return; }
    if (cs.some(c => c.t === 'CLK') && t - last > 500 / clockHz) { last = t; cs.forEach(c => { if (c.t === 'CLK') c.v = 1 - (c.v | 0); }); settle(cs, ws); draw(); }
    requestAnimationFrame(loop); })(0);
  ctx.onClose?.(() => { alive = false; document.removeEventListener('keydown', onKey); });
  refresh();
}
