/* =========================================================
   OptiCorte Pro -- Motor de optimización y UI
   Autor: Sistema original (basado en conceptos públicos de
   Guillotine bin packing y MaxRects).
   ========================================================= */

/* ---------- ESTADO GLOBAL ---------- */
const STATE = {
  tableros: [],
  piezas: [],
  sobrantes: [],
  params: { kerf:3, tolPos:0, tolNeg:0, margenPer:10, sepMin:3, margenSeg:0, comp:0, rotGlobal:false, veta:true, criterio:'tableros' },
  lastResult: null,
  editTabId: null,
  editPiezaId: null,
  excelRows: null,
  excelCols: null,
  zoom: 1,
  projectName: 'Sin guardar'
};

const uid = () => '_' + Math.random().toString(36).slice(2,10);
const $ = id => document.getElementById(id);
const fmt = (n,d=0) => Number(n).toLocaleString('es-MX',{minimumFractionDigits:d,maximumFractionDigits:d});

/* ---------- TOAST ---------- */
function toast(msg, type='info'){
  const t = $('toast');
  t.textContent = msg;
  t.className = 'toast show ' + (type==='error'?'error':type==='success'?'success':'');
  clearTimeout(t._to);
  t._to = setTimeout(()=>t.classList.remove('show'), 2600);
}

/* ---------- NAVEGACIÓN ---------- */
document.querySelectorAll('.nav-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s=>s.classList.remove('active'));
    btn.classList.add('active');
    const sec = $('sec-' + btn.dataset.section);
    if(sec) sec.classList.add('active');
    if(window.innerWidth <= 900) $('sidebar').classList.remove('open');
  });
});

/* ---------- MENÚ MÓVIL ---------- */
const menuToggle = document.createElement('button');
menuToggle.className='menu-toggle'; menuToggle.textContent='☰';
document.body.appendChild(menuToggle);
menuToggle.onclick=()=>$('sidebar').classList.toggle('open');

/* =========================================================
   TABLEROS
   ========================================================= */
function renderTableros(){
  const tbody = $('tablaTableros').querySelector('tbody');
  tbody.innerHTML = '';
  STATE.tableros.forEach(t=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(t.nombre)}</td>
      <td>${t.material}</td>
      <td>${t.largo}</td>
      <td>${t.ancho}</td>
      <td>${t.espesor}</td>
      <td>$${fmt(t.precio,2)}</td>
      <td><span style="display:inline-block;width:16px;height:16px;border-radius:4px;border:1px solid #ccc;background:${t.color}"></span></td>
      <td>${t.veta}</td>
      <td>${t.cantidad}</td>
      <td class="actions">
        <button class="icon-btn" data-edit="${t.id}" title="Editar">✏️</button>
        <button class="icon-btn" data-dup="${t.id}" title="Duplicar">⧉</button>
        <button class="icon-btn del" data-del="${t.id}" title="Eliminar">🗑</button>
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>loadTableroForm(b.dataset.edit));
  tbody.querySelectorAll('[data-dup]').forEach(b=>b.onclick=()=>{dupTablero(b.dataset.dup);});
  tbody.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{delTablero(b.dataset.del);});
  $('statTableros').textContent = STATE.tableros.reduce((a,t)=>a+t.cantidad,0);
  saveAuto();
}

function loadTableroForm(id){
  const t = STATE.tableros.find(x=>x.id===id); if(!t) return;
  $('tNombre').value=t.nombre; $('tMaterial').value=t.material;
  $('tLargo').value=t.largo; $('tAncho').value=t.ancho;
  $('tEspesor').value=t.espesor; $('tPrecio').value=t.precio;
  $('tColor').value=t.color; $('tVeta').value=t.veta;
  $('tCantidad').value=t.cantidad; $('tMargen').value=t.margen||0;
  STATE.editTabId=id;
  $('btnAddTablero').textContent='💾 Actualizar tablero';
  $('btnCancelTablero').style.display='inline-block';
}

function clearTableroForm(){
  $('tNombre').value=''; $('tLargo').value=2440; $('tAncho').value=1220;
  $('tEspesor').value=18; $('tPrecio').value=0; $('tColor').value='#c8a878';
  $('tVeta').value='largo'; $('tCantidad').value=10; $('tMargen').value=0;
  STATE.editTabId=null;
  $('btnAddTablero').textContent='➕ Agregar tablero';
  $('btnCancelTablero').style.display='none';
}

$('btnAddTablero').onclick = ()=>{
  const t = {
    id: STATE.editTabId || uid(),
    nombre: $('tNombre').value.trim() || 'Tablero',
    material: $('tMaterial').value,
    largo: +$('tLargo').value,
    ancho: +$('tAncho').value,
    espesor: +$('tEspesor').value,
    precio: +$('tPrecio').value,
    color: $('tColor').value,
    veta: $('tVeta').value,
    cantidad: +$('tCantidad').value,
    margen: +$('tMargen').value
  };
  if(t.largo<=0 || t.ancho<=0){ toast('Dimensiones inválidas','error'); return; }
  if(STATE.editTabId){
    const i = STATE.tableros.findIndex(x=>x.id===t.id);
    STATE.tableros[i]=t;
    toast('Tablero actualizado','success');
  } else {
    STATE.tableros.push(t);
    toast('Tablero agregado','success');
  }
  clearTableroForm(); renderTableros();
};
$('btnCancelTablero').onclick = ()=>{ clearTableroForm(); };
function dupTablero(id){
  const t = STATE.tableros.find(x=>x.id===id); if(!t) return;
  STATE.tableros.push({...t, id:uid(), nombre:t.nombre+' (copia)'});
  renderTableros(); toast('Tablero duplicado','success');
}
function delTablero(id){
  if(!confirm('¿Eliminar tablero?')) return;
  STATE.tableros = STATE.tableros.filter(x=>x.id!==id);
  renderTableros(); toast('Tablero eliminado');
}

/* =========================================================
   PIEZAS
   ========================================================= */
function renderPiezas(){
  const tbody = $('tablaPiezas').querySelector('tbody');
  tbody.innerHTML = '';
  STATE.piezas.forEach((p,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i+1}</td>
      <td>${escapeHtml(p.nombre)}</td>
      <td>${p.largo}</td>
      <td>${p.ancho}</td>
      <td>${p.cantidad}</td>
      <td>${p.espesor}</td>
      <td>${p.material}</td>
      <td>${p.veta}</td>
      <td>${p.rot?'Sí':'No'}</td>
      <td>${escapeHtml(p.obs||'')}</td>
      <td class="actions">
        <button class="icon-btn" data-edit="${p.id}">✏️</button>
        <button class="icon-btn" data-dup="${p.id}">⧉</button>
        <button class="icon-btn del" data-del="${p.id}">🗑</button>
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>loadPiezaForm(b.dataset.edit));
  tbody.querySelectorAll('[data-dup]').forEach(b=>b.onclick=()=>{
    const p = STATE.piezas.find(x=>x.id===b.dataset.dup);
    STATE.piezas.push({...p, id:uid()}); renderPiezas();
  });
  tbody.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
    STATE.piezas = STATE.piezas.filter(x=>x.id!==b.dataset.del); renderPiezas();
  });
  const totalP = STATE.piezas.reduce((a,p)=>a+p.cantidad,0);
  $('countPiezas').textContent = totalP;
  $('statPiezas').textContent = totalP;
  saveAuto();
}

function loadPiezaForm(id){
  const p = STATE.piezas.find(x=>x.id===id); if(!p) return;
  $('pNombre').value=p.nombre; $('pLargo').value=p.largo; $('pAncho').value=p.ancho;
  $('pCant').value=p.cantidad; $('pEspesor').value=p.espesor;
  $('pMaterial').value=p.material; $('pVeta').value=p.veta;
  $('pRot').value=p.rot?'true':'false'; $('pObs').value=p.obs||'';
  STATE.editPiezaId=id;
  $('btnAddPieza').textContent='💾 Actualizar pieza';
  $('btnCancelPieza').style.display='inline-block';
}
function clearPiezaForm(){
  $('pNombre').value=''; $('pLargo').value=0; $('pAncho').value=0;
  $('pCant').value=1; $('pEspesor').value=18; $('pMaterial').value='Melamina';
  $('pVeta').value='ninguna'; $('pRot').value='true'; $('pObs').value='';
  STATE.editPiezaId=null;
  $('btnAddPieza').textContent='➕ Agregar pieza';
  $('btnCancelPieza').style.display='none';
}

