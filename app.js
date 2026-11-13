/* フィールド地図 — 地理院タイル等を表示し、範囲を指定してオフライン保存する PWA */
'use strict';

const GSI = 'https://cyberjapandata.gsi.go.jp/xyz/';
const GSI_ATTR = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>';
const GSJ_ATTR = '<a href="https://gbank.gsj.jp/seamless/" target="_blank">産総研地質調査総合センター 20万分の1日本シームレス地質図V2</a>';
const ECORIS_ATTR ='<a href="https://map.ecoris.info/" target="_blank">エコリス地図タイル</a>（環境省 自然環境保全基礎調査 植生調査）';

// id, 名前, URL, ネイティブズーム範囲, 種類
const LAYERS = [
  { id: 'std', name: '標準地図', url: GSI + 'std/{z}/{x}/{y}.png', min: 2, max: 18, base: true },
  { id: 'pale', name: '淡色地図', url: GSI + 'pale/{z}/{x}/{y}.png', min: 2, max: 18, base: true },
  { id: 'seamlessphoto', name: '写真（最新）', url: GSI + 'seamlessphoto/{z}/{x}/{y}.jpg', min: 2, max: 18, base: true },
  { id: 'hillshademap', name: '陰影起伏図', url: GSI + 'hillshademap/{z}/{x}/{y}.png', min: 2, max: 16, op: 0.5, group: '地形' },
  { id: 'relief', name: '色別標高図', url: GSI + 'relief/{z}/{x}/{y}.png', min: 5, max: 15, op: 0.5, group: '地形' },
  { id: 'lcm25k_2012', name: '土地条件図', url: GSI + 'lcm25k_2012/{z}/{x}/{y}.png', min: 10, max: 16, op: 0.7, group: '地形分類' },
  { id: 'lcmfc2', name: '治水地形分類図（更新版）', url: GSI + 'lcmfc2/{z}/{x}/{y}.png', min: 11, max: 16, op: 0.7, group: '地形分類' },
  { id: 'geology', name: '20万分の1日本シームレス地質図V2', url: 'https://gbank.gsj.jp/seamless/v2/api/1.2/tiles/{z}/{y}/{x}.png', min: 3, max: 13, op: 0.6, group: '地質', note: 'タップで凡例', attr: GSJ_ATTR },
  { id: 'ort_riku10', name: '空中写真 1936〜1942年頃', url: GSI + 'ort_riku10/{z}/{x}/{y}.png', min: 13, max: 18, op: 1, group: '過去の空中写真', note: '一部地域のみ' },
  { id: 'ort_USA10', name: '空中写真 1945〜1950年', url: GSI + 'ort_USA10/{z}/{x}/{y}.png', min: 10, max: 17, op: 1, group: '過去の空中写真' },
  { id: 'ort_old10', name: '空中写真 1961〜1969年', url: GSI + 'ort_old10/{z}/{x}/{y}.png', min: 10, max: 17, op: 1, group: '過去の空中写真' },
  { id: 'gazo1', name: '空中写真 1974〜1978年', url: GSI + 'gazo1/{z}/{x}/{y}.jpg', min: 10, max: 17, op: 1, group: '過去の空中写真' },
  { id: 'gazo2', name: '空中写真 1979〜1983年', url: GSI + 'gazo2/{z}/{x}/{y}.jpg', min: 10, max: 17, op: 1, group: '過去の空中写真' },
  { id: 'gazo3', name: '空中写真 1984〜1986年', url: GSI + 'gazo3/{z}/{x}/{y}.jpg', min: 10, max: 17, op: 1, group: '過去の空中写真' },
  { id: 'gazo4', name: '空中写真 1988〜1990年', url: GSI + 'gazo4/{z}/{x}/{y}.jpg', min: 10, max: 17, op: 1, group: '過去の空中写真' },
  { id: 'vege67', name: '植生図（第6〜7回 1/2.5万）', url: 'https://map.ecoris.info/tiles/vege67/{z}/{x}/{y}.png', min: 2, max: 15, op: 0.7, group: '植生', ecoris: true },
  { id: 'vege', name: '植生図（第2〜5回 1/5万）', url: 'https://map.ecoris.info/tiles/vege/{z}/{x}/{y}.png', min: 2, max: 15, op: 0.7, group: '植生', ecoris: true },
];
const LAYER_BY_ID = Object.fromEntries(LAYERS.map(l => [l.id, l]));

const BOUND_YEARS = ['19200101', '19301231', '19401231', '19501001', '19551001', '19601001', '19651001', '19701001', '19801001', '20001001', '20200101', '20230101'];
const geoshapeUrl = (date, pref) => `https://geoshape.ex.nii.ac.jp/city/topojson/${date}/${pref}/${pref}_city.i.topojson`;

const TILE_CACHE = 'fm-tiles-v1';
const DATA_CACHE = 'fm-data-v1';
const LOCAL_CACHE = 'fm-local-v1';
const LOCAL_PREFIX = new URL('local/', location.href).href;

const MAX_TILES = 30000;       // 1回の保存の上限
const MAX_ECORIS_TILES = 3000; // エコリスへの過度なアクセスを避ける
const $ = s => document.querySelector(s);

/* ---------------- 状態の保存 ---------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
};
const state = Object.assign({
  view: [32.4376, 131.4401, 14], base: 'std', overlays: {}, fude: false, bound: false, boundYear: '19501001', pop: true, user: true,
}, store.get('fm-state', {}));
const saveState = () => store.set('fm-state', state);

/* ---------------- 地図 ---------------- */
const map = L.map('map', { zoomControl: true, preferCanvas: true, maxZoom: 19 })
  .setView([state.view[0], state.view[1]], state.view[2]);
L.control.scale({ imperial: false }).addTo(map);
map.attributionControl.setPrefix(false);
map.on('moveend', () => { const c = map.getCenter(); state.view = [c.lat, c.lng, map.getZoom()]; saveState(); });

const tileLayers = {};
function makeTile(l) {
  return L.tileLayer(l.url, {
    minNativeZoom: l.min, maxNativeZoom: l.max, minZoom: l.base ? 0 : Math.max(l.min - 2, 0), maxZoom: 19,
    opacity: l.op ?? 1, attribution: l.attr || (l.ecoris ? ECORIS_ATTR : GSI_ATTR), crossOrigin: true,
  });
}
LAYERS.forEach(l => { tileLayers[l.id] = makeTile(l); });

