/* フィールド地図 — 地理院タイル等を表示し、範囲を指定してオフライン保存する PWA */
'use strict';

const GSI = 'https://cyberjapandata.gsi.go.jp/xyz/';
const GSI_ATTR = '<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">地理院タイル</a>';
const GSJ_ATTR = '<a href="https://gbank.gsj.jp/seamless/" target="_blank">産総研地質調査総合センター 20万分の1日本シームレス地質図V2</a>';
const VEG_ATTR = '<a href="https://www.geospatial.jp/ckan/dataset/biodic_veg2024tile" target="_blank">現存植生図2024（環境省生物多様性センター）</a>';

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
  { id: 'dem_png', name: '標高データ（集水域計算用）', url: GSI + 'dem_png/{z}/{x}/{y}.png', min: 8, max: 14, dataOnly: true },
  { id: 'ort_riku10', name: '空中写真 1936〜1942年頃', url: GSI + 'ort_riku10/{z}/{x}/{y}.png', min: 13, max: 18, op: 1, group: '過去の空中写真', note: '一部地域のみ' },
  { id: 'ort_USA10', name: '空中写真 1945〜1950年', url: GSI + 'ort_USA10/{z}/{x}/{y}.png', min: 10, max: 17, op: 1, group: '過去の空中写真' },
  { id: 'ort_old10', name: '空中写真 1961〜1969年', url: GSI + 'ort_old10/{z}/{x}/{y}.png', min: 10, max: 17, op: 1, group: '過去の空中写真' },
  { id: 'gazo1', name: '空中写真 1974〜1978年', url: GSI + 'gazo1/{z}/{x}/{y}.jpg', min: 10, max: 17, op: 1, group: '過去の空中写真' },
  { id: 'gazo2', name: '空中写真 1979〜1983年', url: GSI + 'gazo2/{z}/{x}/{y}.jpg', min: 10, max: 17, op: 1, group: '過去の空中写真' },
  { id: 'gazo3', name: '空中写真 1984〜1986年', url: GSI + 'gazo3/{z}/{x}/{y}.jpg', min: 10, max: 17, op: 1, group: '過去の空中写真' },
  { id: 'gazo4', name: '空中写真 1988〜1990年', url: GSI + 'gazo4/{z}/{x}/{y}.jpg', min: 10, max: 17, op: 1, group: '過去の空中写真' },
  // 配信元がCORSを許可していないため opaque（画像表示・端末保存は可、ZIP書き出しは不可）
  { id: 'veg2024', name: '現存植生図2024（1/2.5万）', url: 'https://www.biodic.go.jp/kiso/vg/tile/veg2024raster/{z}/{x}/{y}.png', min: 5, max: 15, op: 0.6, group: '植生', opaque: true, attr: VEG_ATTR },
];
const VEG_LEGEND = [['高山帯自然植生域', '#fff4b3'], ['コケモモ－トウヒクラス域自然植生', '#8b7c24'], ['コケモモ－トウヒクラス域代償植生', '#888b24'], ['ブナクラス域自然植生', '#178017'], ['ブナクラス域代償植生', '#5b8e0f'], ['ヤブツバキクラス域自然植生', '#206020'], ['ヤブツバキクラス域代償植生', '#229456'], ['河辺・湿原・塩沼地・砂丘植生', '#e7cb6a'], ['植林地', '#697720'], ['スギ・ヒノキ・サワラ植林', '#2e5961'], ['竹林', '#bfd968'], ['牧草地・ゴルフ場・芝地', '#e7f066'], ['耕作地', '#988e58'], ['水田雑草群落', '#b3f6ff'], ['市街地等', '#B0B0B0'], ['開放水域', '#bed2ff']];
const LAYER_BY_ID = Object.fromEntries(LAYERS.map(l => [l.id, l]));

const BOUND_YEARS = ['19200101', '19301231', '19401231', '19501001', '19551001', '19601001', '19651001', '19701001', '19801001', '20001001', '20200101', '20230101'];
const geoshapeUrl = (date, pref) => `https://geoshape.ex.nii.ac.jp/city/topojson/${date}/${pref}/${pref}_city.i.topojson`;

const TILE_CACHE = 'fm-tiles-v1';
const DATA_CACHE = 'fm-data-v1';
const LOCAL_CACHE = 'fm-local-v1';
const LOCAL_PREFIX = new URL('local/', location.href).href;

const MAX_TILES = 30000;       // 1回の保存の上限
const MAX_OPAQUE_TILES = 1500; // CORS非対応タイルはブラウザの容量計算で大きく数えられるため上限を低めに
const $ = s => document.querySelector(s);

/* ---------------- 状態の保存 ---------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } },
};
const DEFAULT_OVERLAYS = { hillshademap: { on: true, op: 0.5 }, relief: { on: true, op: 0.4 } };
const state = Object.assign({
  view: [32.4376, 131.4401, 14], base: 'std', overlays: DEFAULT_OVERLAYS, fude: false, bound: false, boundYear: '19501001', pop: true, user: true,
}, store.get('fm-state2', {}));

/* URLハッシュ: #map=z/lat/lng&b=背景&o=レイヤ:不透明度,...&v=pop,fude,bound:年次
   これを開けば同じ場所・同じレイヤで地図を共有できる */