$('btnAddPieza').onclick = ()=>{
  const p = {
    id: STATE.editPiezaId || uid(),
    nombre: $('pNombre').value.trim() || 'Pieza',
    largo: +$('pLargo').value,
    ancho: +$('pAncho').value,
    cantidad: +$('pCant').value,
    espesor: +$('pEspesor').value,
    material: $('pMaterial').value,
    veta: $('pVeta').value,
    rot: $('pRot').value === 'true',
    obs: $('pObs').value.trim()
  };
  if(p.largo<=0 || p.ancho<=0){ toast('Dimensiones inválidas','error'); return; }
  if(p.cantidad<=0){ toast('Cantidad inválida','error'); return; }
  if(STATE.editPiezaId){
    const i = STATE.piezas.findIndex(x=>x.id===p.id);
    STATE.piezas[i]=p; toast('Pieza actualizada','success');
  } else {
    STATE.piezas.push(p); toast('Pieza agregada','success');
  }
  clearPiezaForm(); renderPiezas();
};
$('btnCancelPieza').onclick = clearPiezaForm;
$('btnClearPiezas').onclick = ()=>{
  if(!confirm('¿Eliminar todas las piezas?')) return;
  STATE.piezas=[]; renderPiezas();
};
$('btnEjemplo').onclick = ()=>{
  const ej=[
    {nombre:'Lateral izq.',largo:600,ancho:400,cantidad:2,espesor:18,material:'Melamina',veta:'largo',rot:false,obs:''},
    {nombre:'Lateral der.',largo:600,ancho:400,cantidad:2,espesor:18,material:'Melamina',veta:'largo',rot:false,obs:''},
    {nombre:'Tapa superior',largo:800,ancho:400,cantidad:1,espesor:18,material:'Melamina',veta:'largo',rot:false,obs:''},
    {nombre:'Base',largo:800,ancho:400,cantidad:1,espesor:18,material:'Melamina',veta:'largo',rot:false,obs:''},
    {nombre:'Entrepaño',largo:760,ancho:380,cantidad:2,espesor:18,material:'Melamina',veta:'ninguna',rot:true,obs:''},
    {nombre:'Puerta',largo:700,ancho:390,cantidad:2,espesor:18,material:'Melamina',veta:'largo',rot:false,obs:''},
    {nombre:'Trasera',largo:800,ancho:600,cantidad:1,espesor:3,material:'MDF',veta:'ninguna',rot:true,obs:''}
  ];
  ej.forEach(p=>STATE.piezas.push({...p,id:uid()}));
  renderPiezas(); toast('Ejemplo cargado','success');
};

/* =========================================================
   PARÁMETROS
   ========================================================= */
function bindParams(){
  const map = {
    prKerf:'kerf', prTolPos:'tolPos', prTolNeg:'tolNeg', prMargenPer:'margenPer',
    prSepMin:'sepMin', prMargenSeg:'margenSeg', prComp:'comp',
    prRotGlobal:'rotGlobal', prVeta:'veta', prCriterio:'criterio'
  };
  Object.entries(map).forEach(([elId,key])=>{
    const el = $(elId);
    el.addEventListener('input', ()=>{
      let v = el.value;
      if(['rotGlobal','veta'].includes(key)) v = (v==='true');
      else if(key!=='criterio') v = +v||0;
      STATE.params[key]=v; saveAuto();
    });
  });
}
function loadParamsUI(){
  $('prKerf').value=STATE.params.kerf;
  $('prTolPos').value=STATE.params.tolPos;
  $('prTolNeg').value=STATE.params.tolNeg;
  $('prMargenPer').value=STATE.params.margenPer;
  $('prSepMin').value=STATE.params.sepMin;
  $('prMargenSeg').value=STATE.params.margenSeg;
  $('prComp').value=STATE.params.comp;
  $('prRotGlobal').value=String(STATE.params.rotGlobal);
  $('prVeta').value=String(STATE.params.veta);
  $('prCriterio').value=STATE.params.criterio;
}

/* =========================================================
   MOTOR DE OPTIMIZACIÓN
   ========================================================= */

/**
 * Aplica tolerancias a una pieza (una sola vez).
 * Retorna {w, h} efectivos en mm.
 * Regla: se aplica tolPos a las dimensiones externas (pieza más grande),
 * y tolNeg se considera como reducción del margen útil entre piezas.
 * El kerf NO se suma a la pieza: se suma al espacio entre piezas al colocar.
 */
// <<ALGO-START (sin DOM; se prueba por separado)
function applyTolerance(p){
  // Piezas importadas de Excel: tolerancia propia por eje (solo +número, ya validada).
  if(p.tolAncho!==undefined || p.tolLargo!==undefined){
    return { w: p.ancho + (p.tolAncho||0), h: p.largo + (p.tolLargo||0) };
  }
  // Piezas capturadas a mano: se conserva el comportamiento anterior.
  const tol = (STATE.params.tolPos||0);
  return { w: p.ancho + tol, h: p.largo + tol };
}

/**
 * Expande piezas en unidades individuales por material+espesor.
 */
function expandPieces(){
  const grouped = {};
  STATE.piezas.forEach(p=>{
    const key = p.material+'|'+p.espesor;
    if(!grouped[key]) grouped[key] = {material:p.material, espesor:p.espesor, pieces:[]};
    for(let i=0;i<p.cantidad;i++){
      const dim = applyTolerance(p);
      grouped[key].pieces.push({
        id: p.id + '_' + i,
        name: p.nombre,
        origId: p.id,
        w: dim.w, h: dim.h,
        veta: p.veta,
        rot: p.rot && !STATE.params.rotGlobal,
        material: p.material,
        espesor: p.espesor
      });
    }
  });
  return grouped;
}

/**
 * Filtra tableros disponibles para un material+espesor.
 */
function getTablerosFor(material, espesor){
  const list = STATE.tableros.filter(t => t.material===material && +t.espesor === +espesor);
  const expanded = [];
  list.forEach(t=>{ for(let i=0;i<t.cantidad;i++) expanded.push({...t, instanceIdx:i}); });
  return expanded;
}

/** Margen total por lado de un tablero. */
function margenTablero(board){
  return STATE.params.margenPer + (board.margen||0) + STATE.params.margenSeg;
}

/**
 * Orientaciones permitidas de una pieza (rotación y veta). Una sola regla para todos los modos.
 * veta 'largo' -> solo normal; veta 'ancho' -> solo girada (si el control de veta está activo).
 */
function orientaciones(piece){
  const normal = {w:piece.w, h:piece.h, rot:false};
  const girada = {w:piece.h, h:piece.w, rot:true};
  if(STATE.params.veta){
    if(piece.veta==='largo') return [normal];
    if(piece.veta==='ancho') return [girada];
  }
  return piece.rot ? [normal, girada] : [normal];
}

/** ¿Cabe la pieza en el tablero (con márgenes), en alguna orientación permitida? */
function pieceFitsInBoard(p, board){
  const m = margenTablero(board);
  const availW = board.ancho - 2*m;
  const availH = board.largo - 2*m;
  return orientaciones(p).some(o => o.w <= availW + 1e-9 && o.h <= availH + 1e-9);
}

/* =========================================================
   MODO 1: GUILLOTINE
   ========================================================= */
/**
 * Guillotine: cada pieza se coloca en la región libre donde mejor encaja
 * (menor sobrante del lado corto) y la región se divide en dos con un corte
 * de sierra (kerf) entre pieza y sobrante. Si una pieza no cabe, se intenta
 * con las siguientes (antes se detenía en la primera que no cabía).
 * opts.keepOrder = true respeta el orden recibido (lo usa el modo mixto).
 */
function optimizeGuillotine(pieces, board, opts){
  const m = margenTablero(board);
  const kerf = STATE.params.kerf;
  const EPS = 0.01;
  const freeRegions = [{x:m, y:m, w:board.ancho-2*m, h:board.largo-2*m}];
  const placed = [], unplaced = [];
  const queue = (opts && opts.keepOrder) ? [...pieces] : [...pieces].sort((a,b)=>(b.w*b.h)-(a.w*a.h));

  function mejorEncaje(piece){
    let best = null;
    freeRegions.forEach((reg,ri)=>{
      for(const o of orientaciones(piece)){
        if(o.w <= reg.w+EPS && o.h <= reg.h+EPS){
          const sobraW = reg.w-o.w, sobraH = reg.h-o.h;
          const score = Math.min(sobraW,sobraH)*1e5 + Math.max(sobraW,sobraH);
          if(!best || score < best.score) best = {ri, o, score};
        }
      }
    });
    return best;
  }

  for(const piece of queue){
    const b = mejorEncaje(piece);
    if(!b){ unplaced.push(piece); continue; }
    const reg = freeRegions[b.ri], o = b.o;
    placed.push({...piece, x:reg.x, y:reg.y, w:o.w, h:o.h, rotated:o.rot, boardId:board.instanceId});
    const rightW = reg.w - o.w - kerf, bottomH = reg.h - o.h - kerf;
    // Opción A: derecha a altura completa + abajo solo bajo la pieza
    const A = [], B = [];
    if(rightW > EPS) A.push({x:reg.x+o.w+kerf, y:reg.y, w:rightW, h:reg.h});
    if(bottomH > EPS) A.push({x:reg.x, y:reg.y+o.h+kerf, w:o.w, h:bottomH});
    // Opción B: abajo a ancho completo + derecha solo junto a la pieza
    if(bottomH > EPS) B.push({x:reg.x, y:reg.y+o.h+kerf, w:reg.w, h:bottomH});
    if(rightW > EPS) B.push({x:reg.x+o.w+kerf, y:reg.y, w:rightW, h:o.h});
    const maxA = A.reduce((s,r)=>Math.max(s,r.w*r.h),0), maxB = B.reduce((s,r)=>Math.max(s,r.w*r.h),0);
    freeRegions.splice(b.ri, 1, ...(maxA >= maxB ? A : B));
  }
  return { placed, unplaced, freeRegions };
}