// 地図の重なり順
map.createPane('overPane').style.zIndex = 250;
map.createPane('vecPane').style.zIndex = 420;

/* ---------------- レイヤUI ---------------- */
function buildLayerUI() {
  const bl = $('#baseList'); bl.innerHTML = '';
  LAYERS.filter(l => l.base).forEach(l => {
    const lab = document.createElement('label'); lab.className = 'row';
    lab.innerHTML = `<input type="radio" name="base" value="${l.id}"> <span class="name">${l.name}</span>`;
    const r = lab.querySelector('input'); r.checked = state.base === l.id;
    r.onchange = () => { setBase(l.id); };
    bl.appendChild(lab);
  });
  const ol = $('#overList'); ol.innerHTML = '';
  let group = '';
  LAYERS.filter(l => !l.base).forEach(l => {
    if (l.group !== group) { group = l.group; const h = document.createElement('div'); h.className = 'note'; h.style.marginTop = '8px'; h.textContent = group; ol.appendChild(h); }
    const o = state.overlays[l.id] || { on: false, op: l.op };
    const lab = document.createElement('div'); lab.className = 'row';
    lab.innerHTML = `<label class="name"><input type="checkbox"> ${l.name}${l.note ? ` <small>${l.note}</small>` : ''}</label>
      <input type="range" min="0" max="1" step="0.05" aria-label="不透明度">`;
    const [cb, rg] = lab.querySelectorAll('input');
    cb.checked = o.on; rg.value = o.op;
    cb.onchange = () => { setOverlay(l.id, cb.checked, +rg.value); };
    rg.oninput = () => { setOverlay(l.id, cb.checked, +rg.value); };
    ol.appendChild(lab);
  });
}
function setBase(id) {
  LAYERS.filter(l => l.base).forEach(l => map.removeLayer(tileLayers[l.id]));
  tileLayers[id].addTo(map); tileLayers[id].bringToBack();
  state.base = id; saveState();
}
function setOverlay(id, on, op) {
  const t = tileLayers[id];
  t.setOpacity(op);
  if (on) { if (!map.hasLayer(t)) t.addTo(map); } else map.removeLayer(t);
  // 背景より上、ベクタより下の順序を保つ
  LAYERS.filter(l => !l.base).forEach(l => { if (map.hasLayer(tileLayers[l.id])) tileLayers[l.id].bringToFront(); });
  state.overlays[id] = { on, op }; saveState();
}
buildLayerUI();
setBase(state.base);
LAYERS.filter(l => !l.base).forEach(l => { const o = state.overlays[l.id]; if (o?.on) setOverlay(l.id, true, o.op); });

/* ---------------- パネル ---------------- */
const panel = $('#panel');
$('#btnPanel').onclick = () => { panel.classList.toggle('open'); panel.setAttribute('aria-hidden', !panel.classList.contains('open')); };
$('#btnClose').onclick = () => { panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); };
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t.id === 'tab-' + b.dataset.tab));
  if (b.dataset.tab === 'dl') { refreshAreas(); updateEstimate(); }
  if (b.dataset.tab === 'data') { refreshExportSelect(); updateMeshLinks(); }
});

/* ---------------- 現在地 ---------------- */
let locMarker, locCircle, locating = false, firstFix = false;
$('#btnLocate').onclick = () => {
  locating = !locating;
  $('#btnLocate').classList.toggle('on', locating);
  if (locating) { firstFix = true; map.locate({ watch: true, enableHighAccuracy: true, setView: false }); }
  else { map.stopLocate(); locMarker?.remove(); locCircle?.remove(); locMarker = locCircle = null; }
};
map.on('locationfound', e => {
  if (!locMarker) {
    locCircle = L.circle(e.latlng, { radius: e.accuracy, weight: 1, color: '#1a73e8', fillOpacity: .1, interactive: false }).addTo(map);
    locMarker = L.circleMarker(e.latlng, { radius: 7, weight: 3, color: '#fff', fillColor: '#1a73e8', fillOpacity: 1 }).addTo(map);
  } else { locMarker.setLatLng(e.latlng); locCircle.setLatLng(e.latlng).setRadius(e.accuracy); }
  if (firstFix) { map.setView(e.latlng, Math.max(map.getZoom(), 15)); firstFix = false; }
});
map.on('locationerror', e => { alert('現在地を取得できません: ' + e.message); locating = false; $('#btnLocate').classList.remove('on'); });

/* ---------------- オンライン表示 ---------------- */
const netUpd = () => { $('#netState').hidden = navigator.onLine; };
addEventListener('online', netUpd); addEventListener('offline', netUpd); netUpd();

/* ---------------- 地質図: タップした地点の凡例 ---------------- */
const geoLegendMemo = store.get('fm-geolegend', {});
map.on('click', async e => {
  if (!map.hasLayer(tileLayers.geology)) return;
  const { lat, lng } = e.latlng;
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  const show = j => {
    const html = j && j.symbol
      ? `<b>地質</b> <span style="display:inline-block;width:12px;height:12px;background:rgb(${j.r},${j.g},${j.b});border:1px solid #0003;vertical-align:-2px"></span><table>
         <tr><td>岩相</td><td>${esc(j.lithology_ja)}</td></tr><tr><td>区分</td><td>${esc(j.group_ja)}</td></tr>
         <tr><td>時代</td><td>${esc(j.formationAge_ja)}</td></tr><tr><td>記号</td><td>${esc(j.symbol)}</td></tr></table>`
      : '<b>地質</b><br><span class="note">' + (j === null ? 'オフラインのため凡例を取得できません' : 'この地点のデータはありません') + '</span>';
    L.popup().setLatLng(e.latlng).setContent(html).openOn(map);
  };
  if (key in geoLegendMemo) return show(geoLegendMemo[key]);
  try {
    const r = await fetch(`https://gbank.gsj.jp/seamless/v2/api/1.2/legend.json?point=${lat.toFixed(6)},${lng.toFixed(6)}`);
    const j = r.ok ? await r.json() : {};
    geoLegendMemo[key] = j; store.set('fm-geolegend', geoLegendMemo);
    show(j);
  } catch { show(null); }
});

/* ---------------- 遺跡: 文化財総覧WebGISへのリンク ---------------- */
$('#btnHeritage').onclick = () => {
  const c = map.getCenter();
  window.open(`https://heritagemap.nabunken.go.jp/?lat=${c.lat.toFixed(6)}&lng=${c.lng.toFixed(6)}&zoom=${Math.min(map.getZoom(), 18).toFixed(1)}`, '_blank', 'noopener');
};