function hashFromState() {
  const [lat, lng, z] = state.view;
  const o = Object.entries(state.overlays).filter(([, v]) => v.on).map(([k, v]) => `${k}:${(+v.op).toFixed(2).replace(/0+$/, '').replace(/\.$/, '')}`).join(',');
  const v = [state.pop && 'pop', state.fude && 'fude', state.bound && 'bound:' + state.boundYear.slice(0, 4)].filter(Boolean).join(',');
  return `#map=${z}/${(+lat).toFixed(5)}/${(+lng).toFixed(5)}&b=${state.base}` + (o ? `&o=${o}` : '') + (v ? `&v=${v}` : '');
}
function applyHash(h) {
  const q = new URLSearchParams(h.replace(/^#/, ''));
  const m = (q.get('map') || '').split('/').map(Number);
  if (m.length !== 3 || m.some(isNaN)) return false;
  state.view = [m[1], m[2], m[0]];
  if (q.has('b')) state.base = q.get('b');
  if (q.has('o') || q.has('b')) {
    state.overlays = {};
    (q.get('o') || '').split(',').filter(Boolean).forEach(t => { const [k, op] = t.split(':'); state.overlays[k] = { on: true, op: op ? +op : 0.6 }; });
  }
  if (q.has('v') || q.has('b')) {
    const v = (q.get('v') || '').split(',');
    state.pop = v.includes('pop'); state.fude = v.includes('fude');
    const b = v.find(t => t.startsWith('bound')); state.bound = !!b;
    if (b && b.includes(':')) { const y = b.split(':')[1]; state.boundYear = (typeof BOUND_YEARS !== 'undefined' && BOUND_YEARS.find(d => d.startsWith(y))) || state.boundYear; }
  }
  return true;
}
applyHash(location.hash);
let hashTimer;
const saveState = () => {
  store.set('fm-state2', state);
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => { const h = hashFromState(); if (location.hash !== h) history.replaceState(null, '', h); }, 300);
};
addEventListener('hashchange', () => { if (location.hash !== hashFromState() && applyHash(location.hash)) location.reload(); });

/* ---------------- 地図 ---------------- */
const map = L.map('map', { zoomControl: true, preferCanvas: true, maxZoom: 19 })
  .setView([state.view[0], state.view[1]], state.view[2]);
L.control.scale({ imperial: false }).addTo(map);
map.attributionControl.setPrefix(false);
map.on('moveend', () => { const c = map.getCenter(); state.view = [c.lat, c.lng, map.getZoom()]; saveState(); });

// 重なり順: 背景(tilePane 200) → 主題図(250) → 地形(270, 乗算で重ねて下の色を残す) → ベクタ(420)
map.createPane('themePane').style.zIndex = 250;
const terrPane = map.createPane('terrPane'); terrPane.style.zIndex = 270; terrPane.style.mixBlendMode = 'multiply';
const tileLayers = {};
function makeTile(l) {
  return L.tileLayer(l.url, {
    pane: l.base ? 'tilePane' : l.group === '地形' ? 'terrPane' : 'themePane',
    minNativeZoom: l.min, maxNativeZoom: l.max, minZoom: l.base ? 0 : Math.max(l.min - 2, 0), maxZoom: 19,
    opacity: l.op ?? 1, attribution: l.attr || GSI_ATTR, crossOrigin: !l.opaque,
  });
}
LAYERS.filter(l => !l.dataOnly).forEach(l => { tileLayers[l.id] = makeTile(l); });

map.createPane('vecPane').style.zIndex = 420;

/* ---------------- レイヤUI: 背景 1つ ＋ 地形（陰影・色別標高） ＋ 主題図 1つ ---------------- */
const TERRAIN_IDS = ['hillshademap', 'relief'];
const TERRAIN_SHORT = { hillshademap: '陰影起伏', relief: '色別標高' };
// 主題図は種類ごとにまとめ、種類の中から1枚を選ぶ
const THEMES = [
  { key: 'geology', name: '地質', ids: ['geology'] },
  { key: 'veg', name: '植生', ids: ['veg2024'] },
  { key: 'landform', name: '地形分類', ids: ['lcm25k_2012', 'lcmfc2'] },
  { key: 'photo', name: '古写真', ids: ['ort_riku10', 'ort_USA10', 'ort_old10', 'gazo1', 'gazo2', 'gazo3', 'gazo4'] },
];
const THEME_IDS = THEMES.flatMap(t => t.ids);
const themeOf = id => THEMES.find(t => t.ids.includes(id));
const BASE_SHORT = { std: '標準', pale: '淡色', seamlessphoto: '写真' };
const lastPick = store.get('fm-theme-pick', {}); // 種類ごとに最後に選んだレイヤ

// 主題図は1枚だけ（古いURLや保存状態で複数入っていたら最初の1枚に絞る）
(() => {
  const on = THEME_IDS.filter(id => state.overlays[id]?.on);
  on.slice(1).forEach(id => { state.overlays[id].on = false; });
})();
const curTheme = () => THEME_IDS.find(id => state.overlays[id]?.on) || '';
const opOf = id => state.overlays[id]?.op ?? LAYER_BY_ID[id].op ?? 1;

function slider(id, label) {
  const d = document.createElement('div'); d.className = 'oprow';
  d.innerHTML = `<span>${label}</span><input type="range" min="0.1" max="1" step="0.05" aria-label="${label}の不透明度">`;
  const r = d.querySelector('input'); r.value = opOf(id);
  r.oninput = () => setOverlay(id, true, +r.value);
  return d;
}
function chip(text, on, onclick) {
  const b = document.createElement('button'); b.className = 'chip' + (on ? ' on' : ''); b.textContent = text; b.onclick = onclick; return b;
}
function buildLayerUI() {
  const bs = $('#baseSeg'); bs.innerHTML = '';
  LAYERS.filter(l => l.base).forEach(l => bs.appendChild(chip(BASE_SHORT[l.id] || l.name, state.base === l.id, () => { setBase(l.id); buildLayerUI(); })));

  const ts = $('#terrSeg'); ts.innerHTML = ''; const to = $('#terrOps'); to.innerHTML = '';
  TERRAIN_IDS.forEach(id => {
    const on = !!state.overlays[id]?.on;
    ts.appendChild(chip(TERRAIN_SHORT[id], on, () => { setOverlay(id, !on, opOf(id)); buildLayerUI(); }));
    if (on) to.appendChild(slider(id, TERRAIN_SHORT[id]));
  });

  const th = $('#themeSeg'); th.innerHTML = ''; const sub = $('#themeSub'); sub.innerHTML = '';
  const cur = curTheme(), curT = themeOf(cur);
  th.appendChild(chip('なし', !cur, () => { setTheme(''); }));
  THEMES.forEach(t => th.appendChild(chip(t.name, curT === t, () => {
    if (curT === t) return setTheme('');
    setTheme(t.ids.includes(lastPick[t.key]) ? lastPick[t.key] : t.ids[t.key === 'photo' ? 2 : 0]);
  })));
  if (cur) {
    const l = LAYER_BY_ID[cur];
    if (curT.ids.length > 1) {
      const s = document.createElement('select'); s.className = 'full';
      s.innerHTML = curT.ids.map(id => `<option value="${id}">${LAYER_BY_ID[id].name}${LAYER_BY_ID[id].note ? '（' + LAYER_BY_ID[id].note + '）' : ''}</option>`).join('');
      s.value = cur; s.onchange = () => setTheme(s.value);
      sub.appendChild(s);
    } else {
      const n = document.createElement('div'); n.className = 'note'; n.textContent = l.name + (l.note ? '（' + l.note + '）' : ''); sub.appendChild(n);
    }
    sub.appendChild(slider(cur, '濃さ'));
    if (cur === 'veg2024') {
      const lg = document.createElement('details'); lg.innerHTML = '<summary>凡例</summary><div class="legend">' + VEG_LEGEND.map(([n, c]) => `<span><i style="background:${c}"></i>${n}</span>`).join('') + '</div>';
      sub.appendChild(lg);
    }
    if (map.getZoom() < l.min - 2) { const w = document.createElement('div'); w.className = 'note'; w.textContent = `ズーム${l.min - 2}以上で表示されます`; sub.appendChild(w); }
  }
}
function setTheme(id) {
  THEME_IDS.forEach(x => { if (x !== id && state.overlays[x]?.on) setOverlay(x, false, opOf(x)); });
  if (id) { setOverlay(id, true, opOf(id)); lastPick[themeOf(id).key] = id; store.set('fm-theme-pick', lastPick); }
  buildLayerUI();
}
function setBase(id) {
  LAYERS.filter(l => l.base).forEach(l => map.removeLayer(tileLayers[l.id]));
  tileLayers[id].addTo(map); tileLayers[id].bringToBack();
  state.base = id; saveState();
}
function setOverlay(id, on, op) {
  const t = tileLayers[id]; if (!t) return;
  t.setOpacity(op);
  if (on) { if (!map.hasLayer(t)) t.addTo(map); } else map.removeLayer(t);
  state.overlays[id] = { on, op }; saveState();
}
setBase(state.base);
[...TERRAIN_IDS, ...THEME_IDS].forEach(id => { const o = state.overlays[id]; if (o?.on && tileLayers[id]) setOverlay(id, true, o.op); });
buildLayerUI();
map.on('zoomend', () => { if (curTheme()) buildLayerUI(); });

// ベクタのチップ: チェック状態に合わせて見た目と補足（凡例など）を切り替える
function syncChips() {
  document.querySelectorAll('label.chip input').forEach(i => i.parentElement.classList.toggle('on', i.checked));
  document.querySelectorAll('#vecSub .sub').forEach(s => { s.hidden = !$('#' + s.dataset.for).checked; });
  $('#selBoundYear').hidden = !$('#chkBound').checked;
}
document.addEventListener('change', e => { if (e.target.closest?.('label.chip')) syncChips(); });

/* ---------------- パネル（下のツールバーから開く） ---------------- */
const panel = $('#panel');
const VIEW_TITLE = { layers: '地図', dl: '範囲を保存', more: 'その他' };
let curView = '';
function openView(v) {
  if (!v || curView === v) { curView = ''; panel.classList.remove('open'); panel.setAttribute('aria-hidden', 'true'); }
  else {
    curView = v; panel.classList.add('open'); panel.setAttribute('aria-hidden', 'false');
    $('#panelTitle').textContent = VIEW_TITLE[v];
    document.querySelectorAll('.view').forEach(s => s.classList.toggle('on', s.id === 'view-' + v));
    if (v === 'layers') { buildLayerUI(); syncChips(); }
    if (v === 'dl') onOpenDl();
    if (v === 'more') { refreshExportSelect(); updateMeshLinks(); }
  }
  document.querySelectorAll('#toolbar [data-view]').forEach(b => b.classList.toggle('on', b.dataset.view === curView));
  if (v !== 'dl' && !dlBusy) clearSelection();
}
document.querySelectorAll('#toolbar [data-view]').forEach(b => b.onclick = () => openView(b.dataset.view));
$('#btnClose').onclick = () => openView('');

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

/* ---------------- 共有 ---------------- */
$('#btnShare').onclick = async () => {
  const url = location.href.split('#')[0] + hashFromState();
  try {
    if (navigator.share) { await navigator.share({ title: 'フィールド地図', url }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(url); toast('この場所のURLをコピーしました'); }
  catch { prompt('このURLを共有してください', url); }
};
function toast(t) {
  const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d);
  setTimeout(() => d.remove(), 2500);
}

/* ---------------- オンライン表示 ---------------- */
const netUpd = () => { $('#netState').hidden = navigator.onLine; };
addEventListener('online', netUpd); addEventListener('offline', netUpd); netUpd();

/* ---------------- 地質図: タップした地点の凡例 ---------------- */
const geoLegendMemo = store.get('fm-geolegend', {});
map.on('click', async e => {
  if (catchMode || !map.hasLayer(tileLayers.geology)) return;
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
// パネルに隠れていない地図の部分に合わせて範囲を置く
function fitSelectionToView() {
  const sz = map.getSize(), pr = panel.getBoundingClientRect(), mobile = innerWidth < 700;
  const x0 = 24, y0 = 70, x1 = (mobile ? sz.x : pr.left) - 24, y1 = (mobile ? pr.top : sz.y - 70) - 24;
  const nw = map.containerPointToLatLng([x0, y0]), se = map.containerPointToLatLng([x1, Math.max(y1, y0 + 60)]);
  setSelection([nw.lng, se.lat, se.lng, nw.lat]);
}
$('#btnSelect').onclick = fitSelectionToView;
let dlBusy = false;
function onOpenDl() {
  // 表示中の地図 ＋ 標高データ を保存対象にする
  if (!dlBusy) {
    const vis = new Set([state.base, ...Object.entries(state.overlays).filter(([, v]) => v.on).map(([k]) => k), 'dem_png']);
    document.querySelectorAll('#dlLayers input').forEach(i => { i.checked = vis.has(i.value); });
  }
  setTimeout(() => { if (!selRect) fitSelectionToView(); updateEstimate(); }, 300); // パネルが開ききってから
  refreshAreas();
}

// 保存対象レイヤの選択UI
function buildDlLayers() {
  const d = $('#dlLayers'); d.innerHTML = '';
  LAYERS.forEach(l => {
    const lab = document.createElement('label'); lab.className = 'row';
    lab.innerHTML = `<input type="checkbox" value="${l.id}"> ${l.name} <small>z${l.min}–${l.max}</small>`;
    lab.querySelector('input').onchange = updateEstimate;
    d.appendChild(lab);
  });
}
const dlLayerIds = () => [...document.querySelectorAll('#dlLayers input:checked')].map(i => i.value);
buildDlLayers();
['#zMin', '#zMax'].forEach(s => $(s).oninput = updateEstimate);

function estimate(bbox, ids, zMin, zMax) {
  let total = 0, opaque = 0; const per = {};
  ids.forEach(id => { const l = LAYER_BY_ID[id]; const n = countTiles(l, bbox, zMin, zMax); per[id] = n; total += n; if (l.opaque) opaque += n; });
  return { total, opaque, per, mb: total * 0.025 }; // 1枚 ≒ 25KB として概算
}
function updateEstimate() {
  const bbox = selBBox(); const el = $('#dlEstimate');
  if (!bbox) { el.textContent = '「範囲を指定」を押して地図上で範囲を決めてください。'; return; }
  const zMin = +$('#zMin').value, zMax = +$('#zMax').value;
  const e = estimate(bbox, dlLayerIds(), zMin, zMax);
  const km = (() => { const [w, s, ee, n] = bbox; const dy = (n - s) * 111; const dx = (ee - w) * 111 * Math.cos((n + s) / 2 * Math.PI / 180); return (dx * dy).toFixed(1); })();
  let warn = '';
  if (e.total > MAX_TILES) warn += `<br>⚠ ${MAX_TILES.toLocaleString()}枚を超えています。範囲かズームを小さくしてください。`;
  if (e.opaque > MAX_OPAQUE_TILES) warn += `<br>⚠ 植生図タイルは1回${MAX_OPAQUE_TILES.toLocaleString()}枚までです（ズーム最大を下げてください）。`;
  el.innerHTML = `範囲 約${km} km² ／ タイル ${e.total.toLocaleString()} 枚 ／ 約 ${e.mb.toFixed(0)} MB（概算）${warn}`;
}

/* ================= ダウンロード（オフライン保存） ================= */
let cancelFlag = false;
$('#btnCancel').onclick = () => { cancelFlag = true; };
async function pool(items, conc, fn) {
  let i = 0; const run = async () => { while (i < items.length && !cancelFlag) { const it = items[i++]; await fn(it); } };
  await Promise.all(Array.from({ length: conc }, run));
}
async function fetchToCache(cache, url, opaque = false) {
  if (await cache.match(url)) return 'hit';
  try {
    const r = await fetch(url, { mode: opaque ? 'no-cors' : 'cors' });
    if (opaque && r.type === 'opaque') { await cache.put(url, r); return 'ok'; }
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
  if (est.total > MAX_TILES || est.opaque > MAX_OPAQUE_TILES) { alert('枚数が上限を超えています。範囲かズームを小さくしてください。'); return; }
  if (est.total > 5000 && !confirm(`${est.total.toLocaleString()}枚（約${est.mb.toFixed(0)}MB）を保存します。Wi-Fi環境を推奨します。続けますか？`)) return;

  try { await navigator.storage?.persist?.(); } catch { }
  cancelFlag = false; dlBusy = true;
  $('#btnDownload').disabled = true; $('#btnCancel').hidden = false;
  const prog = $('#dlProg'); prog.hidden = false; prog.value = 0;
  const msg = $('#dlMsg');
  const cache = await caches.open(TILE_CACHE);
  const stat = { ok: 0, hit: 0, none: 0, err: 0 };
  const total = est.total; let done = 0;
  const tick = r => { stat[r]++; done++; if (done % 20 === 0 || done === total) { prog.value = done / total; msg.textContent = `タイル ${done.toLocaleString()} / ${total.toLocaleString()}（新規 ${stat.ok}・保存済 ${stat.hit}・データなし ${stat.none}・失敗 ${stat.err}）`; } };

  // 通常は並列6、CORS非対応（植生図）は並列2
  const gsiItems = [], ecoItems = [];
  ids.forEach(id => { const l = LAYER_BY_ID[id]; for (const t of tileUrls(l, bbox, zMin, zMax)) (l.opaque ? ecoItems : gsiItems).push(t.url); });
  await Promise.all([
    pool(gsiItems, 6, async u => tick(await fetchToCache(cache, u))),
    pool(ecoItems, 2, async u => tick(await fetchToCache(cache, u, true))),
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

  if (!cancelFlag) { msg.textContent = '人口メッシュを保存中…'; for (const c of mesh1InBBox(bbox)) { try { await loadPopMesh1(c); } catch { } } }
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
  $('#btnDownload').disabled = false; $('#btnCancel').hidden = true; prog.hidden = true; dlBusy = false;
  refreshAreas();
};

async function refreshAreas() {
  const list = $('#areaList'); const areas = store.get('fm-areas', []);
  list.innerHTML = areas.length ? '' : '<p class="note">まだありません。</p>';
  areas.forEach(a => {
    const d = document.createElement('div'); d.className = 'area';
    d.innerHTML = `<b></b><span class="note">${new Date(a.date).toLocaleDateString('ja-JP')}・z${a.zMin}–${a.zMax}・${a.tiles.toLocaleString()}枚${a.fude ? `・筆${(a.fudeN || 0).toLocaleString()}` : ''}・${a.layers.map(id => LAYER_BY_ID[id]?.name).filter(Boolean).join('、')}</span><br>
      <button class="btn" data-a="go">表示</button><button class="btn" data-a="again">再取得</button><button class="btn" data-a="del">削除</button>`;
    d.querySelector('b').textContent = a.name;
    d.querySelector('[data-a=go]').onclick = () => { const [w, s, e, n] = a.bbox; map.fitBounds([[s, w], [n, e]], innerWidth < 700 ? { paddingBottomRight: [0, panel.offsetHeight] } : { paddingBottomRight: [panel.offsetWidth, 0] }); setSelection(a.bbox); };
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

/* ================= 流域（集水域）: 地理院DEMから計算 ================= */
// 地点をタップすると、その地点より上流の集水域を DEM(10m) から求める。
// 流域が計算範囲の端に達したらズームを下げて（＝範囲を広げて）やり直す。
let catchMode = false;
const DEM = LAYER_BY_ID.dem_png;
const CATCH_TILES = 6;           // 6×6タイル（1536×1536セル）で計算
const CATCH_ZMAX = 14, CATCH_ZMIN = 8;
const catchWorkerSrc = `
self.onmessage = e => {
  const { h, W, H, px, py, snap } = e.data; const N = W * H;
  // Priority-Flood（窪地埋め）＋流向: セルは「自分を押し込んだセル」へ流れる
  const dir = new Int32Array(N).fill(-1), closed = new Uint8Array(N), order = new Int32Array(N);
  let hk = new Float64Array(1 << 16), hv = new Int32Array(1 << 16), hn = 0, seq = new Float64Array(1 << 16);
  let sq = 0;
  const less = (i, j) => hk[i] < hk[j] || (hk[i] === hk[j] && seq[i] < seq[j]);
  const swap = (i, j) => { let t = hk[i]; hk[i] = hk[j]; hk[j] = t; t = hv[i]; hv[i] = hv[j]; hv[j] = t; t = seq[i]; seq[i] = seq[j]; seq[j] = t; };
  function push(k, v) {
    if (hn === hk.length) { const a = new Float64Array(hn * 2); a.set(hk); hk = a; const b = new Int32Array(hn * 2); b.set(hv); hv = b; const c = new Float64Array(hn * 2); c.set(seq); seq = c; }
    let i = hn++; hk[i] = k; hv[i] = v; seq[i] = sq++;
    while (i > 0) { const p = (i - 1) >> 1; if (less(i, p)) { swap(i, p); i = p; } else break; }
  }
  function pop() {
    const v = hv[0], k = hk[0]; hn--; hk[0] = hk[hn]; hv[0] = hv[hn]; seq[0] = seq[hn];
    let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < hn && less(l, m)) m = l; if (r < hn && less(r, m)) m = r; if (m === i) break; swap(i, m); i = m; }
    popK = k; return v;
  }
  let popK = 0;
  const q = new Int32Array(N), ql = new Float64Array(N); let qh = 0, qt = 0;
  const elev = i => (h[i] !== h[i]) ? -1e4 : h[i];      // NaN(海など)は出口
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { const i = y * W + x; if (!closed[i]) { closed[i] = 1; push(elev(i), i); } }
  for (let y = 1; y < H - 1; y++) for (const x of [0, W - 1]) { const i = y * W + x; if (!closed[i]) { closed[i] = 1; push(elev(i), i); } }
  const DX = [-1, 0, 1, -1, 1, -1, 0, 1], DY = [-1, -1, -1, 0, 0, 1, 1, 1];
  let oc = 0;
  while (qh < qt || hn > 0) {
    let c, lv;
    if (qh < qt) { c = q[qh]; lv = ql[qh]; qh++; } else { c = pop(); lv = popK; }
    order[oc++] = c;
    const cx = c % W, cy = (c / W) | 0;
    for (let k = 0; k < 8; k++) {
      const nx = cx + DX[k], ny = cy + DY[k];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx; if (closed[n]) continue;
      closed[n] = 1; dir[n] = c;
      const he = elev(n);
      if (he <= lv) { q[qt] = n; ql[qt] = lv; qt++; } else push(he, n);
    }
  }
  // 集水面積（セル数）
  const acc = new Float64Array(N).fill(1);
  for (let k = N - 1; k >= 0; k--) { const c = order[k]; if (dir[c] >= 0) acc[dir[c]] += acc[c]; }
  // 流路へスナップ
  let pour = py * W + px, best = -1;
  for (let y = Math.max(0, py - snap); y <= Math.min(H - 1, py + snap); y++)
    for (let x = Math.max(0, px - snap); x <= Math.min(W - 1, px + snap); x++) {
      if ((x - px) ** 2 + (y - py) ** 2 > snap * snap) continue;
      const i = y * W + x; if (h[i] === h[i] && acc[i] > best) { best = acc[i]; pour = i; }
    }
  // 上流域: 流下順に、下流側が流域内なら自分も流域内
  const mask = new Uint8Array(N); mask[pour] = 1; let start = 0;
  for (let k = 0; k < N; k++) if (order[k] === pour) { start = k; break; }
  let count = 1, edge = false;
  for (let k = start + 1; k < N; k++) {
    const c = order[k];
    if (dir[c] >= 0 && mask[dir[c]]) {
      mask[c] = 1; count++;
      const x = c % W, y = (c / W) | 0; if (x <= 1 || y <= 1 || x >= W - 2 || y >= H - 2) edge = true;  // 外周セルは出口扱いのため、その内側に届いたら範囲不足
    }
  }
  // 主な流路（集水セル数が一定以上）の線分
  const thr = Math.max(200, count / 400), streams = [];
  for (let c = 0; c < N; c++) if (mask[c] && acc[c] >= thr && dir[c] >= 0) streams.push(c, dir[c]);
  self.postMessage({ mask, count, pour, edge, pourElev: h[pour], acc: acc[pour], streams: Int32Array.from(streams) }, [mask.buffer]);
};`;
let catchWorker = null;
function runCatchWorker(msg) {
  catchWorker ??= new Worker(URL.createObjectURL(new Blob([catchWorkerSrc], { type: 'text/javascript' })));
  return new Promise((ok, ng) => { catchWorker.onmessage = e => ok(e.data); catchWorker.onerror = e => { catchWorker = null; ng(e); }; catchWorker.postMessage(msg); });
}
async function demTile(z, x, y) {
  const url = DEM.url.replace('{z}', z).replace('{x}', x).replace('{y}', y);
  let r = await (await caches.open(TILE_CACHE)).match(url);
  if (!r) { try { r = await fetch(url, { mode: 'cors' }); } catch { r = null; } }
  if (!r || !r.ok) return null;
  const bmp = await createImageBitmap(await r.blob());
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(bmp, 0, 0);
  return ctx.getImageData(0, 0, 256, 256).data;
}
async function demGrid(z, tx0, ty0, n) {
  const W = n * 256, h = new Float32Array(W * W).fill(NaN); let missing = 0;
  const jobs = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) jobs.push((async () => {
    const d = await demTile(z, tx0 + i, ty0 + j); if (!d) { missing++; return; }
    for (let p = 0; p < 65536; p++) {
      const v = d[p * 4] * 65536 + d[p * 4 + 1] * 256 + d[p * 4 + 2];
      if (v === 8388608 || d[p * 4 + 3] === 0) continue;
      h[(j * 256 + (p >> 8)) * W + i * 256 + (p & 255)] = (v < 8388608 ? v : v - 16777216) * 0.01;
    }
  })());
  await Promise.all(jobs);
  return { h, W, missing };
}
const pix2lon = (X, z) => X / (256 * 2 ** z) * 360 - 180;
const pix2lat = (Y, z) => Math.atan(Math.sinh(Math.PI * (1 - 2 * Y / (256 * 2 ** z)))) * 180 / Math.PI;
function maskToRing(mask, W, H) {
  // マスクの外周をたどって最大のリングを返す（ピクセル角の座標）
  const out = new Map(); const key = (x, y) => y * (W + 1) + x;
  const add = (x1, y1, x2, y2) => { const k = key(x1, y1); (out.get(k) || out.set(k, []).get(k)).push(key(x2, y2)); };
  const m = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!mask[y * W + x]) continue;
    if (!m(x, y - 1)) add(x, y, x + 1, y);
    if (!m(x + 1, y)) add(x + 1, y, x + 1, y + 1);
    if (!m(x, y + 1)) add(x + 1, y + 1, x, y + 1);
    if (!m(x - 1, y)) add(x, y + 1, x, y);
  }
  let best = [];
  for (const [k0] of out) {
    if (!out.get(k0)?.length) continue;
    const ring = []; let k = k0;
    while (out.get(k)?.length) { ring.push(k); const nx = out.get(k).pop(); if (!out.get(k).length) out.delete(k); k = nx; if (k === k0) break; }
    if (ring.length > best.length) best = ring;
  }
  // 直線上の頂点を間引く
  const pts = best.map(k => [k % (W + 1), Math.floor(k / (W + 1))]); const res = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
    if ((b[0] - a[0]) * (c[1] - b[1]) !== (b[1] - a[1]) * (c[0] - b[0])) res.push(b);
  }
  return res;
}
async function delineate(latlng) {
  toast('集水域を計算中…（数秒〜数十秒）');
  for (let z = CATCH_ZMAX; z >= CATCH_ZMIN; z--) {
    const X = (latlng.lng + 180) / 360 * 256 * 2 ** z;
    const r = latlng.lat * Math.PI / 180, Y = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 256 * 2 ** z;
    const tx0 = Math.floor(X / 256) - CATCH_TILES / 2 + 1, ty0 = Math.floor(Y / 256) - CATCH_TILES / 2 + 1;
    const { h, W, missing } = await demGrid(z, tx0, ty0, CATCH_TILES);
    if (missing === CATCH_TILES ** 2) { toast(navigator.onLine ? '標高データがありません' : 'この範囲の標高データが端末にありません'); return; }
    const px = Math.floor(X - tx0 * 256), py = Math.floor(Y - ty0 * 256);
    const res = await runCatchWorker({ h, W, H: W, px, py, snap: Math.max(2, 6 - (CATCH_ZMAX - z)) });
    if (res.edge && z > CATCH_ZMIN) continue;            // 範囲を広げてやり直し
    const ring = maskToRing(res.mask, W, W).map(([x, y]) => [+pix2lon(tx0 * 256 + x, z).toFixed(6), +pix2lat(ty0 * 256 + y, z).toFixed(6)]);
    if (ring.length < 3) { toast('集水域を求められませんでした'); return; }
    ring.push(ring[0]);
    const cell = 40075016.686 * Math.cos(r) / (256 * 2 ** z);
    const area = res.count * cell * cell / 1e6;
    const pc = res.pour % W, pr = Math.floor(res.pour / W);
    const pour = [+pix2lon(tx0 * 256 + pc + .5, z).toFixed(6), +pix2lat(ty0 * 256 + pr + .5, z).toFixed(6)];
    const streams = []; for (let i = 0; i < res.streams.length; i += 2) {
      const a = res.streams[i], b = res.streams[i + 1];
      streams.push([[+pix2lon(tx0 * 256 + a % W + .5, z).toFixed(6), +pix2lat(ty0 * 256 + Math.floor(a / W) + .5, z).toFixed(6)],
                    [+pix2lon(tx0 * 256 + b % W + .5, z).toFixed(6), +pix2lat(ty0 * 256 + Math.floor(b / W) + .5, z).toFixed(6)]]);
    }
    const name = `集水域 ${pour[1].toFixed(4)},${pour[0].toFixed(4)}`;
    const props = { _kind: 'catchment', 名称: name, '面積(km2)': +area.toFixed(area < 10 ? 3 : 1), '流出点標高(m)': +res.pourElev.toFixed(1),
      '計算解像度(m)': Math.round(cell), 'DEM': '地理院 DEM10B (dem_png z' + z + ')', ...(res.edge ? { '注意': '計算範囲の端に達しています。実際の流域はさらに大きい可能性があります' } : {}) };
    const gj = { type: 'FeatureCollection', features: [
      { type: 'Feature', properties: props, geometry: { type: 'Polygon', coordinates: [ring] } },
      { type: 'Feature', properties: { _kind: 'catchment', 名称: name + '（流出点）' }, geometry: { type: 'Point', coordinates: pour } },
      ...(streams.length ? [{ type: 'Feature', properties: { _kind: 'catchment', 名称: name + '（主な流路・DEMから推定）' }, geometry: { type: 'MultiLineString', coordinates: streams } }] : []),
    ] };
    const lc = await caches.open(LOCAL_CACHE);
    await lc.put(LOCAL_PREFIX + 'geo/' + encodeURIComponent(name + '.geojson'), new Response(JSON.stringify(gj), { headers: { 'content-type': 'application/json' } }));
    await loadLocal(); if (!state.user) $('#chkUser').click();
    const b = L.geoJSON(gj).getBounds(); if (!map.getBounds().contains(b)) map.fitBounds(b, { padding: [20, 20] });
    toast(`集水域 ${props['面積(km2)']} km²（解像度 約${Math.round(cell)}m）`);
    return;
  }
}
function setCatchMode(on) {
  catchMode = on; $('#btnCatch').classList.toggle('on', on); $('#catchBar').hidden = !on;
  map.getContainer().style.cursor = on ? 'crosshair' : '';
}
$('#btnCatch').onclick = () => { setCatchMode(!catchMode); if (catchMode && innerWidth < 700) openView(''); };
$('#catchCancel').onclick = () => setCatchMode(false);
map.on('click', async e => {
  if (!catchMode) return; setCatchMode(false);
  try { await delineate(e.latlng); } catch (err) { console.warn(err); toast('計算に失敗しました'); }
});

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
const POP_BASE = new URL('data/pop500/', location.href).href;
const POP_MINZOOM = 10;
const popGroups = new Map();   // 1次メッシュ → layerGroup
let popData = [];               // 読込済の全メッシュ [{code, pop, male, female, hh, src}]
let popIndex = null, popTimer;
const popRenderer = L.canvas({ pane: 'vecPane' });
function popRect(d) {
  const col = popColor(d.pop); if (!col) return null;
  const [w, s, e, n] = meshBBox(d.code);
  return L.rectangle([[s, w], [n, e]], { renderer: popRenderer, pane: 'vecPane', bubblingMouseEvents: false, weight: .3, color: '#555', fillColor: col, fillOpacity: .5 })
    .bindPopup(() => `<b>500mメッシュ ${d.code}</b><table><tr><td>人口</td><td>${d.pop ?? '秘匿'}</td></tr><tr><td>男</td><td>${d.male ?? '-'}</td></tr><tr><td>女</td><td>${d.female ?? '-'}</td></tr>${d.hh != null ? `<tr><td>世帯数</td><td>${d.hh}</td></tr>` : ''}</table><span class="note">${esc(d.src)}</span>`);
}
function addPopRows(key, rows) {
  popGroups.get(key)?.remove();
  const g = L.layerGroup(); rows.forEach(d => { const r = popRect(d); if (r) g.addLayer(r); });
  popGroups.set(key, g); popLayer.addLayer(g);
  popData = popData.filter(d => d.__k !== key).concat(rows.map(d => Object.assign(d, { __k: key })));
}
function parsePopCsv(text, src) {
  const n = v => v === '' || v === undefined ? null : +v;
  return text.trim().split('\n').slice(1).map(l => { const [code, pop, male, female, hh] = l.split(','); return { code, pop: n(pop), male: n(male), female: n(female), hh: n(hh), src }; });
}
async function cachedText(url) {
  const c = await caches.open(DATA_CACHE);
  let r = await c.match(url);
  if (!r) { r = await fetch(url); if (!r.ok) throw new Error(r.status); await c.put(url, r.clone()); }
  return r.text();
}
async function loadPopMesh1(code) {
  if (popGroups.has(code)) return;
  if (!popIndex) popIndex = new Set(JSON.parse(await cachedText(POP_BASE + 'index.json')));
  if (!popIndex.has(code)) return;
  popGroups.set(code, null);
  try { addPopRows(code, parsePopCsv(await cachedText(POP_BASE + code + '.csv'), '令和2年国勢調査 500mメッシュ（e-Stat）')); }
  catch (e) { popGroups.delete(code); throw e; }
}
async function refreshPop() {
  const info = $('#popInfo');
  if (!state.pop) { map.removeLayer(popLayer); info.textContent = ''; return; }
  popLayer.addTo(map);
  if (map.getZoom() < POP_MINZOOM) { info.textContent = `ズーム${POP_MINZOOM}以上で表示します`; return; }
  const b = map.getBounds();
  try {
    for (const c of mesh1InBBox([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()])) await loadPopMesh1(c);
    info.textContent = `読込済 ${popData.length.toLocaleString()} メッシュ`;
  } catch { info.textContent = '人口データを読込めませんでした（オフライン時は保存済み範囲のみ）'; }
}
map.on('moveend', () => { clearTimeout(popTimer); popTimer = setTimeout(refreshPop, 300); });
$('#chkPop').checked = state.pop;
$('#chkPop').onchange = () => { state.pop = $('#chkPop').checked; saveState(); refreshPop(); };

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
  style: f => f.properties?._kind === 'catchment'
    ? { color: '#0b6e99', weight: 2.5, fillColor: '#29a3d6', fillOpacity: .15, dashArray: '6 3', bubblingMouseEvents: false }
    : { color: '#c0392b', weight: 2, fillOpacity: .2, bubblingMouseEvents: false },
  pointToLayer: (f, ll) => L.circleMarker(ll, { radius: 6, bubblingMouseEvents: false, color: '#fff', weight: 2, fillColor: '#c0392b', fillOpacity: .9, pane: 'vecPane' }),
  onEachFeature: (f, ly) => {
    const rows = Object.entries(f.properties || {}).filter(([k]) => !k.startsWith('_')).slice(0, 30)
      .map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('');
    const box = document.createElement('div');
    box.innerHTML = `<table>${rows}</table><span class="note">${esc(f.properties?.__src || '')}</span><br>`;
    const del = document.createElement('button'); del.className = 'mini';
    del.textContent = f.properties?._kind === 'catchment' ? 'この集水域を消す' : 'このデータを消す';
    del.onclick = () => { map.closePopup(); removeUser(f.properties?.__src); };
    box.appendChild(del);
    ly.bindPopup(box, { maxHeight: 300 });
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

async function removeUser(name) {
  const u = userData.find(x => x.name === name); if (!u) return;
  if (!confirm(`「${name}」を消しますか？`)) return;
  await (await caches.open(LOCAL_CACHE)).delete(u.key); loadLocal();
}
async function loadLocal() {
  const lc = await caches.open(LOCAL_CACHE);
  const keys = await lc.keys();
  userData = []; userLayer.clearLayers();
  [...popGroups.keys()].filter(k => k.startsWith('local:')).forEach(k => { popGroups.get(k)?.remove(); popGroups.delete(k); popData = popData.filter(d => d.__k !== k); });
  const info = [];
  for (const k of keys) {
    const rel = k.url.slice(LOCAL_PREFIX.length);
    const j = await (await lc.match(k)).json();
    if (rel.startsWith('pop/')) addPopRows('local:' + rel, j);
    if (rel.startsWith('geo/')) {
      const name = decodeURIComponent(rel.slice(4));
      (j.features || [j]).forEach(f => { f.properties = Object.assign({}, f.properties, { __src: name }); });
      userData.push({ name, gj: j, key: k.url }); userLayer.addData(j); info.push(name);
    }
  }
  refreshPop();
  if (state.user) userLayer.addTo(map);
  // 地図パネルの一覧（集水域など）
  const ul = $('#userList'); ul.innerHTML = '';
  userData.forEach(u => {
    const d = document.createElement('div'); d.className = 'item';
    d.innerHTML = `<span></span><button class="mini" data-a="go">表示</button><button class="mini" data-a="del">✕</button>`;
    d.querySelector('span').textContent = u.name.replace(/\.geojson$/, '');
    d.querySelector('[data-a=go]').onclick = () => { const b = L.geoJSON(u.gj).getBounds(); if (b.isValid()) map.fitBounds(b, { maxZoom: 16 }); };
    d.querySelector('[data-a=del]').onclick = () => removeUser(u.name);
    ul.appendChild(d);
  });
  const nCatch = userData.filter(u => u.name.startsWith('集水域')).length;
  if (nCatch > 1) {
    const b = document.createElement('button'); b.className = 'mini'; b.textContent = `集水域をすべて消す（${nCatch}件）`;
    b.onclick = async () => { if (!confirm(`集水域 ${nCatch}件を消しますか？`)) return; const lc = await caches.open(LOCAL_CACHE); for (const u of userData.filter(u => u.name.startsWith('集水域'))) await lc.delete(u.key); loadLocal(); };
    ul.appendChild(b);
  }
  if (!userData.length) ul.innerHTML = '<span class="note">まだありません（集水域の結果や読込んだGeoJSONがここに並びます）</span>';
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
  const exportable = a.layers.filter(id => LAYER_BY_ID[id] && !LAYER_BY_ID[id].opaque);
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
  const pf = popData.filter(d => d.code && inBBox(meshBBox(d.code), a.bbox)).map(d => {
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
    a.layers.some(id => LAYER_BY_ID[id]?.opaque) ? '  ※現存植生図2024タイルは配信元がCORS非対応のためアプリから読み出せず、含めていません（G空間情報センターでGPKG/タイルを入手できます）。' : '',
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
syncChips();