/* =========================================================
   MODO 2: MAXRECTS (NESTING LIBRE)
   ========================================================= */
function optimizeMaxRects(pieces, board){
  const m = STATE.params.margenPer + (board.margen||0) + STATE.params.margenSeg;
  const kerf = STATE.params.kerf;
  const availW = board.ancho - 2*m;
  const availH = board.largo - 2*m;

  let freeRects = [{x:m, y:m, w:availW, h:availH}];
  const placed = [];

  function intersect(a,b){
    const x1=Math.max(a.x,b.x), y1=Math.max(a.y,b.y);
    const x2=Math.min(a.x+a.w,b.x+b.w), y2=Math.min(a.y+a.h,b.y+b.h);
    if(x2<=x1||y2<=y1) return null;
    return {x:x1,y:y1,w:x2-x1,h:y2-y1};
  }
  function splitFreeRects(used){
    const newFree = [];
    for(const fr of freeRects){
      const inter = intersect(fr, used);
      if(!inter){ newFree.push(fr); continue; }
      // 4 posibles sub-rectángulos
      if(inter.x > fr.x) newFree.push({x:fr.x, y:fr.y, w:inter.x-fr.x, h:fr.h});
      if(inter.x+inter.w < fr.x+fr.w) newFree.push({x:inter.x+inter.w, y:fr.y, w:fr.x+fr.w-(inter.x+inter.w), h:fr.h});
      if(inter.y > fr.y) newFree.push({x:fr.x, y:fr.y, w:fr.w, h:inter.y-fr.y});
      if(inter.y+inter.h < fr.y+fr.h) newFree.push({x:fr.x, y:inter.y+inter.h, w:fr.w, h:fr.y+fr.h-(inter.y+inter.h)});
    }
    // Eliminar rectángulos contenidos
    const pruned = [];
    for(let i=0;i<newFree.length;i++){
      let contained = false;
      for(let j=0;j<newFree.length;j++){
        if(i===j) continue;
        const a=newFree[i], b=newFree[j];
        if(a.x>=b.x && a.y>=b.y && a.x+a.w<=b.x+b.w && a.y+a.h<=b.y+b.h){
          if(!(a.x===b.x && a.y===b.y && a.w===b.w && a.h===b.h) || j<i){
            contained = true; break;
          }
        }
      }
      if(!contained) pruned.push(newFree[i]);
    }
    freeRects = pruned;
  }

  function findBestPosition(piece){
    let best = null;
    for(const fr of freeRects){
      for(const o of orientaciones(piece)){
        if(o.w <= fr.w + 1e-9 && o.h <= fr.h + 1e-9){
          // Heurística: mejor ajuste (menor área sobrante)
          const leftover = (fr.w*fr.h) - (o.w*o.h);
          // Bonus por tocar bordes (borde inferior-izquierdo)
          const touchX = (fr.x === m) ? 1 : 0;
          const touchY = (fr.y === m) ? 1 : 0;
          const score = leftover - (touchX+touchY)*50;
          if(!best || score < best.score){
            best = { x:fr.x, y:fr.y, w:o.w, h:o.h, rot:o.rot, score };
          }
        }
      }
    }
    return best;
  }

  const sorted = [...pieces].sort((a,b)=>(b.w*b.h)-(a.w*a.h));
  const unplaced = [];
  for(const piece of sorted){
    const pos = findBestPosition(piece);
    if(!pos){ unplaced.push(piece); continue; }
    // Colocar con kerf incluido en el rect ocupado
    const occupied = { x:pos.x, y:pos.y, w:pos.w+kerf, h:pos.h+kerf };
    // Pero la pieza real es sin kerf en la posición
    placed.push({
      ...piece, x:pos.x, y:pos.y, w:pos.w, h:pos.h, rotated:pos.rot,
      boardId: board.instanceId
    });
    splitFreeRects(occupied);
  }
  return { placed, unplaced, freeRegions: freeRects };
}

/* =========================================================
   MODO 3: MIXTO / INTELIGENTE
   ========================================================= */
/**
 * El modo mixto ejecuta variantes del guillotine (ordenamientos distintos)
 * y del MaxRects, comparando resultados. Escoge el que deje menos tableros
 * y menos desperdicio, con un desempate por número de cortes estimados.
 */
function optimizeMixed(pieces, board){
  const orden = {
    'Guillotine-área':   [...pieces].sort((a,b)=>(b.w*b.h)-(a.w*a.h)),
    'Guillotine-largo':  [...pieces].sort((a,b)=>Math.max(b.w,b.h)-Math.max(a.w,a.h) || (b.w*b.h)-(a.w*a.h)),
    'Guillotine-ancho':  [...pieces].sort((a,b)=>Math.min(b.w,b.h)-Math.min(a.w,a.h) || (b.w*b.h)-(a.w*a.h))
  };
  const variants = Object.entries(orden).map(([name,list])=>({name, result: optimizeGuillotine(list, board, {keepOrder:true})}));
  variants.push({ name:'MaxRects', result: optimizeMaxRects(pieces, board) });

  // Mejor variante = más área de pieza colocada en este tablero
  let best = variants[0];
  for(const v of variants){
    if(usedArea(v.result.placed) > usedArea(best.result.placed) + 1e-6) best = v;
  }
  return { ...best.result, variantName: best.name, allVariants: variants.map(v=>({
    name:v.name, placed:v.result.placed.length, unplaced:v.result.unplaced.length
  }))};
}

function usedArea(placed){ return placed.reduce((s,p)=>s+p.w*p.h, 0); }

/* =========================================================
   OPTIMIZACIÓN GLOBAL
   ========================================================= */

/**
 * Ejecuta un modo sobre todas las piezas y tableros disponibles.
 * Devuelve un resultado consolidado con boards (cada uno con placed).
 */
function runMode(modeName){
  const grouped = expandPieces();
  const boardsUsed = [];
  let totalCuts = 0;
  const unplacedAll = [];
  const freeLeftovers = [];

  // Modos disponibles
  const modeFns = {
    'guillotine': optimizeGuillotine,
    'maxrects': optimizeMaxRects,
    'mixto': optimizeMixed
  };
  const fn = modeFns[modeName];

  Object.entries(grouped).forEach(([key, group])=>{
    let remaining = [...group.pieces];
    const available = getTablerosFor(group.material, group.espesor);
    let boardIdx = 0;

    // Validación: pieza más grande que el tablero
    const validTab = available[0];
    if(!validTab){
      unplacedAll.push(...remaining.map(p=>({...p, reason:'Sin tablero del material/espesor'})));
      return;
    }

    // Filtrar piezas que no caben
    remaining = remaining.filter(p=>{
      if(!available.some(b=>pieceFitsInBoard(p, b))){
        unplacedAll.push({...p, reason:'Pieza más grande que el tablero'});
        return false;
      }
      return true;
    });

    while(remaining.length > 0 && boardIdx < available.length){
      const board = available[boardIdx];
      board.instanceId = `${key}_B${boardIdx}`;
      const res = fn(remaining, board);
      if(res.placed.length === 0){
        boardIdx++;
        continue;
      }
      boardsUsed.push({
        id: board.instanceId,
        board,
        placed: res.placed,
        freeRegions: res.freeRegions || [],
        mode: modeName,
        variantName: res.variantName || null
      });
      remaining = res.unplaced;
      boardIdx++;
      totalCuts += estimateCuts(res.placed, modeName);
    }
    if(remaining.length > 0){
      unplacedAll.push(...remaining.map(p=>({...p, reason:'Sin tableros suficientes'})));
    }
  });

  const totalEsperado = Object.values(grouped).reduce((n,g)=>n+g.pieces.length,0);
  const out = { mode: modeName, boards: boardsUsed, unplaced: unplacedAll, totalCuts };
  out.validation = validarResultado(out, totalEsperado);
  return out;
}

/**
 * Verifica un resultado: piezas dentro del tablero (con márgenes), separación de sierra
 * entre piezas y que colocadas + no colocadas = piezas esperadas. Devuelve lista de errores.
 */
