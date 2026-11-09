/* =========================================================
   CUTFIX PRO -- Motor de optimización y UI
   Autor: Sistema original (basado en conceptos públicos de
   Guillotine bin packing y MaxRects).
   ========================================================= */

/* ---------- ESTADO GLOBAL ---------- */
const STATE = {
  tableros: [],
  piezas: [],
  habilitados: [],   // [{id, nombre, muebles, incluir, archivo}]
  sobrantes: [],
  params: { kerf:3, tolPos:0, tolNeg:0, margenPer:10, sepMin:3, margenSeg:0, comp:0, rotGlobal:false, veta:true, criterio:'tableros', nombreGuion:true },
  lastResult: null,
  editTabId: null,
  editPiezaId: null,
  excelRows: null,
  excelCols: null,
  zoom: 1,
  orientacion: 'horizontal',   // giro VISUAL del tablero: 'horizontal' | 'vertical' (no afecta el cálculo)
  projectName: 'Sin guardar'
};

const uid = () => '_' + Math.random().toString(36).slice(2,10);
const $ = id => document.getElementById(id);
/* ---------- ICONOS (sprite SVG definido en index.html) ---------- */
const ico = (n,cls='ico') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
function setBtn(btn, icon, text){ btn.innerHTML = ico(icon)+'<span>'+text+'</span>'; }
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
    if(window.innerWidth <= 1024) $('sidebar').classList.remove('open');
  });
});

/* ---------- MENÚ MÓVIL ---------- */
const menuToggle = $('menuToggle');
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
        <button class="icon-btn" data-edit="${t.id}" title="Editar">${ico('edit')}</button>
        <button class="icon-btn" data-dup="${t.id}" title="Duplicar">${ico('copy')}</button>
        <button class="icon-btn del" data-del="${t.id}" title="Eliminar">${ico('delete')}</button>
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
  setBtn($('btnAddTablero'),'save','Actualizar tablero');
  $('btnCancelTablero').style.display='inline-block';
}