/* ================= タイル計算 ================= */
const lon2x = (lon, z) => Math.floor((lon + 180) / 360 * 2 ** z);
const lat2y = (lat, z) => { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); };
function tileRange(bbox, z) {
  const [w, s, e, n] = bbox;
  return { x0: lon2x(w, z), x1: lon2x(e, z), y0: lat2y(n, z), y1: lat2y(s, z) };
}
function* tileUrls(layer, bbox, zMin, zMax) {
  const z0 = Math.max(zMin, layer.min), z1 = Math.min(zMax, layer.max);
  for (let z = z0; z <= z1; z++) {
    const r = tileRange(bbox, z);
    for (let x = r.x0; x <= r.x1; x++) for (let y = r.y0; y <= r.y1; y++)
      yield { z, x, y, url: layer.url.replace('{z}', z).replace('{x}', x).replace('{y}', y) };
  }
}
function countTiles(layer, bbox, zMin, zMax) {
  let n = 0; const z0 = Math.max(zMin, layer.min), z1 = Math.min(zMax, layer.max);
  for (let z = z0; z <= z1; z++) { const r = tileRange(bbox, z); n += (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1); }
  return n;
}

/* ================= 範囲指定 ================= */
let selRect = null, selHandles = [];
function selBBox() {
  if (!selRect) return null;
  const b = selRect.getBounds();
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].map(v => +v.toFixed(6));
}
function setSelection(bbox) {
  clearSelection();
  const [w, s, e, n] = bbox;
  selRect = L.rectangle([[s, w], [n, e]], { color: '#d33', weight: 2, fillOpacity: .06, dashArray: '6 4', interactive: false }).addTo(map);
  const icon = L.divIcon({ className: 'sel-handle', iconSize: [22, 22] });
  const a = L.marker([n, w], { draggable: true, icon }).addTo(map);
  const b = L.marker([s, e], { draggable: true, icon }).addTo(map);
  const upd = () => {
    selRect.setBounds(L.latLngBounds(a.getLatLng(), b.getLatLng()));
    updateEstimate(); updateMeshLinks();
  };
  a.on('drag', upd); b.on('drag', upd); a.on('dragend', upd); b.on('dragend', upd);
  selHandles = [a, b];
  updateEstimate(); updateMeshLinks();
}
function clearSelection() { selRect?.remove(); selHandles.forEach(h => h.remove()); selRect = null; selHandles = []; }
$('#btnSelect').onclick = () => {
  const b = map.getBounds().pad(-0.2);
  setSelection([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
  if (innerWidth < 700) { panel.classList.remove('open'); }
};

// 保存対象レイヤの選択UI
function buildDlLayers() {
  const d = $('#dlLayers'); d.innerHTML = '';
  const saved = store.get('fm-dl-layers', ['pale', 'seamlessphoto', 'hillshademap', 'ort_old10', 'ort_USA10', 'vege67', 'lcm25k_2012']);
  LAYERS.forEach(l => {
    const lab = document.createElement('label'); lab.className = 'row';
    lab.innerHTML = `<input type="checkbox" value="${l.id}"> ${l.name} <small>z${l.min}–${l.max}</small>`;
    const cb = lab.querySelector('input'); cb.checked = saved.includes(l.id);
    cb.onchange = () => { store.set('fm-dl-layers', dlLayerIds()); updateEstimate(); };
    d.appendChild(lab);
  });
}
const dlLayerIds = () => [...document.querySelectorAll('#dlLayers input:checked')].map(i => i.value);
buildDlLayers();
['#zMin', '#zMax'].forEach(s => $(s).oninput = updateEstimate);

function estimate(bbox, ids, zMin, zMax) {
  let total = 0, ecoris = 0; const per = {};
  ids.forEach(id => { const l = LAYER_BY_ID[id]; const n = countTiles(l, bbox, zMin, zMax); per[id] = n; total += n; if (l.ecoris) ecoris += n; });
  return { total, ecoris, per, mb: total * 0.025 }; // 1枚 ≒ 25KB として概算
}
function updateEstimate() {
  const bbox = selBBox(); const el = $('#dlEstimate');
  if (!bbox) { el.textContent = '「範囲を指定」を押して地図上で範囲を決めてください。'; return; }
  const zMin = +$('#zMin').value, zMax = +$('#zMax').value;
  const e = estimate(bbox, dlLayerIds(), zMin, zMax);
  const km = (() => { const [w, s, ee, n] = bbox; const dy = (n - s) * 111; const dx = (ee - w) * 111 * Math.cos((n + s) / 2 * Math.PI / 180); return (dx * dy).toFixed(1); })();
  let warn = '';
  if (e.total > MAX_TILES) warn += `<br>⚠ ${MAX_TILES.toLocaleString()}枚を超えています。範囲かズームを小さくしてください。`;
  if (e.ecoris > MAX_ECORIS_TILES) warn += `<br>⚠ 植生図タイルは${MAX_ECORIS_TILES.toLocaleString()}枚までです（提供元への負荷配慮）。`;
  el.innerHTML = `範囲 約${km} km² ／ タイル ${e.total.toLocaleString()} 枚 ／ 約 ${e.mb.toFixed(0)} MB（概算）${warn}`;
}

/* ================= ダウンロード（オフライン保存） ================= */
let cancelFlag = false;
$('#btnCancel').onclick = () => { cancelFlag = true; };
async function pool(items, conc, fn) {
  let i = 0; const run = async () => { while (i < items.length && !cancelFlag) { const it = items[i++]; await fn(it); } };
  await Promise.all(Array.from({ length: conc }, run));
}
async function fetchToCache(cache, url) {
  if (await cache.match(url)) return 'hit';
  try {
    const r = await fetch(url, { mode: 'cors' });
    if (r.ok) { await cache.put(url, r); return 'ok'; }
    return r.status === 404 ? 'none' : 'err';
  } catch { return 'err'; }
}

$('#btnDownload').onclick = async () => {
  const bbox = selBBox();
  if (!bbox) { alert('先に「範囲を指定」してください。'); return; }
  if (!navigator.onLine) { alert('オフラインのため保存できません。'); return; }
  const ids = dlLayerIds(), zMin = +$('#zMin').value, zMax = +$('#zMax').value;
  if (zMin > zMax) { alert('ズームの最小が最大を超えています。'); return; }
  const est = estimate(bbox, ids, zMin, zMax);
  if (est.total > MAX_TILES || est.ecoris > MAX_ECORIS_TILES) { alert('枚数が上限を超えています。範囲かズームを小さくしてください。'); return; }
  if (est.total > 5000 && !confirm(`${est.total.toLocaleString()}枚（約${est.mb.toFixed(0)}MB）を保存します。Wi-Fi環境を推奨します。続けますか？`)) return;

  try { await navigator.storage?.persist?.(); } catch { }
  cancelFlag = false;
  $('#btnDownload').disabled = true; $('#btnCancel').hidden = false;
  const prog = $('#dlProg'); prog.hidden = false; prog.value = 0;
  const msg = $('#dlMsg');
  const cache = await caches.open(TILE_CACHE);
  const stat = { ok: 0, hit: 0, none: 0, err: 0 };
  const total = est.total; let done = 0;
  const tick = r => { stat[r]++; done++; if (done % 20 === 0 || done === total) { prog.value = done / total; msg.textContent = `タイル ${done.toLocaleString()} / ${total.toLocaleString()}（新規 ${stat.ok}・保存済 ${stat.hit}・データなし ${stat.none}・失敗 ${stat.err}）`; } };

  // 地理院は並列6、エコリスは並列2
  const gsiItems = [], ecoItems = [];
  ids.forEach(id => { const l = LAYER_BY_ID[id]; for (const t of tileUrls(l, bbox, zMin, zMax)) (l.ecoris ? ecoItems : gsiItems).push(t.url); });
  await Promise.all([
    pool(gsiItems, 6, async u => tick(await fetchToCache(cache, u))),
    pool(ecoItems, 2, async u => tick(await fetchToCache(cache, u))),
  ]);

  // 旧市町村界
  let prefs = [];
  if (!cancelFlag && $('#dlBound').checked) {
    msg.textContent = '旧市町村界を保存中…';
    prefs = await prefsInBBox(bbox);
    if (!prefs.length) msg.textContent = '都道府県を判定できず、旧市町村界は保存できませんでした（再取得で再試行できます）。';
    const dc = await caches.open(DATA_CACHE);
    const urls = prefs.flatMap(p => BOUND_YEARS.map(y => geoshapeUrl(y, p)));
    await pool(urls, 4, async u => { await fetchToCache(dc, u); });
  }

  const name = $('#areaName').value.trim() || `範囲 ${new Date().toLocaleDateString('ja-JP')}`;
  const areaId = Date.now().toString(36);
  let fudeN = 0;
  if (!cancelFlag && $('#dlFude').checked) {
    msg.textContent = '筆ポリゴンを保存中…';
    try {
      if (!prefs.length) prefs = await prefsInBBox(bbox);
      const feats = await queryFude(bbox, prefs, 200000);
      fudeN = feats.length;
      const lc = await caches.open(LOCAL_CACHE);
      await lc.put(fudeKey(areaId), new Response(JSON.stringify({ type: 'FeatureCollection', features: feats }), { headers: { 'content-type': 'application/json' } }));
    } catch (e) { console.warn(e); msg.textContent = '筆ポリゴンの保存に失敗しました'; }
  }
  if (!cancelFlag) {
    const areas = store.get('fm-areas', []);
    areas.push({ id: areaId, name, bbox, layers: ids, zMin, zMax, prefs, fude: fudeN > 0, fudeN, tiles: total, date: new Date().toISOString() });
    store.set('fm-areas', areas);
    msg.textContent = `保存しました：${name}（タイル ${total.toLocaleString()} 枚、失敗 ${stat.err}${fudeN ? `、筆ポリゴン ${fudeN.toLocaleString()} 筆` : ''}）` + (stat.err ? ' — 失敗分はもう一度保存すると再取得します。' : '');
  } else msg.textContent = '中止しました（取得済みのタイルは残っています）。';
  $('#btnDownload').disabled = false; $('#btnCancel').hidden = true; prog.hidden = true;
  refreshAreas();
};

async function refreshAreas() {
  const list = $('#areaList'); const areas = store.get('fm-areas', []);
  list.innerHTML = areas.length ? '' : '<p class="note">まだありません。</p>';
  areas.forEach(a => {
    const d = document.createElement('div'); d.className = 'area';
    d.innerHTML = `<b></b><span class="note">${new Date(a.date).toLocaleDateString('ja-JP')}・z${a.zMin}–${a.zMax}・${a.tiles.toLocaleString()}枚${a.fude ? `・筆${(a.fudeN || 0).toLocaleString()}` : ''}・${a.layers.map(id => LAYER_BY_ID[id]?.name).join('、')}</span><br>
      <button class="btn" data-a="go">表示</button><button class="btn" data-a="again">再取得</button><button class="btn" data-a="del">削除</button>`;
    d.querySelector('b').textContent = a.name;
    d.querySelector('[data-a=go]').onclick = () => { const [w, s, e, n] = a.bbox; map.fitBounds([[s, w], [n, e]]); setSelection(a.bbox); if (innerWidth < 700) panel.classList.remove('open'); };
    d.querySelector('[data-a=again]').onclick = () => {
      setSelection(a.bbox); $('#zMin').value = a.zMin; $('#zMax').value = a.zMax; $('#areaName').value = a.name;
      document.querySelectorAll('#dlLayers input').forEach(i => i.checked = a.layers.includes(i.value));
      deleteAreaRecord(a.id); updateEstimate(); $('#btnDownload').click();
    };
    d.querySelector('[data-a=del]').onclick = async () => {
      if (!confirm(`「${a.name}」のタイルを端末から削除します。他の保存範囲と重なるタイルも消えます。よろしいですか？`)) return;
      const cache = await caches.open(TILE_CACHE);
      for (const id of a.layers) { const l = LAYER_BY_ID[id]; if (!l) continue; for (const t of tileUrls(l, a.bbox, a.zMin, a.zMax)) await cache.delete(t.url); }
      await (await caches.open(LOCAL_CACHE)).delete(fudeKey(a.id));
      deleteAreaRecord(a.id); refreshAreas();
    };
    list.appendChild(d);
  });
  try {
    const e = await navigator.storage.estimate();
    const persisted = await navigator.storage.persisted?.();
    $('#storageInfo').textContent = `使用量 約${(e.usage / 1e6).toFixed(0)}MB／利用可能 約${(e.quota / 1e9).toFixed(1)}GB` + (persisted ? '（永続化済）' : '');
  } catch { }
}
function deleteAreaRecord(id) { store.set('fm-areas', store.get('fm-areas', []).filter(a => a.id !== id)); }

/* ================= 都道府県の判定（旧市町村界の取得用） ================= */
// 都道府県界（簡略版, 約1.4MB・一度取得したら端末に保持）で判定する
const PREF_URL = 'https://geoshape.ex.nii.ac.jp/city/topojson/20230101/jp_pref.c.topojson';
let prefIndex = null;
async function loadPrefIndex() {
  if (prefIndex) return prefIndex;
  const topo = await getJSON(PREF_URL);
  const gj = topojson.feature(topo, topo.objects.pref);
  prefIndex = [];
  gj.features.forEach(f => {
    const code = f.properties.N03_007;
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    polys.forEach(rings => prefIndex.push({ code, rings, bbox: featBBox({ geometry: { coordinates: rings } }) }));
  });
  return prefIndex;
}
function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
async function prefsInBBox(bbox, grid = 6) {
  let idx; try { idx = await loadPrefIndex(); } catch { return []; }
  const [w, s, e, n] = bbox; const set = new Set();
  const cand = idx.filter(p => inBBox(p.bbox, bbox));
  for (let i = 0; i <= grid; i++) for (let j = 0; j <= grid; j++) {
    const y = s + (n - s) * i / grid, x = w + (e - w) * j / grid;
    for (const p of cand) if (!set.has(p.code) && inRing(x, y, p.rings[0]) && !p.rings.slice(1).some(h => inRing(x, y, h))) set.add(p.code);
  }
  // 範囲が海上などで点が当たらない場合は、範囲と重なる県を採用
  if (!set.size) cand.forEach(p => set.add(p.code));
  return [...set];
}
// オフライン時は保存済範囲から推定
function prefsFromAreas(bbox) {
  const [w, s, e, n] = bbox; const set = new Set();
  store.get('fm-areas', []).forEach(a => { const [aw, as, ae, an] = a.bbox; if (aw < e && ae > w && as < n && an > s) (a.prefs || []).forEach(p => set.add(p)); });
  return [...set];
}

/* ================= 旧市町村界 ================= */
const boundLayer = L.geoJSON(null, {
  pane: 'vecPane',
  style: { color: '#7a2d8f', weight: 2, fill: false },
  onEachFeature: (f, ly) => {
    const p = f.properties;
    const name = [p.N03_001, p.N03_002, p.N03_003, p.N03_004].filter(Boolean).join(' ');
    ly.bindPopup(`<b>${esc(name)}</b><br><span class="note">${esc(f.__year || '')}</span>`);
    ly.bindTooltip(esc(p.N03_004 || p.N03_003 || ''), { permanent: false, sticky: true });
  },
});
const loadedBound = new Set();
$('#selBoundYear').innerHTML = BOUND_YEARS.map(y => `<option value="${y}">${y.slice(0, 4)}年</option>`).join('');
$('#selBoundYear').value = state.boundYear;
$('#chkBound').checked = state.bound;
$('#chkBound').onchange = () => { state.bound = $('#chkBound').checked; saveState(); refreshBound(true); };
$('#selBoundYear').onchange = () => { state.boundYear = $('#selBoundYear').value; saveState(); refreshBound(true); };

let boundTimer;
async function refreshBound(reset) {
  if (reset) { boundLayer.clearLayers(); loadedBound.clear(); }
  if (!state.bound) { map.removeLayer(boundLayer); return; }
  boundLayer.addTo(map);
  if (map.getZoom() < 9) return;
  const b = map.getBounds(); const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
  let prefs = await prefsInBBox(bbox, 4);
  if (!prefs.length) prefs = prefsFromAreas(bbox);
  for (const p of prefs) {
    const key = state.boundYear + '/' + p; if (loadedBound.has(key)) continue;
    loadedBound.add(key);
    try {
      const topo = await getJSON(geoshapeUrl(state.boundYear, p));
      const gj = topojson.feature(topo, topo.objects[Object.keys(topo.objects)[0]]);
      gj.features.forEach(f => f.__year = state.boundYear.slice(0, 4) + '年');
      boundLayer.addData(gj);
    } catch (e) { loadedBound.delete(key); console.warn('境界取得失敗', p, e); }
  }
}
map.on('moveend', () => { clearTimeout(boundTimer); boundTimer = setTimeout(() => refreshBound(false), 400); });
async function getJSON(url) {
  // キャッシュ優先（Service Worker が無い環境でも動くように）
  const c = await caches.open(DATA_CACHE);
  let r = await c.match(url);
  if (!r) { r = await fetch(url); if (!r.ok) throw new Error(r.status); await c.put(url, r.clone()); }
  return r.json();
}

/* ================= 農地の筆ポリゴン（農林水産省 2022年度公開 / 農研機構 FlatGeobuf） ================= */
const fudeUrl = pref => `https://habs.rad.naro.go.jp/spatial_data/fudepoly47/fude_2022_${pref}.fgb`;
const FUDE_MINZOOM = 15, FUDE_MAX = 30000;
const LAND_TYPE = { 100: '田', 200: '畑' };
const fudeLayer = L.geoJSON(null, {
  pane: 'vecPane', bubblingMouseEvents: false,
  style: f => f.properties.land_type === 100
    ? { color: '#1565c0', weight: 1.2, fillColor: '#64b5f6', fillOpacity: .25, bubblingMouseEvents: false }
    : { color: '#8d6e00', weight: 1.2, fillColor: '#ffd54f', fillOpacity: .25, bubblingMouseEvents: false },
  onEachFeature: (f, ly) => {
    const p = f.properties;
    ly.bindPopup(() => `<b>筆ポリゴン（${LAND_TYPE[p.land_type] || p.land_type}）</b><table>
      <tr><td>面積</td><td>${fudeArea(f).toLocaleString()} m²（概算）</td></tr>
      <tr><td>市町村コード</td><td>${esc(p.local_government_cd)}</td></tr>
      <tr><td>更新年度</td><td>${esc(p.edit_year)}</td></tr>
      <tr><td>ID</td><td style="font-size:11px">${esc(p.polygon_uuid)}</td></tr></table>`);
  },
});
function fudeArea(f) { // 球面近似の面積
  const R = 6378137, ring = f.geometry.coordinates[0]; let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[i + 1];
    a += (x2 - x1) * Math.PI / 180 * (2 + Math.sin(y1 * Math.PI / 180) + Math.sin(y2 * Math.PI / 180));
  }
  return Math.round(Math.abs(a * R * R / 2));
}
const slimFude = f => {
  const r = v => Math.round(v * 1e7) / 1e7;
  const geom = f.geometry.type === 'Polygon' ? { type: 'Polygon', coordinates: f.geometry.coordinates.map(ring => ring.map(([x, y]) => [r(x), r(y)])) } : f.geometry;
  const { history, last_polygon_uuid, point_lat, point_lng, ...props } = f.properties;
  return { type: 'Feature', properties: props, geometry: geom };
};
async function queryFude(bbox, prefs, limit = FUDE_MAX) {
  const [w, s, e, n] = bbox; const out = [];
  for (const p of prefs) {
    for await (const f of flatgeobuf.deserialize(fudeUrl(p), { minX: w, minY: s, maxX: e, maxY: n })) {
      out.push(slimFude(f)); if (out.length >= limit) return out;
    }
  }
  return out;
}
const fudeKey = id => LOCAL_PREFIX + 'fude/' + id + '.json';
async function savedFudeFor(bbox) {
  const lc = await caches.open(LOCAL_CACHE); const feats = []; let covers = false;
  for (const a of store.get('fm-areas', [])) {
    if (!a.fude || !inBBox(a.bbox, bbox)) continue;
    const r = await lc.match(fudeKey(a.id)); if (!r) continue;
    const [aw, as, ae, an] = a.bbox, [w, s, e, n] = bbox;
    if (aw <= w && as <= s && ae >= e && an >= n) covers = true;
    feats.push(...(await r.json()).features);
  }
  return { feats, covers };
}
const fudeLoaded = new Set(); let fudeBusy = false, fudeTimer;
$('#chkFude').checked = state.fude;
$('#chkFude').onchange = () => { state.fude = $('#chkFude').checked; saveState(); refreshFude(); };
function addFude(feats) {
  const add = feats.filter(f => !fudeLoaded.has(f.properties.polygon_uuid));
  add.forEach(f => fudeLoaded.add(f.properties.polygon_uuid));
  if (add.length) fudeLayer.addData({ type: 'FeatureCollection', features: add });
}
async function refreshFude() {
  const info = $('#fudeInfo');
  if (!state.fude) { map.removeLayer(fudeLayer); info.textContent = ''; return; }
  fudeLayer.addTo(map);
  if (map.getZoom() < FUDE_MINZOOM) { info.textContent = `ズーム${FUDE_MINZOOM}以上で表示します`; return; }
  if (fudeBusy) return; fudeBusy = true;
  try {
    if (fudeLayer.getLayers().length > 60000) { fudeLayer.clearLayers(); fudeLoaded.clear(); }
    const b = map.getBounds().pad(0.2); const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()];
    const saved = await savedFudeFor(bbox);
    addFude(saved.feats);
    if (!saved.covers && navigator.onLine) {
      info.textContent = '筆ポリゴン読込中…';
      const prefs = await prefsInBBox(bbox, 2);
      addFude(await queryFude(bbox, prefs));
    }
    info.textContent = `表示中 ${fudeLayer.getLayers().length.toLocaleString()} 筆` + (saved.covers ? '（端末保存分）' : '');
  } catch (e) { info.textContent = '筆ポリゴンを読込めませんでした'; console.warn(e); }
  finally { fudeBusy = false; }
}
map.on('moveend', () => { clearTimeout(fudeTimer); fudeTimer = setTimeout(refreshFude, 400); });