function validarResultado(result, totalEsperado){
  const errs = [], kerf = STATE.params.kerf, EPS = 0.01;
  result.boards.forEach(b=>{
    const m = margenTablero(b.board);
    b.placed.forEach((p,i)=>{
      if(p.x < m-EPS || p.y < m-EPS || p.x+p.w > b.board.ancho-m+EPS || p.y+p.h > b.board.largo-m+EPS)
        errs.push(`${b.id}: "${p.name}" excede el tablero`);
      for(let j=i+1;j<b.placed.length;j++){
        const q = b.placed[j];
        const sepX = Math.max(q.x-(p.x+p.w), p.x-(q.x+q.w));
        const sepY = Math.max(q.y-(p.y+p.h), p.y-(q.y+q.h));
        if(Math.max(sepX,sepY) < kerf-EPS) errs.push(`${b.id}: "${p.name}" y "${q.name}" sin separación de corte`);
      }
    });
  });
  const colocadas = result.boards.reduce((n,b)=>n+b.placed.length,0);
  if(totalEsperado!==undefined && colocadas + result.unplaced.length !== totalEsperado)
    errs.push(`Cantidad inconsistente: ${colocadas} colocadas + ${result.unplaced.length} sin colocar ≠ ${totalEsperado}`);
  return errs;
}

function estimateCuts(placed, mode){
  if(placed.length === 0) return 0;
  if(mode === 'maxrects'){
    return placed.length * 4; // Estimación: 4 cortes por pieza (libre)
  }
  // Guillotine: número de subdivisiones ~ piezas + regiones
  return placed.length + 1;
}

/**
 * Calcula métricas de un resultado.
 */
function computeMetrics(result){
  const placed = result.boards.flatMap(b=>b.placed);
  const areaPiezas = placed.reduce((s,p)=>s + (p.w*p.h), 0);
  const areaTableros = result.boards.reduce((s,b)=>s + (b.board.ancho * b.board.largo), 0);
  const desperdicio = Math.max(0, areaTableros - areaPiezas);
  const aprovechamiento = areaTableros > 0 ? (areaPiezas/areaTableros)*100 : 0;
  const costo = result.boards.reduce((s,b)=>s + (b.board.precio||0), 0);
  const costoDesperdicio = areaTableros > 0 ? costo * (desperdicio/areaTableros) : 0;
  const sobrantesReutilizables = result.boards.reduce((s,b)=>s + countReusable(b), 0);
  return {
    tableros: result.boards.length,
    piezasColocadas: placed.length,
    piezasTotal: placed.length + result.unplaced.length,
    areaPiezas, areaTableros, desperdicio, aprovechamiento,
    costo, costoDesperdicio, cortes: result.totalCuts,
    sobrantes: sobrantesReutilizables,
    unplaced: result.unplaced.length
  };
}

function countReusable(board){
  // Región libre con ambos lados >= 200mm se considera reutilizable
  return board.freeRegions.filter(r=>r.w>=200 && r.h>=200).length;
}
// <<ALGO-END
/* =========================================================
   BOTÓN PRINCIPAL: CALCULAR
   ========================================================= */
$('btnOptimize').onclick = ()=>{
  if(STATE.tableros.length === 0){ toast('Registra al menos un tablero','error'); return; }
  if(STATE.piezas.length === 0){ toast('Registra al menos una pieza','error'); return; }

  const bar = $('optProgress');
  bar.style.display='block';
  bar.firstElementChild.style.width='10%';

  setTimeout(()=>{
    bar.firstElementChild.style.width='30%';
    const rG = runMode('guillotine');
    bar.firstElementChild.style.width='55%';
    const rM = runMode('maxrects');
    bar.firstElementChild.style.width='80%';
    const rX = runMode('mixto');
    bar.firstElementChild.style.width='100%';

    const results = [
      { name:'Guillotine', result:rG, metrics: computeMetrics(rG), status:'Solución heurística' },
      { name:'MaxRects', result:rM, metrics: computeMetrics(rM), status:'Solución heurística' },
      { name:'Mixto', result:rX, metrics: computeMetrics(rX), status: rX.unplaced.length===0 ? 'Mejor evaluada (no demostrada óptima)' : 'Solución heurística' }
    ];

    const fallas = [rG,rM,rX].flatMap(r=>r.validation||[]);
    if(fallas.length){ console.error('Validación de optimización:', fallas); toast('⚠️ La validación detectó '+fallas.length+' problema(s); revisa la consola','error'); }
    STATE.lastResult = results;
    renderComparison(results);
    renderPlanoSelector(results);
    renderSavings(results);
    $('savingsCard').style.display='block';
    setTimeout(()=>bar.style.display='none', 500);
    toast('Optimización completada','success');
  }, 60);
};

function pickBest(results){
  const crit = STATE.params.criterio;
  const score = (m)=>{
    if(crit==='tableros') return m.tableros + (m.unplaced>0?1000:0);
    if(crit==='desperdicio') return m.desperdicio + (m.unplaced>0?1e7:0);
    if(crit==='costo') return m.costo + (m.unplaced>0?1e7:0);
    if(crit==='cortes') return m.cortes + (m.unplaced>0?10000:0);
    return 0;
  };
  return results.reduce((a,b)=> score(a.metrics) <= score(b.metrics) ? a : b);
}

function renderComparison(results){
  const tbody = $('tablaComparacion').querySelector('tbody');
  tbody.innerHTML='';
  const best = pickBest(results);
  results.forEach(r=>{
    const m = r.metrics;
    const tr = document.createElement('tr');
    if(r===best) tr.classList.add('best-row');
    tr.innerHTML = `
      <td><b>${r.name}</b></td>
      <td>${m.tableros}</td>
      <td>${fmt(m.areaPiezas)} mm²</td>
      <td>${fmt(m.areaTableros)} mm²</td>
      <td>${fmt(m.desperdicio)} mm²</td>
      <td>${m.aprovechamiento.toFixed(2)}%</td>
      <td>${m.cortes}</td>
      <td>$${fmt(m.costo,2)}</td>
      <td>${r.status}${m.unplaced>0?' · '+m.unplaced+' sin colocar':''}</td>`;
    tbody.appendChild(tr);
  });
  $('comparisonCard').style.display='block';
  $('bestModeBox').innerHTML = `✅ Mejor resultado según criterio <b>"${STATE.params.criterio}"</b>: <b>${best.name}</b> — ${best.metrics.tableros} tableros, ${best.metrics.aprovechamiento.toFixed(2)}% aprovechamiento.`;
  $('statModo').textContent = best.name;
  $('statAprov').textContent = best.metrics.aprovechamiento.toFixed(1)+'%';
}

function renderSavings(results){
  // Referencia = Guillotine básico (nuestro método menos optimizado entre los 3)
  const ref = results.find(r=>r.name==='Guillotine');
  const best = pickBest(results);
  if(!ref || !best) return;
  const tabAhorrados = ref.metrics.tableros - best.metrics.tableros;
  const areaAhorrada = (ref.metrics.areaTableros - best.metrics.areaTableros)/1e6; // m²
  const ahorroMoney = ref.metrics.costo - best.metrics.costo;
  $('saveTab').textContent = tabAhorrados;
  $('saveM2').textContent = areaAhorrada.toFixed(3)+' m²';
  $('saveMoney').textContent = '$'+fmt(ahorroMoney,2);
  $('saveWaste').textContent = best.metrics.desperdicio>0 ? fmt(best.metrics.desperdicio/1e6,3)+' m²' : '0';
  $('savingsNote').innerHTML = `Método de referencia: <b>Guillotine básico</b> (el más simple de los tres). ` +
    `El ahorro mostrado es la diferencia entre ese método y el mejor según el criterio <b>"${STATE.params.criterio}"</b>. ` +
    `No se trata de un óptimo matemático demostrado, sino del mejor resultado encontrado por nuestras heurísticas.`;
}

/* =========================================================
   PLANOS (SVG)
   ========================================================= */
let currentPlanData = null;

function renderPlanoSelector(results){
  const best = pickBest(results);
  STATE.bestResult = best.result;
  const boards = best.result.boards;
  const sel = $('selTableroPlano');
  sel.innerHTML='';
  boards.forEach((b,i)=>{
    const o = document.createElement('option');
    o.value = i;
    o.textContent = `Tablero ${i+1} — ${b.board.nombre} (${b.board.ancho}×${b.board.largo})`;
    sel.appendChild(o);
  });
  $('planosControls').style.display = boards.length?'block':'none';
  sel.onchange = ()=> drawPlano(+sel.value);
  ['chkShowDims','chkShowCuts','chkShowVeta','chkShowLabels'].forEach(id=>{
    $(id).onchange = ()=> drawPlano(+$('selTableroPlano').value);
  });
  $('btnZoomIn').onclick = ()=>{ STATE.zoom=Math.min(3,STATE.zoom+0.2); applyZoom(); };
  $('btnZoomOut').onclick = ()=>{ STATE.zoom=Math.max(0.3,STATE.zoom-0.2); applyZoom(); };
  $('btnZoomReset').onclick = ()=>{ STATE.zoom=1; applyZoom(); };
  if(boards.length) drawPlano(0);
  else $('planoContainer').innerHTML = '<p class="empty-msg">No hay tableros utilizados.</p>';
}

function applyZoom(){
  const svg = $('planoContainer').querySelector('svg');
  if(svg) svg.style.transform = `scale(${STATE.zoom})`;
}