function clearTableroForm(){
  $('tNombre').value=''; $('tLargo').value=2440; $('tAncho').value=1220;
  $('tEspesor').value=18; $('tPrecio').value=0; $('tColor').value='#c8a878';
  $('tVeta').value='largo'; $('tCantidad').value=10; $('tMargen').value=0;
  STATE.editTabId=null;
  setBtn($('btnAddTablero'),'add','Agregar tablero');
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
        <button class="icon-btn" data-edit="${p.id}">${ico('edit')}</button>
        <button class="icon-btn" data-dup="${p.id}">${ico('copy')}</button>
        <button class="icon-btn del" data-del="${p.id}">${ico('delete')}</button>
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
  setBtn($('btnAddPieza'),'save','Actualizar pieza');
  $('btnCancelPieza').style.display='inline-block';
}
function clearPiezaForm(){
  $('pNombre').value=''; $('pLargo').value=0; $('pAncho').value=0;
  $('pCant').value=1; $('pEspesor').value=18; $('pMaterial').value='Melamina';
  $('pVeta').value='ninguna'; $('pRot').value='true'; $('pObs').value='';
  STATE.editPiezaId=null;
  setBtn($('btnAddPieza'),'add','Agregar pieza');
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
    prRotGlobal:'rotGlobal', prVeta:'veta', prCriterio:'criterio', prNombreGuion:'nombreGuion'
  };
  Object.entries(map).forEach(([elId,key])=>{
    const el = $(elId);
    el.addEventListener('input', ()=>{
      let v = el.value;
      if(['rotGlobal','veta','nombreGuion'].includes(key)) v = (v==='true');
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
  $('prNombreGuion').value=String(STATE.params.nombreGuion !== false);
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
function nombreCorto(n, cortar){
  const t = String(n==null ? '' : n).trim();
  // SÍ (por defecto): recorta después del último guion. NO: conserva el nombre original completo.
  if(cortar === undefined) cortar = !(typeof STATE !== 'undefined' && STATE.params && STATE.params.nombreGuion === false);
  if(!cortar) return t;
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
   MODO 4: MIXTO (LARGO + ANCHO)
   ========================================================= */
/**
 * Estrategia en dos fases por tablero (no modifica ningún otro método):
 *  FASE 1 (prioridad: LARGO): forma franjas a lo largo del tablero con piezas que comparten la misma
 *    medida transversal (mismo ancho). Elige primero las franjas que mejor llenan la longitud
 *    (voraz + mochila 1D para refinar). Solo confirma franjas con llenado >= minFill.
 *  FASE 2 (prioridad: ANCHO / sobrantes): con todos los espacios libres reales (restos al final de cada
 *    franja + columna sobrante) coloca las piezas restantes en cualquier orientación permitida
 *    (incluida la transversal), mejor-ajuste con cortes de guillotina y kerf.
 * Se prueban varias combinaciones (umbral de llenado x orden de piezas) y se conserva la que
 * coloca más área en el tablero (desempate: menos cortes).
 * Reutiliza: orientaciones() (rotación + veta), margenTablero(), STATE.params.kerf y el formato
 * de salida {placed, unplaced, freeRegions, cuts} de los demás optimizadores.
 */
function optimizeLargoAncho(pieces, board){
  const m = margenTablero(board), kerf = STATE.params.kerf, EPS = 0.01;
  const Ltot = board.largo - 2*m;      // eje largo (y): sentido de las franjas
  const Ctot = board.ancho - 2*m;      // eje ancho (x): sentido transversal

  const noCaben = [], items = [];
  pieces.forEach(p=>{
    const os = orientaciones(p, board).filter(o=> o.h <= Ltot+EPS && o.w <= Ctot+EPS);
    if(os.length) items.push({p, os}); else noCaben.push(p);
  });

  // ---- 1D: qué piezas forman una franja a lo largo (prefiere el mismo ancho; admite más angostas) ----
  // Cada candidato = {it, o} con una sola orientación por pieza. Valor = área; peso = largo + kerf.
  function llenarFranja(cands, c){
    const ord = cands.slice().sort((a,b)=> b.o.w - a.o.w || b.o.h - a.o.h);
    const sel = []; let usedL = 0, areaP = 0;
    for(const k of ord){
      const need = usedL + (sel.length ? kerf : 0) + k.o.h;
      if(need <= Ltot+EPS){ sel.push(k); usedL = need; areaP += k.o.w*k.o.h; }
    }
    return {sel, usedL, areaP, ord, c};
  }
  function mejorarFranja(r){
    const ord = r.ord, n = ord.length;
    if(n < 2 || n > 400 || r.usedL >= Ltot-EPS) return r;
    const cap = Math.floor(Ltot + kerf + EPS), W = cap+1;
    const wts = ord.map(k=> Math.ceil(k.o.h + kerf - 1e-9));   // redondeo hacia arriba: nunca excede
    const dp = new Float64Array(W), take = new Uint8Array(n*W);
    for(let i=0;i<n;i++){
      const wi = wts[i], vi = ord[i].o.w*ord[i].o.h;
      for(let w=cap; w>=wi; w--){
        const v = dp[w-wi] + vi;
        if(v > dp[w] + 1e-6){ dp[w] = v; take[i*W+w] = 1; }
      }
    }
    let w = cap; const sel = [];
    for(let i=n-1;i>=0;i--){ if(take[i*W+w]){ sel.push(ord[i]); w -= wts[i]; } }
    if(!sel.length) return r;
    const areaP = sel.reduce((s,k)=>s+k.o.w*k.o.h,0);
    const usedL = sel.reduce((s,k)=>s+k.o.h,0) + (sel.length-1)*kerf;
    return (areaP > r.areaP + 1e-6 && usedL <= Ltot+EPS) ? {sel, usedL, areaP, ord, c:r.c} : r;
  }
  const llenado = r => r.areaP / (Ltot * r.c);
  const mejorQue = (a,b)=>{            // ¿franja a mejor que b? (llenado en pasos de 2%, luego área colocada)
    const ka = Math.round(llenado(a)*50), kb = Math.round(llenado(b)*50);
    return ka!==kb ? ka>kb : a.areaP > b.areaP;
  };

  // ---- FASE 1: franjas a lo largo ----
  function fase1(minFill, semilla){
    let pool = items.slice();
    const strips = [], placed = [], libres = [];
    let usedC = 0;
    while(pool.length){
      const c0 = strips.length ? usedC + kerf : 0;
      const Cdisp = Ctot - c0;
      if(Cdisp < EPS) break;
      // anchos de franja posibles = medidas transversales distintas de las piezas pendientes
      const anchos = new Map();
      pool.forEach(it=> it.os.forEach(o=>{ if(o.w <= Cdisp+EPS) anchos.set(Math.round(o.w*100), o.w); }));
      const evals = [];
      const cMax = Math.max(...anchos.values());
      anchos.forEach(c=>{
        if(semilla==='ancho' && c < cMax-EPS) return;
        const cands = [];
        pool.forEach(it=>{                       // una sola orientación por pieza: la más ancha que cabe
          let o = null;
          it.os.forEach(x=>{ if(x.w <= c+EPS && (!o || x.w > o.w)) o = x; });
          if(o) cands.push({it, o});
        });
        const r = llenarFranja(cands, c);
        if(r.sel.length) evals.push(r);
      });
      if(!evals.length) break;
      evals.sort((a,b)=> mejorQue(a,b) ? -1 : (mejorQue(b,a) ? 1 : 0));
      let mejor = null;
      evals.slice(0,3).forEach(e=>{ const r = mejorarFranja(e); if(!mejor || mejorQue(r,mejor)) mejor = r; });
      if(llenado(mejor) < minFill) break;

      // colocar: más anchas primero (las del mismo ancho quedan juntas y sus huecos laterales se unen)
      const sel = mejor.sel.slice().sort((a,b)=> b.o.w - a.o.w || b.o.h - a.o.h);
      let lOff = 0, run = null;
      const cierraRun = ()=>{ if(run && run.w > EPS) libres.push({x:run.x, y:run.y, w:run.w, h:run.h}); run = null; };
      sel.forEach((k,i)=>{
        if(i) lOff += kerf;
        placed.push({...k.it.p, x:m+c0, y:m+lOff, w:k.o.w, h:k.o.h, rotated:k.o.rot, boardId:board.instanceId});
        const gapW = mejor.c - k.o.w - kerf;                     // hueco lateral junto a esta pieza
        if(run && Math.abs(run.cw - k.o.w) < EPS){ run.h = (m+lOff+k.o.h) - run.y; }
        else { cierraRun(); run = {cw:k.o.w, x:m+c0+k.o.w+kerf, y:m+lOff, w:gapW, h:k.o.h}; }
        lOff += k.o.h;
      });
      cierraRun();
      const usados = new Set(sel.map(k=>k.it));
      pool = pool.filter(it=>!usados.has(it));
      strips.push({c0, c:mejor.c});
      usedC = c0 + mejor.c;
      const l0 = lOff + kerf;                                     // resto al final de la franja
      if(Ltot - l0 > EPS) libres.push({x:m+c0, y:m+l0, w:mejor.c, h:Ltot-l0});
    }
    const cSobra = strips.length ? usedC + kerf : 0;              // columna sobrante a lo ancho
    if(Ctot - cSobra > EPS) libres.push({x:m+cSobra, y:m, w:Ctot-cSobra, h:Ltot});
    return {strips, placed, pool, libres};
  }

  // ---- FASE 2: aprovechar todos los sobrantes (cualquier orientación permitida) ----
  const ordenFns = {
    area:  (a,b)=> (b.p.w*b.p.h) - (a.p.w*a.p.h),
    largo: (a,b)=> Math.max(b.p.w,b.p.h) - Math.max(a.p.w,a.p.h) || (b.p.w*b.p.h)-(a.p.w*a.p.h),
    ancho: (a,b)=> Math.min(b.p.w,b.p.h) - Math.min(a.p.w,a.p.h) || (b.p.w*b.p.h)-(a.p.w*a.p.h)
  };
  function fase2(libresIni, pool, orden){
    const regs = libresIni.map((r,i)=>({...r, root:i}));
    const placed = [], sin = [], raices = new Set();
    for(const it of pool.slice().sort(ordenFns[orden])){
      let best = null;
      regs.forEach((reg,ri)=>{
        for(const o of it.os){
          if(o.w <= reg.w+EPS && o.h <= reg.h+EPS){
            const sw = reg.w-o.w, sh = reg.h-o.h;
            const score = Math.min(sw,sh)*1e5 + Math.max(sw,sh);
            if(!best || score < best.score) best = {ri, o, score};
          }
        }
      });
      if(!best){ sin.push(it); continue; }
      const reg = regs[best.ri], o = best.o;
      placed.push({...it.p, x:reg.x, y:reg.y, w:o.w, h:o.h, rotated:o.rot, boardId:board.instanceId});
      raices.add(reg.root);
      const rightW = reg.w-o.w-kerf, bottomH = reg.h-o.h-kerf, rt = reg.root;
      const A = [], B = [];
      if(rightW > EPS)  A.push({x:reg.x+o.w+kerf, y:reg.y, w:rightW, h:reg.h, root:rt});
      if(bottomH > EPS) A.push({x:reg.x, y:reg.y+o.h+kerf, w:o.w, h:bottomH, root:rt});
      if(bottomH > EPS) B.push({x:reg.x, y:reg.y+o.h+kerf, w:reg.w, h:bottomH, root:rt});
      if(rightW > EPS)  B.push({x:reg.x+o.w+kerf, y:reg.y, w:rightW, h:o.h, root:rt});
      const maxA = A.reduce((s,r)=>Math.max(s,r.w*r.h),0), maxB = B.reduce((s,r)=>Math.max(s,r.w*r.h),0);
      regs.splice(best.ri, 1, ...(maxA >= maxB ? A : B));
    }
    return {placed, sin, regs, cuts: placed.length + raices.size};
  }

  // ---- Combinar variantes y quedarse con la que más área coloca ----
  const cands = [];
  ['llenado','ancho'].forEach(sem=> [0.85, 0.7, 0.5, 0.3, 0].forEach(mf=>{ const f = fase1(mf, sem); if(f.strips.length) cands.push(f); }));
  if(!cands.length) cands.push(fase1(0, 'ancho'));   // asegura que siempre se intente al menos una franja

  let mejor = null;
  cands.forEach(f1=>{
    Object.keys(ordenFns).forEach(ord=>{
      const f2 = fase2(f1.libres, f1.pool, ord);
      const placed = f1.placed.concat(f2.placed);
      const area = usedArea(placed);
      const cuts = f1.strips.length + f1.placed.length + f2.cuts;
      if(!mejor || area > mejor.area + 1e-6 || (Math.abs(area-mejor.area) <= 1e-6 && cuts < mejor.cuts))
        mejor = {placed, area, cuts, f2};
    });
  });
  return {
    placed: mejor.placed,
    unplaced: noCaben.concat(mejor.f2.sin.map(it=>it.p)),
    freeRegions: mejor.f2.regs.filter(r=>r.w>EPS && r.h>EPS).map(({x,y,w,h})=>({x,y,w,h})),
    cuts: mejor.cuts
  };
}

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
    'anchura':  (p,b)=>optimizeFranjas(p,b,{sentido:'anchura'}),
    'mixto (largo + ancho)': optimizeLargoAncho
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
      el.innerHTML = `${ico('warn','ico ico-inline')} <b>${sin.length} pieza(s) NO se pudieron colocar</b> (${escapeHtml(mot)}). Si es por falta de tableros, aumenta la cantidad disponible en Tableros y vuelve a calcular.`;
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

$('prNombreGuion').addEventListener('change', ()=>{
  if(STATE.ultimasEstrategias){ calcularResultados(STATE.ultimasEstrategias); toast('Identificación de piezas actualizada en los planos','success'); }
});
$('btnRecalcular').onclick = ()=>{
  if(STATE.ultimasEstrategias){ calcularResultados(STATE.ultimasEstrategias); toast('Planos recalculados con los datos actuales','success'); }
};
// Cualquier cambio en datos o parámetros revisa si el cálculo mostrado sigue vigente
document.addEventListener('change', ()=> setTimeout(actualizarAvisoResultado,0));
document.addEventListener('input',  ()=> setTimeout(actualizarAvisoResultado,0));

$('btnOptLongitud').onclick = ()=> ejecutarOptimizacion([{name:'Por longitud', mode:'longitud'}]);
$('btnOptAnchura').onclick  = ()=> ejecutarOptimizacion([{name:'Por anchura',  mode:'anchura'}]);
$('btnOptMixtoLA').onclick   = ()=> ejecutarOptimizacion([{name:'Mixto (Largo + Ancho)', mode:'mixto (largo + ancho)'}]);
// ÓPTIMO: compara todos los métodos y se queda con el mejor según el criterio de prioridad
$('btnOptimize').onclick = ()=> ejecutarOptimizacion([
  {name:'Por longitud', mode:'longitud'},
  {name:'Por anchura',  mode:'anchura'},
  {name:'Guillotine',   mode:'guillotine'},
  {name:'MaxRects',     mode:'maxrects'},
  {name:'Mixto',        mode:'mixto'},
  {name:'Mixto (Largo + Ancho)', mode:'mixto (largo + ancho)'}
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
    ? `${ico('check','ico ico-inline')} Resultado del método <b>${best.name}</b> — ${best.metrics.tableros} tableros, ${best.metrics.aprovechamiento.toFixed(2)}% aprovechamiento.`
    : `${ico('check','ico ico-inline')} Mejor resultado según criterio <b>"${STATE.params.criterio}"</b>: <b>${best.name}</b> — ${best.metrics.tableros} tableros, ${best.metrics.aprovechamiento.toFixed(2)}% aprovechamiento.`;
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

function applyZoom(){ aplicarZoomSvg($('planoContainer').querySelector('svg')); }
/** Zoom vectorial: se cambia el tamaño real del SVG (no un transform), así el dibujo se re-renderiza nítido en cada nivel. */
function aplicarZoomSvg(svg){
  if(!svg) return;
  const w = +svg.getAttribute('width') || 600, z = STATE.zoom;
  const cw = svg.parentElement ? svg.parentElement.clientWidth - 40 : 0;
  const base = cw > 120 ? Math.min(w, cw) : w;      // si la sección está oculta, usa el tamaño natural
  svg.style.transform = 'none';
  svg.style.width = (base*z) + 'px';
  svg.style.height = 'auto';
  svg.style.maxWidth = z > 1.0001 ? 'none' : '100%';
}

// <<PLANO-START (sin DOM; se prueba por separado)
const textoVeta = v => v==='largo' ? 'a lo largo' : v==='ancho' ? 'a lo ancho' : 'sin veta';
const nf = n => Number.isInteger(+n) ? fmt(n,0) : fmt(n,1);
const escSvg = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const truncTxt = (s,n)=> s.length>n ? s.slice(0,Math.max(1,n-1))+'…' : s;

/** ¿Se dibuja el tablero girado 90°? 'horizontal' = lado largo en horizontal; 'vertical' = lado largo en vertical. Solo afecta el dibujo. */
function giroActivo(board){
  return STATE.orientacion==='vertical' ? board.ancho > board.largo : board.largo >= board.ancho;
}

/**
 * Rectángulo punteado vectorial con separación UNIFORME: cada lado empieza y termina con trazo completo y la
 * separación se ajusta para que el patrón encaje exacto (sin trazos pegados, cortados ni superpuestos).
 * ext = prolongación en las esquinas (mitad del grosor) para que cierren limpias. Devuelve [[x1,y1,x2,y2],...].
 */
function segmentosRectPunteado(x,y,w,h,dash,gap,ext){
  const out = []; ext = ext||0;
  const lado = (x1,y1,x2,y2)=>{
    const L = Math.hypot(x2-x1,y2-y1); if(!(L>0)) return;
    const ux=(x2-x1)/L, uy=(y2-y1)/L;
    let n = Math.max(1, Math.round((L+gap)/(dash+gap)));
    let g = n>1 ? (L-n*dash)/(n-1) : 0;
    while(n>1 && g<gap*0.7){ n--; g = n>1 ? (L-n*dash)/(n-1) : 0; }
    if(n===1){ out.push([x1-ux*ext,y1-uy*ext,x2+ux*ext,y2+uy*ext]); return; }
    for(let i=0;i<n;i++){
      let a=i*(dash+g), b=a+dash;
      if(i===0) a-=ext;
      if(i===n-1) b+=ext;
      out.push([x1+ux*a,y1+uy*a,x1+ux*b,y1+uy*b]);
    }
  };
  lado(x,y,x+w,y); lado(x+w,y,x+w,y+h); lado(x+w,y+h,x,y+h); lado(x,y+h,x,y);
  return out;
}
const dPath = segs => segs.map(g=>`M${g[0].toFixed(2)} ${g[1].toFixed(2)}L${g[2].toFixed(2)} ${g[3].toFixed(2)}`).join('');

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

const nombreTablero = board => String(board.nombre || board.material || '').replace(/\s*\(auto\)\s*$/i,'').trim() || String(board.material||'');

/** Resta un rectángulo ocupado `o` de una lista de rectángulos libres (quedan los libres máximos). */
function restarRect(libres, o){
  const EPS = 0.01, next = [];
  for(const f of libres){
    if(o.x >= f.x+f.w-EPS || o.x+o.w <= f.x+EPS || o.y >= f.y+f.h-EPS || o.y+o.h <= f.y+EPS){ next.push(f); continue; }
    if(o.y > f.y+EPS) next.push({x:f.x, y:f.y, w:f.w, h:o.y-f.y});
    if(o.y+o.h < f.y+f.h-EPS) next.push({x:f.x, y:o.y+o.h, w:f.w, h:f.y+f.h-(o.y+o.h)});
    if(o.x > f.x+EPS) next.push({x:f.x, y:f.y, w:o.x-f.x, h:f.h});
    if(o.x+o.w < f.x+f.w-EPS) next.push({x:o.x+o.w, y:f.y, w:f.x+f.w-(o.x+o.w), h:f.h});
  }
  const unicos = [], vistos = new Set();
  next.forEach(r=>{ const k = [r.x,r.y,r.w,r.h].map(v=>Math.round(v*100)).join('|'); if(!vistos.has(k)){ vistos.add(k); unicos.push(r); } });
  return unicos.filter((a,i)=>!unicos.some((b,j)=> j!==i && b.x<=a.x+EPS && b.y<=a.y+EPS && b.x+b.w>=a.x+a.w-EPS && b.y+b.h>=a.y+a.h-EPS) && a.w>EPS && a.h>EPS);
}

/** Rectángulos libres máximos del tablero dado un conjunto de rectángulos ocupados (incluyen su kerf). */
function rectsLibres(base, ocupados){
  let libres = [{...base}];
  for(const o of ocupados) libres = restarRect(libres, o);
  return libres;
}

/**
 * Sobrantes de un tablero, como si fueran otros tableros: se descuenta el margen del tablero y el corte de
 * sierra (kerf) alrededor de cada pieza. Se toma siempre el rectángulo libre más grande, luego el siguiente
 * (sin traslaparse, separados por un kerf) hasta cubrir todo el espacio libre mayor a `minLado` mm por lado.
 * Devuelve {x,y,w,h}: w = medida a lo ancho del tablero, h = medida a lo largo.
 */
function calcularSobrantes(board, placed, opts){
  const m = margenTablero(board), kerf = STATE.params.kerf;
  const minLado = (opts && opts.minLado) || 15, max = (opts && opts.max) || 12;
  const base = {x:m, y:m, w:board.ancho-2*m, h:board.largo-2*m};
  let libres = rectsLibres(base, placed.map(p=>({x:p.x-kerf, y:p.y-kerf, w:p.w+2*kerf, h:p.h+2*kerf})));
  const out = [];
  while(out.length < max){
    let best = null;
    libres.forEach(r=>{ if(r.w>=minLado && r.h>=minLado && (!best || r.w*r.h > best.w*best.h)) best = r; });
    if(!best) break;
    out.push({x:best.x, y:best.y, w:Math.round(best.w*100)/100, h:Math.round(best.h*100)/100});
    libres = restarRect(libres, {x:best.x-kerf, y:best.y-kerf, w:best.w+2*kerf, h:best.h+2*kerf});
  }
  return out;
}

/** Texto compacto con las medidas de todos los sobrantes, partido en renglones de hasta `maxChars` caracteres. */
function lineasSobrantes(sob, maxChars, separador){
  if(!sob.length) return [];
  const sep = separador || '×';
  const toks = sob.map((r,i)=>`S${i+1} ${nf(r.w)}${sep}${nf(r.h)}`);
  const lines = [];
  let cur = '';
  toks.forEach(t=>{ const n = cur ? cur+'  ·  '+t : t; if(cur && n.length>maxChars){ lines.push(cur); cur = t; } else cur = n; });
  if(cur) lines.push(cur);
  return lines;
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
  const R = giroActivo(board);                       // giro visual de 90° (no toca las coordenadas calculadas)
  const BW = R ? H : W, BH = R ? W : H;              // tamaño visible del tablero
  const scale = Math.min(860/BW, 760/BH, 1.2);
  const bw = BW*scale, bh = BH*scale;
  const top = 138, left = 70, right = 30;
  const svgW = Math.max(left+bw+right, 600);
  const x0 = left + (svgW-left-right-bw)/2, y0 = top;
  // tablero (mm) -> dibujo (px). Con giro: ancho<->largo y eje invertido (90° antihorario), igual que en el PDF.
  const T = (x,y,w,h)=> R ? {x:x0+y*scale, y:y0+(W-x-w)*scale, w:h*scale, h:w*scale} : {x:x0+x*scale, y:y0+y*scale, w:w*scale, h:h*scale};
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
  const sobrantes = calcularSobrantes(board, placed);
  if(sobrantes.length){ leyenda.push('SOBRANTES (ancho × largo, mm; ya sin kerf ni margen):'); lineasSobrantes(sobrantes, 80).forEach(t=>leyenda.push(t)); }
  const legY = y0 + bh + 40, lh = 15;
  const svgH = legY + 22 + leyenda.length*lh + 50;

  let s = '';
  s += `<svg xmlns="http://www.w3.org/2000/svg" class="plano-svg" shape-rendering="geometricPrecision" text-rendering="geometricPrecision" width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" font-family="Segoe UI, Arial, sans-serif">`;
  s += `<defs><pattern id="hatch${uid2}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="8" stroke="#cbd5e1" stroke-width="1"/></pattern>`+
       `<marker id="arr${uid2}" markerWidth="6" markerHeight="6" refX="4" refY="3" orient="auto"><polygon points="0,0 6,3 0,6" fill="#7c2d12"/></marker></defs>`;
  s += `<rect width="${svgW}" height="${svgH}" fill="#fff"/>`;

  // Encabezado
  s += `<text x="${svgW-20}" y="24" text-anchor="end" font-size="13" font-weight="800" letter-spacing="1.2" fill="#2358e6">CUTFIX PRO</text>`;
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
  s += `<text x="${x0+bw/2}" y="${ty-5}" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a">${fmt(BW)} mm</text>`;
  s += `<text transform="translate(${x0-22} ${y0+bh/2}) rotate(-90)" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a">${fmt(BH)} mm</text>`;

  // Tablero: fondo, sobrante rayado y margen
  s += `<rect x="${x0}" y="${y0}" width="${bw}" height="${bh}" fill="#f8fafc" stroke="#334155" stroke-width="2"/>`;
  s += `<rect x="${x0}" y="${y0}" width="${bw}" height="${bh}" fill="url(#hatch${uid2})"/>`;
  { const mr = T(m, m, W-2*m, H-2*m);   // margen perimetral: trazos vectoriales con separación uniforme
    s += `<path d="${dPath(segmentosRectPunteado(mr.x, mr.y, mr.w, mr.h, 4, 3, 0.5))}" fill="none" stroke="#94a3b8" stroke-width="1" stroke-linecap="butt"/>`; }

  // Bandas de kerf (debajo de las piezas)
  if(opts.showCuts){
    // Franjas de kerf opacas y sin traslape (la segunda franja no repite la esquina de la primera)
    const mk = r => `<rect x="${r.x.toFixed(2)}" y="${r.y.toFixed(2)}" width="${Math.max(r.w,1.5).toFixed(2)}" height="${Math.max(r.h,1.5).toFixed(2)}" fill="#f28b8b"/>`;
    piezas.forEach(p=>{ s += mk(T(p.x+p.w, p.y, kerf, p.h+kerf)); s += mk(T(p.x, p.y+p.h, p.w, kerf)); });
  }

  // Medidas centradas sobre cada lado (ancho arriba, alto a la izquierda) + nombre COMPLETO al centro
  const etiquetas = (x,y,w,h,vw,vh,nombreTxt)=>{
    let o = '';
    const sw = nf(vw), sh = nf(vh);
    const fe = Math.max(7, Math.min(12, Math.min(w,h)/9)), pad = fe+3;
    const topOk  = opts.showDims && w >= sw.length*fe*0.6+6 && h >= pad*2+2;
    const leftOk = opts.showDims && h >= sh.length*fe*0.6+6 && w >= pad*2+2;
    const enLados = topOk && leftOk;
    let rx = x, ry = y, rw = w, rh = h;
    if(enLados){
      o += `<text x="${x+w/2}" y="${y+fe+1}" text-anchor="middle" font-size="${fe.toFixed(1)}" font-weight="600" fill="#0f172a">${sw}</text>`;
      o += `<text transform="translate(${x+fe+1} ${y+h/2}) rotate(-90)" text-anchor="middle" font-size="${fe.toFixed(1)}" font-weight="600" fill="#0f172a">${sh}</text>`;
      rx = x+pad; ry = y+pad; rw = w-pad-2; rh = h-pad-2;   // solo se reserva el lado donde está cada medida
    }
    const texto = enLados ? nombreTxt : (opts.showDims ? `${nombreTxt} ${sw}×${sh}` : nombreTxt);
    const anchoPx = (str,fs)=> str.length*fs*0.62;
    const numero = nombreTxt.split(' ')[0];
    const lay = ajustarNombre(texto, rw-4, rh-3, 12, 5.5, anchoPx, 1) || ajustarNombre(numero, rw-2, rh-2, 12, 5, anchoPx, 1);
    if(lay){
      const cx = rx+rw/2, cy = ry+rh/2;
      lay.lines.forEach((t,i)=>{
        const off = (i-(lay.lines.length-1)/2)*lay.lh;
        o += lay.vertical
          ? `<text transform="translate(${cx} ${cy}) rotate(-90)" y="${off}" text-anchor="middle" dominant-baseline="middle" font-size="${lay.fs.toFixed(1)}" font-weight="600" fill="#0f172a">${escSvg(t)}</text>`
          : `<text x="${cx}" y="${cy+off}" text-anchor="middle" dominant-baseline="middle" font-size="${lay.fs.toFixed(1)}" font-weight="600" fill="#0f172a">${escSvg(t)}</text>`;
      });
    }
    return o;
  };

  // Sobrantes (como otro tablero: verde punteado)
  sobrantes.forEach((r,i)=>{
    const q = T(r.x, r.y, r.w, r.h), x = q.x, y = q.y, w = q.w, h = q.h;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#bbf7d0" fill-opacity="0.55"/>`;
    s += `<path d="${dPath(segmentosRectPunteado(x, y, w, h, 6, 4, 0.75))}" fill="none" stroke="#16a34a" stroke-width="1.5" stroke-linecap="butt"/>`;
    s += etiquetas(x,y,w,h, R ? r.h : r.w, R ? r.w : r.h, `S${i+1} SOBRANTE`);
  });

  // Piezas
  piezas.forEach(p=>{
    const q = T(p.x, p.y, p.w, p.h), x = q.x, y = q.y, w = q.w, h = q.h;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${hslColorFromString(p.material+p.name)}" fill-opacity="0.85" stroke="#0f172a" stroke-width="1"/>`;
    if(opts.showVeta && p.veta!=='ninguna' && w>26 && h>26){
      const vertical = ((p.veta==='largo') !== !!p.rotated) !== R;
      s += vertical
        ? `<line x1="${x+7}" y1="${y+h*0.2}" x2="${x+7}" y2="${y+h*0.8}" stroke="#7c2d12" stroke-width="1.4" marker-end="url(#arr${uid2})"/>`
        : `<line x1="${x+w*0.2}" y1="${y+h-7}" x2="${x+w*0.8}" y2="${y+h-7}" stroke="#7c2d12" stroke-width="1.4" marker-end="url(#arr${uid2})"/>`;
    }
    s += etiquetas(x,y,w,h, R ? p.h : p.w, R ? p.w : p.h, opts.showLabels ? `#${p.n} ${p.name}` : `#${p.n}`);
  });

  // Leyenda
  s += `<text x="${left-30}" y="${legY}" font-size="13" font-weight="700" fill="#0f172a">Piezas de este tablero (medidas en mm sobre cada lado; ↻ = girada)</text>`;
  leyenda.forEach((t,i)=>{ s += `<text x="${left-30}" y="${legY+20+i*lh}" font-size="12" fill="#1e293b">${escSvg(t)}</text>`; });

  // Esquema ampliado del kerf
  const ky = legY + 24 + leyenda.length*lh + 6;
  s += `<rect x="${left-30}" y="${ky-9}" width="28" height="12" fill="#cbd5e1" stroke="#0f172a"/><rect x="${left-2}" y="${ky-9}" width="6" height="12" fill="#ef4444" fill-opacity="0.6"/><rect x="${left+4}" y="${ky-9}" width="28" height="12" fill="#cbd5e1" stroke="#0f172a"/>`;
  s += `<text x="${left+42}" y="${ky}" font-size="11.5" fill="#334155">Separación de sierra entre piezas: ${kerf} mm (esquema ampliado). Verde punteado = sobrante (S1, S2…).</text>`;
  s += `</svg>`;
  return { svg: s, width: svgW, height: svgH };
}

/** Resumen por material + espesor del resultado de una optimización. */
function resumenPorMaterial(result){
  const g = {};
  const get = (mat, esp)=> g[mat+'|'+(+esp)] = g[mat+'|'+(+esp)] || {material:mat, espesor:+esp, medidas:new Set(), cortes:{}, tableros:0, colocadas:0, sinColocar:0, areaPiezas:0, areaTableros:0};
  result.boards.forEach(b=>{
    const o = get(b.board.material, b.board.espesor);
    o.medidas.add(`${fmt(b.board.ancho)}×${fmt(b.board.largo)}`);
    b.placed.forEach(p=>{ o.cortes[p.name] = (o.cortes[p.name]||0)+1; });
    o.tableros++; o.colocadas += b.placed.length;
    o.areaPiezas += b.placed.reduce((s,p)=>s+p.w*p.h,0);
    o.areaTableros += b.board.ancho*b.board.largo;
  });
  result.unplaced.forEach(p=>{ const o = get(p.material, p.espesor); o.sinColocar++; o.cortes[p.name] = (o.cortes[p.name]||0)+1; });
  return Object.values(g).map(o=>({
    ...o, medidas: o.medidas.size ? [...o.medidas].join(' · ') : '—',
    nombres: Object.entries(o.cortes).sort((a,b)=>b[1]-a[1] || a[0].localeCompare(b[0])).map(e=>e[0]).join(', ') || '—',
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
  aplicarZoomSvg(container.querySelector('svg'));
  currentPlanData = { board:b.board, placed:b.placed, svgW:out.width, svgH:out.height };
}

/** Pinta el resumen general por material y espesor debajo de los planos. */
function renderResumen(result){
  const rows = resumenPorMaterial(result);
  const kerf = STATE.params.kerf;
  const th = $('resumenMateriales').querySelector('thead');
  const tb = $('resumenMateriales').querySelector('tbody');
  th.innerHTML = '<tr><th>Material</th><th>Tablero (nombre)</th><th>Espesor (mm)</th><th>Tablero (ancho×largo mm)</th><th>Piezas requeridas</th><th>Colocadas</th><th>Tableros usados</th><th>Kerf (mm)</th><th>Aprovechamiento</th><th>Desperdicio estimado</th></tr>';
  tb.innerHTML = '';
  let t = {req:0,col:0,tab:0,ap:0,at:0};
  rows.forEach(r=>{
    t.req+=r.requeridas; t.col+=r.colocadas; t.tab+=r.tableros; t.ap+=r.areaPiezas; t.at+=r.areaTableros;
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(r.material)}</td><td>${escapeHtml(r.nombres)}</td><td>${nf(r.espesor)}</td><td>${r.medidas}</td><td>${r.requeridas}</td>`+
      `<td>${r.colocadas}${r.sinColocar?` <span style="color:#dc2626">(${r.sinColocar} sin colocar)</span>`:''}</td><td>${r.tableros}</td><td>${kerf}</td>`+
      `<td>${r.aprov.toFixed(1)}%</td><td>${fmt(r.desperdicioMm2/1e6,2)} m² (${r.desperdicioPct.toFixed(1)}%)</td>`;
    tb.appendChild(tr);
  });
  const tr = document.createElement('tr');
  tr.style.fontWeight = '700';
  tr.innerHTML = `<td colspan="4">TOTAL</td><td>${t.req}</td><td>${t.col}</td><td>${t.tab}</td><td>${kerf}</td>`+
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
/** Rectángulo punteado en PDF: cada trazo es una línea vectorial independiente (no depende del patrón de guiones del visor). */
function rectPunteadoPdf(doc,x,y,w,h,rgb,lw,dash,gap){
  doc.setDrawColor(...rgb); doc.setLineWidth(lw); doc.setLineDashPattern([],0);
  if(doc.setLineCap) doc.setLineCap('butt');
  if(doc.setLineJoin) doc.setLineJoin('miter');
  segmentosRectPunteado(x,y,w,h,dash,gap,lw/2).forEach(g=>doc.line(g[0],g[1],g[2],g[3]));
}

function hslAArreglo(str){
  const m = String(str).match(/hsl\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)/);
  if(!m) return [220,220,220];
  const h=+m[1]/360, s=+m[2]/100, l=+m[3]/100;
  const q = l<0.5 ? l*(1+s) : l+s-l*s, p = 2*l-q;
  const f = t=>{ t=(t+1)%1; return t<1/6? p+(q-p)*6*t : t<1/2? q : t<2/3? p+(q-p)*(2/3-t)*6 : p; };
  return [f(h+1/3),f(h),f(h-1/3)].map(v=>Math.round(v*255));
}

const nf2 = n => { const v = +n; return Number.isInteger(v) ? String(v) : String(Math.round(v*100)/100); };

/** Resumen por material con el desglose por habilitado (piezas por mueble, muebles y piezas a cortar). */
function resumenDetallado(result){
  return resumenPorMaterial(result).map(r=>{
    const porHab = {};
    STATE.piezas.filter(p=>p.material===r.material && +p.espesor===r.espesor).forEach(p=>{
      const h = habilitadoDe(p);
      if(p.habId && !(h && h.incluir)) return;
      const tot = cantidadTotal(p); if(tot<=0) return;
      const k = h ? h.id : 'manual';
      const o = porHab[k] = porHab[k] || {hab: h ? h.nombre : 'Piezas manuales', muebles: h ? h.muebles : null, porMueble: h ? 0 : null, total:0};
      if(h) o.porMueble += p.cantidad;
      o.total += tot;
    });
    return {...r, filasHab: Object.values(porHab)};
  });
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
 * Firma del patrón de corte de un tablero: material, espesor, medidas, margen, veta, giro del dibujo y, para cada
 * pieza, nombre, posición, medidas, giro y medida original. Dos tableros solo coinciden si TODO el acomodo es igual
 * (no basta con tener las mismas piezas). Las piezas se ordenan para que el orden interno no importe.
 */
function firmaPatronTablero(b){
  const bd = b.board, f = v=>Math.round((+v||0)*100)/100;
  const piezas = b.placed.map(p=>[p.name, p.material, f(p.x), f(p.y), f(p.w), f(p.h), p.rotated?1:0, f(p.ow), f(p.oh), p.veta||''])
    .sort((a,c)=> a[3]-c[3] || a[2]-c[2] || String(a[0]).localeCompare(String(c[0])) || a[4]-c[4] || a[5]-c[5]);
  return JSON.stringify([bd.material, f(bd.espesor), f(bd.ancho), f(bd.largo), f(margenTablero(bd)), bd.veta||'', giroActivo(bd)?1:0, piezas]);
}
/** Agrupa los tableros con idéntico patrón, conservando el orden de la primera aparición: [{idxs:[0,1,2,3]}, {idxs:[4]}] */
function agruparPatronesTablero(boards){
  const grupos = [], porFirma = new Map();
  boards.forEach((b,i)=>{
    const k = firmaPatronTablero(b);
    if(porFirma.has(k)) porFirma.get(k).idxs.push(i);
    else { const g = {idxs:[i]}; porFirma.set(k,g); grupos.push(g); }
  });
  return grupos;
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

  // ---------- Página 1: resumen general (hoja horizontal) ----------
  const pw1 = doc.internal.pageSize.getWidth();
  doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor(15,23,42);
  doc.text('OPTIMIZACIÓN DE CORTE DE TABLEROS', 12, 16);
  doc.setTextColor(35,88,230); doc.text('CUTFIX PRO', pw1-12, 16, {align:'right'}); doc.setTextColor(15,23,42);
  doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(51,65,85);
  doc.text(`Fecha de generación: ${ctx.fecha}   |   Proyecto: ${ctx.proyecto}   |   Método: ${ctx.modo}`, 12, 23);
  doc.text(`Corte de sierra (kerf): ${kerf} mm   |   Margen perimetral: ${nf(P.margenPer + P.margenSeg)} mm`, 12, 28);
  doc.text(`Piezas: ${totCol} de ${totReq} colocadas   |   Tableros necesarios: ${totTab}   |   Patrones de corte distintos: ${agruparPatronesTablero(boards).length}   |   Aprovechamiento global: ${aT? (aP/aT*100).toFixed(1):'0.0'}%`, 12, 33);
  let yTab = 40;
  const habInc = (STATE.habilitados||[]).filter(h=>h.incluir && h.muebles>0);
  if(habInc.length){
    const txt = doc.splitTextToSize('Habilitados incluidos: ' + habInc.map(h=>`${h.nombre} (${h.muebles} mueble${h.muebles>1?'s':''})`).join('; '), pw1-24);
    doc.setFont('helvetica','bold'); doc.setTextColor(30,64,175);
    doc.text(txt, 12, 38);
    yTab = 38 + txt.length*4.2 + 4;
    doc.setTextColor(15,23,42);
  }
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(15,23,42);
  doc.text('Resumen por material: piezas por mueble, piezas a cortar y tableros necesarios', 12, yTab);

  const det = resumenDetallado(result);
  const body = [], grupoDeFila = [];
  det.forEach((r,gi)=>{
    const filas = r.filasHab.length ? r.filasHab : [{hab:'-', porMueble:null, muebles:null, total:r.requeridas}];
    filas.forEach((f,fi)=>{
      const celdasHab = [f.hab, f.porMueble==null ? '-' : nf2(f.porMueble), f.muebles==null ? '-' : f.muebles, f.total];
      if(fi===0){
        const sp = filas.length;
        body.push([
          {content:r.material, rowSpan:sp, styles:{fontStyle:'bold'}},
          {content:r.nombres, rowSpan:sp},
          {content:nf(r.espesor), rowSpan:sp},
          {content:r.medidas.replace(/,/g,''), rowSpan:sp},
          ...celdasHab,
          {content:String(r.requeridas) + (r.sinColocar ? ` (${r.sinColocar} sin colocar)` : ''), rowSpan:sp, styles:{fontStyle:'bold'}},
          {content:String(r.tableros), rowSpan:sp, styles:{fontStyle:'bold', fontSize:11, textColor:[30,64,175]}},
          {content:r.aprov.toFixed(1)+'%', rowSpan:sp, styles:{fontStyle:'bold'}},
          {content:`${(r.desperdicioMm2/1e6).toFixed(2)} m2 (${r.desperdicioPct.toFixed(1)}%)`, rowSpan:sp}
        ]);
      } else body.push(celdasHab);
      grupoDeFila.push(gi);
    });
  });
  body.push([{content:'TOTAL', colSpan:8, styles:{halign:'right'}}, String(totReq), String(totTab), (aT?(aP/aT*100).toFixed(1):'0.0')+'%', `${((aT-aP)/1e6).toFixed(2)} m2 (${aT?((aT-aP)/aT*100).toFixed(1):'0.0'}%)`]);
  doc.autoTable({
    startY: yTab+3, margin:{left:12,right:12,bottom:14}, theme:'grid',
    head:[['Material','Tablero (nombre)','Esp. (mm)','Medida tablero (mm)','Habilitado','Piezas por mueble','Muebles','Piezas a cortar','Total piezas del material','Tableros necesarios','Aprov.','Desperdicio']],
    body, styles:{fontSize:8.5, cellPadding:1.8, valign:'middle'},
    headStyles:{fillColor:[15,23,42], halign:'center', valign:'middle'},
    columnStyles:{0:{cellWidth:36},1:{cellWidth:42},2:{cellWidth:11,halign:'center'},3:{cellWidth:22,halign:'center'},4:{cellWidth:26},
                  5:{cellWidth:15,halign:'center'},6:{cellWidth:17,halign:'center'},7:{cellWidth:16,halign:'center'},
                  8:{cellWidth:19,halign:'center'},9:{cellWidth:21,halign:'center'},10:{cellWidth:16,halign:'center'}},
    didParseCell: d=>{
      if(d.section!=='body') return;
      if(d.row.index === body.length-1){ d.cell.styles.fontStyle='bold'; d.cell.styles.fillColor=[203,213,225]; return; }
      d.cell.styles.fillColor = (grupoDeFila[d.row.index]%2) ? [241,245,249] : [255,255,255];
    }
  });
  let yy = doc.lastAutoTable.finalY + 7;
  doc.setFont('helvetica','bold'); doc.setFontSize(9.5); doc.setTextColor(30,64,175);
  const lineaTab = doc.splitTextToSize(`Tableros necesarios: ${totTab} en total — ` + det.map(r=>`${r.material}: ${r.tableros}`).join(' · '), pw1-24);
  doc.text(lineaTab, 12, yy);
  yy += lineaTab.length*4.2 + 3;
  doc.setTextColor(15,23,42);
  if(result.unplaced.length){
    doc.setFontSize(10); doc.setTextColor(220,38,38);
    doc.text(`ATENCIÓN: ${result.unplaced.length} pieza(s) no se pudieron colocar`, 12, yy);
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
    const lst = result.unplaced.slice(0,10).map(p=>`- ${p.name} (${nf(p.w)} x ${nf(p.h)} mm, ${p.material}): ${p.reason||'sin tablero disponible'}`);
    doc.text(lst, 12, yy+5);
    doc.setTextColor(15,23,42);
  }

  // ---------- Lista general de cortes (todas las piezas del trabajo) ----------
  if(boards.length){
    const tot = Object.values(totalesPorCorte(boards, result.unplaced))
      .sort((a,b)=> a.material.localeCompare(b.material) || a.espesor-b.espesor || a.name.localeCompare(b.name));
    doc.addPage('a4','landscape');
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
  // Una sola hoja por patrón de corte distinto; indica cuántos tableros se cortan con ese patrón
  agruparPatronesTablero(boards).forEach(g=>{
    const idx = g.idxs[0], b = boards[idx], N = g.idxs.length;
    const board = b.board, info = infoTablero(boards, idx, result.unplaced);
    const mismosMat = boards.filter(x=>x.board.material===board.material && +x.board.espesor===+board.espesor);
    const numsTxt = compactarNumeros(g.idxs.map(i=>i+1));
    const secTxt  = compactarNumeros(g.idxs.map(i=>mismosMat.indexOf(boards[i])+1));
    const lblNum = N>1 ? 'Tableros ' + (numsTxt.length<=34 ? numsTxt : `${idx+1}… (${N} iguales)`) : `Tablero ${info.numero}`;
    const lblSec = N>1 ? 'Tableros ' + (secTxt.length<=34 ? secTxt : `${mismosMat.indexOf(b)+1}… (${N} iguales)`) : `Tablero ${info.secMat}`;
    doc.addPage('a4', STATE.orientacion==='vertical' ? 'portrait' : 'landscape');   // la hoja sigue la orientación elegida
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
    const W = board.ancho, H = board.largo, m = margenTablero(board);
    const R = giroActivo(board);                         // giro visual elegido por el usuario (horizontal / vertical)
    const piezas = b.placed.map((p,i)=>({...p, n:i+1}));
    const area = piezas.reduce((s2,p)=>s2+p.w*p.h,0), aprov = (W*H)? area/(W*H)*100 : 0;
    const rgbMat = hslAArreglo(hslColorFromString(board.material));

    // Encabezado (el texto se ajusta al ancho de la hoja, horizontal o vertical)
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5);
    const hl = [
      ...doc.splitTextToSize(`${lblSec} de ${info.totMat} de este material | Medidas: ${nf(W)} x ${nf(H)} mm (ancho x largo) | Kerf: ${kerf} mm | Margen: ${nf(m)} mm | Veta: ${textoVeta(board.veta)} | Orientación: ${pw<ph?'vertical':'horizontal'}${R?' | Dibujo girado 90 grados':''}`, pw-20),
      ...doc.splitTextToSize(`${piezas.length} piezas | Aprovechamiento ${aprov.toFixed(1)}% | Sobrante ${(100-aprov).toFixed(1)}% (${((W*H-area)/1e6).toFixed(2)} m2)`, pw-20)
    ];
    let muebL = [];
    if(muebTxt){ doc.setFont('helvetica','bold'); muebL = doc.splitTextToSize(muebTxt, pw-20).slice(0,2); doc.setFont('helvetica','normal'); }
    const hBand = Math.max(28, 14 + (hl.length+muebL.length)*4.7 + 2 + 6);   // +6: renglón CANTIDAD DE TABLEROS
    doc.setFillColor(...rgbMat); doc.rect(0,0,pw,hBand,'F');
    doc.setFont('helvetica','bold'); doc.setFontSize(13); doc.setTextColor(15,23,42);
    doc.text(`${lblNum} de ${info.total} - ${board.material} - espesor ${nf(board.espesor)} mm`, 10, 8);
    doc.setFontSize(9); doc.setTextColor(35,88,230); doc.text('CUTFIX PRO', pw-10, 8, {align:'right'});
    doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(15,23,42);
    let yh = 14;
    hl.forEach(t=>{ doc.text(t, 10, yh); yh += 4.7; });
    if(muebL.length){ doc.setFont('helvetica','bold'); doc.setTextColor(30,64,175); muebL.forEach(t=>{ doc.text(t, 10, yh); yh += 4.7; }); doc.setTextColor(15,23,42); }

    // CANTIDAD DE TABLEROS que se cortan con este patrón
    {
      const insignia = `CANTIDAD DE TABLEROS: ${N}`;
      doc.setFont('helvetica','bold'); doc.setFontSize(10);
      const bwid = doc.getTextWidth(insignia) + 6;
      doc.setFillColor(30,64,175); doc.roundedRect(10, yh-3.3, bwid, 6.4, 1.2, 1.2, 'F');
      doc.setTextColor(255,255,255); doc.text(insignia, 13, yh+1.2);
      if(N>1){ doc.setFont('helvetica','normal'); doc.setFontSize(8.5); doc.setTextColor(15,23,42); doc.text(`Mismo patrón de corte en los tableros ${numsTxt.length<=60 ? numsTxt : N+' (ver lista general)'}`, 10+bwid+3, yh+1.2); }
      doc.setTextColor(15,23,42);
    }

    // Leyenda en 1, 2 o 3 columnas según cuántos cortes distintos haya
    const leyenda = agruparLeyenda(piezas, info.totales);
    const sobrantes = calcularSobrantes(board, b.placed);
    const ncol = Math.min(leyenda.length<=5 ? 1 : leyenda.length<=10 ? 2 : 3, pw<ph ? 2 : 3);
    const porCol = Math.ceil(leyenda.length/ncol);
    const legH = 15 + porCol*5.4;
    doc.setFont('helvetica','bold'); doc.setFontSize(7);
    const sobTxt = sobrantes.length ? doc.splitTextToSize('SOBRANTES (ancho x largo, mm; ya sin kerf ni margen):   ' + lineasSobrantes(sobrantes, 400, ' x ').join('  ·  '), pw-24) : [];
    const sobH = sobTxt.length ? sobTxt.length*3.1 + 3 : 0;

    // Zona de dibujo (el tablero ocupa el ancho de la hoja)
    const x0 = 26, y0 = hBand + 12;
    const availW = pw - x0 - 12, availH = ph - y0 - 24 - legH - sobH;
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
    rectPunteadoPdf(doc, mr.x, mr.y, mr.w, mr.h, [148,163,184], 0.2, 2.2, 1.6);   // punteado vectorial, separación uniforme

    // Kerf (franjas rojas) bajo las piezas
    doc.setFillColor(239,68,68);
    piezas.forEach(p=>{
      [T(p.x+p.w, p.y, kerf, p.h+kerf), T(p.x, p.y+p.h, p.w, kerf)].forEach(r=>{
        doc.rect(r.x, r.y, Math.max(r.w,0.3), Math.max(r.h,0.3), 'F');
      });
    });

    // Medidas sobre cada lado + nombre COMPLETO al centro (se usa en piezas y en sobrantes)
    const etiquetasPdf = (r, vw, vh, nombreTxt)=>{
      const sw = nf(vw), sh = nf(vh);
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
      const texto = enLados ? nombreTxt : `${nombreTxt} ${sw}x${sh}`;
      const anchoPdf = (str,fs)=>{ doc.setFont('helvetica','bold'); doc.setFontSize(fs); return doc.getTextWidth(str); };
      const lay = ajustarNombre(texto, rw-1.2, rh-1, 8, 3.5, anchoPdf, 0.3528) || ajustarNombre(nombreTxt.split(' ')[0], rw-0.8, rh-0.8, 8, 3, anchoPdf, 0.3528);
      if(lay){
        doc.setFont('helvetica','bold'); doc.setFontSize(lay.fs); doc.setTextColor(15,23,42);
        const cx = rx+rw/2, cy = ry+rh/2;
        lay.lines.forEach((t,i)=>{
          const off = (i-(lay.lines.length-1)/2)*lay.lh;
          if(lay.vertical) doc.text(t, cx+off+lay.lh*0.3, cy+doc.getTextWidth(t)/2, {angle:90});
          else doc.text(t, cx, cy+off+lay.lh*0.3, {align:'center'});
        });
      }
    };

    // Sobrantes (como otro tablero: verde punteado)
    sobrantes.forEach((sb,i)=>{
      const r = T(sb.x, sb.y, sb.w, sb.h);
      doc.setFillColor(220,252,231); doc.rect(r.x, r.y, r.w, r.h, 'F');
      rectPunteadoPdf(doc, r.x, r.y, r.w, r.h, [22,163,74], 0.35, 3, 2);            // punteado vectorial, separación uniforme
      etiquetasPdf(r, R ? sb.h : sb.w, R ? sb.w : sb.h, `S${i+1} SOBRANTE`);
    });

    // Piezas
    doc.setLineWidth(0.2); doc.setDrawColor(15,23,42);
    piezas.forEach(p=>{
      const r = T(p.x, p.y, p.w, p.h);
      doc.setFillColor(...hslAArreglo(hslColorFromString(p.material+p.name)));
      doc.rect(r.x, r.y, r.w, r.h, 'FD');
      etiquetasPdf(r, R ? p.h : p.w, R ? p.w : p.h, `#${p.n} ${p.name}`);
    });

    // Medidas de todos los sobrantes (renglón compacto)
    if(sobTxt.length){ doc.setFont('helvetica','bold'); doc.setFontSize(7); doc.setTextColor(22,101,52); doc.text(sobTxt, 12, by+bh+6.5); doc.setTextColor(15,23,42); }

    // Leyenda (tabla de cortes) en columnas
    const gap = 4, colW = ncol===1 ? Math.min(170, pw-24) : (pw-24-(ncol-1)*gap)/ncol;
    for(let c=0;c<ncol;c++){
      const filas = leyenda.slice(c*porCol, (c+1)*porCol);
      if(!filas.length) continue;
      const left = 12 + c*(colW+gap);
      doc.autoTable({
        startY: by+bh+6.5+sobH, margin:{left, right: pw-left-colW, bottom:14}, tableWidth: colW, theme:'grid',
        head:[['#','Pieza','Aquí','Se ocupan','Medida final (mm)']],
        body: filas.map(r=>[r.nums, r.name, r.cant, r.total, r.med]),
        styles:{fontSize:6.5, cellPadding:0.8}, headStyles:{fillColor:[15,23,42], fontSize:6.2},
        columnStyles:{0:{cellWidth:13},2:{cellWidth:9},3:{cellWidth:14}}
      });
    }
    doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(71,85,105);
    const nota = doc.splitTextToSize('Aquí = piezas de ese corte en ' + (N>1 ? `cada uno de los ${N} tableros de este patrón` : 'este tablero') + '. Se ocupan = total de ese corte en todo el trabajo. Franja roja = separación de sierra (' + kerf + ' mm). S1, S2… = sobrantes (verde: todo el espacio libre, medida ya sin kerf ni margen).', pw-24);
    doc.text(nota, 12, ph-9.5-(nota.length-1)*3);
  });

  // Pie de página
  const n = doc.getNumberOfPages();
  for(let i=1;i<=n;i++){
    doc.setPage(i);
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(100,116,139);
    doc.text(`Página ${i} de ${n}`, pw-12, ph-6, {align:'right'});
    doc.text(`CUTFIX PRO - Optimización de corte - ${ctx.fecha}`, 12, ph-6);
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
    const doc = new window.jspdf.jsPDF({orientation:'landscape', unit:'mm', format:'a4'});
    const ahora = new Date();
    const r = STATE.bestResult;
    construirPdfOptimizacion(doc, r, {
      fecha: ahora.toLocaleString('es-MX'),
      proyecto: STATE.projectName || 'Sin guardar',
      modo: (r.mode || 'mixto')
    });
    const pad = n=>String(n).padStart(2,'0');
    doc.save(`cutfix-pro_optimizacion_${ahora.getFullYear()}${pad(ahora.getMonth()+1)}${pad(ahora.getDate())}.pdf`);
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
      <div class="hoja-brand">CUTFIX<span>PRO</span></div>
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
      svg.removeAttribute('style');
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
      <td><button class="icon-btn del" data-del="${i}">${ico('delete')}</button></td>`;
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
   IMPORTACIÓN MÚLTIPLE DE HABILITADOS
   Varios Excel de una sola vez; la cantidad de muebles se captura por archivo en una tabla y todo se
   confirma junto. Reutiliza detectarColumna() y procesarFilasExcel() (mismos cálculos que la importación individual).
   ========================================================= */
const LOTE = [];     // archivos pendientes de confirmar (no forma parte del proyecto guardado)

function loteOpts(fileName){
  return { unidades: $('loteUnidades').value.split(','), factor: +$('loteUnidadMedida').value || 1,
           vetaDefault: $('loteVeta').value, fileName };
}
function loteProcesar(it){
  if(!it.rows) return;
  it.res = procesarFilasExcel(it.rows, it.map, loteOpts(it.file.name));
  const ok = it.res.items.filter(x=>x.estado==='ok');
  it.ok = ok.length;
  it.ign = it.res.items.filter(x=>x.estado==='ignorada').length;
  it.err = it.res.items.filter(x=>x.estado==='error').length;
  it.porMueble = ok.reduce((n,x)=>n+x.cantidad,0);
}
function loteTotalPiezas(it){
  const m = Math.floor(+it.muebles) || 0;
  return (it.res ? it.res.items.filter(x=>x.estado==='ok') : []).reduce((n,x)=>n+Math.ceil(+(x.cantidad*m).toFixed(6)),0);
}
function loteResumen(){
  const val = LOTE.filter(it=>it.ok>0), con = val.filter(it=>Math.floor(+it.muebles)>=1);
  $('loteResumen').innerHTML = `<b>${LOTE.length}</b> archivo(s) en la lista · <b>${val.length}</b> con renglones válidos · cantidad de muebles capturada en <b>${con.length}</b> de ${val.length}` +
    (val.length && con.length<val.length ? ' — <span style="color:#dc2626">captura la cantidad de cada habilitado para poder importar</span>' : '') +
    ` · total de piezas: <b>${con.reduce((n,it)=>n+loteTotalPiezas(it),0)}</b>`;
}
function loteRender(){
  $('loteBody').style.display = LOTE.length ? 'block' : 'none';
  const tb = $('tablaLote').querySelector('tbody'); tb.innerHTML = '';
  LOTE.forEach((it,i)=>{
    const estado = it.error ? `❌ ${escapeHtml(it.error)}`
      : it.ok ? `✅ ${it.ok} renglones` + (it.ign?` · ${it.ign} ignorados`:'') + (it.err?` · <span style="color:#dc2626">${it.err} con error</span>`:'')
      : '❌ Sin renglones válidos (revisa unidades / columnas)';
    const tr = document.createElement('tr'); tr.dataset.id = it.id;
    tr.innerHTML = `<td>${i+1}</td>`+
      `<td><input type="text" data-lnom="${it.id}" value="${escapeHtml(it.nombre)}"></td>`+
      `<td>${escapeHtml(it.file.name)}</td><td>${estado}</td>`+
      `<td>${it.ok ? +it.porMueble.toFixed(2) : '-'}</td>`+
      `<td><input type="number" min="1" step="1" style="width:90px" data-lmue="${it.id}" value="${it.muebles}" placeholder="Cantidad"${it.ok?'':' disabled'}></td>`+
      `<td class="lote-total">${it.ok && Math.floor(+it.muebles)>=1 ? loteTotalPiezas(it) : '-'}</td>`+
      `<td><button class="btn btn-sm btn-outline" data-ldel="${it.id}" title="Quitar de la lista"><svg class="ico" aria-hidden="true"><use href="#i-close"/></svg></button></td>`;
    tb.appendChild(tr);
  });
  loteResumen();
}
async function loteAgregar(files){
  let nuevos = 0, repetidos = 0, yaImportados = 0, noExcel = 0;
  for(const file of files){
    if(!/\.(xlsx|xls)$/i.test(file.name)){ noExcel++; continue; }
    if(LOTE.some(x=>x.file.name===file.name)){ repetidos++; continue; }                           // ya está en la lista
    if(STATE.habilitados.some(h=>h.archivo===file.name)){ yaImportados++; continue; }             // ya fue importado
    const it = {id:uid(), file, nombre:file.name.replace(/\.[^.]+$/,''), muebles:'', rows:null, map:null};
    try{
      const wb = XLSX.read(new Uint8Array(await file.arrayBuffer()), {type:'array'});
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header:1, defval:'', raw:true});
      if(rows.length < 2) it.error = 'Archivo vacío o sin datos';
      else { it.rows = rows; it.map = {}; IMPORT_FIELDS.forEach(f=>{ it.map[f.key] = detectarColumna(rows[0], f); }); }
    }catch(err){ console.error(err); it.error = 'No se pudo leer el archivo'; }
    loteProcesar(it); LOTE.push(it); nuevos++;
  }
  loteRender();
  const av = [];
  if(repetidos) av.push(`${repetidos} ya estaba(n) en la lista`);
  if(yaImportados) av.push(`${yaImportados} ya estaba(n) importado(s) como habilitado`);
  if(noExcel) av.push(`${noExcel} no es(son) Excel`);
  toast(`${nuevos} archivo(s) agregado(s) a la lista` + (av.length ? ' · omitidos: ' + av.join(', ') : '') + (nuevos ? ' · captura la cantidad de muebles de cada uno' : ''), av.length&&!nuevos ? 'error' : 'success');
}

$('btnLoteElegir').onclick = $('btnLoteMas').onclick = ()=> $('loteFiles').click();
$('btnHabAgregarVarios').onclick = ()=> $('loteFiles').click();
$('loteFiles').onchange = async (e)=>{
  const files = [...e.target.files]; e.target.value = '';
  if(!files.length) return;
  document.querySelector('.nav-btn[data-section="importar"]').click();
  await loteAgregar(files);
};
['loteUnidades','loteUnidadMedida','loteVeta'].forEach(id=> $(id).addEventListener('change', ()=>{ LOTE.forEach(loteProcesar); loteRender(); }));
$('tablaLote').addEventListener('input', ev=>{
  const t = ev.target;
  if(t.dataset.lnom){ const it = LOTE.find(x=>x.id===t.dataset.lnom); if(it) it.nombre = t.value; }
  if(t.dataset.lmue){
    const it = LOTE.find(x=>x.id===t.dataset.lmue); if(!it) return;
    it.muebles = t.value; t.style.outline = '';
    t.closest('tr').querySelector('.lote-total').textContent = Math.floor(+it.muebles)>=1 ? loteTotalPiezas(it) : '-';
    loteResumen();
  }
});
$('tablaLote').addEventListener('click', ev=>{
  const b = ev.target.closest('[data-ldel]'); if(!b) return;
  const i = LOTE.findIndex(x=>x.id===b.dataset.ldel); if(i>=0) LOTE.splice(i,1);
  loteRender();
});
$('btnLoteLimpiar').onclick = ()=>{ LOTE.length = 0; loteRender(); };
$('btnLoteConfirmar').onclick = ()=>{
  const validos = LOTE.filter(it=>it.ok>0);
  if(!validos.length){ toast('No hay archivos con renglones válidos para importar','error'); return; }
  const faltan = validos.filter(it=>!(Math.floor(+it.muebles)>=1));
  if(faltan.length){
    faltan.forEach(it=>{ const inp = $('tablaLote').querySelector(`[data-lmue="${it.id}"]`); if(inp) inp.style.outline = '2px solid #dc2626'; });
    const first = $('tablaLote').querySelector(`[data-lmue="${faltan[0].id}"]`); if(first) first.focus();
    toast(`Falta la cantidad de muebles en ${faltan.length} habilitado(s)`,'error'); return;
  }
  const existentes = new Set(STATE.piezas.map(p=>p.srcKey).filter(Boolean));
  const combos = new Set();
  let nHab = 0, nPiezas = 0, dup = 0, errores = 0;
  validos.forEach(it=>{
    const hab = { id: uid(), nombre: (it.nombre||'').trim() || it.file.name.replace(/\.[^.]+$/,''),
                  muebles: Math.max(1, Math.floor(+it.muebles)), incluir: true, archivo: it.file.name };
    let count = 0;
    it.res.items.filter(x=>x.estado==='ok').forEach(x=>{
      if(existentes.has(x.srcKey)){ dup++; return; }
      existentes.add(x.srcKey);
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
    errores += it.err;
    if(count>0){ STATE.habilitados.push(hab); nHab++; nPiezas += count; }
  });
  let nuevosTab = 0;
  combos.forEach(k=>{
    const [mat, esp] = k.split('|'); const e = +esp;
    if(!STATE.tableros.some(t=>t.material===mat && +t.espesor===e)){
      STATE.tableros.push({id:uid(), nombre:`${mat} (auto)`, material:mat, largo:2440, ancho:1220,
        espesor:e, precio:0, color:'#c8a878', veta:'largo', cantidad:50, margen:0});
      nuevosTab++;
    }
  });
  const omitidos = LOTE.length - validos.length;
  LOTE.length = 0; loteRender();
  renderPiezas(); renderTableros(); renderHabilitados();
  if(typeof saveAuto === 'function') saveAuto();
  toast(`${nHab} habilitado(s) importado(s) · ${nPiezas} renglones` + (dup?` · ${dup} ya existían`:'') + (errores?` · ${errores} con error`:'') + (omitidos?` · ${omitidos} archivo(s) omitido(s) sin renglones válidos`:'') + (nuevosTab?` · ${nuevosTab} tableros 2440×1220 creados`:''), errores?'error':'success');
  if(nHab>0 || dup>0) document.querySelector('.nav-btn[data-section="habilitados"]').click();
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
    const pagina = STATE.orientacion==='vertical' ? 'portrait' : 'landscape';
    const doc = new jsPDF({orientation:pagina, unit:'mm', format:'a4'});
    STATE.bestResult.boards.forEach((b,i)=>{
      if(i>0) doc.addPage('a4', pagina);
      const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight();
      doc.setFontSize(14); doc.setTextColor(15,23,42);
      doc.text(`Tablero ${i+1} — ${b.board.nombre}`, 10, 12);
      doc.setFontSize(10);
      doc.text(doc.splitTextToSize(`Material: ${b.board.material} · ${b.board.ancho}×${b.board.largo} mm · Kerf: ${STATE.params.kerf} mm`, pageW-20), 10, 18);
      doc.setFont('helvetica','bold'); doc.setTextColor(35,88,230); doc.text('CUTFIX PRO', pageW-10, 12, {align:'right'});
      doc.setFont('helvetica','normal'); doc.setTextColor(15,23,42);
      // Dibujo con el giro elegido (visual): ancho<->largo y eje invertido, igual que la vista previa
      const W = b.board.ancho, H = b.board.largo, R = giroActivo(b.board);
      const BW = R ? H : W, BH = R ? W : H;
      const padX = 15, padY = 25;
      const availW = pageW - padX*2, availH = pageH - padY - 15;
      const scale = Math.min(availW/BW, availH/BH);
      const T = (x,y,w,h)=> R ? {x:padX+y*scale, y:padY+(W-x-w)*scale, w:h*scale, h:w*scale} : {x:padX+x*scale, y:padY+y*scale, w:w*scale, h:h*scale};
      doc.setDrawColor(50,50,50);
      doc.setFillColor(245,245,245);
      doc.rect(padX, padY, BW*scale, BH*scale, 'FD');
      b.placed.forEach((p,j)=>{
        const r = T(p.x, p.y, p.w, p.h);
        doc.setDrawColor(0,0,0);
        const c = hslToRgb(p.material+p.name);
        doc.setFillColor(c.r,c.g,c.b);
        doc.rect(r.x, r.y, r.w, r.h, 'FD');
        if(r.w > 15 && r.h > 8){
          doc.setFontSize(7);
          doc.text(p.name.substring(0,16), r.x+1, r.y+4);
          doc.text(`${Math.round(R?p.h:p.w)}×${Math.round(R?p.w:p.h)}`, r.x+1, r.y+8);
        } else {
          doc.setFontSize(6);
          doc.text(String(j+1), r.x+1, r.y+3);
        }
      });
    });
    doc.save('cutfix-pro_planos_corte.pdf');
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
      <td class="actions"><button class="icon-btn" data-ren="${h.id}" title="Renombrar">${ico('edit')}</button><button class="icon-btn del" data-delhab="${h.id}" title="Eliminar habilitado">${ico('delete')}</button></td>`;
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

/* =========================================================
   CAPA DE INTERFAZ (solo presentación: navegación, menú móvil y giro visual)
   No modifica datos ni cálculos.
   ========================================================= */
const TITULOS = {inicio:'Inicio', tableros:'Tableros', piezas:'Piezas', importar:'Importar Excel', habilitados:'Habilitados',
  parametros:'Parámetros', optimizacion:'Optimización', planos:'Planos de corte', hoja:'Hoja de corte', sobrantes:'Sobrantes', reportes:'Reportes'};
function irSeccion(k){ const b = document.querySelector(`.nav-btn[data-section="${k}"]`); if(b) b.click(); }
document.querySelectorAll('.nav-btn').forEach(btn=>btn.addEventListener('click', ()=>{
  const k = btn.dataset.section;
  $('appbarTitle').textContent = TITULOS[k] || k;
  document.querySelectorAll('.bn-btn[data-go]').forEach(b=>b.classList.toggle('active', b.dataset.go===k));
  $('bnMore').classList.toggle('active', !document.querySelector(`.bn-btn[data-go="${k}"]`));
  window.scrollTo({top:0, behavior:'smooth'});
  if(k==='planos') requestAnimationFrame(()=>aplicarZoomSvg($('planoContainer').querySelector('svg')));
}));
document.querySelectorAll('[data-go]').forEach(el=>el.addEventListener('click', ()=>irSeccion(el.dataset.go)));
$('bnMore').onclick = ()=> $('sidebar').classList.add('open');
$('scrim').onclick = ()=> $('sidebar').classList.remove('open');
document.addEventListener('keydown', e=>{ if(e.key==='Escape') $('sidebar').classList.remove('open'); });
let _rsz; window.addEventListener('resize', ()=>{ clearTimeout(_rsz); _rsz = setTimeout(()=>aplicarZoomSvg($('planoContainer').querySelector('svg')), 120); });

/** Giro visual del tablero (90°): solo redibuja la vista previa; NO recalcula ni altera la distribución. */
function actualizarEtiquetaGiro(){
  const v = STATE.orientacion === 'vertical';
  $('orientBadge').innerHTML = ico(v ? 'vert' : 'horiz') + '<span id="orientLabel">' + (v ? 'Vertical' : 'Horizontal') + '</span>';
}
$('btnGirar').onclick = ()=>{
  STATE.orientacion = STATE.orientacion === 'vertical' ? 'horizontal' : 'vertical';
  actualizarEtiquetaGiro();
  if(STATE.bestResult && STATE.bestResult.boards.length) drawPlano(+$('selTableroPlano').value || 0);
  toast('Tablero en orientación ' + STATE.orientacion + ' (el PDF usará esta orientación)');
};
actualizarEtiquetaGiro();

/* =========================================================
   TUTORIAL (solo contenido de ayuda; no toca datos ni cálculos)
   ========================================================= */
const TUT_W = (inner)=>`<svg viewBox="0 0 360 170" xmlns="http://www.w3.org/2000/svg" font-family="system-ui,Arial,sans-serif"><rect x="6" y="6" width="348" height="158" rx="12" fill="#fff" stroke="#cfd7e4"/><rect x="6" y="6" width="348" height="22" rx="12" fill="#e8eefd"/><rect x="6" y="18" width="348" height="10" fill="#e8eefd"/><circle cx="20" cy="17" r="3" fill="#ff7a1a"/><circle cx="31" cy="17" r="3" fill="#cfd7e4"/><circle cx="42" cy="17" r="3" fill="#cfd7e4"/>${inner}</svg>`;
const tF = (x,y,w,l,v)=>`<text x="${x}" y="${y-4}" font-size="8" fill="#627086" font-weight="600">${l}</text><rect x="${x}" y="${y}" width="${w}" height="18" rx="5" fill="#fff" stroke="#9db0d6"/><text x="${x+6}" y="${y+12}" font-size="9" fill="#18212f">${v}</text>`;
const tB = (x,y,w,t,c='#2358e6')=>`<rect x="${x}" y="${y}" width="${w}" height="20" rx="7" fill="${c}"/><text x="${x+w/2}" y="${y+13.5}" font-size="9" font-weight="700" fill="#fff" text-anchor="middle">${t}</text>`;
const tTab = (rows)=>rows.map((r,i)=>`<rect x="20" y="${42+i*20}" width="320" height="20" fill="${i?'#fff':'#f6f8fc'}" stroke="#e2e8f1"/>`+r.map((c,j)=>`<text x="${28+j*64}" y="${55+i*20}" font-size="8.5" fill="${i?'#18212f':'#4a5972'}" font-weight="${i?400:700}">${c}</text>`).join('')).join('');
const tBoard = (x,y,w,h,rects)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f1f5f9" stroke="#334155" stroke-width="1.5"/>`+rects.map(r=>`<rect x="${x+r[0]}" y="${y+r[1]}" width="${r[2]}" height="${r[3]}" fill="${r[4]}" stroke="#0f172a" stroke-width=".8"/>`+(r[5]?`<text x="${x+r[0]+r[2]/2}" y="${y+r[1]+r[3]/2+3}" font-size="8" text-anchor="middle" fill="#0f172a" font-weight="700">${r[5]}</text>`:'')).join('');
const TUT_ILL = {
 inicio: TUT_W(`<g>${[['Tableros','10'],['Piezas','42'],['Aprovech.','73%'],['Modo','Óptimo']].map((s,i)=>`<rect x="${20+i*82}" y="42" width="74" height="44" rx="9" fill="#fff" stroke="#e2e8f1"/><text x="${28+i*82}" y="58" font-size="7.5" fill="#627086" font-weight="700">${s[0].toUpperCase()}</text><text x="${28+i*82}" y="78" font-size="16" fill="#2358e6" font-weight="800">${s[1]}</text>`).join('')}</g>${['1 Tableros','2 Piezas','3 Parámetros','4 Optimizar','5 Planos'].map((t,i)=>`<rect x="${20+i*65}" y="100" width="60" height="50" rx="9" fill="#fff" stroke="#e2e8f1"/><circle cx="${34+i*65}" cy="114" r="7" fill="#e8eefd"/><text x="${34+i*65}" y="117" font-size="8" fill="#2358e6" text-anchor="middle" font-weight="800">${t[0]}</text><text x="${26+i*65}" y="138" font-size="8" fill="#18212f" font-weight="700">${t.slice(2)}</text>`).join('')}`),
 tableros: TUT_W(tF(20,50,100,'Nombre','Melamina blanca')+tF(130,50,60,'Largo (mm)','2440')+tF(200,50,60,'Ancho (mm)','1220')+tF(270,50,60,'Espesor','18')+tF(20,90,70,'Precio','850')+tF(100,90,60,'Veta','A lo largo')+tF(170,90,60,'Cantidad','10')+tB(20,128,110,'+ Agregar tablero')+`<rect x="270" y="90" width="60" height="18" rx="5" fill="#c8a878"/>`),
 piezas: TUT_W(tF(20,46,90,'Nombre','Lateral izq.')+tF(120,46,50,'Largo','600')+tF(180,46,50,'Ancho','400')+tF(240,46,40,'Cant.','2')+tF(290,46,50,'Espesor','18')+tTab([]).replace(/^$/,'')+`<g transform="translate(0,52)">${tTab([['#','Nombre','Largo','Ancho','Cant.'],['1','Lateral izq.','600','400','2'],['2','Tapa','800','400','1']])}</g>`),
 excel: TUT_W(`<rect x="20" y="42" width="320" height="34" rx="9" fill="#fafbfe" stroke="#9db0d6" stroke-dasharray="4 3"/><text x="180" y="63" font-size="10" fill="#2358e6" text-anchor="middle" font-weight="700">📄 Elegir archivo .xlsx / .xls</text>`+tF(20,100,90,'Unidades válidas','HOJA')+tF(120,100,90,'Muebles','20')+tF(220,100,110,'Unidad de medida','Centímetros')+tB(20,134,120,'✓ Importar registros','#16a34a')),
 hab: TUT_W(tTab([['Incluir','Habilitado','Renglones','Muebles','Total']]).replace('','')+`<g>${[['☑','IFD4221BFF','12','20','240'],['☐','IFD5530XA','9','5','45']].map((r,i)=>`<rect x="20" y="${62+i*22}" width="320" height="22" fill="#fff" stroke="#e2e8f1" opacity="${i?.5:1}"/>`+r.map((c,j)=>`<text x="${28+j*64}" y="${76+i*22}" font-size="9" fill="#18212f">${c}</text>`).join('')).join('')}</g>`+tB(20,126,120,'Ir a calcular el corte')),
 param: TUT_W(tF(20,46,90,'Kerf (mm)','3')+tF(120,46,90,'Margen perimetral','10')+tF(220,46,110,'Separación mínima','3')+tF(20,90,90,'Rotación global','No')+tF(120,90,90,'Respetar veta','Sí')+tF(220,90,110,'Criterio','Menos tableros')+`<text x="20" y="140" font-size="8.5" fill="#627086">El kerf y la tolerancia son independientes: no se suman dos veces.</text>`),
 opt: TUT_W(tB(20,42,100,'↕ POR LONGITUD','#627086')+tB(130,42,100,'↔ POR ANCHURA','#627086')+tB(240,42,100,'⚡ ÓPTIMO')+`<rect x="20" y="76" width="320" height="22" fill="#f6f8fc" stroke="#e2e8f1"/>`+['Modo','Tableros','Aprov.','Cortes'].map((t,i)=>`<text x="${28+i*80}" y="90" font-size="8.5" font-weight="700" fill="#4a5972">${t}</text>`).join('')+`<rect x="20" y="98" width="320" height="22" fill="#e8f8ee" stroke="#9bdcb4"/>`+['Mixto','9','73.4%','41'].map((t,i)=>`<text x="${28+i*80}" y="112" font-size="9" font-weight="700" fill="#14622f">${t}</text>`).join('')+`<rect x="20" y="132" width="320" height="6" rx="3" fill="#e3e9f4"/><rect x="20" y="132" width="230" height="6" rx="3" fill="#2358e6"/>`),
 planos: TUT_W(`<rect x="20" y="36" width="90" height="16" rx="8" fill="#e8eefd"/><text x="65" y="47" font-size="8" fill="#2358e6" text-anchor="middle" font-weight="700">Tablero 1 ▾</text>`+tB(120,34,64,'⟳ Girar 90°','#fff').replace('fill="#fff"/>','fill="#fff" stroke="#9db0d6"/>').replace(/font-size="9" font-weight="700" fill="#fff"/,'font-size="9" font-weight="700" fill="#2b3850"')+tB(192,34,50,'Zoom +','#fff').replace('fill="#fff"/>','fill="#fff" stroke="#9db0d6"/>')+tBoard(60,62,240,96,[[4,4,150,56,'#9fd8e4','#1 Panel'],[4,62,150,30,'#9fd8e4','#2 Panel'],[158,4,76,40,'#c4b0e8','#3'],[158,48,76,44,'#c4b0e8','#4']])+`<rect x="60" y="62" width="240" height="96" fill="none" stroke="#94a3b8" stroke-dasharray="4 3"/>`),
 pdf: TUT_W(`<rect x="30" y="36" width="130" height="122" rx="4" fill="#fff" stroke="#9db0d6"/><text x="95" y="48" font-size="7" fill="#627086" text-anchor="middle">HORIZONTAL (hoja apaisada)</text>`+tBoard(38,54,114,56,[[3,3,70,50,'#9fd8e4'],[76,3,35,24,'#c4b0e8'],[76,30,35,23,'#c4b0e8']])+`<rect x="38" y="118" width="114" height="34" fill="#eef" stroke="#99a"/><rect x="200" y="36" width="90" height="122" rx="4" fill="#fff" stroke="#9db0d6"/><text x="245" y="48" font-size="7" fill="#627086" text-anchor="middle">VERTICAL</text>`+tBoard(214,54,62,60,[[3,3,26,54,'#9fd8e4'],[32,3,27,26,'#c4b0e8'],[32,31,27,26,'#c4b0e8']])+`<rect x="208" y="122" width="74" height="30" fill="#eef" stroke="#99a"/><path d="M168 98h24l-6-6m6 6l-6 6" stroke="#ff7a1a" stroke-width="2" fill="none"/>`),
 hoja: TUT_W(`<text x="20" y="46" font-size="8" font-weight="800" fill="#627086">CUTFIX <tspan fill="#ff7a1a">PRO</tspan></text><text x="20" y="62" font-size="12" font-weight="800" fill="#18212f">Hoja de corte — Tablero 1</text><line x1="20" y1="67" x2="340" y2="67" stroke="#2358e6" stroke-width="2"/>`+tBoard(20,76,130,70,[[3,3,80,64,'#9fd8e4'],[86,3,40,30,'#c4b0e8']])+tTab([]).replace(/^$/,'')+`<g transform="translate(150,40)">${tTab([['#','Pieza','Largo']].concat([['1','Panel','1500'],['2','Lateral','600'],['3','Tapa','800']])).replace(/x="20"/g,'x="20"').replace(/width="320"/g,'width="170"')}</g>`),
 sobr: TUT_W(tBoard(30,40,200,110,[[4,4,110,64,'#c4b0e8','Pieza'],[118,4,78,64,'#9fd8e4','Pieza']])+`<rect x="34" y="112" width="192" height="34" fill="#bbf7d0" fill-opacity=".6" stroke="#16a34a" stroke-dasharray="5 3"/><text x="130" y="133" font-size="9" fill="#14622f" text-anchor="middle" font-weight="700">S1 SOBRANTE</text>`+tB(246,70,96,'♻ Detectar','#16a34a')+tB(246,98,96,'+ Agregar')),
 rep: TUT_W(['Piezas a Excel','Tableros a Excel','Resultados a Excel','Sobrantes a Excel','Exportar proyecto (.json)','Importar proyecto (.json)'].map((t,i)=>`<rect x="${20+(i%2)*162}" y="${42+Math.floor(i/2)*36}" width="156" height="28" rx="9" fill="#fff" stroke="#cfd7e4"/><text x="${98+(i%2)*162}" y="${60+Math.floor(i/2)*36}" font-size="9.5" fill="#2b3850" text-anchor="middle" font-weight="650">${t}</text>`).join(''))
};
const TUTORIAL = [
 {id:'resumen',tab:'Resumen',titulo:'Qué puede hacer CUTFIX PRO',go:'inicio',ill:'inicio',
  lead:'CUTFIX PRO calcula cómo cortar tus piezas en tableros completos gastando el menor material posible, y te da planos y hojas listos para el taller.',
  grupos:[['Preparar','Tableros','Registra tus tableros: medidas, material, precio, veta y cuántos tienes.','tableros'],['Preparar','Piezas','Captura lo que debes cortar o impórtalo desde Excel.','piezas'],['Preparar','Importar Excel','Convierte una lista de materiales en piezas automáticamente.','importar'],['Preparar','Habilitados','Cada Excel es un habilitado: elige cuántos muebles y cuáles cortar juntos.','habilitados'],['Calcular','Parámetros','Ancho de sierra, márgenes, veta, rotación y criterio de prioridad.','parametros'],['Calcular','Optimización','Tres métodos de corte y comparación para elegir el mejor.','optimizacion'],['Resultados','Planos y PDF','Ve cada tablero a escala, gíralo y exporta el PDF.','planos'],['Resultados','Hoja de corte','Documento imprimible para el operador.','hoja'],['Resultados','Sobrantes','Guarda los retazos reutilizables.','sobrantes'],['Archivo','Reportes y proyectos','Excel, guardar, cargar y compartir proyectos.','reportes']]},
 {id:'tableros',tab:'Tableros',titulo:'Tableros',go:'tableros',ill:'tableros',lead:'Aquí das de alta el material con el que vas a cortar. El sistema solo usa un tablero para piezas del mismo material y espesor.',
  pasos:['Escribe un nombre (ej. «Melamina blanca») y elige el material.','Indica largo, ancho y espesor en milímetros (ej. 2440 × 1220 × 18).','Pon el precio, el color, la dirección de la veta y cuántos tableros tienes.','Pulsa «Agregar tablero».'],
  tips:['Con los iconos de la tabla puedes editar, duplicar o eliminar.','«Exportar Excel» guarda tu lista de tableros.','Si importas un Excel con un material sin tablero, se crea uno de 2440 × 1220 automáticamente.'],tip:'La «Cantidad disponible» limita cuántos tableros puede usar el cálculo.'},
 {id:'piezas',tab:'Piezas',titulo:'Piezas a cortar',go:'piezas',ill:'piezas',lead:'Registra cada pieza con sus medidas y cantidad. Puedes escribirlas a mano o traerlas de Excel.',
  pasos:['Escribe nombre, largo, ancho, cantidad y espesor.','Elige material y veta (si la pieza debe respetar el sentido de la veta).','Decide si se permite girar la pieza (rotación).','Pulsa «Agregar pieza». Usa «Cargar ejemplo» para probar rápido.'],
  tips:['Edita, duplica o elimina desde la tabla.','«Limpiar» borra todas las piezas.','La columna «Total a cortar» multiplica por los muebles del habilitado.'],tip:'Largo y ancho siempre son mayores que cero; la cantidad mínima es 1.'},
 {id:'importar',tab:'Importar Excel',titulo:'Importar desde Excel',go:'importar',ill:'excel',lead:'Sube tu lista de materiales (.xlsx o .xls) y CUTFIX PRO reconoce las columnas por su nombre.',
  pasos:['Elige el archivo.','Revisa el mapeo de columnas (descripción, cantidad, ancho, largo, grueso, material, unidad, veta y tolerancias).','Escribe las unidades que se optimizan (por defecto HOJA), el nombre del habilitado y cuántos muebles son.','Indica si las medidas del Excel están en cm o mm y revisa la tabla de revisión.','Pulsa «Importar registros».'],
  tips:['Los renglones con otra unidad se ignoran y se marcan en gris.','Los errores (falta ancho, largo, material…) salen en rojo.','Una tolerancia solo se suma si está escrita como +número, por ejemplo +2.'],tip:'Si importas el mismo archivo dos veces, no se duplican las piezas.'},
 {id:'habilitados',tab:'Habilitados',titulo:'Habilitados',go:'habilitados',ill:'hab',lead:'Cada Excel importado es un habilitado (un modelo de mueble). Aquí decides cuántos muebles necesitas de cada uno.',
  pasos:['Marca «Incluir en el corte» en los habilitados que quieres cortar juntos.','Escribe la cantidad de muebles; el total de piezas se actualiza al momento.','Usa «Juntar todos» o «Quitar todos» para marcar de golpe.','Pulsa «Ir a calcular el corte».'],tips:['Puedes renombrar o eliminar un habilitado con los iconos.','Cortar varios juntos aprovecha mejor los tableros.'],tip:'Si cambias muebles después de calcular, los planos avisan que están desactualizados.'},
 {id:'param',tab:'Parámetros',titulo:'Parámetros de corte',go:'parametros',ill:'param',lead:'Ajustes que se aplican a todos los métodos de optimización.',
  pasos:['Kerf: el grosor del disco de la sierra (se descuenta entre piezas).','Margen perimetral, separación mínima y margen de seguridad: espacio libre en bordes.','Tolerancias y compensación de corte para ajustar medidas.','Rotación global y «Respetar veta siempre» controlan cómo se pueden girar las piezas.','Criterio de prioridad: menos tableros, menos desperdicio, menor costo o menos cortes.'],tips:['El kerf y la tolerancia son independientes.','Los valores se guardan solos en tu navegador.'],tip:'Cambiar un parámetro después de calcular requiere recalcular.'},
 {id:'opt',tab:'Optimización',titulo:'Optimización',go:'optimizacion',ill:'opt',lead:'Elige cómo quieres cortar. CUTFIX PRO te muestra qué tanto aprovecha el material.',
  pasos:['«Por longitud»: primero cortes paralelos al largo del tablero (franjas largas).','«Por anchura»: primero cortes a lo ancho (franjas transversales).','«Mixto (Largo + Ancho)»: franjas a lo largo y luego aprovecha los sobrantes a lo ancho.','«Óptimo»: prueba todos los métodos y elige el mejor según tu criterio.','Revisa la tabla de comparación y el ahorro de material.'],tips:['La fila verde es el mejor resultado.','Verás tableros, aprovechamiento, desperdicio, cortes y costo.'],tip:'Es el mejor resultado encontrado por el sistema, no un óptimo matemático demostrado.'},
 {id:'planos',tab:'Planos y giro',titulo:'Planos de corte y giro del tablero',go:'planos',ill:'planos',lead:'Cada tablero se dibuja a escala, con piezas numeradas, medidas, veta, líneas de corte y sobrantes.',
  pasos:['Elige el tablero en la lista.','Activa o desactiva dimensiones, líneas de corte, veta y etiquetas.','Usa Zoom +, Zoom − y Reset: el dibujo se mantiene nítido.','Pulsa «Girar 90°» para cambiar entre horizontal y vertical.'],tips:['El giro es solo visual: no recalcula ni mueve piezas.','El PDF respeta la orientación que elijas.','Debajo hay un resumen de materiales y cantidades.'],tip:'Gira el tablero ANTES de generar el PDF.'},
 {id:'pdf',tab:'PDF',titulo:'PDF de optimización',go:'planos',ill:'pdf',lead:'Genera un documento con el resumen, la lista general de cortes y una hoja por cada tablero.',
  pasos:['Calcula la optimización.','En Planos, elige la orientación con «Girar 90°».','Pulsa «Generar PDF de optimización» (todos los tableros) o «PDF (tablero actual)».'],tips:['Las líneas punteadas son vectoriales: se ven nítidas con mucho zoom.','Horizontal = hoja apaisada; Vertical = hoja vertical.','Cada hoja incluye leyenda de piezas y medidas de sobrantes.'],tip:'Si cambiaste datos, el PDF recalcula antes de generarse.'},
 {id:'hoja',tab:'Hoja de corte',titulo:'Hoja de corte',go:'hoja',ill:'hoja',lead:'Documento imprimible para el operador del taller, con plano y lista de piezas de cada tablero.',
  pasos:['Escribe el nombre del proyecto, operador o cliente y la fecha.','Pulsa «Generar hoja».','Pulsa «Imprimir / PDF» para imprimir o guardar.'],tips:['Incluye kerf, tolerancias, piezas rotadas y veta.'],tip:'Primero debes ejecutar la optimización.'},
 {id:'sobr',tab:'Sobrantes',titulo:'Sobrantes reutilizables',go:'sobrantes',ill:'sobr',lead:'Guarda los retazos grandes para usarlos en próximos trabajos.',
  pasos:['Agrégalos a mano con largo, ancho, espesor, material y veta.','O pulsa «Detectar sobrantes del último cálculo» (retazos de 200 × 200 mm o más).','Exporta la lista a Excel.'],tips:['Elimina con el icono de papelera cuando los uses.'],tip:'La detección usa el último resultado calculado.'},
 {id:'rep',tab:'Reportes y proyectos',titulo:'Reportes, exportaciones y proyectos',go:'reportes',ill:'rep',lead:'Saca tu información a Excel y guarda tu trabajo.',
  pasos:['Exporta piezas, tableros, resultados o sobrantes a Excel.','«Exportar proyecto (.json)» guarda todo en un archivo; «Importar proyecto» lo recupera.','En el menú lateral: Guardar, Cargar y Nuevo manejan proyectos dentro del navegador.'],tips:['Tus datos se recuperan solos al volver a abrir la app.'],tip:'Usa «Nuevo» con cuidado: borra lo que no hayas guardado.'}
];
let _tutI = 0;
function tutRender(){
  const t = TUTORIAL[_tutI], body = $('tutBody');
  $('tutTitulo').textContent = t.titulo;
  $('tutTabs').innerHTML = TUTORIAL.map((x,i)=>`<button class="${i===_tutI?'on':''}" data-i="${i}">${x.tab}</button>`).join('');
  $('tutTabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{ _tutI=+b.dataset.i; tutRender(); });
  let h = `<div class="tut-ill">${TUT_ILL[t.ill]||''}</div><p class="tut-lead">${t.lead}</p>`;
  if(t.grupos){
    h += `<div class="tut-grid">${t.grupos.map(g=>`<button class="tut-card" data-t="${g[3]}"><div class="g">${g[0]}</div><b>${g[1]}</b><span>${g[2]}</span></button>`).join('')}</div>`;
  } else {
    h += `<div class="tut-cols"><div><h4>Paso a paso</h4><ol>${t.pasos.map(p=>`<li>${p}</li>`).join('')}</ol></div><div><h4>Detalles útiles</h4><ul>${t.tips.map(p=>`<li>${p}</li>`).join('')}</ul></div></div><div class="tut-tip"><b>Ojo:</b> ${t.tip}</div>`;
  }
  h += `<div class="tut-go"><button class="btn btn-primary" id="tutIr">Ir a esta sección</button></div>`;
  body.innerHTML = h; body.scrollTop = 0;
  body.querySelectorAll('.tut-card').forEach(c=>c.onclick=()=>{ _tutI = TUTORIAL.findIndex(x=>x.id===c.dataset.t || (c.dataset.t==='piezas'&&x.id==='piezas')); if(_tutI<0) _tutI=0; tutRender(); });
  $('tutIr').onclick = ()=>{ tutCerrar(); irSeccion(t.go); };
  $('tutPos').textContent = (_tutI+1)+' de '+TUTORIAL.length;
  $('tutPrev').disabled = _tutI===0; $('tutNext').disabled = _tutI===TUTORIAL.length-1;
  const on = $('tutTabs').querySelector('.on'); if(on && on.scrollIntoView) on.scrollIntoView({inline:'center',block:'nearest'});
}
function tutAbrir(){ _tutI = 0; $('tutorial').hidden = false; document.body.style.overflow='hidden'; tutRender(); $('tutCerrar').focus(); }
function tutCerrar(){ $('tutorial').hidden = true; document.body.style.overflow=''; $('btnTutorial').focus(); }
$('btnTutorial').onclick = tutAbrir;
$('tutCerrar').onclick = tutCerrar;
$('tutorial').addEventListener('click', e=>{ if(e.target===$('tutorial')) tutCerrar(); });
$('tutPrev').onclick = ()=>{ if(_tutI>0){ _tutI--; tutRender(); } };
$('tutNext').onclick = ()=>{ if(_tutI<TUTORIAL.length-1){ _tutI++; tutRender(); } };
document.addEventListener('keydown', e=>{ if($('tutorial').hidden) return; if(e.key==='Escape') tutCerrar(); if(e.key==='ArrowRight') $('tutNext').click(); if(e.key==='ArrowLeft') $('tutPrev').click(); });

document.addEventListener('DOMContentLoaded', init);

/* =========================================================
   FIN DEL ARCHIVO script.js
   ========================================================= */