/* ================= 地域メッシュ ================= */
// メッシュコード → [w,s,e,n]（1次4桁, 2次6桁, 3次8桁, 1/2 9桁, 1/4 10桁）
function meshBBox(code) {
  code = String(code);
  let lat = +code.slice(0, 2) / 1.5, lon = +code.slice(2, 4) + 100, dLat = 2 / 3, dLon = 1;
  if (code.length >= 6) { dLat /= 8; dLon /= 8; lat += +code[4] * dLat; lon += +code[5] * dLon; }
  if (code.length >= 8) { dLat /= 10; dLon /= 10; lat += +code[6] * dLat; lon += +code[7] * dLon; }
  for (let i = 8; i < code.length; i++) { const q = +code[i]; dLat /= 2; dLon /= 2; if (q >= 3) lat += dLat; if (q === 2 || q === 4) lon += dLon; }
  return [lon, lat, lon + dLon, lat + dLat];
}
function mesh1InBBox(bbox) {
  const [w, s, e, n] = bbox; const out = [];
  for (let a = Math.floor(s * 1.5); a <= Math.floor(n * 1.5 - 1e-9); a++)
    for (let b = Math.floor(w) - 100; b <= Math.floor(e - 1e-9) - 100; b++) out.push(`${a}${String(b).padStart(2, '0')}`);
  return out;
}
function updateMeshLinks() {
  const el = $('#meshLinks'); const bbox = selBBox();
  if (!bbox) { el.innerHTML = '<p class="note">（「範囲保存」タブで範囲を指定するとリンクが出ます）</p>'; return; }
  const codes = mesh1InBBox(bbox);
  el.innerHTML = '<span class="note">対象1次メッシュ: </span>' + codes.map(c =>
    `<a class="meshlink" target="_blank" rel="noopener" href="https://www.e-stat.go.jp/gis/statmap-search/data?statsId=T001141&code=${c}&downloadType=2">${c} ↓</a>`).join('');
}

