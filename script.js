/* =========================================================
   OptiCorte Pro -- Motor de optimización y UI
   Autor: Sistema original (basado en conceptos públicos de
   Guillotine bin packing y MaxRects).
   ========================================================= */

/* ---------- ESTADO GLOBAL ---------- */
const STATE = {
  tableros: [],
  piezas: [],
  habilitados: [],   // [{id, nombre, muebles, incluir, archivo}]
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
      <td><b>${cantidadTotal(p)}</b></td>
      <td>${p.espesor}</td>
      <td>${p.material}</td>
      <td>${p.veta}</td>
      <td>${p.rot?'Sí':'No'}</td>
      <td>${habilitadoDe(p) ? escapeHtml(habilitadoDe(p).nombre) : '—'}</td>
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
  const totalP = STATE.piezas.reduce((a,p)=>a+cantidadTotal(p),0);
  $('countPiezas').textContent = STATE.piezas.length;
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
  STATE.piezas=[]; STATE.habilitados=[]; renderPiezas(); renderHabilitados();
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
/** Nombre de la pieza para los planos: lo que está después del ÚLTIMO guión ("IFD4221BFT - ENTREPAÑO" -> "ENTREPAÑO"). */
function nombreCorto(n){
  const t = String(n==null ? '' : n).trim();
  const i = t.lastIndexOf('-');
  const corto = i>=0 ? t.slice(i+1).trim() : t;
  return corto || t;
}

/** Texto "Cortes para: IFD4221BFF: 20 muebles" con los habilitados incluidos (para encabezados de hojas). */
function textoMuebles(){
  const inc = (STATE.habilitados||[]).filter(h=>h.incluir && h.muebles>0);
  const manuales = STATE.piezas.some(p=>!p.habId && cantidadTotal(p)>0);
  const partes = inc.map(h=>`${h.nombre}: ${h.muebles} mueble${h.muebles>1?'s':''}`);
  if(manuales) partes.push('piezas manuales');
  return partes.length ? 'Cortes para: ' + partes.join(' · ') : '';
}

/** Huella de todo lo que influye en el cálculo; si cambia, el resultado mostrado quedó desactualizado. */
function firmaDatos(){
  return JSON.stringify([
    STATE.piezas.map(p=>[p.id,p.cantidad,p.largo,p.ancho,p.material,p.espesor,p.veta,p.rot,p.tolAncho,p.tolLargo,p.habId]),
    (STATE.habilitados||[]).map(h=>[h.id,h.muebles,h.incluir]),
    STATE.tableros.map(t=>[t.id,t.material,t.espesor,t.largo,t.ancho,t.cantidad,t.veta,t.margen]),
    STATE.params
  ]);
}

/** Habilitado al que pertenece un renglón (o null si es una pieza manual). */
function habilitadoDe(p){ return p.habId ? (STATE.habilitados||[]).find(h=>h.id===p.habId) || null : null; }

/**
 * Cantidad total a cortar de un renglón = cantidad por mueble × muebles del habilitado,
 * redondeada hacia arriba (ej. 0.2 por mueble × 3 muebles = 1 pieza).
 * Si el habilitado no está incluido (o fue eliminado) no se corta nada.
 */
function cantidadTotal(p){
  if(p.habId){
    const h = habilitadoDe(p);
    if(!h || !h.incluir) return 0;
    return Math.ceil(+(p.cantidad*(+h.muebles||0)).toFixed(6));
  }
  return Math.ceil(+(+p.cantidad||0).toFixed(6));
}

/** Total de piezas de un habilitado con su número de muebles (sin importar si está incluido). */
function totalPiezasHab(h){
  return STATE.piezas.filter(p=>p.habId===h.id).reduce((n,p)=>n+Math.ceil(+(p.cantidad*(+h.muebles||0)).toFixed(6)),0);
}

function expandPieces(){
  const grouped = {};
  STATE.piezas.forEach(p=>{
    const total = cantidadTotal(p);
    if(total <= 0) return;
    const key = p.material+'|'+p.espesor;
    if(!grouped[key]) grouped[key] = {material:p.material, espesor:p.espesor, pieces:[]};
    for(let i=0;i<total;i++){
      const dim = applyTolerance(p);
      grouped[key].pieces.push({
        id: p.id + '_' + i,
        name: nombreCorto(p.nombre),
        origId: p.id,
        w: dim.w, h: dim.h,
        ow: p.ancho, oh: p.largo,
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
 * Orientaciones permitidas de una pieza en un tablero (rotación + veta).
 * La veta del tablero ('largo' = corre sobre el eje largo/vertical, 'ancho' = sobre el eje ancho/horizontal)
 * y la veta de la pieza ('largo' = corre sobre su medida largo, 'ancho' = sobre su medida ancho)
 * deben coincidir cuando "Respetar veta siempre" está activo. Sin veta en pieza o tablero: solo manda la rotación.
 */
function orientaciones(piece, board){
  const normal = {w:piece.w, h:piece.h, rot:false};
  const girada = {w:piece.h, h:piece.w, rot:true};
  const libres = piece.rot ? [normal, girada] : [normal];
  if(!STATE.params.veta || (piece.veta!=='largo' && piece.veta!=='ancho')) return libres;
  const grano = board && board.veta;
  if(grano!=='largo' && grano!=='ancho') return libres;         // tablero sin veta: nada que respetar
  const ejeTablero = grano==='largo' ? 'y' : 'x';
  const ejeNormal  = piece.veta==='largo' ? 'y' : 'x';          // eje de la veta de la pieza sin girar
  const ejeGirada  = ejeNormal==='y' ? 'x' : 'y';
  const ok = [];
  if(ejeNormal===ejeTablero) ok.push(normal);
  if(ejeGirada===ejeTablero) ok.push(girada);
  return ok;
}

/** ¿Cabe la pieza en el tablero (con márgenes), en alguna orientación permitida? */
function pieceFitsInBoard(p, board){
  const m = margenTablero(board);
  const availW = board.ancho - 2*m;
  const availH = board.largo - 2*m;
  return orientaciones(p, board).some(o => o.w <= availW + 1e-9 && o.h <= availH + 1e-9);
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
      for(const o of orientaciones(piece, board)){
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
      for(const o of orientaciones(piece, board)){
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
/**
 * Corte por franjas (guillotina de dos etapas).
 * sentido 'longitud': primero cortes paralelos al LARGO del tablero -> franjas verticales a lo largo
 *                     (las piezas se apilan dentro de cada franja).
 * sentido 'anchura' : primero cortes a lo ANCHO -> franjas horizontales (piezas lado a lado).
 */
function optimizeFranjas(pieces, board, opts){
  const m = margenTablero(board), kerf = STATE.params.kerf, EPS = 0.01;
  const porLongitud = opts.sentido === 'longitud';
  const availW = board.ancho-2*m, availH = board.largo-2*m;
  const Ltot = porLongitud ? availH : availW;     // eje a lo largo de la franja
  const Ctot = porLongitud ? availW : availH;     // eje transversal (suma de franjas)
  const lc = o => porLongitud ? {l:o.h, c:o.w} : {l:o.w, c:o.h};
  const orientsDe = piece => orientaciones(piece, board).map(o=>({o, ...lc(o)})).filter(x=>x.l<=Ltot+EPS && x.c<=Ctot+EPS);

  const unplaced = [], validas = [];
  pieces.forEach(p=>{ const os = orientsDe(p); if(os.length) validas.push({p, os, cMin: Math.min(...os.map(x=>x.c))}); else unplaced.push(p); });
  validas.sort((a,b)=> b.cMin-a.cMin || (b.p.w*b.p.h)-(a.p.w*a.p.h));

  const franjas = [], placed = [];
  let usedC = 0;
  for(const {p:piece, os} of validas){
    let best = null;
    franjas.forEach((f,fi)=>{
      os.forEach(x=>{
        const needL = f.usado + (f.n? kerf:0) + x.l;
        if(x.c <= f.c+EPS && needL <= Ltot+EPS){
          const score = (Ltot-needL) + (f.c-x.c)*3;
          if(!best || score < best.score) best = {fi, x, score};
        }
      });
    });
    if(!best){
      os.forEach(x=>{
        const needC = usedC + (franjas.length? kerf:0) + x.c;
        if(needC <= Ctot+EPS){
          const score = x.c*1000 + (Ltot-x.l);
          if(!best || score < best.score) best = {x, score, needC};
        }
      });
      if(best){ franjas.push({c0: franjas.length? usedC+kerf : 0, c: best.x.c, usado:0, n:0}); usedC = best.needC; best.fi = franjas.length-1; }
    }
    if(!best){ unplaced.push(piece); continue; }
    const f = franjas[best.fi], x = best.x;
    const lOff = f.usado + (f.n? kerf:0);
    f.usado = lOff + x.l; f.n++;
    const px = m + (porLongitud ? f.c0 : lOff), py = m + (porLongitud ? lOff : f.c0);
    placed.push({...piece, x:px, y:py, w:x.o.w, h:x.o.h, rotated:x.o.rot, boardId:board.instanceId});
  }

  const rect = (c0,c,l0,len)=> porLongitud ? {x:m+c0,y:m+l0,w:c,h:len} : {x:m+l0,y:m+c0,w:len,h:c};
  const freeRegions = [];
  franjas.forEach(f=>{ const l0=f.usado+kerf; if(Ltot-l0>EPS) freeRegions.push(rect(f.c0,f.c,l0,Ltot-l0)); });
  const cSobra = franjas.length ? usedC+kerf : 0;
  if(Ctot-cSobra>EPS) freeRegions.push(rect(cSobra, Ctot-cSobra, 0, Ltot));
  return { placed, unplaced, freeRegions, cuts: franjas.length + placed.length };
}

function optimizeMixed(pieces, board){
  const orden = {
    'Guillotine-área':   [...pieces].sort((a,b)=>(b.w*b.h)-(a.w*a.h)),
    'Guillotine-largo':  [...pieces].sort((a,b)=>Math.max(b.w,b.h)-Math.max(a.w,a.h) || (b.w*b.h)-(a.w*a.h)),
    'Guillotine-ancho':  [...pieces].sort((a,b)=>Math.min(b.w,b.h)-Math.min(a.w,a.h) || (b.w*b.h)-(a.w*a.h))
  };
  const variants = Object.entries(orden).map(([name,list])=>({name, result: optimizeGuillotine(list, board, {keepOrder:true})}));
  variants.push({ name:'MaxRects', result: optimizeMaxRects(pieces, board) });
  variants.push({ name:'Por longitud', result: optimizeFranjas(pieces, board, {sentido:'longitud'}) });
  variants.push({ name:'Por anchura', result: optimizeFranjas(pieces, board, {sentido:'anchura'}) });

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
    'mixto': optimizeMixed,
    'longitud': (p,b)=>optimizeFranjas(p,b,{sentido:'longitud'}),
    'anchura':  (p,b)=>optimizeFranjas(p,b,{sentido:'anchura'})
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
      totalCuts += (res.cuts!==undefined ? res.cuts : estimateCuts(res.placed, modeName));
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
    const grano = b.board.veta;
    if(STATE.params.veta && (grano==='largo' || grano==='ancho')){
      b.placed.forEach(p=>{
        if(p.veta!=='largo' && p.veta!=='ancho') return;
        const ejePieza = ((p.veta==='largo') !== !!p.rotated) ? 'y' : 'x';
        if(ejePieza !== (grano==='largo' ? 'y' : 'x')) errs.push(`${b.id}: "${p.name}" quedó con la veta en sentido contrario al tablero`);
      });
    }
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
/**
 * Ejecuta una o varias estrategias de corte y muestra resultados.
 * estrategias: [{name, mode, status?}]  (mode = 'longitud'|'anchura'|'guillotine'|'maxrects'|'mixto')
 */
function calcularResultados(estrategias, onPaso){
  const results = estrategias.map((e,i)=>{
    if(onPaso) onPaso(i, estrategias.length);
    const r = runMode(e.mode);
    return { name:e.name, result:r, metrics:computeMetrics(r), status: e.status || 'Solución heurística' };
  });
  results.forEach(x=>{ if(x.name==='Mixto' && x.result.unplaced.length===0) x.status='Mejor evaluada (no demostrada óptima)'; });
  const fallas = results.flatMap(x=>x.result.validation||[]);
  if(fallas.length){ console.error('Validación de optimización:', fallas); toast('⚠️ La validación detectó '+fallas.length+' problema(s); revisa la consola','error'); }
  STATE.lastResult = results;
  STATE.firmaResultado = firmaDatos();
  STATE.ultimasEstrategias = estrategias;
  renderComparison(results);
  renderPlanoSelector(results);
  if(results.length > 1){ renderSavings(results); $('savingsCard').style.display='block'; }
  else $('savingsCard').style.display='none';
  actualizarAvisoResultado();
  const el = $('avisoSinColocar');
  if(el){
    const sin = STATE.bestResult ? STATE.bestResult.unplaced : [];
    if(sin.length){
      const mot = [...new Set(sin.map(p=>p.reason||'Sin tablero disponible'))].join('; ');
      el.innerHTML = `⚠️ <b>${sin.length} pieza(s) NO se pudieron colocar</b> (${escapeHtml(mot)}). Si es por falta de tableros, aumenta la cantidad disponible en Tableros y vuelve a calcular.`;
      el.style.display = 'block';
    } else el.style.display = 'none';
  }
  return { results, fallas };
}

/** Muestra el aviso si se cambiaron piezas, muebles, tableros o parámetros después del último cálculo. */
function actualizarAvisoResultado(){
  const el = $('avisoDesactualizado'); if(!el) return;
  el.style.display = (STATE.firmaResultado && STATE.firmaResultado !== firmaDatos()) ? 'block' : 'none';
}

function ejecutarOptimizacion(estrategias){
  if(STATE.tableros.length === 0){ toast('Registra al menos un tablero','error'); return; }
  if(STATE.piezas.length === 0){ toast('Registra al menos una pieza','error'); return; }
  if(!STATE.piezas.some(p=>cantidadTotal(p)>0)){ toast('No hay piezas para cortar: revisa los habilitados incluidos y su cantidad de muebles','error'); return; }
  const bar = $('optProgress');
  bar.style.display='block';
  bar.firstElementChild.style.width='10%';
  setTimeout(()=>{
    const { fallas } = calcularResultados(estrategias, (i,n)=>{ bar.firstElementChild.style.width = Math.round(10 + 85*(i+1)/n)+'%'; });
    bar.firstElementChild.style.width='100%';
    setTimeout(()=>bar.style.display='none', 500);
    if(!fallas.length) toast('Optimización completada','success');
  }, 60);
}

$('btnRecalcular').onclick = ()=>{
  if(STATE.ultimasEstrategias){ calcularResultados(STATE.ultimasEstrategias); toast('Planos recalculados con los datos actuales','success'); }
};
// Cualquier cambio en datos o parámetros revisa si el cálculo mostrado sigue vigente
document.addEventListener('change', ()=> setTimeout(actualizarAvisoResultado,0));
document.addEventListener('input',  ()=> setTimeout(actualizarAvisoResultado,0));

$('btnOptLongitud').onclick = ()=> ejecutarOptimizacion([{name:'Por longitud', mode:'longitud'}]);
$('btnOptAnchura').onclick  = ()=> ejecutarOptimizacion([{name:'Por anchura',  mode:'anchura'}]);
// ÓPTIMO: compara todos los métodos y se queda con el mejor según el criterio de prioridad
$('btnOptimize').onclick = ()=> ejecutarOptimizacion([
  {name:'Por longitud', mode:'longitud'},
  {name:'Por anchura',  mode:'anchura'},
  {name:'Guillotine',   mode:'guillotine'},
  {name:'MaxRects',     mode:'maxrects'},
  {name:'Mixto',        mode:'mixto'}
]);

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
  $('bestModeBox').innerHTML = results.length===1
    ? `✅ Resultado del método <b>${best.name}</b> — ${best.metrics.tableros} tableros, ${best.metrics.aprovechamiento.toFixed(2)}% aprovechamiento.`
    : `✅ Mejor resultado según criterio <b>"${STATE.params.criterio}"</b>: <b>${best.name}</b> — ${best.metrics.tableros} tableros, ${best.metrics.aprovechamiento.toFixed(2)}% aprovechamiento.`;
  $('statModo').textContent = best.name;
  $('statAprov').textContent = best.metrics.aprovechamiento.toFixed(1)+'%';
}

function renderSavings(results){
  // Referencia = Guillotine básico (el método más simple)
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
  $('savingsNote').innerHTML = `Método de referencia: <b>Guillotine básico</b> (el más simple de los métodos). ` +
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
    o.textContent = `Tablero ${i+1} — ${b.board.material} ${nf(b.board.espesor)} mm (${b.board.ancho}×${b.board.largo})`;
    sel.appendChild(o);
  });
  $('planosControls').style.display = boards.length?'block':'none';
  renderResumen(best.result);
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

// <<PLANO-START (sin DOM; se prueba por separado)
const textoVeta = v => v==='largo' ? 'a lo largo' : v==='ancho' ? 'a lo ancho' : 'sin veta';
const nf = n => Number.isInteger(+n) ? fmt(n,0) : fmt(n,1);
const escSvg = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const truncTxt = (s,n)=> s.length>n ? s.slice(0,Math.max(1,n-1))+'…' : s;

/** "3, 4, 5, 9" -> "3–5, 9" */
function compactarNumeros(nums){
  const out=[]; let i=0;
  while(i<nums.length){
    let j=i; while(j+1<nums.length && nums[j+1]===nums[j]+1) j++;
    out.push(j>i+1 ? `${nums[i]}–${nums[j]}` : nums.slice(i,j+1).join(', '));
    i=j+1;
  }
  return out.join(', ');
}

const claveCorte = p => p.name+'|'+(p.rotated? p.h : p.w)+'|'+(p.rotated? p.w : p.h);

/** Total de cada corte (mismo nombre y medida) en todos los tableros, más lo que no se pudo colocar. */
function totalesPorCorte(boards, unplaced){
  const t = {};
  const add = (p, tablero)=>{
    const k = claveCorte(p);
    const o = t[k] = t[k] || {name:p.name, fw:(p.rotated? p.h : p.w), fh:(p.rotated? p.w : p.h), ow:p.ow, oh:p.oh,
                              material:p.material, espesor:p.espesor, total:0, sin:0, tableros:new Set()};
    o.total++;
    if(tablero) o.tableros.add(tablero); else o.sin++;
  };
  boards.forEach((b,i)=>b.placed.forEach(p=>add(p,i+1)));
  (unplaced||[]).forEach(p=>add(p,0));
  return t;
}

/** Numeración del tablero: global y dentro de su material/espesor. */
function infoTablero(boards, idx, unplaced){
  const b = boards[idx];
  const mismos = boards.filter(x=>x.board.material===b.board.material && +x.board.espesor===+b.board.espesor);
  return { numero: idx+1, total: boards.length, secMat: mismos.indexOf(b)+1, totMat: mismos.length, totales: totalesPorCorte(boards, unplaced) };
}

/**
 * Ajusta el nombre COMPLETO dentro de un recuadro rw×rh: prueba horizontal y vertical (girado -90°),
 * con saltos de línea entre palabras, bajando el tamaño de letra hasta que quepa.
 * ancho(str, fs) -> ancho del texto; k = unidades por punto de letra (1 en px, 0.3528 en mm).
 * Devuelve {lines, fs, lh, vertical} o null si ni con la letra mínima cabe.
 */
function ajustarNombre(texto, rw, rh, fsMax, fsMin, ancho, k){
  if(rw<=0 || rh<=0) return null;
  const palabras = String(texto).split(/\s+/).filter(Boolean);
  const envolver = (maxW, fs)=>{
    const lines = []; let cur = '';
    for(const w of palabras){
      const t = cur ? cur+' '+w : w;
      if(!cur || ancho(t,fs) <= maxW) cur = t; else { lines.push(cur); cur = w; }
    }
    if(cur) lines.push(cur);
    return lines.every(l=>ancho(l,fs) <= maxW) ? lines : null;
  };
  for(let fs=fsMax; fs>=fsMin-1e-9; fs-=0.5){
    const lh = fs*k*1.2;
    let L = envolver(rw, fs);
    if(L && L.length*lh <= rh) return {lines:L, fs, lh, vertical:false};
    L = envolver(rh, fs);
    if(L && L.length*lh <= rw) return {lines:L, fs, lh, vertical:true};
  }
  return null;
}

/** Elige tamaño de letra y texto que quepan DENTRO de la pieza; si no caben, devuelve null. */
function layoutTextoPieza(lineas, pw, ph){
  const C = 0.6; // ancho medio de un carácter ≈ 0.6 × tamaño
  let fs = Math.min(12, ph/(lineas.length*1.3+0.3));
  if(fs < 7) return null;
  const out = [];
  for(let i=0;i<lineas.length;i++){
    const l = lineas[i];
    const maxChars = Math.floor((pw-6)/(fs*C));
    if(l.fijo){ if(l.t.length>maxChars) return null; out.push(l.t); }
    else { if(maxChars < l.min) return null; out.push(truncTxt(l.t, maxChars)); }
  }
  return { fs, lineas: out };
}

/**
 * Construye el SVG de un tablero (a escala real, sin deformar).
 * b: {board, placed}; info: infoTablero(); opts: {showCuts, showDims, showVeta, showLabels}
 * Devuelve {svg, width, height}.
 */
function construirPlanoSVG(b, info, opts){
  const P = STATE.params, board = b.board, placed = b.placed;
  const W = board.ancho, H = board.largo, kerf = P.kerf, m = margenTablero(board);
  const scale = Math.min(860/W, 760/H, 1.2);
  const bw = W*scale, bh = H*scale;
  const top = 138, left = 70, right = 30;
  const svgW = Math.max(left+bw+right, 600);
  const x0 = left + (svgW-left-right-bw)/2, y0 = top;
  const uid2 = 'p'+info.numero;

  // Piezas numeradas en el orden de colocación
  const piezas = placed.map((p,i)=>({...p, n:i+1}));
  const areaPiezas = piezas.reduce((s,p)=>s+p.w*p.h,0);
  const areaTab = W*H;
  const aprov = areaTab? areaPiezas/areaTab*100 : 0;

  // Leyenda agrupada (pieza + medida final + original)
  const grupos = {};
  piezas.forEach(p=>{
    const fw = p.rotated? p.h : p.w, fh = p.rotated? p.w : p.h;
    const k = p.name+'|'+fw+'|'+fh+'|'+(p.rotated?1:0);
    (grupos[k] = grupos[k] || {name:p.name, fw, fh, ow:p.ow, oh:p.oh, rot:p.rotated, nums:[]}).nums.push(p.n);
  });
  const leyenda = Object.values(grupos).map(g=>{
    const orig = (g.ow!==undefined && (Math.abs(g.ow-g.fw)>0.01 || Math.abs(g.oh-g.fh)>0.01)) ? ` (orig. ${nf(g.ow)}×${nf(g.oh)})` : '';
    const tot = info.totales && info.totales[g.name+'|'+g.fw+'|'+g.fh];
    return `#${compactarNumeros(g.nums)} · ${g.nums.length}× ${truncTxt(g.name,28)} · ${nf(g.fw)}×${nf(g.fh)} mm${g.rot?' ↻':''}${orig}${tot?` · se ocupan ${tot.total} en total`:''}`;
  });
  const legY = y0 + bh + 40, lh = 15;
  const svgH = legY + 22 + leyenda.length*lh + 50;

  let s = '';
  s += `<svg xmlns="http://www.w3.org/2000/svg" class="plano-svg" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" font-family="Segoe UI, Arial, sans-serif">`;
  s += `<defs><pattern id="hatch${uid2}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#cbd5e1" stroke-width="1"/></pattern>`+
       `<marker id="arr${uid2}" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto"><polygon points="0,0 6,3 0,6" fill="#7c2d12"/></marker></defs>`;
  s += `<rect width="${svgW}" height="${svgH}" fill="#fff"/>`;

  // Encabezado
  s += `<text x="${left-30}" y="24" font-size="17" font-weight="700" fill="#0f172a">Tablero ${info.numero} de ${info.total} — ${escSvg(board.material)} · espesor ${nf(board.espesor)} mm</text>`;
  s += `<text x="${left-30}" y="44" font-size="12.5" fill="#334155">Tablero ${info.secMat} de ${info.totMat} de este material · Medidas: ${fmt(W)} × ${fmt(H)} mm (ancho × largo)</text>`;
  s += `<text x="${left-30}" y="62" font-size="12.5" fill="#334155">Corte de sierra (kerf): ${kerf} mm · Margen perimetral: ${nf(m)} mm · Veta del tablero: ${textoVeta(board.veta)}</text>`;
  s += `<text x="${left-30}" y="80" font-size="12.5" font-weight="600" fill="#166534">${piezas.length} piezas · Aprovechamiento ${aprov.toFixed(1)}% · Sobrante ${(100-aprov).toFixed(1)}% (${fmt((areaTab-areaPiezas)/1e6,2)} m²)</text>`;

  const mueb = textoMuebles();
  if(mueb) s += `<text x="${left-30}" y="98" font-size="12.5" font-weight="600" fill="#1d4ed8">${escSvg(truncTxt(mueb,120))}</text>`;

  // Cotas del tablero
  const ty = y0-16;
  s += `<g stroke="#334155" stroke-width="1" fill="none"><line x1="${x0}" y1="${ty}" x2="${x0+bw}" y2="${ty}"/><line x1="${x0}" y1="${ty-4}" x2="${x0}" y2="${ty+4}"/><line x1="${x0+bw}" y1="${ty-4}" x2="${x0+bw}" y2="${ty+4}"/>`+
       `<line x1="${x0-16}" y1="${y0}" x2="${x0-16}" y2="${y0+bh}"/><line x1="${x0-20}" y1="${y0}" x2="${x0-12}" y2="${y0}"/><line x1="${x0-20}" y1="${y0+bh}" x2="${x0-12}" y2="${y0+bh}"/></g>`;
  s += `<text x="${x0+bw/2}" y="${ty-5}" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a">${fmt(W)} mm</text>`;
  s += `<text transform="translate(${x0-22} ${y0+bh/2}) rotate(-90)" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a">${fmt(H)} mm</text>`;

  // Tablero: fondo, sobrante rayado y margen
  s += `<rect x="${x0}" y="${y0}" width="${bw}" height="${bh}" fill="#f8fafc" stroke="#334155" stroke-width="2"/>`;
  s += `<rect x="${x0}" y="${y0}" width="${bw}" height="${bh}" fill="url(#hatch${uid2})"/>`;
  s += `<rect x="${x0+m*scale}" y="${y0+m*scale}" width="${(W-2*m)*scale}" height="${(H-2*m)*scale}" fill="none" stroke="#94a3b8" stroke-dasharray="4 3"/>`;

  // Bandas de kerf (debajo de las piezas)
  if(opts.showCuts){
    const kb = Math.max(kerf*scale, 1.5);
    piezas.forEach(p=>{
      const x = x0+p.x*scale, y = y0+p.y*scale, w = p.w*scale, h = p.h*scale;
      s += `<rect x="${x+w}" y="${y}" width="${kb}" height="${h+kb}" fill="#ef4444" fill-opacity="0.6"/>`;
      s += `<rect x="${x}" y="${y+h}" width="${w+kb}" height="${kb}" fill="#ef4444" fill-opacity="0.6"/>`;
    });
  }

  // Piezas
  piezas.forEach(p=>{
    const x = x0+p.x*scale, y = y0+p.y*scale, w = p.w*scale, h = p.h*scale;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${hslColorFromString(p.material+p.name)}" fill-opacity="0.85" stroke="#0f172a" stroke-width="1"/>`;
    // Veta (flecha en el borde, para no chocar con el texto)
    if(opts.showVeta && p.veta!=='ninguna' && w>26 && h>26){
      const vertical = (p.veta==='largo') !== !!p.rotated;
      s += vertical
        ? `<line x1="${x+7}" y1="${y+h*0.2}" x2="${x+7}" y2="${y+h*0.8}" stroke="#7c2d12" stroke-width="1.4" marker-end="url(#arr${uid2})"/>`
        : `<line x1="${x+w*0.2}" y1="${y+h-7}" x2="${x+w*0.8}" y2="${y+h-7}" stroke="#7c2d12" stroke-width="1.4" marker-end="url(#arr${uid2})"/>`;
    }
    // Medidas centradas sobre cada lado (ancho arriba, alto a la izquierda); nombre COMPLETO al centro
    const sw = nf(p.w), sh = nf(p.h);
    const fe = Math.max(7, Math.min(12, Math.min(w,h)/9)), pad = fe+3;
    const topOk  = opts.showDims && w >= sw.length*fe*0.6+6 && h >= pad*2+2;
    const leftOk = opts.showDims && h >= sh.length*fe*0.6+6 && w >= pad*2+2;
    const enLados = topOk && leftOk;
    let rx = x, ry = y, rw = w, rh = h;
    if(enLados){
      s += `<text x="${x+w/2}" y="${y+fe+1}" text-anchor="middle" font-size="${fe.toFixed(1)}" font-weight="600" fill="#0f172a">${sw}</text>`;
      s += `<text transform="translate(${x+fe+1} ${y+h/2}) rotate(-90)" text-anchor="middle" font-size="${fe.toFixed(1)}" font-weight="600" fill="#0f172a">${sh}</text>`;
      rx = x+pad; ry = y+pad; rw = w-pad-2; rh = h-pad-2;   // solo se reserva el lado donde está cada medida
    }
    const nombreTxt = opts.showLabels ? `#${p.n} ${p.name}` : `#${p.n}`;
    const texto = enLados ? nombreTxt : (opts.showDims ? `${nombreTxt} ${sw}×${sh}` : nombreTxt);
    const anchoPx = (str,fs)=> str.length*fs*0.62;
    let lay = ajustarNombre(texto, rw-4, rh-3, 12, 5.5, anchoPx, 1) || ajustarNombre(`#${p.n}`, rw-2, rh-2, 12, 5, anchoPx, 1);
    if(lay){
      const cx = rx+rw/2, cy = ry+rh/2;
      lay.lines.forEach((t,i)=>{
        const off = (i-(lay.lines.length-1)/2)*lay.lh;
        s += lay.vertical
          ? `<text transform="translate(${cx} ${cy}) rotate(-90)" y="${off}" text-anchor="middle" dominant-baseline="middle" font-size="${lay.fs.toFixed(1)}" font-weight="600" fill="#0f172a">${escSvg(t)}</text>`
          : `<text x="${cx}" y="${cy+off}" text-anchor="middle" dominant-baseline="middle" font-size="${lay.fs.toFixed(1)}" font-weight="600" fill="#0f172a">${escSvg(t)}</text>`;
      });
    }
  });

  // Leyenda
  s += `<text x="${left-30}" y="${legY}" font-size="13" font-weight="700" fill="#0f172a">Piezas de este tablero (medidas en mm sobre cada lado; ↻ = girada)</text>`;
  leyenda.forEach((t,i)=>{ s += `<text x="${left-30}" y="${legY+20+i*lh}" font-size="12" fill="#1e293b">${escSvg(t)}</text>`; });

  // Esquema ampliado del kerf
  const ky = legY + 24 + leyenda.length*lh + 6;
  s += `<rect x="${left-30}" y="${ky-9}" width="28" height="12" fill="#cbd5e1" stroke="#0f172a"/><rect x="${left-2}" y="${ky-9}" width="6" height="12" fill="#ef4444" fill-opacity="0.6"/><rect x="${left+4}" y="${ky-9}" width="28" height="12" fill="#cbd5e1" stroke="#0f172a"/>`;
  s += `<text x="${left+42}" y="${ky}" font-size="11.5" fill="#334155">Separación de sierra entre piezas: ${kerf} mm (esquema ampliado). Zona rayada = sobrante.</text>`;
  s += `</svg>`;
  return { svg: s, width: svgW, height: svgH };
}

/** Resumen por material + espesor del resultado de una optimización. */
function resumenPorMaterial(result){
  const g = {};
  const get = (mat, esp)=> g[mat+'|'+(+esp)] = g[mat+'|'+(+esp)] || {material:mat, espesor:+esp, medidas:new Set(), tableros:0, colocadas:0, sinColocar:0, areaPiezas:0, areaTableros:0};
  result.boards.forEach(b=>{
    const o = get(b.board.material, b.board.espesor);
    o.medidas.add(`${fmt(b.board.ancho)}×${fmt(b.board.largo)}`);
    o.tableros++; o.colocadas += b.placed.length;
    o.areaPiezas += b.placed.reduce((s,p)=>s+p.w*p.h,0);
    o.areaTableros += b.board.ancho*b.board.largo;
  });
  result.unplaced.forEach(p=>{ get(p.material, p.espesor).sinColocar++; });
  return Object.values(g).map(o=>({
    ...o, medidas: o.medidas.size ? [...o.medidas].join(' · ') : '—',
    requeridas: o.colocadas + o.sinColocar,
    aprov: o.areaTableros ? o.areaPiezas/o.areaTableros*100 : 0,
    desperdicioMm2: o.areaTableros - o.areaPiezas,
    desperdicioPct: o.areaTableros ? (o.areaTableros-o.areaPiezas)/o.areaTableros*100 : 0
  })).sort((a,b)=> a.material.localeCompare(b.material) || a.espesor-b.espesor);
}

function drawPlano(idx){
  const boards = STATE.bestResult?.boards || [];
  const b = boards[idx]; if(!b) return;
  const out = construirPlanoSVG(b, infoTablero(boards, idx, STATE.bestResult.unplaced), {
    showCuts: $('chkShowCuts').checked, showDims: $('chkShowDims').checked,
    showVeta: $('chkShowVeta').checked, showLabels: $('chkShowLabels').checked
  });
  const container = $('planoContainer');
  container.innerHTML = out.svg;
  container.querySelector('svg').style.transform = `scale(${STATE.zoom})`;
  currentPlanData = { board:b.board, placed:b.placed, svgW:out.width, svgH:out.height };
}

/** Pinta el resumen general por material y espesor debajo de los planos. */
function renderResumen(result){
  const rows = resumenPorMaterial(result);
  const kerf = STATE.params.kerf;
  const th = $('resumenMateriales').querySelector('thead');
  const tb = $('resumenMateriales').querySelector('tbody');
  th.innerHTML = '<tr><th>Material</th><th>Espesor (mm)</th><th>Tablero (ancho×largo mm)</th><th>Piezas requeridas</th><th>Colocadas</th><th>Tableros usados</th><th>Kerf (mm)</th><th>Aprovechamiento</th><th>Desperdicio estimado</th></tr>';
  tb.innerHTML = '';
  let t = {req:0,col:0,tab:0,ap:0,at:0};
  rows.forEach(r=>{
    t.req+=r.requeridas; t.col+=r.colocadas; t.tab+=r.tableros; t.ap+=r.areaPiezas; t.at+=r.areaTableros;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(r.material)}</td><td>${nf(r.espesor)}</td><td>${r.medidas}</td><td>${r.requeridas}</td>`+
      `<td>${r.colocadas}${r.sinColocar?` <span style="color:#dc2626">(${r.sinColocar} sin colocar)</span>`:''}</td><td>${r.tableros}</td><td>${kerf}</td>`+
      `<td>${r.aprov.toFixed(1)}%</td><td>${fmt(r.desperdicioMm2/1e6,2)} m² (${r.desperdicioPct.toFixed(1)}%)</td>`;
    tb.appendChild(tr);
  });
  const tr = document.createElement('tr');
  tr.style.fontWeight = '700';
  tr.innerHTML = `<td colspan="3">TOTAL</td><td>${t.req}</td><td>${t.col}</td><td>${t.tab}</td><td>${kerf}</td>`+
    `<td>${t.at?(t.ap/t.at*100).toFixed(1):'0.0'}%</td><td>${fmt((t.at-t.ap)/1e6,2)} m² (${t.at?((t.at-t.ap)/t.at*100).toFixed(1):'0.0'}%)</td>`;
  tb.appendChild(tr);
  $('resumenCard').style.display = rows.length ? 'block' : 'none';
}

function hslColorFromString(str){
  let hash = 0;
  for(let i=0;i<str.length;i++) hash = str.charCodeAt(i) + ((hash<<5)-hash);
  const h = Math.abs(hash) % 360;
  return `hsl(${h}, 55%, 72%)`;
}
// <<PLANO-END

// <<PDF-START (sin DOM; se prueba por separado)
function hslAArreglo(str){
  const m = String(str).match(/hsl\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
  if(!m) return [220,220,220];
  const h=+m[1]/360, s=+m[2]/100, l=+m[3]/100;
  const q = l<0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
  const f = t=>{ t=(t+1)%1; return t<1/6? p+(q-p)*6*t : t<1/2? q : t<2/3? p+(q-p)*(2/3-t)*6 : p; };
  return [f(h+1/3),f(h),f(h-1/3)].map(v=>Math.round(v*255));
}

/** Agrupa las piezas de un tablero para la leyenda (misma pieza y medida = una fila). */
function agruparLeyenda(placed, totales){
  const g = {};
  placed.forEach((p,i)=>{
    const n = i+1, fw = p.rotated? p.h : p.w, fh = p.rotated? p.w : p.h;
    const k = p.name+'|'+fw+'|'+fh;
    (g[k] = g[k] || {name:p.name, fw, fh, ow:p.ow, oh:p.oh, rot:!!p.rotated, nums:[]}).nums.push(n);
  });
  return Object.values(g).map(o=>({
    nums: compactarNumeros(o.nums), name:o.name, cant:o.nums.length,
    total: (totales && totales[o.name+'|'+o.fw+'|'+o.fh]) ? totales[o.name+'|'+o.fw+'|'+o.fh].total : o.nums.length,
    med: `${nf(o.fw)} x ${nf(o.fh)}` + ((o.ow!==undefined && (Math.abs(o.ow-o.fw)>0.01 || Math.abs(o.oh-o.fh)>0.01)) ? ` (orig. ${nf(o.ow)} x ${nf(o.oh)})` : ''),
    orig: '-',
    girada: o.rot ? 'Sí' : ''
  }));
}

/** Elige tamaño de letra (pt) y texto que quepan dentro de una pieza dibujada en mm. */
function textoPiezaPdf(doc, cands, pw, ph){
  for(const c of cands){
    for(let fs=8; fs>=4.5; fs-=0.5){
      doc.setFontSize(fs);
      const lh = fs*0.3528*1.25;
      if(c.length*lh > ph-1) continue;
      const lines = []; let ok = true;
      for(const l of c){
        let t = l.t; const maxW = pw-3;
        if(doc.getTextWidth(t) > maxW){
          if(l.fijo){ ok=false; break; }
          while(t.length>5 && doc.getTextWidth(t+'...') > maxW) t = t.slice(0,-1);
          if(doc.getTextWidth(t+'...') > maxW || t.length<=5){ ok=false; break; }
          t += '...';
        }
        lines.push(t);
      }
      if(ok) return {fs, lines, lh};
    }
  }
  return null;
}

/**
 * Construye el PDF general de optimización en `doc` (jsPDF con autoTable).
 * result: resultado de optimización; ctx: {fecha, proyecto, modo}
 */
function construirPdfOptimizacion(doc, result, ctx){
  const P = STATE.params, kerf = P.kerf;
  const resumen = resumenPorMaterial(result);
  const boards = result.boards;
  const totTab = boards.length;
  const totReq = resumen.reduce((n,r)=>n+r.requeridas,0);
  const totCol = resumen.reduce((n,r)=>n+r.colocadas,0);
  const aP = resumen.reduce((n,r)=>n+r.areaPiezas,0), aT = resumen.reduce((n,r)=>n+r.areaTableros,0);

  // ---------- Página 1: resumen general ----------
  doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor(15,23,42);
  doc.text('OPTIMIZACIÓN DE CORTE DE TABLEROS', 12, 16);
  doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(51,65,85);
  doc.text(`Fecha de generación: ${ctx.fecha}`, 12, 23);
  doc.text(`Proyecto: ${ctx.proyecto}`, 12, 28);
  doc.text(`Corte de sierra (kerf): ${kerf} mm   |   Margen perimetral: ${nf(P.margenPer + P.margenSeg)} mm   |   Método: ${ctx.modo}`, 12, 33);
  doc.text(`Piezas: ${totCol} de ${totReq} colocadas   |   Tableros necesarios: ${totTab}   |   Aprovechamiento global: ${aT? (aP/aT*100).toFixed(1):'0.0'}%`, 12, 38);

  let yTab = 47;
  const habInc = (STATE.habilitados||[]).filter(h=>h.incluir && h.muebles>0);
  if(habInc.length){
    const txt = doc.splitTextToSize('Habilitados incluidos: ' + habInc.map(h=>`${h.nombre} (${h.muebles} mueble${h.muebles>1?'s':''})`).join('; '), 186);
    doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(51,65,85);
    doc.text(txt, 12, 43);
    yTab = 43 + txt.length*4.2 + 6;
  }
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(15,23,42);
  doc.text('Resumen de materiales y cantidades', 12, yTab);
  const body = resumen.map(r=>[r.material, nf(r.espesor), r.medidas.replace(/,/g,''), r.requeridas, r.colocadas+(r.sinColocar?` (${r.sinColocar} sin colocar)`:''), r.tableros, kerf, r.aprov.toFixed(1)+'%', `${(r.desperdicioMm2/1e6).toFixed(2)} m2 (${r.desperdicioPct.toFixed(1)}%)`]);
  body.push(['TOTAL','','',totReq,totCol,totTab,kerf,(aT?(aP/aT*100).toFixed(1):'0.0')+'%',`${((aT-aP)/1e6).toFixed(2)} m2 (${aT?((aT-aP)/aT*100).toFixed(1):'0.0'}%)`]);
  doc.autoTable({
    startY: yTab+3, margin:{left:12,right:12}, theme:'grid',
    head:[['Material','Espesor (mm)','Tablero (mm)','Piezas req.','Colocadas','Tableros','Kerf (mm)','Aprovech.','Desperdicio']],
    body, styles:{fontSize:8, cellPadding:1.6}, headStyles:{fillColor:[15,23,42]},
    didParseCell: d=>{ if(d.section==='body' && d.row.index===body.length-1){ d.cell.styles.fontStyle='bold'; d.cell.styles.fillColor=[226,232,240]; } }
  });

  let y = doc.lastAutoTable.finalY + 10;
  doc.setFont('helvetica','bold'); doc.setFontSize(11);
  doc.text('Cantidad total de tableros necesarios por material', 12, y);
  doc.autoTable({
    startY: y+3, margin:{left:12,right:12}, theme:'striped',
    head:[['Material','Espesor (mm)','Medida del tablero (mm)','Tableros necesarios']],
    body: resumen.map(r=>[r.material, nf(r.espesor), r.medidas.replace(/,/g,''), r.tableros]).concat([['TOTAL','','',totTab]]),
    styles:{fontSize:9, cellPadding:1.8}, headStyles:{fillColor:[37,99,235]},
    didParseCell: d=>{ if(d.section==='body' && d.row.index===resumen.length){ d.cell.styles.fontStyle='bold'; } }
  });
  if(result.unplaced.length){
    y = doc.lastAutoTable.finalY + 8;
    doc.setFontSize(10); doc.setTextColor(220,38,38);
    doc.text(`ATENCIÓN: ${result.unplaced.length} pieza(s) no se pudieron colocar`, 12, y);
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
    const lst = result.unplaced.slice(0,12).map(p=>`- ${p.name} (${nf(p.w)} x ${nf(p.h)} mm, ${p.material}): ${p.reason||'sin tablero disponible'}`);
    doc.text(lst, 12, y+5);
    doc.setTextColor(15,23,42);
  }

  // ---------- Lista general de cortes (todas las piezas del trabajo) ----------
  if(boards.length){
    const tot = Object.values(totalesPorCorte(boards, result.unplaced))
      .sort((a,b)=> a.material.localeCompare(b.material) || a.espesor-b.espesor || a.name.localeCompare(b.name));
    doc.addPage('a4','portrait');
    doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(15,23,42);
    doc.text('Lista general de cortes (todas las piezas)', 12, 16);
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(71,85,105);
    doc.text('Cantidad total que se ocupa de cada corte, sumando todos los tableros y los muebles de los habilitados incluidos.', 12, 21);
    doc.autoTable({
      startY: 25, margin:{left:12,right:12,bottom:14}, theme:'grid',
      head:[['Material','Esp.','Pieza','Medida final (ancho x largo mm)','Original','Se ocupan','En tableros']],
      body: tot.map(o=>[o.material, nf(o.espesor), o.name, `${nf(o.fw)} x ${nf(o.fh)}`,
        (o.ow!==undefined && (Math.abs(o.ow-o.fw)>0.01 || Math.abs(o.oh-o.fh)>0.01)) ? `${nf(o.ow)} x ${nf(o.oh)}` : '-',
        o.total + (o.sin?` (${o.sin} sin colocar)`:''), compactarNumeros([...o.tableros].filter(n=>n>0).sort((a,b)=>a-b))]),
      styles:{fontSize:7.5, cellPadding:1.3}, headStyles:{fillColor:[15,23,42]},
      columnStyles:{1:{cellWidth:10},5:{cellWidth:22}}
    });
  }

  // ---------- Una página por tablero: hoja HORIZONTAL y tablero girado 90° (largo en horizontal) ----------
  const muebTxt = textoMuebles();
  boards.forEach((b,idx)=>{
    const board = b.board, info = infoTablero(boards, idx, result.unplaced);
    doc.addPage('a4','landscape');
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
    const W = board.ancho, H = board.largo, m = margenTablero(board);
    const R = H >= W;                                   // girar si el largo es mayor que el ancho
    const piezas = b.placed.map((p,i)=>({...p, n:i+1}));
    const area = piezas.reduce((s2,p)=>s2+p.w*p.h,0), aprov = (W*H)? area/(W*H)*100 : 0;
    const rgbMat = hslAArreglo(hslColorFromString(board.material));

    // Encabezado
    doc.setFillColor(...rgbMat); doc.rect(0,0,pw,28,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(15,23,42);
    doc.text(`Tablero ${info.numero} de ${info.total} - ${board.material} - espesor ${nf(board.espesor)} mm`, 10, 8);
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
    doc.text(`Tablero ${info.secMat} de ${info.totMat} de este material | Medidas: ${nf(W)} x ${nf(H)} mm (ancho x largo) | Kerf: ${kerf} mm | Margen: ${nf(m)} mm | Veta: ${textoVeta(board.veta)}${R?' | Dibujo girado 90 grados':''}`, 10, 14);
    doc.text(`${piezas.length} piezas | Aprovechamiento ${aprov.toFixed(1)}% | Sobrante ${(100-aprov).toFixed(1)}% (${((W*H-area)/1e6).toFixed(2)} m2)`, 10, 19);
    if(muebTxt){ doc.setFont('helvetica','bold'); doc.setTextColor(30,64,175); doc.text(doc.splitTextToSize(muebTxt, pw-20)[0], 10, 24.5); doc.setTextColor(15,23,42); }

    // Leyenda en 1, 2 o 3 columnas según cuántos cortes distintos haya
    const leyenda = agruparLeyenda(piezas, info.totales);
    const ncol = leyenda.length<=5 ? 1 : leyenda.length<=10 ? 2 : 3;
    const porCol = Math.ceil(leyenda.length/ncol);
    const legH = 15 + porCol*5.4;

    // Zona de dibujo (el tablero ocupa el ancho de la hoja)
    const x0 = 26, y0 = 40;
    const availW = pw - x0 - 12, availH = ph - y0 - 24 - legH;
    const BW = R ? H : W, BH = R ? W : H;               // tamaño visible del tablero en la hoja
    const sc = Math.min(availW/BW, availH/BH);
    const bw = BW*sc, bh = BH*sc, bx = x0 + (availW-bw)/2, by = y0;
    // tablero -> hoja (giro de 90° en sentido antihorario si R)
    const T = (x,y,w,h)=> R ? {x:bx+y*sc, y:by+(W-x-w)*sc, w:h*sc, h:w*sc} : {x:bx+x*sc, y:by+y*sc, w:w*sc, h:h*sc};

    // Cotas
    doc.setDrawColor(51,65,85); doc.setLineWidth(0.25); doc.setTextColor(15,23,42); doc.setFontSize(8); doc.setFont('helvetica','bold');
    doc.line(bx, by-4, bx+bw, by-4); doc.line(bx, by-5.5, bx, by-2.5); doc.line(bx+bw, by-5.5, bx+bw, by-2.5);
    doc.text(`${nf(BW)} mm`, bx+bw/2, by-6, {align:'center'});
    doc.line(bx-5, by, bx-5, by+bh); doc.line(bx-6.5, by, bx-3.5, by); doc.line(bx-6.5, by+bh, bx-3.5, by+bh);
    doc.text(`${nf(BH)} mm`, bx-7, by+bh/2+doc.getTextWidth(`${nf(BH)} mm`)/2, {angle:90});

    // Tablero y margen
    doc.setFillColor(241,245,249); doc.setDrawColor(51,65,85); doc.setLineWidth(0.5);
    doc.rect(bx, by, bw, bh, 'FD');
    const mr = T(m, m, W-2*m, H-2*m);
    doc.setDrawColor(148,163,184); doc.setLineWidth(0.15); doc.setLineDashPattern([1,1],0);
    doc.rect(mr.x, mr.y, mr.w, mr.h); doc.setLineDashPattern([],0);

    // Kerf (franjas rojas) bajo las piezas
    doc.setFillColor(239,68,68);
    piezas.forEach(p=>{
      [T(p.x+p.w, p.y, kerf, p.h+kerf), T(p.x, p.y+p.h, p.w+kerf, kerf)].forEach(r=>{
        doc.rect(r.x, r.y, Math.max(r.w,0.3), Math.max(r.h,0.3), 'F');
      });
    });

    // Piezas
    doc.setLineWidth(0.2); doc.setDrawColor(15,23,42);
    piezas.forEach(p=>{
      const r = T(p.x, p.y, p.w, p.h);
      doc.setFillColor(...hslAArreglo(hslColorFromString(p.material+p.name)));
      doc.rect(r.x, r.y, r.w, r.h, 'FD');
      const sw = nf(R ? p.h : p.w), sh = nf(R ? p.w : p.h);   // medida del lado horizontal / vertical en la hoja
      const fe = Math.max(5, Math.min(9, Math.min(r.w,r.h)/5)), th = fe*0.3528, pad = th+1.8;
      doc.setFont('helvetica','bold'); doc.setFontSize(fe); doc.setTextColor(15,23,42);
      const topOk  = doc.getTextWidth(sw)+2 <= r.w && r.h >= pad*2+2;
      const leftOk = doc.getTextWidth(sh)+2 <= r.h && r.w >= pad*2+2;
      const enLados = topOk && leftOk;
      let rx = r.x, ry = r.y, rw = r.w, rh = r.h;
      if(enLados){
        doc.text(sw, r.x+r.w/2, r.y+th+1.2, {align:'center'});
        doc.text(sh, r.x+th+1.2, r.y+r.h/2+doc.getTextWidth(sh)/2, {angle:90});
        rx = r.x+pad; ry = r.y+pad; rw = r.w-pad-1; rh = r.h-pad-1;   // solo se reserva el lado donde está cada medida
      }
      const nombreTxt = `#${p.n} ${p.name}`;
      const texto = enLados ? nombreTxt : `${nombreTxt} ${sw}x${sh}`;
      const anchoPdf = (str,fs)=>{ doc.setFont('helvetica','bold'); doc.setFontSize(fs); return doc.getTextWidth(str); };
      const lay = ajustarNombre(texto, rw-1.2, rh-1, 8, 3.5, anchoPdf, 0.3528) || ajustarNombre(`#${p.n}`, rw-0.8, rh-0.8, 8, 3, anchoPdf, 0.3528);
      if(lay){
        doc.setFont('helvetica','bold'); doc.setFontSize(lay.fs); doc.setTextColor(15,23,42);
        const cx = rx+rw/2, cy = ry+rh/2;
        lay.lines.forEach((t,i)=>{
          const off = (i-(lay.lines.length-1)/2)*lay.lh;
          if(lay.vertical) doc.text(t, cx+off+lay.lh*0.3, cy+doc.getTextWidth(t)/2, {angle:90});
          else doc.text(t, cx, cy+off+lay.lh*0.3, {align:'center'});
        });
      }
    });

    // Leyenda (tabla de cortes) en columnas
    const gap = 4, colW = ncol===1 ? Math.min(170, pw-24) : (pw-24-(ncol-1)*gap)/ncol;
    for(let c=0;c<ncol;c++){
      const filas = leyenda.slice(c*porCol, (c+1)*porCol);
      if(!filas.length) continue;
      const left = 12 + c*(colW+gap);
      doc.autoTable({
        startY: by+bh+7, margin:{left, right: pw-left-colW, bottom:14}, tableWidth: colW, theme:'grid',
        head:[['#','Pieza','Aquí','Se ocupan','Medida final (mm)']],
        body: filas.map(r=>[r.nums, r.name, r.cant, r.total, r.med]),
        styles:{fontSize:6.5, cellPadding:0.8}, headStyles:{fillColor:[15,23,42], fontSize:6.2},
        columnStyles:{0:{cellWidth:13},2:{cellWidth:9},3:{cellWidth:14}}
      });
    }
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(71,85,105);
    doc.text('Aquí = piezas de ese corte en este tablero. Se ocupan = total de ese corte en todo el trabajo. Franja roja = separación de sierra (' + kerf + ' mm). Línea punteada = margen.', 12, ph-10.5);
  });

  // Pie de página
  const n = doc.getNumberOfPages();
  for(let i=1;i<=n;i++){
    doc.setPage(i);
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(100,116,139);
    doc.text(`Página ${i} de ${n}`, pw-12, ph-6, {align:'right'});
    doc.text(`Optimización de corte - ${ctx.fecha}`, 12, ph-6);
  }
}
// <<PDF-END

$('btnPdfOptim').onclick = ()=>{
  if(!STATE.bestResult){ toast('Ejecuta primero la optimización','error'); return; }
  if(STATE.ultimasEstrategias && STATE.firmaResultado !== firmaDatos()){
    calcularResultados(STATE.ultimasEstrategias);
    toast('Los datos cambiaron: se recalculó con los muebles y piezas actuales','success');
  }
  if(!window.jspdf){ toast('La librería de PDF no se ha cargado; revisa tu conexión','error'); return; }
  try{
    const doc = new window.jspdf.jsPDF({orientation:'portrait', unit:'mm', format:'a4'});
    const ahora = new Date();
    const r = STATE.bestResult;
    construirPdfOptimizacion(doc, r, {
      fecha: ahora.toLocaleString('es-MX'),
      proyecto: STATE.projectName || 'Sin guardar',
      modo: (r.mode || 'mixto')
    });
    const pad = n=>String(n).padStart(2,'0');
    doc.save(`optimizacion_corte_${ahora.getFullYear()}${pad(ahora.getMonth()+1)}${pad(ahora.getDate())}.pdf`);
    toast('PDF de optimización generado','success');
  }catch(e){
    console.error(e);
    toast('Error generando el PDF de optimización','error');
  }
};


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
    if(!Number.isInteger(cant)) warnings.push(`Fila ${it.fila}: cantidad por mueble ${cant} no es entera; al multiplicar por los muebles se redondea hacia arriba.`);

    let esp = parseNum(get('espesor'));
    if(esp>0) esp = round2(esp*factor);
    else {
      const m = it.material.match(/(\d+(?:\.\d+)?)\s*MM/i);
      if(m) esp = parseFloat(m[1]); else esp = NaN;
    }
    if(!(esp>0)){ it.estado='error'; it.motivo='Falta espesor'; warnings.push(`Fila ${it.fila}: falta espesor.`); continue; }

    // Veta: la del Excel si existe; si no, la que se elija en la revisión (por defecto: a lo largo del tablero)
    const vetaRaw = normTxt(get('veta'));
    let veta = ['largo','ancho','ninguna'].includes(opts.vetaDefault) ? opts.vetaDefault : 'ninguna';
    if(vetaRaw){
      if(vetaRaw.includes('largo')) veta = 'largo';
      else if(vetaRaw.includes('ancho')) veta = 'ancho';
      else if(/^(sin|ninguna|no$|x$|n\/a|na$)/.test(vetaRaw)) veta = 'ninguna';
    }

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
  $('impVeta').onchange = updateExcelPreview;
  $('impMuebles').oninput = updateExcelPreview;
  $('impHabNombre').value = _excelFileName.replace(/\.[^.]+$/,'');
  $('impMuebles').value = 1;
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
    vetaDefault: $('impVeta') ? $('impVeta').value : 'largo',
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
  const muebles = Math.max(1, Math.floor(+$('impMuebles').value||1));
  const piezasTot = ok.reduce((s,x)=>s+Math.ceil(+(x.cantidad*muebles).toFixed(6)),0);
  $('excelWarnings').innerHTML =
    `<b>${ok.length}</b> renglones entran a optimización (${piezasTot} piezas para ${muebles} mueble${muebles>1?'s':''}) · ${ign} ignorados por unidad · ${err} con error` +
    (res.warnings.length ? '<br>⚠️ ' + res.warnings.slice(0,12).map(escapeHtml).join('<br>⚠️ ') + (res.warnings.length>12?`<br>… y ${res.warnings.length-12} más`:'') : '');
  $('excelReviewTable').querySelector('thead').innerHTML =
    '<tr><th>Fila</th><th>Descripción</th><th>Unidad</th><th>Material</th><th>Esp. (mm)</th><th>Cant.</th><th>Veta</th>'+
    '<th>Ancho orig → final</th><th>Tol. ancho</th><th>Largo orig → final</th><th>Tol. largo</th><th>Estado</th></tr>';
  const rb = $('excelReviewTable').querySelector('tbody');
  rb.innerHTML = '';
  res.items.slice(0,400).forEach(x=>{
    const tr = document.createElement('tr');
    const bg = x.estado==='ignorada' ? '#f1f5f9;color:#94a3b8' : x.estado==='error' ? '#fee2e2' : '';
    tr.style.cssText = bg ? 'background:'+bg : '';
    const med = (o,f,t)=> x.estado==='ok' ? `${fmt(o,1)} → <b>${fmt(f,1)}</b>` : '';
    tr.innerHTML = `<td>${x.fila}</td><td>${escapeHtml(x.nombre)}</td><td>${escapeHtml(x.unidad)}</td><td>${escapeHtml(x.material)}</td>`+
      `<td>${x.estado==='ok'?fmt(x.espesor,1):''}</td><td>${x.estado==='ok'?x.cantidad:''}</td><td>${x.estado==='ok'?x.veta:''}</td>`+
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
  const hab = {
    id: uid(),
    nombre: ($('impHabNombre').value.trim() || _excelFileName.replace(/\.[^.]+$/,'')),
    muebles: Math.max(1, Math.floor(+$('impMuebles').value||1)),
    incluir: true, archivo: _excelFileName
  };
  ok.forEach(x=>{
    if(existentes.has(x.srcKey)){ dup++; return; }
    STATE.piezas.push({
      id: uid(), nombre: x.nombre, largo: x.largo, ancho: x.ancho,
      cantidad: x.cantidad, espesor: x.espesor, material: x.material,
      veta: x.veta, rot: x.veta==='ninguna', obs: '',
      habId: hab.id,
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
  if(count>0) STATE.habilitados.push(hab);
  renderPiezas(); renderTableros(); renderHabilitados();
  const msg = `Importadas ${count} piezas` + (dup?` · ${dup} ya existían`:'') + (errores?` · ${errores} con error`:'') + (nuevos?` · ${nuevos} tableros 2440×1220 creados`:'');
  if(count===0 && dup>0) toast('Ese archivo ya estaba importado: cambia su cantidad de muebles en Habilitados (no se duplicó nada).','error');
  else toast(msg + (count>0 ? ` · habilitado "${hab.nombre}" × ${hab.muebles} mueble(s)` : ''), errores?'error':'success');
  if(count>0 || dup>0) document.querySelector('.nav-btn[data-section="habilitados"]').click();
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
   HABILITADOS (cada Excel importado = un habilitado con N muebles)
   ========================================================= */
/** Piezas importadas con una versión anterior (sin habilitado): se agrupan por archivo en un habilitado de 1 mueble. */
function migrarHabilitadosLegacy(){
  const huerfanas = STATE.piezas.filter(p=>!p.habId && p.srcKey);
  if(!huerfanas.length) return;
  const grupos = {};
  huerfanas.forEach(p=>{ const arch = String(p.srcKey).split('#')[0]; (grupos[arch] = grupos[arch] || []).push(p); });
  Object.entries(grupos).forEach(([arch, ps])=>{
    const h = {id: uid(), nombre: arch.replace(/\.[^.]+$/,''), muebles: 1, incluir: true, archivo: arch};
    STATE.habilitados.push(h); ps.forEach(p=>{ p.habId = h.id; });
  });
}

/** Resumen del cálculo que se va a hacer (se muestra en Habilitados y junto a los botones de cálculo). */
function actualizarResumenHab(){
  const inc = STATE.habilitados.filter(h=>h.incluir && h.muebles>0);
  const piezasHab = inc.reduce((n,h)=>n+totalPiezasHab(h),0);
  const manuales = STATE.piezas.filter(p=>!p.habId).reduce((n,p)=>n+cantidadTotal(p),0);
  const detalle = inc.map(h=>`<b>${escapeHtml(h.nombre)} × ${h.muebles} mueble${h.muebles===1?'':'s'}</b>`).join(', ');
  if($('countHab')) $('countHab').textContent = STATE.habilitados.length;
  if($('habResumen')) $('habResumen').innerHTML = STATE.habilitados.length
    ? `Se cortarán juntos <b>${inc.length}</b> habilitado(s): ${detalle || '—'}.<br>Total: <b>${piezasHab}</b> piezas de habilitados` + (manuales?` + <b>${manuales}</b> piezas manuales`:'') + '.'
    : 'Aún no hay habilitados. Importa un Excel en "Importar Excel" y aparecerá aquí.';
  if($('optResumenEntrada')) $('optResumenEntrada').innerHTML = (piezasHab+manuales)
    ? `📋 Se calculará para: ${detalle || 'solo piezas manuales'}${manuales && detalle?' + piezas manuales':''} → <b>${piezasHab+manuales}</b> piezas en total. <button class="btn btn-sm btn-outline" id="btnIrHab" style="margin-left:6px">Cambiar muebles</button>`
    : '📋 No hay piezas para cortar: importa un Excel o revisa los habilitados incluidos y su cantidad de muebles.';
  if($('btnIrHab')) $('btnIrHab').onclick = ()=> document.querySelector('.nav-btn[data-section="habilitados"]').click();
}

function renderHabilitados(){
  migrarHabilitadosLegacy();
  const tb = $('tablaHab').querySelector('tbody');
  tb.innerHTML = '';
  STATE.habilitados.forEach(h=>{
    const piezas = STATE.piezas.filter(p=>p.habId===h.id);
    const porMueble = piezas.reduce((n,p)=>n+p.cantidad,0);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="text-align:center"><input type="checkbox" data-inc="${h.id}" ${h.incluir?'checked':''}></td>
      <td><b>${escapeHtml(h.nombre)}</b><br><small style="color:#6b7685">${escapeHtml(h.archivo||'')}</small></td>
      <td>${piezas.length}</td>
      <td>${fmt(porMueble,2).replace(/\.?0+$/,'')}</td>
      <td><input type="number" min="0" step="1" value="${h.muebles}" data-mue="${h.id}" style="width:80px;padding:6px 8px;border:1px solid var(--line);border-radius:7px"></td>
      <td><b id="habTot_${h.id}">${totalPiezasHab(h)}</b></td>
      <td class="actions"><button class="icon-btn" data-ren="${h.id}" title="Renombrar">✏️</button><button class="icon-btn del" data-delhab="${h.id}" title="Eliminar habilitado">🗑</button></td>`;
    tr.style.opacity = h.incluir ? '1' : '.55';
    tb.appendChild(tr);
  });
  tb.querySelectorAll('[data-inc]').forEach(c=>c.onchange=()=>{
    STATE.habilitados.find(h=>h.id===c.dataset.inc).incluir = c.checked;
    renderHabilitados(); renderPiezas();
  });
  tb.querySelectorAll('[data-mue]').forEach(i=>{
    const aplicar = (completo)=>{
      const h = STATE.habilitados.find(x=>x.id===i.dataset.mue);
      h.muebles = Math.max(0, Math.floor(+i.value||0));
      if(completo){ renderHabilitados(); renderPiezas(); }
      else { const t = $('habTot_'+h.id); if(t) t.textContent = totalPiezasHab(h); actualizarResumenHab(); saveAuto(); actualizarAvisoResultado(); }
    };
    i.oninput = ()=>aplicar(false);      // se aplica mientras escribes (no depende de salir del campo)
    i.onchange = ()=>aplicar(true);
  });
  tb.querySelectorAll('[data-ren]').forEach(b=>b.onclick=()=>{
    const h = STATE.habilitados.find(x=>x.id===b.dataset.ren);
    const n = prompt('Nombre del habilitado:', h.nombre); if(n && n.trim()){ h.nombre = n.trim(); renderHabilitados(); renderPiezas(); }
  });
  tb.querySelectorAll('[data-delhab]').forEach(b=>b.onclick=()=>{
    const h = STATE.habilitados.find(x=>x.id===b.dataset.delhab);
    if(!confirm(`¿Eliminar el habilitado "${h.nombre}" y sus ${STATE.piezas.filter(p=>p.habId===h.id).length} renglones?`)) return;
    STATE.piezas = STATE.piezas.filter(p=>p.habId!==h.id);
    STATE.habilitados = STATE.habilitados.filter(x=>x.id!==h.id);
    renderHabilitados(); renderPiezas();
  });
  actualizarResumenHab();
  saveAuto();
  actualizarAvisoResultado();
}
$('btnHabTodos').onclick = ()=>{ STATE.habilitados.forEach(h=>h.incluir=true); renderHabilitados(); renderPiezas(); };
$('btnHabNinguno').onclick = ()=>{ STATE.habilitados.forEach(h=>h.incluir=false); renderHabilitados(); renderPiezas(); };
$('btnHabCalcular').onclick = ()=> document.querySelector('.nav-btn[data-section="optimizacion"]').click();

/* =========================================================
   PROYECTOS (localStorage)
   ========================================================= */
function saveAuto(){
  const data = {
    tableros: STATE.tableros,
    piezas: STATE.piezas,
    habilitados: STATE.habilitados,
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
    STATE.habilitados = data.habilitados || [];
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
    tableros: STATE.tableros, piezas: STATE.piezas, habilitados: STATE.habilitados, sobrantes: STATE.sobrantes,
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
  STATE.tableros = data.tableros; STATE.piezas = data.piezas; STATE.habilitados = data.habilitados || [];
  STATE.sobrantes = data.sobrantes; STATE.params = data.params;
  STATE.projectName = data.projectName;
  renderTableros(); renderPiezas(); renderHabilitados(); renderSobrantes(); loadParamsUI();
  $('projInfo').innerHTML = `Proyecto: <b>${escapeHtml(sel)}</b>`;
  toast('Proyecto cargado','success');
};
$('btnNewProj').onclick = ()=>{
  if(!confirm('¿Crear nuevo proyecto? Se perderán los cambios no guardados.')) return;
  STATE.tableros = []; STATE.piezas = []; STATE.habilitados = []; STATE.sobrantes = [];
  STATE.lastResult = null; STATE.projectName = 'Sin guardar';
  renderTableros(); renderPiezas(); renderHabilitados(); renderSobrantes();
  $('projInfo').innerHTML = 'Proyecto: <b>Sin guardar</b>';
  toast('Nuevo proyecto');
};
$('btnExpProj').onclick = ()=>{
  const data = {tableros:STATE.tableros, piezas:STATE.piezas, habilitados:STATE.habilitados, sobrantes:STATE.sobrantes, params:STATE.params, projectName:STATE.projectName};
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
      STATE.habilitados = data.habilitados || [];
      if(data.sobrantes) STATE.sobrantes = data.sobrantes;
      if(data.params) STATE.params = data.params;
      if(data.projectName) STATE.projectName = data.projectName;
      renderTableros(); renderPiezas(); renderHabilitados(); renderSobrantes(); loadParamsUI();
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
  renderHabilitados();
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
