// Gateworks : des portes logiques à poser et à relier à la souris. Interrupteurs, lampes, horloge, 7 portes ; la simulation tourne
// en continu (les bascules marchent), la table de vérité se calcule toute seule, et des exemples montrent additionneurs et mémoires.
// Le parcours : 11 niveaux, de la seule porte NON-ET jusqu'à un petit processeur ; chaque niveau réussi devient une puce réutilisable.
const CSS = `
.gwBar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;align-items:center}
.gwBar .btn{min-width:0;width:auto;margin:0;padding:6px 10px}
.gwBar .btn.chip{border-style:dashed}
.gwBar .f{width:auto;flex:none;margin:0}
.gwBar .hint{align-self:center}
.gwGrid{display:grid;grid-template-columns:minmax(0,1fr) clamp(260px,21vw,380px);gap:14px}
@media (max-width:900px){.gwGrid{grid-template-columns:minmax(0,1fr)}}
.gwCan{display:block;width:min(100%,calc(clamp(280px,calc(100vh - 290px),1000px) * 820 / 480));height:auto;aspect-ratio:820/480;margin:0 auto;image-rendering:pixelated;background:#0b0816;border:2px solid var(--line);touch-action:none}
.gwTable{font:clamp(14px,1vw,17px) monospace;border-collapse:collapse;width:100%}
.gwTable td,.gwTable th{border:1px solid var(--line);padding:4px 8px;text-align:center}
.gwTable th{color:var(--lilac)}
.gwTable td.on{color:#ffd34f}
.gwTable td.bad{background:rgba(255,74,58,.28);color:#fff}
.gwTable tr.cur td{background:rgba(var(--pkr),.25)}
.gwScroll{max-height:clamp(220px,calc(100vh - 520px),640px);overflow:auto;margin-top:6px}
.gwHint{font-size:14px;color:var(--lilac);line-height:1.5;margin-top:8px}
.gwGoal{font-size:15px;line-height:1.5;margin:6px 0}
.gwGoal b{color:#ffd34f}
.gwRes{font-size:15px;line-height:1.45;margin:8px 0 0}
.gwRes.ok{color:#7ee07a}.gwRes.no{color:#ff8a7a}
.gwRow{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.gwBar [hidden],.gwRow [hidden],.sysCard [hidden]{display:none!important}
`;
// les types : nombre d'entrées, fonction
const T = {
  IN: [0, null], OUT: [1, null], CLK: [0, null], CHIP: [0, null],
  AND: [2, (a, b) => a & b], OR: [2, (a, b) => a | b], XOR: [2, (a, b) => a ^ b], NAND: [2, (a, b) => 1 - (a & b)], NOR: [2, (a, b) => 1 - (a | b)], XNOR: [2, (a, b) => 1 - (a ^ b)], NOT: [1, a => 1 - a],
};
const NAMES = {IN: 'Interrupteur', OUT: 'Lampe', CLK: 'Horloge', AND: 'ET', OR: 'OU', XOR: 'OU exclusif', NAND: 'NON-ET', NOR: 'NON-OU', XNOR: 'NON-OU excl.', NOT: 'NON'};
// les puces : nom -> { cs, ws } (le circuit), plus ins / outs (leurs étiquettes, dans l'ordre des broches : de haut en bas)
let LIB = {};
const byPos = (a, b) => a.y - b.y || a.x - b.x;
const defPins = d => ({ ins: d.cs.filter(c => c.t === 'IN').sort(byPos).map(c => c.label), outs: d.cs.filter(c => c.t === 'OUT').sort(byPos).map(c => c.label) });
const nIn = c => c.t === 'CHIP' ? (LIB[c.chip]?.ins.length || 0) : T[c.t][0];
const nOut = c => c.t === 'OUT' ? 0 : c.t === 'CHIP' ? (LIB[c.chip]?.outs.length || 0) : 1;
const SIZE = c => c.t === 'IN' || c.t === 'CLK' ? [50, 30] : c.t === 'OUT' ? [40, 40] : c.t === 'CHIP' ? [100, Math.max(40, 20 * (Math.max(nIn(c), nOut(c)) + 1))] : [60, 40];
const pinIn = (c, i) => { const [, h] = SIZE(c), n = nIn(c); return [c.x, c.y + h * (i + 1) / (n + 1)]; };
const pinOut = (c, j = 0) => { const [w, h] = SIZE(c), n = Math.max(1, nOut(c)); return [c.x + w, c.y + h * (j + 1) / (n + 1)]; };
const outVal = (c, j = 0) => c.t === 'CHIP' ? (c.o?.[j] | 0) : c.v | 0;
// l'ordre de calcul : les pièces les plus proches des entrées d'abord (le plus long chemin depuis un interrupteur, boucles comprises au plus n tours) ;
// ainsi, dans une bascule, le NON de l'horloge change avant que la mémoire ne regarde son entrée
function order(cs, ws) {
  const d = new Map(cs.map(c => [c.id, 0]));
  for (let k = 0; k < cs.length; k++) { let ch = false; for (const w of ws) { const v = Math.min(cs.length, (d.get(w.from) ?? 0) + 1); if (d.has(w.to) && v > d.get(w.to)) { d.set(w.to, v); ch = true; } } if (!ch) break; }
  return [...cs].sort((a, b) => d.get(a.id) - d.get(b.id));
}
// une puce posée : sa copie du circuit, avec sa propre mémoire
function inst(name) {
  const d = LIB[name]; if (!d) return null;
  const cs = d.cs.map(c => ({ ...c, v: 0, o: null, inner: null })), ws = d.ws.map(w => ({ ...w }));
  return { cs, ws, ins: cs.filter(c => c.t === 'IN').sort(byPos), outs: cs.filter(c => c.t === 'OUT').sort(byPos), ord: order(cs, ws) };
}
// la simulation : on recalcule les pièces une par une, sur place, jusqu'à ce que rien ne bouge (au plus 64 tours) ;
// sur place et pas toutes en même temps, sinon une bascule partie de 0 oscillerait sans fin. Une puce calcule tout son circuit à chaque fois.
function settle(cs, ws, ord = order(cs, ws)) {
  const by = new Map(cs.map(c => [c.id, c])), inputs = new Map();
  for (const w of ws) inputs.set(w.to + ':' + w.pin, w);
  const inVal = (c, i) => { const w = inputs.get(c.id + ':' + i), f = w && by.get(w.from); return f ? outVal(f, w.out | 0) : 0; };
  for (let k = 0; k < 64; k++) {
    let ch = false;
    for (const c of ord) {
      if (c.t === 'IN' || c.t === 'CLK') continue;
      if (c.t === 'CHIP') {
        c.inner ??= inst(c.chip); if (!c.inner) continue;
        c.inner.ins.forEach((p, i) => p.v = inVal(c, i)); settle(c.inner.cs, c.inner.ws, c.inner.ord);
        const o = c.inner.outs.map(p => p.v | 0); if (!c.o || o.some((v, j) => v !== c.o[j])) { c.o = o; c.v = o[0] | 0; ch = true; }
        continue;
      }
      const v = c.t === 'OUT' ? inVal(c, 0) : T[c.t][1](...Array.from({length: T[c.t][0]}, (_, i) => inVal(c, i)));
      if ((c.v | 0) !== v) { c.v = v; ch = true; }
    }
    if (!ch) return true;
  }
  return false;  // ça oscille (une boucle NON sur elle-même, par exemple)
}
const reset = cs => cs.forEach(c => { if (c.t !== 'IN') c.v = 0; c.o = null; c.inner = null; });
// la table de vérité : toutes les combinaisons des interrupteurs (6 au plus), en partant de tout à 0 ; la mémoire des puces est remise après
function truth(cs, ws) {
  const ins = cs.filter(c => c.t === 'IN').sort(byPos), outs = cs.filter(c => c.t === 'OUT').sort(byPos);
  if (!ins.length || !outs.length || ins.length > 6) return null;
  const save = cs.map(c => [c.v, c.o, c.inner]), rows = [], ord = order(cs, ws);
  for (let m = 0; m < 1 << ins.length; m++) {
    reset(cs); ins.forEach((c, i) => c.v = m >> (ins.length - 1 - i) & 1);
    const ok = settle(cs, ws, ord); rows.push([ins.map(c => c.v), outs.map(c => ok ? c.v : '~')]);
  }
  cs.forEach((c, i) => [c.v, c.o, c.inner] = save[i]);
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
// le parcours « de la porte au processeur » : on part de la seule porte NON-ET ; chaque niveau réussi devient une puce pour les suivants.
// f : la fonction attendue (entrées -> sorties) ; steps : pour les mémoires, une suite d'étapes [entrées, sorties attendues] en partant de tout à 0
const B = (n, k) => Array.from({length: k}, (_, i) => n >> (k - 1 - i) & 1);
const LEVELS = [
  { id: 'NON', ins: ['A'], outs: ['Y'], f: ([a]) => [1 - a],
    goal: 'La porte <b>NON-ET</b> est ta seule pièce : avec elle, on peut tout construire. Fais une porte <b>NON</b> : la lampe Y s’allume quand A est éteint.', tip: 'Relie A aux deux entrées d’un NON-ET.' },
  { id: 'ET', ins: ['A', 'B'], outs: ['Y'], f: ([a, b]) => [a & b],
    goal: 'Ta puce NON est prête. Fais une porte <b>ET</b> : Y s’allume seulement quand A et B sont allumés tous les deux.', tip: 'Un NON-ET, puis un NON derrière.' },
  { id: 'OU', ins: ['A', 'B'], outs: ['Y'], f: ([a, b]) => [a | b],
    goal: 'Fais une porte <b>OU</b> : Y s’allume quand A ou B (ou les deux) est allumé.', tip: 'Un NON sur A, un NON sur B, puis un NON-ET des deux.' },
  { id: 'OU exclusif', ins: ['A', 'B'], outs: ['Y'], f: ([a, b]) => [a ^ b],
    goal: 'Fais un <b>OU exclusif</b> : Y s’allume quand A et B sont différents.', tip: '(A OU B) ET (A NON-ET B).' },
  { id: 'Demi-additionneur', ins: ['A', 'B'], outs: ['S', 'R'], f: ([a, b]) => [a ^ b, a & b],
    goal: 'Additionne deux bits : <b>S</b> est la somme, <b>R</b> la retenue. En binaire, 1 + 1 = 10 : S = 0 et R = 1.', tip: 'Un OU exclusif pour S, un ET pour R.' },
  { id: 'Additionneur complet', ins: ['A', 'B', 'Re'], outs: ['S', 'Rs'], f: ([a, b, c]) => B(a + b + c, 2).reverse(),
    goal: 'Additionne <b>A + B + Re</b> (la retenue qui arrive) : S est la somme, <b>Rs</b> la retenue qui sort.', tip: 'Deux demi-additionneurs à la suite, et un OU des deux retenues.' },
  { id: 'Additionneur 2 bits', ins: ['A1', 'A0', 'B1', 'B0'], outs: ['S2', 'S1', 'S0'], f: ([a1, a0, b1, b0]) => B(a1 * 2 + a0 + b1 * 2 + b0, 3),
    goal: 'Additionne deux nombres de 2 bits : <b>A1 A0 + B1 B0 = S2 S1 S0</b>. Le bit qui finit par 1 vaut 2, celui qui finit par 0 vaut 1 (et S2 vaut 4).', tip: 'Un demi-additionneur pour A0 + B0, un additionneur complet pour A1 + B1 avec la retenue du premier.' },
  { id: 'Multiplexeur', ins: ['Sel', 'A', 'B'], outs: ['Y'], f: ([s, a, b]) => [s ? b : a],
    goal: 'Un aiguillage : <b>Y recopie A</b> quand Sel est éteint, <b>B</b> quand Sel est allumé.', tip: '(A ET NON Sel) OU (B ET Sel).' },
  { id: 'Verrou', ins: ['D', 'E'], outs: ['Q'], steps: [[[1, 1], [1]], [[0, 0], [1]], [[0, 1], [0]], [[1, 0], [0]], [[1, 1], [1]], [[0, 0], [1]]],
    goal: 'La <b>mémoire</b> ! Quand E (écrire) est allumé, Q recopie D. Quand E s’éteint, Q <b>garde sa valeur</b>, même si D change.', tip: 'Un multiplexeur dont la sortie revient sur sa propre entrée A : un fil peut repartir en arrière.' },
  { id: 'Bascule D', ins: ['D', 'H'], outs: ['Q'], steps: [[[1, 0], [0]], [[1, 1], [1]], [[0, 1], [1]], [[0, 0], [1]], [[0, 1], [0]], [[1, 1], [0]], [[1, 0], [0]], [[1, 1], [1]]],
    goal: 'La mémoire au rythme de l’horloge : Q prend la valeur de D <b>seulement quand H passe de 0 à 1</b>, et ne bouge plus le reste du temps.', tip: 'Deux verrous à la suite : le premier écrit quand H est éteint (avec un NON), le second quand H est allumé.' },
  { id: 'Processeur', ins: ['Op', 'V1', 'V0', 'H'], outs: ['Q1', 'Q0'],
    steps: [[[0, 1, 0, 0], [0, 0]], [[0, 1, 0, 1], [1, 0]], [[0, 1, 0, 0], [1, 0]], [[1, 0, 1, 0], [1, 0]], [[1, 0, 1, 1], [1, 1]], [[1, 0, 1, 0], [1, 1]], [[1, 1, 1, 0], [1, 1]], [[1, 1, 1, 1], [1, 0]], [[1, 1, 1, 0], [1, 0]], [[0, 0, 0, 0], [1, 0]], [[0, 0, 0, 1], [0, 0]]],
    goal: 'Ton <b>processeur</b> ! À chaque fois que H passe de 0 à 1, il exécute une instruction sur son registre Q1 Q0 : si <b>Op</b> est éteint, il <b>charge</b> la valeur V1 V0 ; si Op est allumé, il l’<b>ajoute</b> (Q = Q + V, sur 2 bits).', tip: 'Un additionneur 2 bits pour Q + V, deux multiplexeurs pilotés par Op (V ou la somme), et deux bascules D sur H.' },
];
// vérifier un niveau : la table entière, ou les étapes de la mémoire ; renvoie ce qui ne va pas, en clair
function checkLevel(L, cs, ws) {
  const ins = cs.filter(c => c.t === 'IN').sort(byPos), outs = cs.filter(c => c.t === 'OUT').sort(byPos), ord = order(cs, ws);
  const say = (iv, which, want, got) => L.ins.map((n, i) => n + ' = ' + iv[i]).join(', ') + ' : ' + L.outs[which] + ' devrait être à ' + want + (got === '~' ? ' (le circuit oscille)' : ' (il est à ' + got + ')') + '.';
  const save = cs.map(c => [c.v, c.o, c.inner]), back = () => cs.forEach((c, i) => [c.v, c.o, c.inner] = save[i]);
  try {
    if (L.f) for (let m = 0; m < 1 << L.ins.length; m++) {
      const iv = B(m, L.ins.length); reset(cs); ins.forEach((c, i) => c.v = iv[i]); const ok = settle(cs, ws, ord), want = L.f(iv);
      for (let j = 0; j < want.length; j++) { const got = ok ? outs[j].v | 0 : '~'; if (got !== want[j]) return { ok: false, msg: 'Pour ' + say(iv, j, want[j], got) }; }
    }
    else { reset(cs); settle(cs, ws, ord);
      for (let s = 0; s < L.steps.length; s++) { const [iv, want] = L.steps[s]; ins.forEach((c, i) => c.v = iv[i]); const ok = settle(cs, ws, ord);
        for (let j = 0; j < want.length; j++) { const got = ok ? outs[j].v | 0 : '~'; if (got !== want[j]) return { ok: false, msg: 'À l’étape ' + (s + 1) + ' sur ' + L.steps.length + ', pour ' + say(iv, j, want[j], got) }; } } }
    return { ok: true };
  } finally { back(); }
}
const strip = cs => cs.map(({id, t, x, y, label, chip, fixed, v}) => ({id, t, x, y, label, ...(chip ? {chip} : {}), ...(fixed ? {fixed} : {}), v: t === 'IN' ? v | 0 : 0}));
const stripW = ws => ws.map(({from, to, pin, out}) => ({from, to, pin, ...(out ? {out} : {})}));
// le départ d'un niveau : ses interrupteurs à gauche, ses lampes à droite, qu'on ne peut pas enlever
function levelStart(L) {
  const cs = [], gap = n => Math.max(3, Math.min(5, Math.floor(20 / n)));
  L.ins.forEach((n, i) => cs.push({ id: cs.length + 1, t: 'IN', x: 20, y: (2 + i * gap(L.ins.length)) * 20, label: n, v: 0, fixed: true }));
  L.outs.forEach((n, i) => cs.push({ id: cs.length + 1, t: 'OUT', x: 740, y: (2 + i * gap(L.outs.length)) * 20, label: n, v: 0, fixed: true }));
  return { cs, ws: [] };
}

export default async function (ctx) {
  const view = ctx.view;
  if (!ctx.host) { view.textContent = "Ce plugin doit être approuvé par NeoDex pour s'ouvrir."; return; }
  const { el, toast } = ctx.host;
  ctx.host.addStyle(CSS);
  let cs = [], ws = [], nid = 1;
  function load([comps, wires]) { cs = comps.map(([t, x, y, label], i) => ({id: i + 1, t, x: x * 20, y: y * 20, label: label || '', v: 0})); nid = cs.length + 1; ws = wires.map(([f, t, pin]) => ({from: f + 1, to: t + 1, pin})); settle(cs, ws); }
  // vérification : le demi-additionneur et l'additionneur complet donnent les bonnes sommes, la bascule RS garde sa mémoire ; une puce garde la sienne
  { load(EX['Additionneur complet']); const tt = truth(cs, ws); console.assert(tt.rows.every(([i, o]) => o[0] * 1 + o[1] * 2 === i[0] + i[1] + i[2]), 'gateworks : additionneur');
    load(EX['Bascule RS']); const [R, S] = cs; S.v = 1; settle(cs, ws); S.v = 0; settle(cs, ws); const q1 = cs[4].v; R.v = 1; settle(cs, ws); R.v = 0; settle(cs, ws); console.assert(q1 === 1 && cs[4].v === 0, 'gateworks : bascule');
    LIB = { RS: { cs: strip(cs), ws: stripW(ws), ...defPins({ cs }) } };
    const two = [{ id: 1, t: 'IN', x: 0, y: 0, label: 'R' }, { id: 2, t: 'IN', x: 0, y: 40, label: 'S' }, { id: 3, t: 'CHIP', chip: 'RS', x: 100, y: 0 }, { id: 4, t: 'OUT', x: 300, y: 0, label: 'Q' }];
    const tw = [{ from: 1, to: 3, pin: 0 }, { from: 2, to: 3, pin: 1 }, { from: 3, to: 4, pin: 0 }]; two[1].v = 1; settle(two, tw); two[1].v = 0; settle(two, tw);
    console.assert(two[3].v === 1 && checkLevel(LEVELS[1], levelStart(LEVELS[1]).cs, []).ok === false, 'gateworks : puce à mémoire'); LIB = {}; }
  let data = null; try { data = await ctx.folder.read('gateworks'); } catch {}
  data = { hz: 2, lib: {}, done: {}, work: {}, level: null, ...(data || {}) };
  if (!data.free && data.cs) data.free = { cs: data.cs, ws: data.ws || [] };  // l'ancien format (avant le parcours)
  delete data.cs; delete data.ws;
  LIB = data.lib;
  let level = LEVELS.find(L => L.id === data.level) || null;
  let clockHz = data.hz || 2, saveT = 0;
  const keepCur = () => { const w = { cs: strip(cs), ws: stripW(ws) }; if (level) data.work[level.id] = w; else data.free = w; };
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { keepCur(); data.hz = clockHz; data.level = level?.id || null; ctx.folder.write('gateworks', data).catch(() => {}); }, 400); };
  function use(w) { cs = w.cs.map(c => ({ ...c, o: null, inner: null })); ws = w.ws.map(x => ({ ...x })); nid = Math.max(0, ...cs.map(c => c.id)) + 1; settle(cs, ws); }
  if (level) use(data.work[level.id] || levelStart(level)); else if (data.free?.cs?.length) use(data.free); else load(EX['Demi-additionneur']);
  // ---------- l'interface ----------
  view.innerHTML = '';
  const wrap = el('div', 'appWrap wide'), head = el('div', 'agHead'), bar = el('div', 'gwBar'), bar2 = el('div', 'gwBar'), lay = el('div', 'gwGrid'), main = el('div'), side = el('div', 'sysCard px');
  const headL = el('span', 'label', 'Gateworks · circuits logiques'), headH = el('span', 'hint', '');
  head.append(headL, headH); lay.append(main, side); wrap.append(head, bar2, bar, lay); view.append(wrap);
  const can = el('canvas', 'gwCan'), g = can.getContext('2d'); const LW = 820, LH = 480; can.width = LW; can.height = LH; can.id = 'gw_canvas';  // LW × LH : la grille ; la toile est dessinée plus fine si elle est affichée plus grande
  const hint = el('p', 'gwHint', 'Choisis une pièce puis clique sur la grille pour la poser. Glisse une pièce pour la déplacer, glisse d\'une sortie (à droite) vers une entrée (à gauche) pour la relier. Clic sur un interrupteur : l\'allumer. Clic droit ou Suppr : enlever une pièce ou un fil.');
  main.append(can, hint);
  let tool = null;  // 'NAND', 'CHIP:Additionneur complet'…
  const toolOf = k => k?.startsWith('CHIP:') ? { t: 'CHIP', chip: k.slice(5) } : { t: k };
  function buildTools() {
    const keys = level ? ['NAND', ...LEVELS.slice(0, LEVELS.indexOf(level)).filter(L => data.done[L.id] && LIB[L.id]).map(L => 'CHIP:' + L.id)]
      : [...Object.keys(T).filter(t => t !== 'CHIP'), ...Object.keys(LIB).map(n => 'CHIP:' + n)];
    if (tool && !keys.includes(tool)) tool = null;
    bar.replaceChildren(...keys.map(k => { const chip = k.startsWith('CHIP:'), b = el('button', 'btn px' + (chip ? ' chip' : '') + (k === tool ? ' main' : ''), chip ? k.slice(5) : NAMES[k]);
      b.dataset.tool = k; b.title = chip ? 'Puce « ' + k.slice(5) + ' » : ' + LIB[k.slice(5)].ins.join(', ') + ' → ' + LIB[k.slice(5)].outs.join(', ') + (level ? '' : ' · clic droit : la supprimer') : '';
      b.onclick = () => { tool = tool === k ? null : k; buildTools(); };
      if (chip && !level) b.oncontextmenu = async e => { e.preventDefault(); const n = k.slice(5); if (!(await ctx.host.confirm?.('Supprimer la puce « ' + n + ' » ? Celles déjà posées ne marcheront plus.') ?? true)) return; delete LIB[n]; if (LEVELS.some(L => L.id === n)) delete data.done[n]; save(); buildTools(); refresh(); };
      return b; }));
  }
  // la barre du haut : le parcours, les exemples, effacer, l'horloge, créer une puce
  const lvSel = el('select', 'f'); lvSel.id = 'gw_level'; lvSel.title = 'Le parcours : de la porte NON-ET au processeur';
  const exSel = el('select', 'f'); exSel.append(el('option', '', 'Exemples…')); for (const k of Object.keys(EX)) { const o = el('option', '', k); o.value = k; exSel.append(o); }
  exSel.onchange = () => { if (!EX[exSel.value]) return; load(EX[exSel.value]); exSel.selectedIndex = 0; save(); refresh(); };
  const clear = el('button', 'btn px', 'Tout effacer'); clear.onclick = async () => { if (cs.some(c => !c.fixed) && !(await ctx.host.confirm?.(level ? 'Recommencer ce niveau ?' : 'Effacer tout le circuit ?') ?? true)) return; if (level) use(levelStart(level)); else { cs = []; ws = []; } save(); refresh(); };
  const hz = el('select', 'f'); for (const v of [0.5, 1, 2, 5, 10]) { const o = el('option', '', v + ' Hz'); o.value = v; if (v === clockHz) o.selected = true; hz.append(o); }
  hz.title = 'Vitesse de l\'horloge'; hz.onchange = () => { clockHz = +hz.value; save(); };
  const hzL = el('span', 'hint', 'Horloge'), mkChip = el('button', 'btn px', 'CRÉER UNE PUCE'); mkChip.id = 'gw_mkchip';
  mkChip.title = 'Le circuit devient une pièce réutilisable : ses interrupteurs sont ses entrées, ses lampes ses sorties';
  mkChip.onclick = async () => {
    if (!cs.some(c => c.t === 'IN') || !cs.some(c => c.t === 'OUT')) { toast('Une puce a besoin d’au moins un interrupteur (entrée) et une lampe (sortie).', true); return; }
    if (cs.some(c => c.t === 'CLK')) { toast('Une puce ne peut pas contenir d’horloge : mets un interrupteur à la place.', true); return; }
    const n = String(await ctx.host.ask?.('Nom de la puce :', '') || '').trim().slice(0, 24); if (!n) return;
    if (LIB[n] && !(await ctx.host.confirm?.('Remplacer la puce « ' + n + ' » ?') ?? true)) return;
    if (inUse(n, { cs: strip(cs) })) { toast('Une puce ne peut pas se contenir elle-même.', true); return; }
    LIB[n] = { cs: strip(cs), ws: stripW(ws), ...defPins({ cs }) }; save(); buildTools(); toast('Puce « ' + n + ' » créée : ' + LIB[n].ins.length + ' entrée(s), ' + LIB[n].outs.length + ' sortie(s).');
  };
  const inUse = (n, d, seen = new Set()) => d.cs.some(c => c.t === 'CHIP' && (c.chip === n || (!seen.has(c.chip) && LIB[c.chip] && (seen.add(c.chip), inUse(n, LIB[c.chip], seen)))));
  bar2.append(lvSel, exSel, clear, hzL, hz, mkChip);
  // le panneau de droite : en atelier, la table de vérité ; dans un niveau, le but, la table (les cases fausses en rouge), VÉRIFIER
  const tTitle = el('span', 'label', 'Table de vérité'), goal = el('div', 'gwGoal'), tBox = el('div', 'gwScroll'), status = el('p', 'gwHint');
  const checkB = el('button', 'btn main px', 'VÉRIFIER'), tipB = el('button', 'btn px', 'ASTUCE'), nextB = el('button', 'btn px', 'NIVEAU SUIVANT'), res = el('p', 'gwRes'), row = el('div', 'gwRow');
  checkB.id = 'gw_check'; nextB.id = 'gw_next'; res.id = 'gw_res'; tBox.id = 'gw_table'; status.id = 'gw_status'; goal.id = 'gw_goal';
  row.append(checkB, tipB, nextB); side.append(tTitle, goal, row, res, tBox, status);
  tipB.onclick = () => { res.className = 'gwRes'; res.textContent = 'Astuce : ' + level.tip; };
  checkB.onclick = () => {
    const r = checkLevel(level, cs, ws); settle(cs, ws);
    if (!r.ok) { res.className = 'gwRes no'; res.textContent = 'Pas encore. ' + r.msg; draw(); return; }
    const first = !data.done[level.id]; data.done[level.id] = true; LIB[level.id] = { cs: strip(cs), ws: stripW(ws), ...defPins({ cs }) };
    const i = LEVELS.indexOf(level), last = i === LEVELS.length - 1;
    res.className = 'gwRes ok'; res.textContent = last ? 'Bravo ! Ton processeur charge et additionne au rythme de l’horloge : tu as construit un ordinateur à partir de la seule porte NON-ET. La puce « Processeur » t’attend dans l’atelier libre.'
      : 'Bravo ! « ' + level.id + ' » devient une puce, à utiliser dans les niveaux suivants' + (first ? '' : ' (remplacée par ce circuit)') + '.';
    save(); paintLevels(); nextB.hidden = last; draw();
  };
  nextB.onclick = () => go(LEVELS[LEVELS.indexOf(level) + 1]?.id ?? '');
  function paintLevels() {
    const reach = LEVELS.findIndex(L => !data.done[L.id]), n = LEVELS.filter(L => data.done[L.id]).length;
    lvSel.replaceChildren(new Option('Atelier libre', ''), ...LEVELS.map((L, i) => { const o = new Option((i + 1) + '. ' + L.id + (data.done[L.id] ? ' ✓' : ''), L.id); o.disabled = reach >= 0 && i > reach && !data.done[L.id]; return o; }));
    lvSel.value = level?.id || ''; headH.textContent = 'Parcours : ' + n + ' / ' + LEVELS.length + (n === LEVELS.length ? ' · processeur construit !' : '');
  }
  function go(id) {
    keepCur(); level = LEVELS.find(L => L.id === id) || null; tool = null;
    if (level) use(data.work[level.id] || levelStart(level)); else if (data.free?.cs) use(data.free); else { cs = []; ws = []; }
    res.textContent = ''; save(); paintLevels(); buildTools(); refresh();
  }
  lvSel.onchange = () => go(lvSel.value);
  function paintMode() {
    for (const x of [exSel, hzL, hz, mkChip]) x.hidden = !!level;
    for (const x of [goal, row, res]) x.hidden = !level;
    nextB.hidden = !level || !data.done[level.id] || LEVELS.indexOf(level) === LEVELS.length - 1;
    if (level) { const i = LEVELS.indexOf(level); goal.innerHTML = '<span class="label">Niveau ' + (i + 1) + ' / ' + LEVELS.length + ' · ' + level.id + '</span><br>' + level.goal + (level.steps ? '<br><small>Vérifié pas à pas : ' + level.steps.length + ' étapes en partant de tout à 0.</small>' : ''); }
    tTitle.hidden = !!level?.steps;
  }
  // ---------- le dessin ----------
  const ON = '#ffd34f', OFF = '#3a2f5a';
  function draw() {
    const k = Math.max(1, Math.min(3, Math.round(can.clientWidth * devicePixelRatio / LW * 2) / 2)); if (can.width !== LW * k) { can.width = LW * k; can.height = LH * k; } g.setTransform(k, 0, 0, k, 0, 0);
    g.fillStyle = '#0b0816'; g.fillRect(0, 0, LW, LH);
    g.fillStyle = '#1a1430'; for (let x = 0; x < LW; x += 20) for (let y = 0; y < LH; y += 20) g.fillRect(x, y, 2, 2);
    const by = new Map(cs.map(c => [c.id, c]));
    g.lineWidth = 3;
    for (const w of ws) { const a = by.get(w.from), b = by.get(w.to); if (!a || !b) continue; const [x1, y1] = pinOut(a, w.out | 0), [x2, y2] = pinIn(b, w.pin);
      g.strokeStyle = outVal(a, w.out | 0) ? ON : OFF; g.beginPath(); g.moveTo(x1, y1);
      if (x2 > x1 + 10) { const mx = Math.round((x1 + x2) / 2); g.lineTo(mx, y1); g.lineTo(mx, y2); }
      else { const yb = Math.max(a.y + SIZE(a)[1], b.y + SIZE(b)[1]) + 10; g.lineTo(x1 + 10, y1); g.lineTo(x1 + 10, yb); g.lineTo(x2 - 10, yb); g.lineTo(x2 - 10, y2); }  // un fil qui revient en arrière passe par-dessous
      g.lineTo(x2, y2); g.stroke(); }
    if (wiring) { g.strokeStyle = '#ff4fb0'; g.setLineDash([4, 4]); g.beginPath(); const [x1, y1] = pinOut(wiring.c, wiring.j); g.moveTo(x1, y1); g.lineTo(wiring.x, wiring.y); g.stroke(); g.setLineDash([]); }
    g.font = 'bold 14px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const c of cs) {
      const [w, h] = SIZE(c), sel = c === hover;
      if (c.t === 'OUT') { g.fillStyle = c.v ? ON : '#2a2244'; g.fillRect(c.x + 4, c.y + 4, w - 8, h - 8); g.strokeStyle = sel ? '#ff4fb0' : '#8a7aa8'; g.lineWidth = 2; g.strokeRect(c.x + 4, c.y + 4, w - 8, h - 8); if (c.v) { g.fillStyle = '#fff6c0'; g.fillRect(c.x + 10, c.y + 10, 6, 6); } }
      else if (c.t === 'IN' || c.t === 'CLK') { g.fillStyle = '#1a1430'; g.fillRect(c.x, c.y, w, h); g.strokeStyle = sel ? '#ff4fb0' : '#8a7aa8'; g.lineWidth = 2; g.strokeRect(c.x, c.y, w, h); g.fillStyle = c.v ? ON : '#5a4a8a'; g.fillRect(c.x + 6, c.y + 6, w - 12, h - 12); g.fillStyle = c.v ? '#000' : '#fff'; g.fillText(c.t === 'CLK' ? '⏲' : c.v ? '1' : '0', c.x + w / 2, c.y + h / 2 + 1); }
      else if (c.t === 'CHIP') { const d = LIB[c.chip]; g.fillStyle = '#1e2a40'; g.fillRect(c.x, c.y, w, h); g.strokeStyle = sel ? '#ff4fb0' : d ? '#7aa8e0' : '#ff4a3a'; g.lineWidth = 2; g.setLineDash([5, 3]); g.strokeRect(c.x, c.y, w, h); g.setLineDash([]);
        g.fillStyle = '#fff'; g.font = 'bold 12px monospace'; g.fillText((c.chip.length > 12 ? c.chip.slice(0, 11) + '…' : c.chip), c.x + w / 2, c.y + 10);
        g.font = '10px monospace'; g.fillStyle = '#b8c8f0';
        if (d) { g.textAlign = 'left'; d.ins.forEach((n, i) => g.fillText(n.slice(0, 4), c.x + 5, pinIn(c, i)[1])); g.textAlign = 'right'; d.outs.forEach((n, j) => g.fillText(n.slice(0, 4), c.x + w - 5, pinOut(c, j)[1])); g.textAlign = 'center'; }
        g.font = 'bold 14px monospace'; }
      else { g.fillStyle = '#241c40'; g.fillRect(c.x, c.y, w, h); g.strokeStyle = sel ? '#ff4fb0' : c.v ? ON : '#8a7aa8'; g.lineWidth = 2; g.strokeRect(c.x, c.y, w, h); g.fillStyle = '#fff'; g.fillText(c.t, c.x + w / 2, c.y + h / 2 + 1); }
      g.fillStyle = '#8a7aa8';
      for (let i = 0; i < nIn(c); i++) { const [px, py] = pinIn(c, i); g.fillRect(px - 4, py - 2, 5, 5); }
      for (let j = 0; j < nOut(c); j++) { const [px, py] = pinOut(c, j); g.fillStyle = outVal(c, j) ? ON : '#8a7aa8'; g.fillRect(px - 1, py - 3, 6, 6); }
      if (c.label) { g.fillStyle = c.fixed ? '#ffd34f' : '#c8b8f0'; g.font = '13px monospace'; g.fillText(c.label, c.x + w / 2, c.y - 8); g.font = 'bold 14px monospace'; }
    }
    if (tool && ghost) { const [w, h] = SIZE(toolOf(tool)); g.strokeStyle = '#ff4fb0'; g.lineWidth = 1; g.setLineDash([3, 3]); g.strokeRect(ghost[0], ghost[1], w, h); g.setLineDash([]); }
  }
  function drawTable() {
    tBox.replaceChildren(); if (level?.steps) return;
    const tt = truth(cs, ws);
    if (!tt) { tBox.append(el('p', 'hint', cs.some(c => c.t === 'IN') && cs.filter(c => c.t === 'IN').length > 6 ? '6 interrupteurs au plus pour la table.' : 'Pose au moins un interrupteur et une lampe.')); return; }
    const tb = el('table', 'gwTable'), hr = el('tr'), name = (c, i, p) => c.label || p + (i + 1);
    tt.ins.forEach((c, i) => hr.append(el('th', '', name(c, i, 'E')))); tt.outs.forEach((c, i) => hr.append(el('th', '', '→ ' + name(c, i, 'L'))));
    tb.append(hr); tb.translate = false;
    const cur = tt.ins.map(c => c.v | 0).join('');
    for (const [i, o] of tt.rows) { const tr = el('tr', i.join('') === cur ? 'cur' : ''), want = level?.f?.(i); i.forEach(v => tr.append(el('td', v ? 'on' : '', String(v))));
      o.forEach((v, j) => { const td = el('td', (v === 1 ? 'on' : '') + (want && v !== want[j] ? ' bad' : ''), String(v)); if (want && v !== want[j]) td.title = 'Attendu : ' + want[j]; tr.append(td); }); tb.append(tr); }
    tBox.append(tb);
  }
  function refresh() { const ok = settle(cs, ws); paintMode(); status.replaceChildren(el('span', '', ok ? 'Circuit stable.' : 'Le circuit oscille (une boucle sans fin) : la table l\'indique par ~.'), el('br'), cs.length + ' ', el('span', '', cs.length > 1 ? 'pièces' : 'pièce'), ', ' + ws.length + ' ', el('span', '', ws.length > 1 ? 'fils' : 'fil')); drawTable(); draw(); }
  // ---------- la souris ----------
  const pos = e => { const r = can.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * LW, (e.clientY - r.top) / r.height * LH]; };
  const hit = (x, y) => { for (let i = cs.length - 1; i >= 0; i--) { const c = cs[i], [w, h] = SIZE(c); if (x >= c.x - 6 && x <= c.x + w + 6 && y >= c.y && y <= c.y + h) return c; } return null; };
  const nearOut = (x, y) => { for (const c of cs) for (let j = 0; j < nOut(c); j++) { const [px, py] = pinOut(c, j); if (Math.hypot(x - px, y - py) < 9) return [c, j]; } return null; };
  const nearIn = (x, y) => { for (const c of cs) for (let i = 0; i < nIn(c); i++) { const [px, py] = pinIn(c, i); if (Math.hypot(x - px, y - py) < 10) return [c, i]; } return null; };
  const wireAt = (x, y) => { const by = new Map(cs.map(c => [c.id, c])); return ws.find(w => { const a = by.get(w.from), b = by.get(w.to); if (!a || !b) return false; const [x1, y1] = pinOut(a, w.out | 0), [x2, y2] = pinIn(b, w.pin), mx = Math.round((x1 + x2) / 2), seg = (ax, ay, bx, by2) => x >= Math.min(ax, bx) - 4 && x <= Math.max(ax, bx) + 4 && y >= Math.min(ay, by2) - 4 && y <= Math.max(ay, by2) + 4; return seg(x1, y1, mx, y1) || seg(mx, y1, mx, y2) || seg(mx, y2, x2, y2); }); };
  let drag = null, wiring = null, hover = null, ghost = null, moved = false;
  const snap = v => Math.round(v / 20) * 20;
  const drop = c => { if (c.fixed) { toast('Les entrées et les sorties du niveau restent en place.', true); return; } cs = cs.filter(k => k !== c); ws = ws.filter(w => w.from !== c.id && w.to !== c.id); hover = null; save(); refresh(); };
  function remove(x, y) { const c = hit(x, y); if (c) return drop(c); const w = wireAt(x, y); if (!w) return; ws = ws.filter(k => k !== w); hover = null; save(); refresh(); }
  can.oncontextmenu = e => { e.preventDefault(); remove(...pos(e)); };
  can.onpointerdown = e => {
    if (e.button !== 0) return; const [x, y] = pos(e); try { can.setPointerCapture(e.pointerId); } catch {} moved = false;
    const o = nearOut(x, y); if (o && !tool) { wiring = {c: o[0], j: o[1], x, y}; return; }
    const c = hit(x, y);
    if (c && !tool) { drag = {c, dx: x - c.x, dy: y - c.y}; return; }
    if (tool) { const k = toolOf(tool), [w, h] = SIZE(k), t = k.t, n = cs.filter(q => q.t === t).length;
      cs.push({id: nid++, ...k, x: Math.max(0, Math.min(LW - w, snap(x - w / 2))), y: Math.max(20, Math.min(LH - h, snap(y - h / 2))), label: t === 'IN' ? String.fromCharCode(65 + n % 26) : t === 'OUT' ? 'L' + (n + 1) : t === 'CLK' ? 'H' + (n + 1) : '', v: 0}); save(); refresh(); }
  };
  can.onpointermove = e => {
    const [x, y] = pos(e);
    if (wiring) { wiring.x = x; wiring.y = y; draw(); return; }
    if (drag) { moved = true; const [w, h] = SIZE(drag.c); drag.c.x = Math.max(0, Math.min(LW - w, snap(x - drag.dx))); drag.c.y = Math.max(20, Math.min(LH - h, snap(y - drag.dy))); draw(); return; }
    const hv = hit(x, y); ghost = tool ? (() => { const [w, h] = SIZE(toolOf(tool)); return [snap(x - w / 2), snap(y - h / 2)]; })() : null;
    if (hv !== hover || tool) { hover = hv; draw(); }
    can.style.cursor = nearOut(x, y) && !tool ? 'crosshair' : '';
  };
  can.onpointerup = e => {
    const [x, y] = pos(e);
    // un fil peut revenir sur la pièce d'où il part : c'est ainsi qu'un circuit se souvient (le verrou)
    if (wiring) { const t = nearIn(x, y); if (t) { ws = ws.filter(w => !(w.to === t[0].id && w.pin === t[1])); ws.push({from: wiring.c.id, to: t[0].id, pin: t[1], ...(wiring.j ? {out: wiring.j} : {})}); save(); } wiring = null; refresh(); return; }
    if (drag) { const c = drag.c; drag = null; if (!moved && c.t === 'IN') c.v = 1 - (c.v | 0); save(); refresh(); }
  };
  can.onpointerleave = () => { ghost = null; draw(); };
  const onKey = e => { if (!view.isConnected) return; if ((e.key === 'Delete' || e.key === 'Backspace') && hover && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName)) drop(hover); if (e.key === 'Escape') { tool = null; buildTools(); draw(); } };
  document.addEventListener('keydown', onKey);
  // l'horloge
  let last = 0, alive = true;
  (function loop(t) { if (!alive) return; if (!view.isConnected) { document.removeEventListener('keydown', onKey); alive = false; return; }
    if (cs.some(c => c.t === 'CLK') && t - last > 500 / clockHz) { last = t; cs.forEach(c => { if (c.t === 'CLK') c.v = 1 - (c.v | 0); }); settle(cs, ws); draw(); }
    requestAnimationFrame(loop); })(0);
  ctx.onClose?.(() => { alive = false; document.removeEventListener('keydown', onKey); });
  // le test : résoudre un niveau avec des pièces données (indices : d'abord les entrées et sorties du niveau, puis les pièces ajoutées)
  view.__gw = {
    go: id => { go(id); return { level: level?.id || '', tools: [...bar.children].map(b => b.dataset.tool) }; },
    build: (parts, wires) => { const base = levelStart(level).cs; cs = [...base, ...parts.map((k, i) => ({ id: base.length + i + 1, ...toolOf(k), x: 160 + (i % 4) * 140, y: 40 + Math.floor(i / 4) * 120, label: '', v: 0 }))]; nid = cs.length + 1;
      ws = wires.map(([f, t, pin, out]) => ({ from: f + 1, to: t + 1, pin, ...(out ? { out } : {}) })); save(); refresh(); return cs.length; },
    check: () => { checkB.click(); return { ok: res.classList.contains('ok'), msg: res.textContent }; },
    state: () => ({ done: LEVELS.filter(L => data.done[L.id]).map(L => L.id), lib: Object.keys(LIB), head: headH.textContent }),
    reset: () => { data.done = {}; data.work = {}; LIB = data.lib = {}; go(''); },
  };
  paintLevels(); buildTools(); refresh();
}