/* ================= 人口メッシュ ================= */
const POP_BREAKS = [1, 10, 50, 100, 250, 500, 1000, 2000];
const POP_COLORS = ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#b10026'];
const popColor = v => { let i = -1; POP_BREAKS.forEach((b, k) => { if (v >= b) i = k; }); return i < 0 ? null : POP_COLORS[i]; };
$('#popLegend').innerHTML = POP_BREAKS.map((b, i) => `<span><i style="background:${POP_COLORS[i]}"></i>${b}${POP_BREAKS[i + 1] ? '–' + (POP_BREAKS[i + 1] - 1) : '+'}</span>`).join('') + '<span>人/メッシュ</span>';

const popLayer = L.layerGroup();
let popData = []; // [{code, pop, male, female, hh, src}]
function renderPop() {
  popLayer.clearLayers();
  const renderer = L.canvas({ pane: 'vecPane' });
  popData.forEach(d => {
    const col = popColor(d.pop); if (!col) return;
    const [w, s, e, n] = meshBBox(d.code);
    L.rectangle([[s, w], [n, e]], { renderer, pane: 'vecPane', bubblingMouseEvents: false, weight: .3, color: '#555', fillColor: col, fillOpacity: .55 })
      .bindPopup(() => `<b>メッシュ ${d.code}</b><table><tr><td>人口</td><td>${d.pop ?? '秘匿'}</td></tr><tr><td>男</td><td>${d.male ?? '-'}</td></tr><tr><td>女</td><td>${d.female ?? '-'}</td></tr>${d.hh != null ? `<tr><td>世帯数</td><td>${d.hh}</td></tr>` : ''}</table><span class="note">${esc(d.src)}</span>`)
      .addTo(popLayer);
  });
  $('#popInfo').textContent = popData.length ? `読込済 ${popData.length.toLocaleString()} メッシュ` : '';
}
$('#chkPop').checked = state.pop;
$('#chkPop').onchange = () => { state.pop = $('#chkPop').checked; saveState(); state.pop ? popLayer.addTo(map) : map.removeLayer(popLayer); };