function drawPlano(idx){
  const boards = STATE.bestResult?.boards || [];
  const b = boards[idx]; if(!b) return;
  const board = b.board;
  const placed = b.placed;

  const W = board.ancho, H = board.largo;
  const pad = 40;
  const scale = Math.min(900/(W+pad*2), 700/(H+pad*2), 1.2);
  const svgW = (W+pad*2)*scale;
  const svgH = (H+pad*2)*scale;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS,'svg');
  svg.setAttribute('class','plano-svg');
  svg.setAttribute('width', svgW);
  svg.setAttribute('height', svgH);
  svg.setAttribute('viewBox', `0 0 ${svgW} ${svgH}`);

  // Fondo tablero
  const boardRect = document.createElementNS(svgNS,'rect');
  boardRect.setAttribute('x', pad*scale);
  boardRect.setAttribute('y', pad*scale);
  boardRect.setAttribute('width', W*scale);
  boardRect.setAttribute('height', H*scale);
  boardRect.setAttribute('fill', board.color || '#e8e8e8');
  boardRect.setAttribute('stroke', '#334155');
  boardRect.setAttribute('stroke-width', 2);
  svg.appendChild(boardRect);

  // Margen perimetral
  const m = STATE.params.margenPer + (board.margen||0) + STATE.params.margenSeg;
  const marginRect = document.createElementNS(svgNS,'rect');
  marginRect.setAttribute('x', (pad+m)*scale);
  marginRect.setAttribute('y', (pad+m)*scale);
  marginRect.setAttribute('width', (W-2*m)*scale);
  marginRect.setAttribute('height', (H-2*m)*scale);
  marginRect.setAttribute('fill','none');
  marginRect.setAttribute('stroke', '#94a3b8');
  marginRect.setAttribute('stroke-dasharray','4 3');
  marginRect.setAttribute('stroke-width', 1);
  svg.appendChild(marginRect);
  // Piezas
  const showCuts = $('chkShowCuts').checked;
  const showDims = $('chkShowDims').checked;
  const showVeta = $('chkShowVeta').checked;
  const showLabels = $('chkShowLabels').checked;

  placed.forEach((p,i)=>{
    const color = hslColorFromString(p.material + p.name);
    const x = (pad + p.x)*scale;
    const y = (pad + p.y)*scale;
    const w = p.w*scale;
    const h = p.h*scale;

    const rect = document.createElementNS(svgNS,'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('fill', color);
    rect.setAttribute('fill-opacity', 0.75);
    rect.setAttribute('stroke', showCuts ? '#0f172a' : 'transparent');
    rect.setAttribute('stroke-width', showCuts ? 1 : 0);
    svg.appendChild(rect);

    // Etiqueta
    if(showLabels){
      const label = document.createElementNS(svgNS,'text');
      label.setAttribute('x', x + w/2);
      label.setAttribute('y', y + h/2);
      label.setAttribute('text-anchor','middle');
      label.setAttribute('dominant-baseline','middle');
      label.setAttribute('font-size', Math.max(9, Math.min(14, w/8)));
      label.setAttribute('fill','#0f172a');
      label.setAttribute('font-weight','600');
      if(w > 50 && h > 20){
        label.textContent = p.name.substring(0,14);
        svg.appendChild(label);
        if(showDims && h > 40){
          const dim = document.createElementNS(svgNS,'text');
          dim.setAttribute('x', x + w/2);
          dim.setAttribute('y', y + h/2 + 15);
          dim.setAttribute('text-anchor','middle');
          dim.setAttribute('font-size', Math.max(8, Math.min(12, w/10)));
          dim.setAttribute('fill','#334155');
          dim.textContent = `${Math.round(p.w)}×${Math.round(p.h)}`;
          svg.appendChild(dim);
        }
      } else {
        // Etiqueta externa con número
        label.textContent = (i+1);
        label.setAttribute('fill','#fff');
        label.setAttribute('font-size', 10);
        svg.appendChild(label);
      }
    }

    // Veta: flecha
    if(showVeta && p.veta !== 'ninguna'){
      const arrow = document.createElementNS(svgNS,'line');
      let ax1, ay1, ax2, ay2;
      if(p.veta === 'largo'){
        ax1 = x + w/2; ay1 = y + h*0.2; ax2 = x + w/2; ay2 = y + h*0.8;
      } else {
        ax1 = x + w*0.2; ay1 = y + h/2; ax2 = x + w*0.8; ay2 = y + h/2;
      }
      arrow.setAttribute('x1', ax1); arrow.setAttribute('y1', ay1);
      arrow.setAttribute('x2', ax2); arrow.setAttribute('y2', ay2);
      arrow.setAttribute('stroke', '#7c2d12');
      arrow.setAttribute('stroke-width', 1.5);
      arrow.setAttribute('marker-end','url(#arrowhead)');
      svg.appendChild(arrow);
    }
  });

  // Definición de flecha
  const defs = document.createElementNS(svgNS,'defs');
  defs.innerHTML = `<marker id="arrowhead" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto">
    <polygon points="0,0 6,3 0,6" fill="#7c2d12"/></marker>`;
  svg.appendChild(defs);

  // Dimensiones del tablero
  const dimLabel = document.createElementNS(svgNS,'text');
  dimLabel.setAttribute('x', svgW/2);
  dimLabel.setAttribute('y', svgH - 8);
  dimLabel.setAttribute('text-anchor','middle');
  dimLabel.setAttribute('font-size', 12);
  dimLabel.setAttribute('fill','#334155');
  dimLabel.setAttribute('font-weight','600');
  dimLabel.textContent = `${board.nombre} — ${W} × ${H} mm`;
  svg.appendChild(dimLabel);

  const container = $('planoContainer');
  container.innerHTML='';
  container.appendChild(svg);
  svg.style.transform = `scale(${STATE.zoom})`;

  currentPlanData = { board, placed, svgW, svgH };
}

