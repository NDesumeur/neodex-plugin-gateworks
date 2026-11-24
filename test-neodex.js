// lancé par le test « local » de NeoDex : l'additionneur complet, sa table de vérité, un interrupteur basculé à la souris, une porte posée ;
// puis le parcours entier, de la porte NON-ET au processeur : chaque niveau résolu avec les puces gagnées aux niveaux d'avant
module.exports = async ({ pj, sleep, shot }) => {
  await sleep(500);
  const G = `document.getElementById('gw_canvas').closest('.appWrap').parentElement.__gw`;
  await pj(`${G}.reset(), 0`); await sleep(200);
  await pj(`(() => { const s = [...document.querySelectorAll('.gwBar select')].find(x => x.options[0]?.text === 'Exemples…'); s.value = 'Additionneur complet'; s.dispatchEvent(new Event('change')); })(), 0`); await sleep(200);
  const rows = await pj(`[...document.querySelectorAll('#gw_table tr')].slice(1).map(r => [...r.cells].map(c => c.textContent).join(''))`);
  if (rows.length !== 8 || rows[7] !== '11111' || rows[3] !== '01101') throw new Error('table : ' + JSON.stringify(rows));
  // clic sur l'interrupteur A (case 1,3 de la grille) : la ligne en cours devient 100
  await pj(`(() => { const c = document.getElementById('gw_canvas'), r = c.getBoundingClientRect(), k = r.width / 820, o = {clientX: r.left + 45 * k, clientY: r.top + 75 * k, button: 0, bubbles: true, pointerId: 1}; c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); })(), 0`); await sleep(200);
  const cur = await pj(`document.querySelector('#gw_table tr.cur')?.textContent`);
  if (cur !== '10010') throw new Error('après le clic sur A : ' + cur);
  await pj(`document.querySelector('[data-tool=AND]').click(), 0`);
  await pj(`(() => { const c = document.getElementById('gw_canvas'), r = c.getBoundingClientRect(), k = r.width / 820; c.dispatchEvent(new PointerEvent('pointerdown', {clientX: r.left + 700 * k, clientY: r.top + 400 * k, button: 0, bubbles: true, pointerId: 1})); })(), 0`); await sleep(200);
  const st = await pj(`document.getElementById('gw_status').textContent`);
  if (!/11 pièces/.test(st)) throw new Error('porte posée : ' + st);
  await pj(`document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'})), 0`);

  // le parcours : [niveau, pièces ajoutées, fils [de, vers, broche, sortie]] ; indices : entrées du niveau, puis ses sorties, puis les pièces
  const C = n => 'CHIP:' + n;
  const PATH = [
    ['NON', ['NAND'], [[0, 2, 0], [0, 2, 1], [2, 1, 0]]],
    ['ET', ['NAND', C('NON')], [[0, 3, 0], [1, 3, 1], [3, 4, 0], [4, 2, 0]]],
    ['OU', [C('NON'), C('NON'), 'NAND'], [[0, 3, 0], [1, 4, 0], [3, 5, 0], [4, 5, 1], [5, 2, 0]]],
    ['OU exclusif', [C('OU'), 'NAND', C('ET')], [[0, 3, 0], [1, 3, 1], [0, 4, 0], [1, 4, 1], [3, 5, 0], [4, 5, 1], [5, 2, 0]]],
    ['Demi-additionneur', [C('OU exclusif'), C('ET')], [[0, 4, 0], [1, 4, 1], [0, 5, 0], [1, 5, 1], [4, 2, 0], [5, 3, 0]]],
    ['Additionneur complet', [C('Demi-additionneur'), C('Demi-additionneur'), C('OU')], [[0, 5, 0], [1, 5, 1], [5, 6, 0, 0], [2, 6, 1], [6, 3, 0, 0], [5, 7, 0, 1], [6, 7, 1, 1], [7, 4, 0]]],
    ['Additionneur 2 bits', [C('Demi-additionneur'), C('Additionneur complet')], [[1, 7, 0], [3, 7, 1], [7, 6, 0, 0], [0, 8, 0], [2, 8, 1], [7, 8, 2, 1], [8, 5, 0, 0], [8, 4, 0, 1]]],
    ['Multiplexeur', [C('NON'), C('ET'), C('ET'), C('OU')], [[0, 4, 0], [1, 5, 0], [4, 5, 1], [2, 6, 0], [0, 6, 1], [5, 7, 0], [6, 7, 1], [7, 3, 0]]],
    ['Verrou', [C('Multiplexeur')], [[1, 3, 0], [3, 3, 1], [0, 3, 2], [3, 2, 0]]],
    ['Bascule D', [C('NON'), C('Verrou'), C('Verrou')], [[1, 3, 0], [0, 4, 0], [3, 4, 1], [4, 5, 0], [1, 5, 1], [5, 2, 0]]],
    ['Processeur', [C('Additionneur 2 bits'), C('Multiplexeur'), C('Multiplexeur'), C('Bascule D'), C('Bascule D')],
      [[9, 6, 0], [10, 6, 1], [1, 6, 2], [2, 6, 3], [0, 7, 0], [1, 7, 1], [6, 7, 2, 1], [0, 8, 0], [2, 8, 1], [6, 8, 2, 2], [7, 9, 0], [3, 9, 1], [8, 10, 0], [3, 10, 1], [9, 4, 0], [10, 5, 0]]],
  ];
  // un niveau pas encore ouvert ne se choisit pas ; un circuit faux est refusé avec une explication
  const locked = await pj(`[...document.getElementById('gw_level').options].filter(o => o.disabled).length`);
  if (locked !== 10) throw new Error('niveaux fermés : ' + locked);
  const first = await pj(`${G}.go('NON')`);
  if (JSON.stringify(first.tools) !== '["NAND"]') throw new Error('pièces du niveau 1 : ' + JSON.stringify(first.tools));
  await pj(`${G}.build(['NAND'], [[0, 2, 0], [2, 1, 0]])`); const bad = await pj(`${G}.check()`);
  if (bad.ok || !/Pour A = 1 : Y devrait être à 0 \(il est à 1\)/.test(bad.msg)) throw new Error('circuit faux : ' + JSON.stringify(bad));
  for (const [id, parts, wires] of PATH) {
    const g = await pj(`${G}.go(${JSON.stringify(id)})`); if (g.level !== id) throw new Error('niveau ' + id + ' pas ouvert');
    const miss = parts.filter(p => !g.tools.includes(p)); if (miss.length) throw new Error(id + ' : pièces absentes ' + JSON.stringify(miss));
    await pj(`${G}.build(${JSON.stringify(parts)}, ${JSON.stringify(wires)})`); await sleep(100);
    const r = await pj(`${G}.check()`); if (!r.ok) throw new Error(id + ' : ' + r.msg);
    if (id === 'Processeur') { const vis = await pj(`[document.getElementById('gw_next').offsetParent === null, document.getElementById('gw_mkchip').offsetParent === null]`); if (!vis[0] || !vis[1]) throw new Error('boutons cachés visibles : ' + JSON.stringify(vis)); if (shot) await shot('processeur'); }
  }
  const s = await pj(`${G}.state()`);
  if (s.done.length !== 11 || !s.lib.includes('Processeur') || !/11 \/ 11/.test(s.head)) throw new Error('fin du parcours : ' + JSON.stringify(s));
  // le processeur devient une puce de l'atelier libre
  const free = await pj(`${G}.go('')`); if (!free.tools.includes('CHIP:Processeur')) throw new Error('puce Processeur absente de l’atelier');
  await pj(`${G}.reset(), 0`);  // le profil de test reste propre
  return 'additionneur, table, interrupteur et porte posée ok · parcours : 10 niveaux fermés au départ, circuit faux expliqué, 11 niveaux résolus de NON au processeur, puce Processeur dans l’atelier';
};