function parseStatText(text, src) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const head = lines[0].split(','), labels = (lines[1] || '').split(',').map(s => s.replace(/[\s　]/g, ''));
  const iKey = head.indexOf('KEY_CODE');
  if (iKey < 0) throw new Error('KEY_CODE列がありません');
  const find = re => labels.findIndex(l => re.test(l));
  const iPop = find(/^人口（?総数）?$/) >= 0 ? find(/^人口（?総数）?$/) : 4;
  const iM = find(/^人口（総数）男$/), iF = find(/^人口（総数）女$/), iH = find(/世帯総数/);
  const num = v => (v === undefined || v === '' || v === '*' || v === '-') ? null : +v;
  const out = [];
  for (let k = 2; k < lines.length; k++) {
    const c = lines[k].split(','); if (!/^\d{8,10}$/.test(c[iKey])) continue;
    out.push({ code: c[iKey], pop: num(c[iPop]), male: iM >= 0 ? num(c[iM]) : null, female: iF >= 0 ? num(c[iF]) : null, hh: iH >= 0 ? num(c[iH]) : null, src });
  }
  return out;
}
async function readStatFile(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const texts = [];
  if (file.name.toLowerCase().endsWith('.zip')) {
    const files = fflate.unzipSync(buf);
    for (const [n, b] of Object.entries(files)) if (/\.(txt|csv)$/i.test(n)) texts.push([n, b]);
  } else texts.push([file.name, buf]);
  let rows = [];
  for (const [n, b] of texts) {
    let t = new TextDecoder('shift_jis').decode(b);
    if (!t.includes('KEY_CODE')) t = new TextDecoder('utf-8').decode(b);
    rows = rows.concat(parseStatText(t, n));
  }
  return rows;
}
$('#fileStat').onchange = async ev => {
  const lc = await caches.open(LOCAL_CACHE);
  for (const f of ev.target.files) {
    try {
      const rows = await readStatFile(f);
      await lc.put(LOCAL_PREFIX + 'pop/' + encodeURIComponent(f.name) + '.json', new Response(JSON.stringify(rows), { headers: { 'content-type': 'application/json' } }));
    } catch (e) { alert(`${f.name} を読めませんでした: ${e.message}`); }
  }
  ev.target.value = '';
  await loadLocal();
  if (!state.pop) $('#chkPop').click();
};