function hslColorFromString(str){
  let hash = 0;
  for(let i=0;i<str.length;i++) hash = str.charCodeAt(i) + ((hash<<5)-hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 72%)`;
}

/* =========================================================
   HOJA DE CORTE
   ========================================================= */
$('btnGenHoja').onclick = ()=>{
  if(!STATE.bestResult){ toast('Ejecuta primero la optimización','error'); return; }
  const proyecto = $('hojaProyecto').value.trim() || 'Sin nombre';
  const operador = $('hojaOperador').value.trim();
  const fecha = $('hojaFecha').value || new Date().toISOString().slice(0,10);
  const cont = $('hojaOutput');
  cont.innerHTML = '';

  STATE.bestResult.boards.forEach((b, idx)=>{
    const div = document.createElement('div');
    div.className = 'hoja-doc';
    div.innerHTML = `
      <h2>Hoja de corte — Tablero ${idx+1}</h2>
      <div class="hoja-meta">
        <div class="row"><span>Proyecto:</span><b>${escapeHtml(proyecto)}</b></div>
        <div class="row"><span>Operador:</span><b>${escapeHtml(operador)||'—'}</b></div>
        <div class="row"><span>Fecha:</span><b>${fecha}</b></div>
        <div class="row"><span>Material:</span><b>${b.board.material}</b></div>
        <div class="row"><span>Medidas tablero:</span><b>${b.board.ancho}×${b.board.largo} mm</b></div>
        <div class="row"><span>Espesor:</span><b>${b.board.espesor} mm</b></div>
        <div class="row"><span>Kerf:</span><b>${STATE.params.kerf} mm</b></div>
        <div class="row"><span>Tolerancias:</span><b>+${STATE.params.tolPos} / -${STATE.params.tolNeg}</b></div>
      </div>
      <div class="hoja-plano" id="hojaPlano${idx}"></div>
      <h3 style="margin-top:18px">Piezas en este tablero</h3>
      <table class="data-table">
        <thead><tr><th>#</th><th>Pieza</th><th>Largo</th><th>Ancho</th><th>Rotada</th><th>Veta</th></tr></thead>
        <tbody>
          ${b.placed.map((p,i)=>`<tr>
            <td>${i+1}</td><td>${escapeHtml(p.name)}</td>
            <td>${Math.round(p.h)}</td><td>${Math.round(p.w)}</td>
            <td>${p.rotated?'Sí':'No'}</td>
            <td>${p.veta}</td></tr>`).join('')}
        </tbody>
      </table>
      <p style="margin-top:14px;font-size:12px;color:#64748b">
        Secuencia sugerida: cortes horizontales de izquierda a derecha, luego verticales de arriba hacia abajo. 
        Respétese la veta indicada con flechas.
      </p>`;
    cont.appendChild(div);
  });

  // Dibujar mini planos en la hoja
  setTimeout(()=>{
    STATE.bestResult.boards.forEach((b, idx)=>{
      const target = $('hojaPlano'+idx);
      if(!target) return;
      // Clonar el plano del tablero correspondiente
      const prevIdx = +$('selTableroPlano').value;
      $('selTableroPlano').value = idx;
      drawPlano(idx);
      const svg = $('planoContainer').querySelector('svg').cloneNode(true);
      svg.style.transform = 'none';
      target.appendChild(svg);
      $('selTableroPlano').value = prevIdx;
    });
    drawPlano(+$('selTableroPlano').value);
    toast('Hoja de corte generada','success');
  }, 30);
};

$('btnPrintHoja').onclick = ()=>{
  if($('hojaOutput').children.length===0){ toast('Genera primero la hoja','error'); return; }
  window.print();
};
/* =========================================================
   SOBRANTES
   ========================================================= */
function renderSobrantes(){
  const tbody = $('tablaSobrantes').querySelector('tbody');
  tbody.innerHTML='';
  STATE.sobrantes.forEach((s,i)=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${s.largo}</td><td>${s.ancho}</td><td>${s.espesor}</td>
      <td>${s.material}</td><td>${s.veta}</td><td>${escapeHtml(s.origen||'')}</td>
      <td><button class="icon-btn del" data-del="${i}">🗑</button></td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-del]').forEach(b=>b.onclick=()=>{
    STATE.sobrantes.splice(+b.dataset.del,1); renderSobrantes();
  });
  saveAuto();
}
$('btnAddSobrante').onclick = ()=>{
  const s = {
    largo:+$('sLargo').value, ancho:+$('sAncho').value, espesor:+$('sEspesor').value,
    material:$('sMaterial').value, veta:$('sVeta').value, origen:$('sOrigen').value.trim()
  };
  if(s.largo<=0||s.ancho<=0){ toast('Medidas inválidas','error'); return; }
  STATE.sobrantes.push(s); renderSobrantes(); toast('Sobrante agregado','success');
};
$('btnGenSobrantes').onclick = ()=>{
  if(!STATE.bestResult){ toast('Ejecuta primero la optimización','error'); return; }
  let count=0;
  STATE.bestResult.boards.forEach(b=>{
    (b.freeRegions||[]).forEach(r=>{
      if(r.w>=200 && r.h>=200){
        STATE.sobrantes.push({
          largo: Math.round(r.h), ancho: Math.round(r.w),
          espesor: b.board.espesor, material: b.board.material,
          veta: b.board.veta, origen: b.id
        });
        count++;
      }
    });
  });
  renderSobrantes();
  toast(count+' sobrantes detectados','success');
};

/* =========================================================
   IMPORTAR EXCEL
   Reglas: solo entran los renglones cuya UNIDAD esté en la lista
   válida (por defecto HOJA); las tolerancias solo se suman si la
   celda tiene formato +número; ancho y largo se procesan por
   separado; las medidas originales se conservan en la pieza.
   ========================================================= */

// <<PURE-START (lógica sin DOM; se prueba por separado)
const normTxt = s => String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const round2 = n => Math.round(n*100)/100;

/** Tolerancia válida solo si la celda es TEXTO con formato +número (ej. "+2", "+0.5").
 *  Todo lo demás (vacío, 0, 2, -2, N/A, ESC, X, texto) = 0. */
function parseTolerancia(raw){
  if(typeof raw !== 'string') return 0;
  const m = raw.trim().match(/^\+(\d+(?:\.\d+)?)$/);
  return m ? parseFloat(m[1]) : 0;
}

function parseNum(raw){
  if(typeof raw === 'number') return raw;
  const s = String(raw==null?'':raw).trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(s) ? parseFloat(s) : NaN;
}

const IMPORT_FIELDS = [
  {id:'mapNombre',   key:'nombre',   label:'Nombre',            auto:['description','descripcion','nombre','pieza']},
  {id:'mapUnidad',   key:'unidad',   label:'Unidad',            auto:['unidad','unit']},
  {id:'mapAncho',    key:'ancho',    label:'Ancho',             auto:['ancho','width']},
  {id:'mapTolAncho', key:'tolAncho', label:'Ancho tolerancia',  auto:['ancho tolerancia','tolerancia ancho','tol ancho']},
  {id:'mapLargo',    key:'largo',    label:'Largo',             auto:['largo','long','alto','height']},
  {id:'mapTolLargo', key:'tolLargo', label:'Largo tolerancia',  auto:['largo tolerancia','tolerancia largo','tol largo']},
  {id:'mapCant',     key:'cantidad', label:'Cantidad',          auto:['cant/mueble','cantidad','cant','qty']},
  {id:'mapEspesor',  key:'espesor',  label:'Espesor / Grueso',  auto:['grueso','espesor','thickness']},
  {id:'mapMaterial', key:'material', label:'Material',          auto:['material']},
  {id:'mapVeta',     key:'veta',     label:'Veta',              auto:['veta','grain']}
];

function detectarColumna(cols, f){
  const names = cols.map(normTxt);
  const esTol = f.key.startsWith('tol');
  for(const a of f.auto){ const i = names.indexOf(a); if(i>=0) return i; }
  for(const a of f.auto){
    const i = names.findIndex(n => n.includes(a) && (esTol || !n.includes('toler')));
    if(i>=0) return i;
  }
  return -1;
}

/**
 * Procesa las filas del Excel. No modifica el Excel ni STATE.
 * map: {nombre,unidad,ancho,tolAncho,largo,tolLargo,cantidad,espesor,material,veta} -> índice de columna o -1
 * opts: {unidades:['HOJA'], factor:10 (cm->mm), fileName}
 */
function procesarFilasExcel(rows, map, opts){
  const unidades = (opts.unidades||[]).map(u=>u.trim().toUpperCase()).filter(Boolean);
  const factor = opts.factor || 1;
  const items = [], warnings = [];
  if(map.unidad < 0) warnings.push('No se mapeó la columna Unidad: sin ella no se puede decidir qué renglones optimizar.');
  if(!unidades.length) warnings.push('No hay unidades válidas definidas.');

  for(let i=1;i<rows.length;i++){
    const row = rows[i];
    if(!row || row.every(c=>c===''||c==null)) continue;
    const get = k => map[k]>=0 ? row[map[k]] : '';
    const it = {
      fila:i+1, nombre:String(get('nombre')||('Pieza '+i)).trim(),
      unidad:String(get('unidad')).trim().toUpperCase(),
      material:String(get('material')).trim(),
      tolAnchoTxt:String(get('tolAncho')), tolLargoTxt:String(get('tolLargo')),
      estado:'ok', motivo:''
    };
    items.push(it);
    if(map.unidad < 0){ it.estado='ignorada'; it.motivo='Sin columna Unidad'; continue; }
    if(!it.unidad){ it.estado='ignorada'; it.motivo='Unidad vacía'; warnings.push(`Fila ${it.fila}: unidad vacía, no se importa.`); continue; }
    if(!unidades.includes(it.unidad)){ it.estado='ignorada'; it.motivo='Unidad '+it.unidad+' no optimizable'; continue; }

    const ancho = parseNum(get('ancho')), largo = parseNum(get('largo'));
    if(!(ancho>0) || !(largo>0)){ it.estado='error'; it.motivo='Falta ancho o largo'; warnings.push(`Fila ${it.fila}: falta ancho o largo.`); continue; }
    if(!it.material){ it.estado='error'; it.motivo='Falta material'; warnings.push(`Fila ${it.fila}: falta material.`); continue; }

    let cant = parseNum(get('cantidad'));
    if(!(cant>0)){ it.estado='error'; it.motivo='Falta cantidad'; warnings.push(`Fila ${it.fila}: falta cantidad.`); continue; }
    if(!Number.isInteger(cant)){ warnings.push(`Fila ${it.fila}: cantidad ${cant} no es entera, se redondea hacia arriba a ${Math.ceil(cant)}.`); cant = Math.ceil(cant); }

    let esp = parseNum(get('espesor'));
    if(esp>0) esp = round2(esp*factor);
    else {
      const m = it.material.match(/(\d+(?:\.\d+)?)\s*MM/i);
      if(m) esp = parseFloat(m[1]); else esp = NaN;
    }
    if(!(esp>0)){ it.estado='error'; it.motivo='Falta espesor'; warnings.push(`Fila ${it.fila}: falta espesor.`); continue; }

    const vetaRaw = normTxt(get('veta'));
    const veta = vetaRaw.includes('largo') ? 'largo' : vetaRaw.includes('ancho') ? 'ancho' : 'ninguna';

    it.ancho = round2(ancho*factor); it.largo = round2(largo*factor);
    it.tolAncho = round2(parseTolerancia(get('tolAncho'))*factor);
    it.tolLargo = round2(parseTolerancia(get('tolLargo'))*factor);
    it.anchoFinal = round2(it.ancho + it.tolAncho); it.largoFinal = round2(it.largo + it.tolLargo);
    it.cantidad = cant; it.espesor = esp; it.veta = veta;
    it.srcKey = (opts.fileName||'excel') + '#' + it.fila;
  }
  return { items, warnings };
}
// <<PURE-END

let _excelFileName = 'excel';

$('excelFile').onchange = (e)=>{
  const file = e.target.files[0]; if(!file) return;
  _excelFileName = file.name;
  const reader = new FileReader();
  reader.onload = evt=>{
    try{
      const data = new Uint8Array(evt.target.result);
      const wb = XLSX.read(data, {type:'array'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:'', raw:true});
      if(rows.length < 2){ toast('Archivo vacío o sin datos','error'); return; }
      STATE.excelRows = rows;
      STATE.excelCols = rows[0];
      showExcelMapping();
    }catch(err){
      console.error(err);
      toast('Error leyendo el Excel','error');
    }
  };
  reader.readAsArrayBuffer(file);
};

function showExcelMapping(){
  const cols = STATE.excelCols;
  const container = $('excelMapFields');
  container.innerHTML = '';
  IMPORT_FIELDS.forEach(f=>{
    const label = document.createElement('label');
    label.textContent = f.label;
    const sel = document.createElement('select');
    sel.id = f.id;
    sel.innerHTML = '<option value="-1">— no importar —</option>';
    cols.forEach((c,i)=>{
      const opt = document.createElement('option');
      opt.value = i; opt.textContent = c || ('Col '+(i+1));
      sel.appendChild(opt);
    });
    const idx = detectarColumna(cols, f);
    if(idx>=0) sel.value = idx;
    label.appendChild(sel);
    container.appendChild(label);
  });
  $('excelMapCard').style.display='block';
  document.querySelectorAll('#excelMapFields select').forEach(s=>s.onchange = updateExcelPreview);
  $('impUnidades').oninput = updateExcelPreview;
  $('impUnidadMedida').onchange = updateExcelPreview;
  updateExcelPreview();
}

function getImportMapping(){
  const m = {};
  IMPORT_FIELDS.forEach(f=>{ const el=$(f.id); m[f.key] = el ? +el.value : -1; });
  return m;
}
function getImportOpts(){
  return {
    unidades: $('impUnidades').value.split(','),
    factor: +$('impUnidadMedida').value || 1,
    fileName: _excelFileName
  };
}

function updateExcelPreview(){
  const rows = STATE.excelRows; if(!rows) return;
  const cols = STATE.excelCols;
  const mapping = getImportMapping();

  // Vista previa del Excel original (sin modificar)
  const thead = $('excelPreviewTable').querySelector('thead');
  const tbody = $('excelPreviewTable').querySelector('tbody');
  thead.innerHTML = '<tr>' + cols.map(c=>`<th>${escapeHtml(String(c))}</th>`).join('') + '</tr>';
  tbody.innerHTML = '';
  const mapped = Object.values(mapping);
  for(let i=1;i<Math.min(rows.length, 30);i++){
    const tr = document.createElement('tr');
    tr.innerHTML = rows[i].map((c,j)=>{
      const val = c===undefined?'':c;
      return `<td style="${mapped.includes(j)?'background:#f0f9ff':''}">${escapeHtml(String(val))}</td>`;
    }).join('');
    tbody.appendChild(tr);
  }
  $('excelRowCount').textContent = `(${rows.length-1} filas detectadas)`;
  $('excelPreviewCard').style.display='block';

  // Revisión previa: qué renglones entran y con qué medidas
  const res = procesarFilasExcel(rows, mapping, getImportOpts());
  const ok = res.items.filter(x=>x.estado==='ok');
  const ign = res.items.filter(x=>x.estado==='ignorada').length;
  const err = res.items.filter(x=>x.estado==='error').length;
  const piezasTot = ok.reduce((s,x)=>s+x.cantidad,0);
  $('excelWarnings').innerHTML =
    `<b>${ok.length}</b> renglones entran a optimización (${piezasTot} piezas) · ${ign} ignorados por unidad · ${err} con error` +
    (res.warnings.length ? '<br>⚠️ ' + res.warnings.slice(0,12).map(escapeHtml).join('<br>⚠️ ') + (res.warnings.length>12?`<br>… y ${res.warnings.length-12} más`:'') : '');
  $('excelReviewTable').querySelector('thead').innerHTML =
    '<tr><th>Fila</th><th>Descripción</th><th>Unidad</th><th>Material</th><th>Esp. (mm)</th><th>Cant.</th>'+
    '<th>Ancho orig → final</th><th>Tol. ancho</th><th>Largo orig → final</th><th>Tol. largo</th><th>Estado</th></tr>';
  const rb = $('excelReviewTable').querySelector('tbody');
  rb.innerHTML = '';
  res.items.slice(0,400).forEach(x=>{
    const tr = document.createElement('tr');
    const bg = x.estado==='ignorada' ? '#f1f5f9;color:#94a3b8' : x.estado==='error' ? '#fee2e2' : '';
    tr.style.cssText = bg ? 'background:'+bg : '';
    const med = (o,f,t)=> x.estado==='ok' ? `${fmt(o,1)} → <b>${fmt(f,1)}</b>` : '';
    tr.innerHTML = `<td>${x.fila}</td><td>${escapeHtml(x.nombre)}</td><td>${escapeHtml(x.unidad)}</td><td>${escapeHtml(x.material)}</td>`+
      `<td>${x.estado==='ok'?fmt(x.espesor,1):''}</td><td>${x.estado==='ok'?x.cantidad:''}</td>`+
      `<td>${med(x.ancho,x.anchoFinal)}</td><td>${escapeHtml(x.tolAnchoTxt)}</td>`+
      `<td>${med(x.largo,x.largoFinal)}</td><td>${escapeHtml(x.tolLargoTxt)}</td>`+
      `<td>${x.estado==='ok'?'✅ Entra':x.estado==='ignorada'?escapeHtml(x.motivo):'❌ '+escapeHtml(x.motivo)}</td>`;
    rb.appendChild(tr);
  });
  $('excelReviewCard').style.display='block';
}

function ensureOption(selId, value){
  const sel = $(selId); if(!sel) return;
  if(![...sel.options].some(o=>o.value===value || o.text===value)){
    const o = document.createElement('option'); o.textContent = value; sel.appendChild(o);
  }
}

$('btnConfirmImport').onclick = ()=>{
  const rows = STATE.excelRows; if(!rows) return;
  const res = procesarFilasExcel(rows, getImportMapping(), getImportOpts());
  const ok = res.items.filter(x=>x.estado==='ok');
  const errores = res.items.filter(x=>x.estado==='error').length;
  const existentes = new Set(STATE.piezas.map(p=>p.srcKey).filter(Boolean));
  let count = 0, dup = 0;
  const combos = new Set();
  ok.forEach(x=>{
    if(existentes.has(x.srcKey)){ dup++; return; }
    STATE.piezas.push({
      id: uid(), nombre: x.nombre, largo: x.largo, ancho: x.ancho,
      cantidad: x.cantidad, espesor: x.espesor, material: x.material,
      veta: x.veta, rot: x.veta==='ninguna', obs: '',
      unidad: x.unidad, tolAncho: x.tolAncho, tolLargo: x.tolLargo,
      tolAnchoTxt: x.tolAnchoTxt, tolLargoTxt: x.tolLargoTxt, srcKey: x.srcKey
    });
    ensureOption('pMaterial', x.material); ensureOption('tMaterial', x.material);
    combos.add(x.material+'|'+x.espesor);
    count++;
  });
  // Tablero estándar 2440×1220 para cada material/espesor sin tablero registrado
  let nuevos = 0;
  combos.forEach(k=>{
    const [mat, esp] = k.split('|'); const e = +esp;
    if(!STATE.tableros.some(t=>t.material===mat && +t.espesor===e)){
      STATE.tableros.push({id:uid(), nombre:`${mat} (auto)`, material:mat, largo:2440, ancho:1220,
        espesor:e, precio:0, color:'#c8a878', veta:'largo', cantidad:50, margen:0});
      nuevos++;
    }
  });
  renderPiezas(); renderTableros();
  const msg = `Importadas ${count} piezas` + (dup?` · ${dup} ya existían`:'') + (errores?` · ${errores} con error`:'') + (nuevos?` · ${nuevos} tableros 2440×1220 creados`:'');
  toast(msg, errores?'error':'success');
};

/* =========================================================
   EXPORTAR
   ========================================================= */
function exportXLS(filename, sheets){
  const wb = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows])=>{
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, name);
  });
  XLSX.writeFile(wb, filename);
}
$('btnExportTableros').onclick = $('btnExpTabXls').onclick = ()=>{
  if(!STATE.tableros.length){ toast('Sin tableros','error'); return; }
  const rows = [['Nombre','Material','Largo','Ancho','Espesor','Precio','Color','Veta','Cantidad']];
  STATE.tableros.forEach(t=>rows.push([t.nombre,t.material,t.largo,t.ancho,t.espesor,t.precio,t.color,t.veta,t.cantidad]));
  exportXLS('tableros.xlsx', {Tableros:rows});
  toast('Excel exportado','success');
};
$('btnExportPiezas').onclick = $('btnExpPiezasXls').onclick = ()=>{
  if(!STATE.piezas.length){ toast('Sin piezas','error'); return; }
  const rows = [['Nombre','Largo','Ancho','Cantidad','Espesor','Material','Veta','Rotacion','Obs']];
  STATE.piezas.forEach(p=>rows.push([p.nombre,p.largo,p.ancho,p.cantidad,p.espesor,p.material,p.veta,p.rot?'Sí':'No',p.obs]));
  exportXLS('piezas.xlsx', {Piezas:rows});
  toast('Excel exportado','success');
};
$('btnExpSobXls').onclick = $('btnExportSobrantes').onclick = ()=>{
  if(!STATE.sobrantes.length){ toast('Sin sobrantes','error'); return; }
  const rows = [['Largo','Ancho','Espesor','Material','Veta','Origen']];
  STATE.sobrantes.forEach(s=>rows.push([s.largo,s.ancho,s.espesor,s.material,s.veta,s.origen]));
  exportXLS('sobrantes.xlsx', {Sobrantes:rows});
  toast('Excel exportado','success');
};
$('btnExpResXls').onclick = ()=>{
  if(!STATE.lastResult){ toast('Ejecuta primero la optimización','error'); return; }
  const rows = [['Modo','Tableros','Piezas colocadas','Área piezas mm²','Área tableros mm²','Desperdicio mm²','Aprovechamiento %','Cortes','Costo','Piezas sin colocar']];
  STATE.lastResult.forEach(r=>{
    const m = r.metrics;
    rows.push([r.name, m.tableros, m.piezasColocadas, m.areaPiezas, m.areaTableros, m.desperdicio, m.aprovechamiento.toFixed(2), m.cortes, m.costo, m.unplaced]);
  });
  exportXLS('resultados.xlsx', {Resultados:rows});
  toast('Excel exportado','success');
};
/* =========================================================
   PDF PLANO
   ========================================================= */
$('btnPdfPlano').onclick = ()=>{
  if(!STATE.bestResult){ toast('Ejecuta primero la optimización','error'); return; }
  try{
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({orientation:'landscape', unit:'mm', format:'a4'});
    STATE.bestResult.boards.forEach((b,i)=>{
      if(i>0) doc.addPage();
      doc.setFontSize(14);
      doc.text(`Tablero ${i+1} — ${b.board.nombre}`, 10, 12);
      doc.setFontSize(10);
      doc.text(`Material: ${b.board.material} · ${b.board.ancho}×${b.board.largo} mm · Kerf: ${STATE.params.kerf} mm`, 10, 18);
      // Dibujar rectángulos
      const pageW = 280, pageH = 180;
      const padX = 15, padY = 25;
      const availW = pageW - padX*2;
      const availH = pageH - padY - 15;
      const scale = Math.min(availW/b.board.ancho, availH/b.board.largo);
      // Fondo
      doc.setDrawColor(50,50,50);
      doc.setFillColor(245,245,245);
      doc.rect(padX, padY, b.board.ancho*scale, b.board.largo*scale, 'FD');
      b.placed.forEach((p,j)=>{
        const x = padX + p.x*scale;
        const y = padY + p.y*scale;
        doc.setDrawColor(0,0,0);
        const c = hslToRgb(p.material+p.name);
        doc.setFillColor(c.r,c.g,c.b);
        doc.rect(x, y, p.w*scale, p.h*scale, 'FD');
        if(p.w*scale > 15 && p.h*scale > 8){
          doc.setFontSize(7);
          doc.text(p.name.substring(0,16), x+1, y+4);
          doc.text(`${Math.round(p.w)}×${Math.round(p.h)}`, x+1, y+8);
        } else {
          doc.setFontSize(6);
          doc.text(String(j+1), x+1, y+3);
        }
      });
    });
    doc.save('planos_corte.pdf');
    toast('PDF generado','success');
  }catch(e){
    console.error(e);
    toast('Error generando PDF','error');
  }
};
function hslToRgb(hslStr){
  // hslStr aquí es solo un string arbitrario para color; usamos hash
  let hash=0; for(let i=0;i<hslStr.length;i++) hash = hslStr.charCodeAt(i) + ((hash<<5)-hash);
  const r = 180 + (Math.abs(hash)%60);
  const g = 180 + (Math.abs(hash>>8)%60);
  const b = 180 + (Math.abs(hash>>16)%60);
  return {r,g,b};
}

/* =========================================================
   PROYECTOS (localStorage)
   ========================================================= */
function saveAuto(){
  const data = {
    tableros: STATE.tableros,
    piezas: STATE.piezas,
    sobrantes: STATE.sobrantes,
    params: STATE.params,
    projectName: STATE.projectName
  };
  try{
    localStorage.setItem('opticorte_autosave', JSON.stringify(data));
  }catch(e){ console.warn('No se pudo guardar',e); }
}

function loadAuto(){
  try{
    const raw = localStorage.getItem('opticorte_autosave');
    if(!raw) return false;
    const data = JSON.parse(raw);
    if(data.tableros) STATE.tableros = data.tableros;
    if(data.piezas) STATE.piezas = data.piezas;
    if(data.sobrantes) STATE.sobrantes = data.sobrantes;
    if(data.params) STATE.params = {...STATE.params, ...data.params};
    if(data.projectName) STATE.projectName = data.projectName;
    return true;
  }catch(e){ return false; }
}

$('btnSaveProj').onclick = ()=>{
  const name = prompt('Nombre del proyecto:', STATE.projectName);
  if(!name) return;
  STATE.projectName = name;
  const data = {
    tableros: STATE.tableros, piezas: STATE.piezas, sobrantes: STATE.sobrantes,
    params: STATE.params, projectName: name, savedAt: new Date().toISOString()
  };
  const list = JSON.parse(localStorage.getItem('opticorte_projects')||'{}');
  list[name] = data;
  localStorage.setItem('opticorte_projects', JSON.stringify(list));
  $('projInfo').innerHTML = `Proyecto: <b>${escapeHtml(name)}</b>`;
  toast('Proyecto guardado','success');
};
$('btnLoadProj').onclick = ()=>{
  const list = JSON.parse(localStorage.getItem('opticorte_projects')||'{}');
  const names = Object.keys(list);
  if(!names.length){ toast('No hay proyectos guardados','error'); return; }
  const sel = prompt('Proyecto a cargar:\n' + names.join('\n'), names[0]);
  if(!sel || !list[sel]) return;
  const data = list[sel];
  STATE.tableros = data.tableros; STATE.piezas = data.piezas;
  STATE.sobrantes = data.sobrantes; STATE.params = data.params;
  STATE.projectName = data.projectName;
  renderTableros(); renderPiezas(); renderSobrantes(); loadParamsUI();
  $('projInfo').innerHTML = `Proyecto: <b>${escapeHtml(sel)}</b>`;
  toast('Proyecto cargado','success');
};
$('btnNewProj').onclick = ()=>{
  if(!confirm('¿Crear nuevo proyecto? Se perderán los cambios no guardados.')) return;
  STATE.tableros = []; STATE.piezas = []; STATE.sobrantes = [];
  STATE.lastResult = null; STATE.projectName = 'Sin guardar';
  renderTableros(); renderPiezas(); renderSobrantes();
  $('projInfo').innerHTML = 'Proyecto: <b>Sin guardar</b>';
  toast('Nuevo proyecto');
};
$('btnExpProj').onclick = ()=>{
  const data = {tableros:STATE.tableros, piezas:STATE.piezas, sobrantes:STATE.sobrantes, params:STATE.params, projectName:STATE.projectName};
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (STATE.projectName||'proyecto')+'.json';
  a.click();
};
$('btnImpProj').onclick = ()=> $('projFile').click();
$('projFile').onchange = (e)=>{
  const file = e.target.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = evt=>{
    try{
      const data = JSON.parse(evt.target.result);
      if(data.tableros) STATE.tableros = data.tableros;
      if(data.piezas) STATE.piezas = data.piezas;
      if(data.sobrantes) STATE.sobrantes = data.sobrantes;
      if(data.params) STATE.params = data.params;
      if(data.projectName) STATE.projectName = data.projectName;
      renderTableros(); renderPiezas(); renderSobrantes(); loadParamsUI();
      $('projInfo').innerHTML = `Proyecto: <b>${escapeHtml(STATE.projectName)}</b>`;
      toast('Proyecto importado','success');
    }catch(err){ toast('Archivo inválido','error'); }
  };
  reader.readAsText(file);
};

/* =========================================================
   UTILIDADES
   ========================================================= */
function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* =========================================================
   INIT
   ========================================================= */
function init(){
  const hadData = loadAuto();
  bindParams();
  loadParamsUI();
  renderTableros();
  renderPiezas();
  renderSobrantes();
  $('hojaFecha').value = new Date().toISOString().slice(0,10);
  if(hadData){
    $('projInfo').innerHTML = `Proyecto: <b>${escapeHtml(STATE.projectName)}</b>`;
    toast('Datos previos recuperados');
  } else {
    // Cargar un tablero de ejemplo por defecto para que el usuario pueda probar rápido
    STATE.tableros.push({
      id: uid(), nombre:'Melamina blanca', material:'Melamina',
      largo:2440, ancho:1220, espesor:18, precio:850, color:'#c8a878',
      veta:'largo', cantidad:10, margen:0
    });
    renderTableros();
  }
}
document.addEventListener('DOMContentLoaded', init);

/* =========================================================
   FIN DEL ARCHIVO script.js
   ========================================================= */
