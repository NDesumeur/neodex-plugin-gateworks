// lancé par le test « local » de NeoDex : l'additionneur complet, sa table de vérité, un interrupteur basculé à la souris, une porte posée
module.exports = async ({ pj, sleep }) => {
  await sleep(500);
  await pj(`(() => { const s = document.querySelector('.gwBar select'); s.value = 'Additionneur complet'; s.dispatchEvent(new Event('change')); })(), 0`); await sleep(200);
  const rows = await pj(`[...document.querySelectorAll('#gw_table tr')].slice(1).map(r => [...r.cells].map(c => c.textContent).join(''))`);
  if (rows.length !== 8 || rows[7] !== '11111' || rows[3] !== '01101') throw new Error('table : ' + JSON.stringify(rows));
  // clic sur l'interrupteur A (case 1,3 de la grille) : la ligne en cours devient 100
  await pj(`(() => { const c = document.getElementById('gw_canvas'), r = c.getBoundingClientRect(), k = r.width / c.width, o = {clientX: r.left + 45 * k, clientY: r.top + 75 * k, button: 0, bubbles: true, pointerId: 1}; c.dispatchEvent(new PointerEvent('pointerdown', o)); c.dispatchEvent(new PointerEvent('pointerup', o)); })(), 0`); await sleep(200);
  const cur = await pj(`document.querySelector('#gw_table tr.cur')?.textContent`);
  if (cur !== '10010') throw new Error('après le clic sur A : ' + cur);
  await pj(`document.querySelector('[data-tool=AND]').click(), 0`);
  await pj(`(() => { const c = document.getElementById('gw_canvas'), r = c.getBoundingClientRect(), k = r.width / c.width; c.dispatchEvent(new PointerEvent('pointerdown', {clientX: r.left + 700 * k, clientY: r.top + 400 * k, button: 0, bubbles: true, pointerId: 1})); })(), 0`); await sleep(200);
  const st = await pj(`document.getElementById('gw_status').textContent`);
  if (!/11 pièces/.test(st)) throw new Error('porte posée : ' + st);
  await pj(`document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'})), 0`);
  return 'additionneur, table, interrupteur et porte posée ok';
};