/* ================= 任意のGeoJSON（遺跡など） ================= */
const userLayer = L.geoJSON(null, {
  pane: 'vecPane',
  style: { color: '#c0392b', weight: 2, fillOpacity: .2, bubblingMouseEvents: false },
  pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 6, bubblingMouseEvents: false, color: '#fff', weight: 2, fillColor: '#c0392b', fillOpacity: .9, pane: 'vecPane' }),
  onEachFeature: (f, ly) => {
    const rows = Object.entries(f.properties || {}).filter(([k]) => k !== '__src').slice(0, 30)
      .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');
    ly.bindPopup(`<table>${rows}</table><span class="note">${esc(f.properties?.__src || '')}</span>`, { maxHeight: 300 });
  },
});
let userData = [];
$('#chkUser').checked = state.user;
$('#chkUser').onchange = () => { state.user = $('#chkUser').checked; saveState(); state.user ? userLayer.addTo(map) : map.removeLayer(userLayer); };
$('#fileGeo').onchange = async ev => {
  const lc = await caches.open(LOCAL_CACHE);
  for (const f of ev.target.files) {
    try {
      const gj = JSON.parse(await f.text());
      if (!gj.type) throw new Error('GeoJSONではありません');
      await lc.put(LOCAL_PREFIX + 'geo/' + encodeURIComponent(f.name), new Response(JSON.stringify(gj), { headers: { 'content-type': 'application/json' } }));
    } catch (e) { alert(`${f.name} を読めませんでした: ${e.message}`); }
  }
  ev.target.value = '';
  await loadLocal();
  if (!state.user) $('#chkUser').click();
};

async function loadLocal() {
  const lc = await caches.open(LOCAL_CACHE);
  const keys = await lc.keys();
  popData = []; userData = []; userLayer.clearLayers();
  const info = [];
  for (const k of keys) {
    const rel = k.url.slice(LOCAL_PREFIX.length);
    const j = await (await lc.match(k)).json();
    if (rel.startsWith('pop/')) popData = popData.concat(j);
    if (rel.startsWith('geo/')) {
      const name = decodeURIComponent(rel.slice(4));
      (j.features || [j]).forEach(f => { f.properties = Object.assign({}, f.properties, { __src: name }); });
      userData.push({ name, gj: j, key: k.url }); userLayer.addData(j); info.push(name);
    }
  }
  renderPop();
  if (state.pop) popLayer.addTo(map);
  if (state.user) userLayer.addTo(map);
  const ui = $('#userInfo'); ui.innerHTML = '';
  userData.forEach(u => {
    const d = document.createElement('div'); d.className = 'row';
    d.innerHTML = `<span class="name"></span><button class="btn">削除</button>`;
    d.querySelector('.name').textContent = u.name;
    d.querySelector('button').onclick = async () => { await lc.delete(u.key); loadLocal(); };
    ui.appendChild(d);
  });
  if (popData.length) {
    const d = document.createElement('button'); d.className = 'btn'; d.textContent = '人口データを全て削除';
    d.onclick = async () => { for (const k of keys) if (k.url.startsWith(LOCAL_PREFIX + 'pop/')) await lc.delete(k); loadLocal(); };
    $('#popInfo').appendChild(document.createElement('br')); $('#popInfo').appendChild(d);
  }
}

/* ================= ZIP 書き出し ================= */
function refreshExportSelect() {
  const s = $('#selExportArea'); const areas = store.get('fm-areas', []);
  s.innerHTML = areas.length ? areas.map(a => `<option value="${a.id}">${esc(a.name)}</option>`).join('') : '<option value="">（保存済み範囲なし）</option>';
}
const inBBox = ([w, s, e, n], [w2, s2, e2, n2]) => w < e2 && e > w2 && s < n2 && n > s2;
function featBBox(f) {
  let w = 180, s = 90, e = -180, n = -90;
  const walk = c => { if (typeof c[0] === 'number') { w = Math.min(w, c[0]); e = Math.max(e, c[0]); s = Math.min(s, c[1]); n = Math.max(n, c[1]); } else c.forEach(walk); };
  if (f.geometry) walk(f.geometry.coordinates || []);
  return [w, s, e, n];
}
$('#btnExport').onclick = async () => {
  const a = store.get('fm-areas', []).find(x => x.id === $('#selExportArea').value);
  if (!a) return;
  const msg = $('#expMsg'); msg.textContent = '準備中…';
  const exportable = a.layers.filter(id => !LAYER_BY_ID[id]?.ecoris);
  const n = exportable.reduce((s, id) => s + countTiles(LAYER_BY_ID[id], a.bbox, a.zMin, a.zMax), 0);
  if (n > 8000 && !confirm(`タイル${n.toLocaleString()}枚をZIPにします。スマホではメモリ不足になる場合があります。続けますか？`)) { msg.textContent = ''; return; }
  const files = {}; const enc = new TextEncoder();
  const cache = await caches.open(TILE_CACHE);
  let got = 0, miss = 0;
  for (const id of exportable) {
    const l = LAYER_BY_ID[id]; const ext = l.url.split('.').pop();
    for (const t of tileUrls(l, a.bbox, a.zMin, a.zMax)) {
      const r = await cache.match(t.url);
      if (r) { files[`tiles/${id}/${t.z}/${t.x}/${t.y}.${ext}`] = [new Uint8Array(await r.arrayBuffer()), { level: 0 }]; got++; } else miss++;
      if ((got + miss) % 200 === 0) msg.textContent = `タイル読出し ${got + miss} / ${n}`;
    }
  }
  // 範囲
  const [w, s, e, nn] = a.bbox;
  const fc = feats => JSON.stringify({ type: 'FeatureCollection', features: feats });
  files['area.geojson'] = enc.encode(fc([{ type: 'Feature', properties: { name: a.name }, geometry: { type: 'Polygon', coordinates: [[[w, s], [e, s], [e, nn], [w, nn], [w, s]]] } }]));
  // 旧市町村界
  const dc = await caches.open(DATA_CACHE);
  for (const y of BOUND_YEARS) {
    const feats = [];
    for (const p of a.prefs || []) {
      const r = await dc.match(geoshapeUrl(y, p)); if (!r) continue;
      const topo = await r.json(); const gj = topojson.feature(topo, topo.objects[Object.keys(topo.objects)[0]]);
      gj.features.forEach(f => { if (inBBox(featBBox(f), a.bbox)) feats.push(f); });
    }
    if (feats.length) files[`boundaries/city_${y}.geojson`] = enc.encode(fc(feats));
  }
  // 人口メッシュ
  const pf = popData.filter(d => inBBox(meshBBox(d.code), a.bbox)).map(d => {
    const [mw, ms, me, mn] = meshBBox(d.code);
    return { type: 'Feature', properties: { KEY_CODE: d.code, pop: d.pop, male: d.male, female: d.female, households: d.hh }, geometry: { type: 'Polygon', coordinates: [[[mw, ms], [me, ms], [me, mn], [mw, mn], [mw, ms]]] } };
  });
  if (pf.length) files['population_mesh.geojson'] = enc.encode(fc(pf));
  if (a.fude) { const r = await (await caches.open(LOCAL_CACHE)).match(fudeKey(a.id)); if (r) files['fude_polygon_2022.geojson'] = new Uint8Array(await r.arrayBuffer()); }
  userData.forEach(u => {
    const feats = (u.gj.features || []).filter(f => inBBox(featBBox(f), a.bbox));
    if (feats.length) files['user/' + u.name.replace(/[\\/:*?"<>|]/g, '_')] = enc.encode(fc(feats));
  });
  files['README.txt'] = enc.encode([
    `範囲: ${a.name}`, `bbox (W,S,E,N): ${a.bbox.join(', ')}`, `ズーム: ${a.zMin}–${a.zMax}`, '',
    'tiles/<レイヤID>/{z}/{x}/{y} … XYZタイル（QGISでは file:///…/tiles/<ID>/{z}/{x}/{y}.png をXYZ接続に指定）',
    ...exportable.map(id => `  ${id}: ${LAYER_BY_ID[id].name}`), '',
    '出典:', '  地理院タイル（国土地理院）',
    '  旧市町村界: 歴史的行政区域データセットβ版（CODH）／国土数値情報（行政区域データ）をもとにNIIが加工',
    '  人口: 総務省統計局 国勢調査 地域メッシュ統計（e-Stat）',
    '  筆ポリゴン: 農林水産省「筆ポリゴンデータ（2022年度公開）」（農研機構 FlatGeobuf版より取得, land_type 100=田 200=畑）',
    a.layers.some(id => LAYER_BY_ID[id]?.ecoris) ? '  ※エコリス植生図タイルは利用条件により含めていません。' : '',
  ].join('\n'));
  msg.textContent = 'ZIP作成中…';
  await new Promise(r => setTimeout(r, 30));
  const zip = fflate.zipSync(files, { level: 6 });
  const blob = new Blob([zip], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `${a.name.replace(/[\\/:*?"<>|\s]/g, '_')}.zip`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  msg.textContent = `書き出しました（タイル ${got.toLocaleString()} 枚、未保存 ${miss}、${(blob.size / 1e6).toFixed(1)} MB）`;
};

/* ================= 共通 ================= */
function esc(v) { return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

loadLocal();
refreshBound(true);
refreshFude();
updateEstimate(); updateMeshLinks();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW登録失敗', e));
