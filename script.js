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
/** Pregunta el nombre del PDF antes de descargarlo. Devuelve el nombre con .pdf, o null si el usuario cancela. */
function pedirNombrePdf(sugerido){
  const base = String(sugerido||'documento').replace(/\.pdf$/i,'');
  const r = prompt('Nombre del archivo PDF:', base);
  if(r === null) return null;                                   // canceló: no se descarga
  let n = r.trim().replace(/\.pdf$/i,'').replace(/[\\/:*?"<>|]+/g,'-').trim();   // quita caracteres no válidos en nombres de archivo
  if(!n) n = base;
  return n + '.pdf';
}

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

/** Validación de un tablero (la usan el formulario manual y el dictado por voz). Devuelve el mensaje de error o null. */
function validarTablero(t){
  if(!(t.largo>0) || !(t.ancho>0)) return 'Dimensiones inválidas';
  return null;
}
/** Validación de una pieza (formulario manual y dictado por voz). */
function validarPieza(p){
  if(!(p.largo>0) || !(p.ancho>0)) return 'Dimensiones inválidas';
  if(!(p.cantidad>0)) return 'Cantidad inválida';
  return null;
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
  const errT = validarTablero(t);
  if(errT){ toast(errT,'error'); return; }
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
  const errP = validarPieza(p);
  if(errP){ toast(errP,'error'); return; }
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
   MODO 4 · BÚSQUEDA GLOBAL (MIXTO LARGO + ANCHO SOBRE TODO EL LOTE)
   ========================================================= */
/**
 * El mixto convencional llena un tablero a la vez de forma voraz y nunca revisa el lote completo, por eso
 * puede gastar tableros de más. Esta búsqueda trabaja con TODAS las piezas de un material a la vez:
 *  1) TIPOS: agrupa las piezas por medida, veta y rotación.
 *  2) PATRONES: obtiene patrones de corte GUILLOTINABLES del tablero real (cortes de lado a lado, kerf entre
 *     piezas, ancho y largo, solo orientaciones que permite la veta). Mezcla tipos libremente (costados +
 *     cubiertas en el mismo tablero) y prueba cortes verticales y horizontales en cada región, sin depender
 *     de un orden de colocación.
 *       · Pocos tipos (<=3): enumeración exacta de todos los patrones no dominados.
 *       · Más tipos o si se agota el tiempo: generación de columnas (modelo lineal + patrón de mayor valor por
 *         programación dinámica); además entrega una COTA INFERIOR de tableros.
 *  3) COBERTURA: elige cuántos tableros de cada patrón para cubrir todas las piezas con el menor número de
 *     tableros (programación dinámica exacta; en lotes grandes redondeo del modelo lineal / voraz con
 *     reinicios + DP exacta sobre el remanente).
 *  4) REORGANIZACIÓN: reparte de nuevo las piezas de los tableros menos llenos para eliminar tableros casi vacíos.
 * No altera medidas; usa el mismo kerf, márgenes y orientaciones() (veta/rotación) que los demás métodos.
 * Devuelve null si no logra un plan completo en el tiempo dado (el llamador conserva el método convencional).
 * Resultado: {tableros:[{placed, cuts}], cotaInferior, optimoDemostrado, ...}
 */
function optimizarMixtoGlobal(pieces, board, maxTableros, opts){
  const EPS = 0.01, kerf = STATE.params.kerf;
  const t0 = Date.now(), limiteMs = (opts && opts.limiteMs) || 3500;
  const vencio = ()=> Date.now()-t0 > limiteMs;
  const m = margenTablero(board), W0 = board.ancho-2*m, H0 = board.largo-2*m;
  const r2 = v => Math.round(v*100);
  let semilla = 20240611;
  const rnd = ()=>{ semilla = (semilla + 0x6D2B79F5) | 0; let t = Math.imul(semilla ^ (semilla>>>15), 1 | semilla); t = (t + Math.imul(t ^ (t>>>7), 61 | t)) ^ t; return ((t ^ (t>>>14))>>>0)/4294967296; };

  // ---- 1) tipos de pieza ----
  const tipos = [], porClave = new Map();
  for(const p of pieces){
    let os = orientaciones(p, board).filter(o=> o.w<=W0+EPS && o.h<=H0+EPS);
    os = os.filter((o,i)=> os.findIndex(q=>Math.abs(q.w-o.w)<EPS && Math.abs(q.h-o.h)<EPS)===i);
    if(!os.length) return null;
    const k = [r2(p.w), r2(p.h), p.veta, p.rot?1:0].join('|');
    let t = porClave.get(k);
    if(!t){ t = {os, piezas:[]}; porClave.set(k, t); tipos.push(t); }
    t.piezas.push(p);
  }
  const d = tipos.length;
  if(!d) return null;
  const dem = tipos.map(t=>t.piezas.length);
  const areaT = tipos.map(t=>t.os[0].w*t.os[0].h);
  const zero = new Array(d).fill(0);
  const minW = Math.min(...tipos.flatMap(t=>t.os.map(o=>o.w)));
  const minH = Math.min(...tipos.flatMap(t=>t.os.map(o=>o.h)));
  const areaDe = v => { let s=0; for(let i=0;i<d;i++) s += v[i]*areaT[i]; return s; };
  const capar = v => v.map((x,i)=>Math.min(x, dem[i]));

  // ---- 2a) puntos de corte naturales: sumas de medidas de pieza (con kerf entre ellas) ----
  let truncado = false;                 // true si algún límite recortó la búsqueda (entonces no se afirma optimalidad)
  function trama(dims, total, maxTerm, tope){
    const uniq = [...new Set(dims.map(r2))].map(v=>v/100).sort((a,b)=>a-b);
    const visto = new Map(); let frente = [];
    uniq.forEach(dm=>{ if(dm<=total+EPS){ visto.set(r2(dm), dm); frente.push({v:dm, n:1}); } });
    while(frente.length){
      const sig = [];
      for(const f of frente){
        if(f.n >= maxTerm){ truncado = true; continue; }
        for(const dm of uniq){
          const v = f.v+kerf+dm; if(v > total+EPS) break;
          const k = r2(v);
          if(!visto.has(k)){ if(visto.size >= tope){ truncado = true; continue; } visto.set(k, v); sig.push({v, n:f.n+1}); }
        }
      }
      frente = sig;
    }
    return [...visto.values()].sort((a,b)=>a-b);
  }
  const indiceMenorIgual = (arr, v)=>{ let lo = 0, hi = arr.length-1, r = -1; while(lo<=hi){ const mid = (lo+hi)>>1; if(arr[mid] <= v+EPS){ r = mid; lo = mid+1; } else hi = mid-1; } return r; };

  // ---- 2b) enumeración exacta de patrones no dominados (pocos tipos) ----
  function patronesExactos(){
    const rX = trama(tipos.flatMap(t=>t.os.map(o=>o.w)), W0, 99, 1600);
    const rY = trama(tipos.flatMap(t=>t.os.map(o=>o.h)), H0, 99, 3200);
    const limInterno = d<=2 ? 120 : 70, limRaiz = d<=2 ? 600 : 400;
    const memo = new Map();
    const domina = (a,b)=>{ for(let i=0;i<d;i++) if(a[i]<b[i]) return false; return true; };
    function podar(cands, lim){
      const mapa = new Map();
      cands.forEach(c=>{ const k = c.v.join(','); if(!mapa.has(k)) mapa.set(k, c); });
      const lista = [...mapa.values()].sort((a,b)=> b.area-a.area), keep = [];
      for(const c of lista){ if(!keep.some(k=>domina(k.v, c.v))) keep.push(c); }
      if(keep.length <= lim) return keep;
      truncado = true;
      const sel = new Set(keep.slice(0, lim));
      for(let i=0;i<d;i++){ let b = null; keep.forEach(c=>{ if(!b || c.v[i]>b.v[i] || (c.v[i]===b.v[i] && c.area>b.area)) b = c; }); if(b) sel.add(b); }
      return keep.filter(c=>sel.has(c));
    }
    function f(Wr, Hr){                         // región normalizada a puntos de trama (sin pérdida de patrones)
      const iw = indiceMenorIgual(rX, Wr), ih = indiceMenorIgual(rY, Hr);
      if(iw<0 || ih<0) return [{v:zero, area:0, src:null}];
      const W = rX[iw], H = rY[ih], key = iw*100000 + ih;
      const hit = memo.get(key); if(hit) return hit;
      if(vencio()) throw new Error('tiempo');
      const cands = [{v:zero, area:0, src:null}];
      tipos.forEach((t,i)=> t.os.forEach(o=>{ if(o.w<=W+EPS && o.h<=H+EPS){ const v = zero.slice(); v[i] = 1; cands.push({v, area:areaT[i], src:{k:'L', t:i, o}}); } }));
      const combinar = (L, R, k, pos)=>{
        for(const a of L){ if(!a.area) continue;
          for(const b of R){ if(!b.area) continue;
            const v = new Array(d);
            for(let i=0;i<d;i++){ const s = a.v[i]+b.v[i]; v[i] = s>dem[i] ? dem[i] : s; }
            cands.push({v, area:areaDe(v), src:{k, pos, a, b}});
          } }
      };
      for(const x of rX){ if(x*2+kerf > W+EPS) break; combinar(f(x,H), f(W-x-kerf,H), 'V', x); }
      for(const y of rY){ if(y*2+kerf > H+EPS) break; combinar(f(W,y), f(W,H-y-kerf), 'H', y); }
      const res = podar(cands, (iw===rX.length-1 && ih===rY.length-1) ? limRaiz : limInterno);
      memo.set(key, res); return res;
    }
    return f(W0, H0).filter(p=>p.area>0);
  }

  // ---- 2c) generación de columnas (muchos tipos) ----
  function patronesColumnas(){
    let maxT = 99, tope = 1200;
    let rX, rY;
    for(;;){                                    // tramas completas si son razonables; si no, se limitan las sumas
      truncado = false;
      rX = trama(tipos.flatMap(t=>t.os.map(o=>o.w)), W0, maxT, tope);
      rY = trama(tipos.flatMap(t=>t.os.map(o=>o.h)), H0, maxT, tope*2);
      if(rX.length*rY.length <= 90000 || maxT<=2) break;
      maxT = maxT>4 ? 4 : maxT-1; tope = Math.max(150, tope>>1);
    }
    const nx = rX.length, ny = rY.length;
    // índice de la región derecha tras un corte: floor(Xs[i]-Xs[c]-kerf)
    const flX = new Int32Array(nx*nx).fill(-1), flY = new Int32Array(ny*ny).fill(-1);
    for(let i=0;i<nx;i++) for(let c=0;c<nx && rX[c]*2+kerf<=rX[i]+EPS;c++) flX[i*nx+c] = indiceMenorIgual(rX, rX[i]-rX[c]-kerf);
    for(let j=0;j<ny;j++) for(let c=0;c<ny && rY[c]*2+kerf<=rY[j]+EPS;c++) flY[j*ny+c] = indiceMenorIgual(rY, rY[j]-rY[c]-kerf);
    const iW0 = indiceMenorIgual(rX, W0), iH0 = indiceMenorIgual(rY, H0);

    function precio(y){                         // patrón guillotinable de mayor valor con precios y[] (cantidades sin límite)
      const val = new Float64Array(nx*ny), kind = new Uint8Array(nx*ny), arg = new Int32Array(nx*ny);
      for(let i=0;i<nx;i++){
        if((i&15)===0 && vencio()) throw new Error('tiempo');
        const W = rX[i];
        for(let j=0;j<ny;j++){
          const H = rY[j], id = i*ny+j;
          let b = 0, k = 0, a = 0;
          for(let t=0;t<d;t++){ if(y[t]<=b) continue; const os = tipos[t].os;
            for(let oi=0;oi<os.length;oi++){ if(os[oi].w<=W+EPS && os[oi].h<=H+EPS){ b = y[t]; k = 1; a = t*2+oi; break; } } }
          for(let c=0;c<i && rX[c]*2+kerf<=W+EPS;c++){
            const r = flX[i*nx+c]; if(r<0) continue;
            const v = val[c*ny+j]+val[r*ny+j]; if(v>b+1e-12){ b = v; k = 2; a = c; }
          }
          for(let c=0;c<j && rY[c]*2+kerf<=H+EPS;c++){
            const r = flY[j*ny+c]; if(r<0) continue;
            const v = val[i*ny+c]+val[i*ny+r]; if(v>b+1e-12){ b = v; k = 3; a = c; }
          }
          val[id] = b; kind[id] = k; arg[id] = a;
        }
      }
      function nodo(i, j){
        const id = i*ny+j, k = kind[id], a = arg[id];
        if(!k) return {src:null};
        if(k===1){ const t = a>>1, oi = a&1; return {src:{k:'L', t, o:tipos[t].os[oi]}}; }
        if(k===2) return {src:{k:'V', pos:rX[a], a:nodo(a,j), b:nodo(flX[i*nx+a], j)}};
        return {src:{k:'H', pos:rY[a], a:nodo(i,a), b:nodo(i, flY[j*ny+a])}};
      }
      const raiz = nodo(iW0, iH0);
      const v = zero.slice();
      (function contar(n){ if(!n.src) return; const s = n.src; if(s.k==='L') v[s.t]++; else { contar(s.a); contar(s.b); } })(raiz);
      return {valor: val[iW0*ny+iH0], v, src: raiz.src};
    }

    function resolverLP(cols){                  // dual: max dem·y  s.t.  p_j·y <= 1  (símplex en tabla)
      const mm = cols.length, n = d, W = n+mm+1;
      const T = cols.map((p,r)=>{ const row = new Float64Array(W); for(let i=0;i<n;i++) row[i] = p[i]; row[n+r] = 1; row[W-1] = 1; return row; });
      const obj = new Float64Array(W); for(let i=0;i<n;i++) obj[i] = -dem[i];
      const base = cols.map((_,r)=>n+r);
      for(let it=0; it<8000; it++){
        let e = -1, mejor = -1e-9;
        if(it < 400){ for(let c=0;c<W-1;c++) if(obj[c]<mejor){ mejor = obj[c]; e = c; } }
        else { for(let c=0;c<W-1;c++) if(obj[c]<-1e-9){ e = c; break; } }   // regla de Bland (evita ciclos)
        if(e<0) break;
        let fila = -1, rmin = Infinity;
        for(let r=0;r<mm;r++){ const a = T[r][e]; if(a>1e-9){ const q = T[r][W-1]/a; if(q<rmin-1e-12 || (Math.abs(q-rmin)<=1e-12 && base[r]<base[fila])){ rmin = q; fila = r; } } }
        if(fila<0) return null;
        const pv = T[fila][e]; for(let c=0;c<W;c++) T[fila][c] /= pv;
        for(let r=0;r<mm;r++){ if(r===fila) continue; const fct = T[r][e]; if(fct!==0) for(let c=0;c<W;c++) T[r][c] -= fct*T[fila][c]; }
        const fo = obj[e]; for(let c=0;c<W;c++) obj[c] -= fo*T[fila][c];
        base[fila] = e;
      }
      const y = new Array(n).fill(0);
      base.forEach((b,r)=>{ if(b<n) y[b] = T[r][W-1]; });
      const x = cols.map((_,j)=>Math.max(0, obj[n+j]));
      return {z: obj[W-1], y, x};
    }

    const pool = [], claves = new Set();
    const agregar = c=>{ const k = c.v.join(','); if(claves.has(k) || !c.v.some(q=>q>0)) return false; claves.add(k); pool.push(c); return true; };
    for(let i=0;i<d;i++){ const y = zero.slice(); y[i] = 1; agregar(precio(y)); }
    let sol = null, convergio = false;
    for(let it=0; it<120; it++){
      sol = resolverLP(pool.map(p=>p.v)); if(!sol) break;
      const c = precio(sol.y);
      if(c.valor <= 1+1e-7){ convergio = true; break; }
      if(!agregar(c)) break;
    }
    if(!sol) throw new Error('lp');
    let cota = 0;
    if(convergio && !truncado) cota = Math.ceil(sol.z-1e-6);
    const lpx = sol.x.slice(), lpPool = pool.slice();
    // más diversidad: patrones con precios perturbados
    for(let r=0; r<14 && !vencio(); r++){
      const y = sol.y.map(v=> v*(1+0.5*(rnd()-0.5)) + (rnd()<0.2 ? 0.02*rnd() : 0));
      try{ agregar(precio(y)); }catch(e){ break; }
    }
    return {pool, lpx, lpPool, cota, convergio, z: sol.z};
  }

  // ---- obtener el conjunto de patrones ----
  let patrones = null, lpInfo = null, cotaInferior = 0, exacto = false;
  if(d<=3){
    try{ patrones = patronesExactos().map(p=>({v:p.v, area:p.area, src:p.src})); exacto = !truncado; }catch(e){ patrones = null; }
  }
  if(!patrones){
    try{ lpInfo = patronesColumnas(); }catch(e){ return null; }
    cotaInferior = lpInfo.cota;
    patrones = lpInfo.pool.map(p=>({v:capar(p.v), area:areaDe(capar(p.v)), src:p.src, vFull:p.v}));
  }
  if(!patrones.length) return null;

  // ---- 3) cobertura con el mínimo de tableros ----
  const LIMITE_DP = 400000;
  const tamEstados = rem => rem.reduce((s,v)=>s*(v+1), 1);
  function cubrirExacto(rem, maxEstados){
    const S = tamEstados(rem); if(S > (maxEstados || LIMITE_DP*4)) return null;
    if(S===1) return [];
    const stride = new Array(d); let acc = 1;
    for(let i=0;i<d;i++){ stride[i] = acc; acc *= rem[i]+1; }
    const dp = new Int32Array(S), eleg = new Int32Array(S).fill(-1);
    const r = new Array(d);
    const util = patrones.map((p,pi)=>pi).filter(pi=>true);
    for(let idx=1; idx<S; idx++){
      let q = idx; for(let i=0;i<d;i++){ r[i] = q % (rem[i]+1); q = (q - r[i])/(rem[i]+1); }
      let mejor = 1e9, mc = -1, ec = -1;
      for(let u=0; u<util.length; u++){
        const pi = util[u], p = patrones[pi].v; let n = 0, c = 0, prog = false;
        for(let i=0;i<d;i++){
          const nr = r[i]>p[i] ? r[i]-p[i] : 0;
          if(nr<r[i]){ prog = true; c += (r[i]-nr)*areaT[i]; }
          n += nr*stride[i];
        }
        if(!prog) continue;
        const val = dp[n]+1;
        if(val<mejor || (val===mejor && c>mc)){ mejor = val; mc = c; ec = pi; }
      }
      dp[idx] = mejor; eleg[idx] = ec;
    }
    const lista = []; let idx = S-1;
    while(idx>0){
      const pi = eleg[idx]; if(pi<0) return null;
      lista.push(pi);
      let q = idx, n = 0;
      for(let i=0;i<d;i++){ const ri = q % (rem[i]+1); q = (q-ri)/(rem[i]+1); const p = patrones[pi].v[i]; n += (ri>p ? ri-p : 0)*stride[i]; }
      idx = n;
    }
    return lista;
  }
  function cubrirVoraz(rem0, ruido){
    let rem = rem0.slice(); const lista = [];
    while(tamEstados(rem) > LIMITE_DP && !vencio()){
      let mejor = -1, mp = -1; const pun = [];
      patrones.forEach((p,pi)=>{ let c = 0; for(let i=0;i<d;i++) c += Math.min(p.v[i], rem[i])*areaT[i]; pun.push(c); if(c>mejor){ mejor = c; mp = pi; } });
      if(mejor<=0) break;
      let elegido = mp;
      if(ruido>0){ const cand = pun.map((c,pi)=>({c,pi})).filter(x=>x.c>=mejor*(1-ruido)); elegido = cand[Math.floor(rnd()*cand.length)].pi; }
      lista.push(elegido);
      rem = rem.map((v,i)=>Math.max(0, v-patrones[elegido].v[i]));
    }
    const resto = cubrirExacto(rem, LIMITE_DP*4);
    return resto ? lista.concat(resto) : null;
  }
  let plan = null;
  if(tamEstados(dem) <= LIMITE_DP*4) plan = cubrirExacto(dem);
  else {
    // redondeo del modelo lineal: floor(x_j) tableros de cada patrón y el remanente con DP exacta
    if(lpInfo){
      const rem = dem.slice(), lista = [];
      lpInfo.lpPool.forEach((p,j)=>{
        const pi = patrones.findIndex(q=>q.vFull===p.v || q.vFull.join(',')===p.v.join(','));
        const n = Math.floor(lpInfo.lpx[j]+1e-9);
        for(let k=0;k<n && pi>=0;k++){ lista.push(pi); for(let i=0;i<d;i++) rem[i] = Math.max(0, rem[i]-patrones[pi].v[i]); }
      });
      const resto = cubrirVoraz(rem, 0);
      if(resto) plan = lista.concat(resto);
    }
    for(let r=0; r<14 && !vencio(); r++){
      const l = cubrirVoraz(dem, r===0 ? 0 : 0.04 + 0.03*(r%4));
      if(l && (!plan || l.length<plan.length)) plan = l;
    }
  }
  if(!plan) return null;

  // contenido real de cada tablero: lo que realmente se asigna (los excedentes se quitan de los últimos)
  let tabs = plan.map(pi=>({pi, c:null}));
  tabs.sort((a,b)=> patrones[b.pi].area - patrones[a.pi].area);
  const asignar = ()=>{
    const falta = dem.slice();
    tabs.forEach(t=>{ t.c = patrones[t.pi].v.map((v,i)=>{ const u = Math.min(v, falta[i]); falta[i] -= u; return u; }); });
    return falta.every(v=>v===0);
  };
  if(!asignar()) return null;
  tabs = tabs.filter(t=>t.c.some(v=>v>0));
  const optimoDemostrado = exacto && tamEstados(dem) <= LIMITE_DP*4 || (cotaInferior>0 && tabs.length===cotaInferior);

  // ---- 4) reorganización: fusionar los tableros menos llenos ----
  function fusionar(){
    let mejoro = true, vueltas = 0;
    while(mejoro && !vencio() && vueltas++<20){
      mejoro = false;
      const orden = tabs.slice().sort((a,b)=>areaDe(a.c)-areaDe(b.c));
      for(let k=Math.min(7, orden.length); k>=2 && !mejoro; k--){
        const sub = orden.slice(0,k);
        const u = zero.slice(); sub.forEach(t=>t.c.forEach((v,i)=>{ u[i]+=v; }));
        if(tamEstados(u) > LIMITE_DP) continue;
        const nuevos = cubrirExacto(u, LIMITE_DP);
        if(nuevos && nuevos.length < k){
          const falta = u.slice();
          const reemp = nuevos.map(pi=>({pi, c:patrones[pi].v.map((v,i)=>{ const x = Math.min(v, falta[i]); falta[i]-=x; return x; })})).filter(t=>t.c.some(v=>v>0));
          tabs = tabs.filter(t=>!sub.includes(t)).concat(reemp);
          mejoro = true;
        }
      }
    }
  }
  if(!optimoDemostrado) fusionar();
  if(maxTableros && tabs.length > maxTableros) return null;

  // ---- 5) materializar coordenadas reales ----
  function emitir(e, x, y, W, H, cuota, out){
    if(!e.src) return 0;
    const s = e.src;
    if(s.k==='L'){
      if(cuota[s.t] > 0){ cuota[s.t]--; out.push({t:s.t, x, y, w:s.o.w, h:s.o.h, rot:s.o.rot}); return 1; }
      return 0;
    }
    let na, nb;
    if(s.k==='V'){ na = emitir(s.a, x, y, s.pos, H, cuota, out); nb = emitir(s.b, x+s.pos+kerf, y, W-s.pos-kerf, H, cuota, out); }
    else         { na = emitir(s.a, x, y, W, s.pos, cuota, out); nb = emitir(s.b, x, y+s.pos+kerf, W, H-s.pos-kerf, cuota, out); }
    return na+nb;
  }
  const cola = tipos.map(t=>t.piezas.slice());
  const tableros = [];
  tabs.sort((a,b)=> areaDe(b.c)-areaDe(a.c));
  for(const t of tabs){
    const out = [], cuota = t.c.slice();
    const n = emitir(patrones[t.pi], 0, 0, W0, H0, cuota, out);
    if(cuota.some(v=>v>0)) return null;          // el patrón no pudo reproducir lo asignado
    const placed = out.map(q=>({...cola[q.t].shift(), x:m+q.x, y:m+q.y, w:q.w, h:q.h, rotated:q.rot}));
    tableros.push({placed, cuts: Math.max(1, n + 1)});
  }
  if(cola.some(c=>c.length)) return null;
  return { tableros, tipos: d, patrones: patrones.length, cotaInferior: optimoDemostrado ? tableros.length : cotaInferior,
           optimoDemostrado: !!optimoDemostrado, ms: Date.now()-t0 };
}

/** ¿El acomodo se puede cortar solo con cortes de lado a lado (guillotina) separados por el kerf? */
function esGuillotinable(placed){
  const kerf = STATE.params.kerf, EPS = 0.01;
  if(placed.length <= 1) return true;
  for(const eje of ['x','y']){
    const tam = eje==='x' ? 'w' : 'h';
    const bordes = [...new Set(placed.map(p=>Math.round((p[eje]+p[tam])*100)))].sort((a,b)=>a-b);
    for(const b of bordes){
      const r = b/100;
      if(placed.every(p=> p[eje]+p[tam] <= r+EPS || p[eje] >= r+kerf-EPS)){
        const A = placed.filter(p=>p[eje]+p[tam] <= r+EPS), B = placed.filter(p=>p[eje] >= r+kerf-EPS);
        if(A.length && B.length && A.length+B.length===placed.length) return esGuillotinable(A) && esGuillotinable(B);
      }
    }
  }
  return false;
}

/* =========================================================
   OPTIMIZACIÓN GLOBAL
   ========================================================= */

/**
 * Prueba la búsqueda global para un grupo (material + espesor) y la compara con el resultado convencional.
 * Devuelve {boards, cuts, cotaInferior, optimoDemostrado} solo si MEJORA (menos tableros, o los mismos con el
 * desperdicio más concentrado); si no, null y se conserva el convencional.
 */
function intentarBusquedaGlobal(piezas, available, key, conv){
  const base = available[0]; if(!base) return null;
  // tableros iguales disponibles (misma medida, veta y margen) para esta búsqueda
  const mismo = b => b.ancho===base.ancho && b.largo===base.largo && b.veta===base.veta && (b.margen||0)===(base.margen||0);
  let n = 0; while(n < available.length && mismo(available[n])) n++;
  let r = null;
  try{ r = optimizarMixtoGlobal(piezas, base, n); }catch(e){ console.warn('Búsqueda global descartada:', e); return null; }
  if(!r || !r.tableros.length) return null;
  const ocupacion = tabs => tabs.reduce((s,t)=>{ const u = usedArea(t.placed)/(base.ancho*base.largo); return s+u*u; }, 0);
  const boards = r.tableros.map((t,i)=>{
    const tab = {...available[i], instanceId: `${key}_B${i}`};
    const placed = t.placed.map(p=>({...p, boardId: tab.instanceId}));
    return { id: tab.instanceId, board: tab, placed, freeRegions: libresDeTablero(tab, placed), mode: 'mixto (largo + ancho)',
             variantName: 'Búsqueda global', guillotina: true, _cuts: t.cuts };
  });
  const sinColocar = conv.unplaced || 0;
  const mejora = sinColocar > 0 ? true
    : boards.length < conv.boards.length ||
      (boards.length === conv.boards.length && ocupacion(boards) > ocupacion(conv.boards) + 1e-9);
  const info = { cotaInferior: r.cotaInferior, optimoDemostrado: r.optimoDemostrado, tablerosGlobal: boards.length };
  if(!mejora) return { usar:false, ...info };
  return { usar:true, boards, cuts: boards.reduce((s,b)=>s+b._cuts,0), ...info };
}

/** Rectángulos libres máximos de un tablero (para el conteo de sobrantes reutilizables). */
function libresDeTablero(board, placed){
  if(typeof rectsLibres !== 'function') return [];
  const m = margenTablero(board), kerf = STATE.params.kerf;
  return rectsLibres({x:m, y:m, w:board.ancho-2*m, h:board.largo-2*m},
    placed.map(p=>({x:p.x-kerf, y:p.y-kerf, w:p.w+2*kerf, h:p.h+2*kerf})));
}

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
  const infoBusqueda = [];      // por material: cómo se obtuvo el resultado (mixto largo + ancho)

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

    // Estado antes del método convencional (para poder compararlo con la búsqueda global)
    const remainingIni = [...remaining];
    const nTabAntes = boardsUsed.length, cortesAntes = totalCuts;
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
    // MIXTO (LARGO + ANCHO): además del método convencional se prueba la búsqueda global sobre todo el lote
    // y se conserva lo mejor (menos tableros; a igual número, el acomodo que concentra el desperdicio).
    if(modeName === 'mixto (largo + ancho)' && remainingIni.length > 0){
      const conv = { boards: boardsUsed.slice(nTabAntes), unplaced: remaining.length, cuts: totalCuts - cortesAntes };
      const glob = intentarBusquedaGlobal(remainingIni, available, key, conv);
      const usar = !!(glob && glob.usar);
      if(usar){
        boardsUsed.splice(nTabAntes, boardsUsed.length - nTabAntes, ...glob.boards);
        totalCuts = cortesAntes + glob.cuts;
        remaining = [];
      }
      infoBusqueda.push({ material: group.material, espesor: group.espesor,
        metodo: usar ? 'optimizada' : 'convencional',
        verificada: !!glob,                                   // la búsqueda global se ejecutó y no encontró algo mejor
        tablerosConvencional: conv.boards.length, tableros: usar ? glob.boards.length : conv.boards.length,
        cotaInferior: glob ? glob.cotaInferior : 0, optimoDemostrado: glob ? glob.optimoDemostrado : false });
    }
    if(remaining.length > 0){
      unplacedAll.push(...remaining.map(p=>({...p, reason:'Sin tableros suficientes'})));
    }
  });

  const totalEsperado = Object.values(grouped).reduce((n,g)=>n+g.pieces.length,0);
  const out = { mode: modeName, boards: boardsUsed, unplaced: unplacedAll, totalCuts };
  if(infoBusqueda.length){
    const nOpt = infoBusqueda.filter(x=>x.metodo==='optimizada').length;
    out.busqueda = infoBusqueda;
    out.metodoBusqueda = nOpt===0 ? 'convencional' : nOpt===infoBusqueda.length ? 'optimizada' : 'mixta';
  }
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
    if(b.guillotina && !esGuillotinable(b.placed)) errs.push(`${b.id}: el acomodo no se puede cortar con cortes de lado a lado (guillotina)`);
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
  results.forEach(x=>{ const t = textoBusqueda(x.result); if(t) x.status = t; });
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

/** Texto corto de cómo se obtuvo un resultado del mixto (largo + ancho): búsqueda optimizada o convencional. */
function textoBusqueda(result){
  const b = result && result.busqueda; if(!b || !b.length) return '';
  const demostrado = b.every(x=>x.optimoDemostrado);
  const cota = b.reduce((n,x)=>n+(x.cotaInferior||0),0);
  let t = result.metodoBusqueda==='optimizada' ? 'Búsqueda optimizada global'
        : result.metodoBusqueda==='mixta' ? 'Búsqueda optimizada global (parte del lote)'
        : (b.every(x=>x.verificada) ? 'Convencional (verificado con búsqueda global: sin mejora posible)' : 'Convencional');
  if(demostrado) t += ' · mínimo demostrado';
  else if(cota>0 && result.boards.length>cota) t += ` · cota inferior ${cota} tableros`;
  return t;
}

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
  const tBusq = textoBusqueda(result);
  doc.text(`Corte de sierra (kerf): ${kerf} mm   |   Margen perimetral: ${nf(P.margenPer + P.margenSeg)} mm` + (tBusq ? `   |   Búsqueda: ${tBusq}` : ''), 12, 28);
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
    const nombrePdf = pedirNombrePdf(`cutfix-pro_optimizacion_${ahora.getFullYear()}${pad(ahora.getMonth()+1)}${pad(ahora.getDate())}`);
    if(!nombrePdf){ toast('Descarga cancelada','info'); return; }
    doc.save(nombrePdf);
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
let _excelDesmarcadas = new Set();   // filas del Excel que el usuario desmarcó (no se cortan); todas vienen marcadas por defecto

$('excelFile').onchange = (e)=>{
  const file = e.target.files[0]; if(!file) return;
  _excelFileName = file.name;
  _excelDesmarcadas = new Set();
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

  // Procesa el Excel (sin modificarlo): qué renglones se cortan y con qué medidas
  const res = procesarFilasExcel(rows, mapping, getImportOpts());
  const okAll = res.items.filter(x=>x.estado==='ok');                 // renglones que se cortan (unidad válida y datos completos)
  const marcadas = okAll.filter(x=>!_excelDesmarcadas.has(x.fila));   // los que siguen marcados como "Cortar"
  const ok = marcadas;
  const ign = res.items.filter(x=>x.estado==='ignorada').length;
  const err = res.items.filter(x=>x.estado==='error').length;
  const desm = okAll.length - marcadas.length;

  // Vista previa: SOLO las piezas que se cortan, con casilla "Cortar" al final
  const wrapPrev = $('excelPreviewTable').closest('.table-wrap');
  const wrapRev = $('excelReviewTable').closest('.table-wrap');
  const scrollPrev = wrapPrev ? wrapPrev.scrollTop : 0, scrollPrevX = wrapPrev ? wrapPrev.scrollLeft : 0;
  const scrollRev = wrapRev ? wrapRev.scrollTop : 0;

  const thead = $('excelPreviewTable').querySelector('thead');
  const tbody = $('excelPreviewTable').querySelector('tbody');
  thead.innerHTML = '<tr>' + cols.map(c=>`<th>${escapeHtml(String(c))}</th>`).join('') +
    '<th class="col-cortar"><label class="chk-cortar-all"><input type="checkbox" id="chkCortarTodas"> Cortar</label></th></tr>';
  tbody.innerHTML = '';
  const mapped = Object.values(mapping);
  okAll.forEach(x=>{
    const row = rows[x.fila-1] || [];
    const tr = document.createElement('tr');
    const off = _excelDesmarcadas.has(x.fila);
    if(off) tr.className = 'fila-desmarcada';
    tr.innerHTML = cols.map((_,j)=>{
      const val = row[j]===undefined ? '' : row[j];
      return `<td style="${mapped.includes(j)?'background:#f0f9ff':''}">${escapeHtml(String(val))}</td>`;
    }).join('') +
      `<td class="col-cortar"><input type="checkbox" class="chk-cortar" data-fila="${x.fila}" ${off?'':'checked'} aria-label="Cortar fila ${x.fila}"></td>`;
    tbody.appendChild(tr);
  });
  if(!okAll.length){
    const tr = document.createElement('tr');
    tr.innerHTML = `<td colspan="${cols.length+1}" style="text-align:center;color:#94a3b8;padding:18px">Ningún renglón entra a corte con las unidades indicadas.</td>`;
    tbody.appendChild(tr);
  }
  $('excelRowCount').textContent = `(${okAll.length} piezas a cortar de ${rows.length-1} filas · ${marcadas.length} marcadas)`;
  $('excelPreviewCard').style.display='block';

  // Casillas: marcar / desmarcar cada pieza y "Cortar" general en el encabezado
  tbody.querySelectorAll('.chk-cortar').forEach(chk=>{
    chk.onchange = ()=>{
      const f = +chk.dataset.fila;
      if(chk.checked) _excelDesmarcadas.delete(f); else _excelDesmarcadas.add(f);
      updateExcelPreview();
    };
  });
  const all = $('chkCortarTodas');
  if(all){
    all.checked = okAll.length>0 && marcadas.length===okAll.length;
    all.indeterminate = marcadas.length>0 && marcadas.length<okAll.length;
    all.disabled = !okAll.length;
    all.onchange = ()=>{
      if(all.checked) _excelDesmarcadas.clear();
      else okAll.forEach(x=>_excelDesmarcadas.add(x.fila));
      updateExcelPreview();
    };
  }
  $('btnConfirmImport').disabled = marcadas.length===0;
  if(wrapPrev){ wrapPrev.scrollTop = scrollPrev; wrapPrev.scrollLeft = scrollPrevX; }

  // Revisión previa
  const muebles = Math.max(1, Math.floor(+$('impMuebles').value||1));
  const piezasTot = ok.reduce((s,x)=>s+Math.ceil(+(x.cantidad*muebles).toFixed(6)),0);
  $('excelWarnings').innerHTML =
    `<b>${ok.length}</b> renglones entran a optimización (${piezasTot} piezas para ${muebles} mueble${muebles>1?'s':''}) · ${ign} ignorados por unidad · ${err} con error` +
    (desm ? ` · ${desm} desmarcado${desm>1?'s':''} por el usuario` : '') +
    (res.warnings.length ? '<br>⚠️ ' + res.warnings.slice(0,12).map(escapeHtml).join('<br>⚠️ ') + (res.warnings.length>12?`<br>… y ${res.warnings.length-12} más`:'') : '');
  $('excelReviewTable').querySelector('thead').innerHTML =
    '<tr><th>Fila</th><th>Descripción</th><th>Unidad</th><th>Material</th><th>Esp. (mm)</th><th>Cant.</th><th>Veta</th>'+
    '<th>Ancho orig → final</th><th>Tol. ancho</th><th>Largo orig → final</th><th>Tol. largo</th><th>Estado</th></tr>';
  const rb = $('excelReviewTable').querySelector('tbody');
  rb.innerHTML = '';
  res.items.slice(0,400).forEach(x=>{
    const tr = document.createElement('tr');
    const apagada = x.estado==='ok' && _excelDesmarcadas.has(x.fila);
    const bg = (x.estado==='ignorada' || apagada) ? '#f1f5f9;color:#94a3b8' : x.estado==='error' ? '#fee2e2' : '';
    tr.style.cssText = bg ? 'background:'+bg : '';
    const med = (o,f,t)=> x.estado==='ok' ? `${fmt(o,1)} → <b>${fmt(f,1)}</b>` : '';
    tr.innerHTML = `<td>${x.fila}</td><td>${escapeHtml(x.nombre)}</td><td>${escapeHtml(x.unidad)}</td><td>${escapeHtml(x.material)}</td>`+
      `<td>${x.estado==='ok'?fmt(x.espesor,1):''}</td><td>${x.estado==='ok'?x.cantidad:''}</td><td>${x.estado==='ok'?x.veta:''}</td>`+
      `<td>${med(x.ancho,x.anchoFinal)}</td><td>${escapeHtml(x.tolAnchoTxt)}</td>`+
      `<td>${med(x.largo,x.largoFinal)}</td><td>${escapeHtml(x.tolLargoTxt)}</td>`+
      `<td>${apagada?'⛔ Desmarcada (no se corta)':x.estado==='ok'?'✅ Entra':x.estado==='ignorada'?escapeHtml(x.motivo):'❌ '+escapeHtml(x.motivo)}</td>`;
    rb.appendChild(tr);
  });
  $('excelReviewCard').style.display='block';
  if(wrapRev) wrapRev.scrollTop = scrollRev;
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
  const ok = res.items.filter(x=>x.estado==='ok' && !_excelDesmarcadas.has(x.fila));   // solo las piezas marcadas como "Cortar"
  const errores = res.items.filter(x=>x.estado==='error').length;
  if(!ok.length){ toast('No hay piezas marcadas para cortar','error'); return; }

  // Las piezas DESMARCADAS mandan: si ese mismo archivo ya se había importado antes, se quitan del proyecto
  // las piezas de esas filas (si no, seguirían apareciendo en la optimización y en los planos).
  const keysDesmarcadas = new Set(res.items.filter(x=>x.estado==='ok' && _excelDesmarcadas.has(x.fila)).map(x=>x.srcKey));
  let quitadas = 0;
  if(keysDesmarcadas.size){
    const afectados = new Set(STATE.piezas.filter(p=>p.srcKey && keysDesmarcadas.has(p.srcKey)).map(p=>p.habId));
    const antes = STATE.piezas.length;
    STATE.piezas = STATE.piezas.filter(p=>!(p.srcKey && keysDesmarcadas.has(p.srcKey)));
    quitadas = antes - STATE.piezas.length;
    // un habilitado afectado que se quedó sin piezas se elimina
    STATE.habilitados = (STATE.habilitados||[]).filter(h=>!afectados.has(h.id) || STATE.piezas.some(p=>p.habId===h.id));
  }
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
  const msg = `Importadas ${count} piezas` + (dup?` · ${dup} ya existían`:'') + (errores?` · ${errores} con error`:'') + (nuevos?` · ${nuevos} tableros 2440×1220 creados`:'') + (quitadas?` · ${quitadas} desmarcadas quitadas`:'');
  if(count===0 && quitadas>0) toast(`Se quitaron ${quitadas} renglones desmarcados que ya estaban importados · se conservan ${dup} marcados`, 'success');
  else if(count===0 && dup>0) toast('Ese archivo ya estaba importado: cambia su cantidad de muebles en Habilitados (no se duplicó nada).','error');
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
    const nombrePdf = pedirNombrePdf('cutfix-pro_planos_corte');
    if(!nombrePdf){ toast('Descarga cancelada','info'); return; }
    doc.save(nombrePdf);
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
 voz: TUT_W(`<circle cx="46" cy="84" r="34" fill="none" stroke="#dc2626" stroke-opacity=".3"/><circle cx="46" cy="84" r="25" fill="#dc2626"/><path d="M46 70a5 5 0 0 1 5 5v9a5 5 0 0 1-10 0v-9a5 5 0 0 1 5-5zm-9 14h2a7 7 0 0 0 14 0h2a9 9 0 0 1-8 9v5h-2v-5a9 9 0 0 1-8-9z" fill="#fff"/>`+
   `<rect x="92" y="38" width="248" height="50" rx="8" fill="#fff" stroke="#9db0d6"/><text x="100" y="52" font-size="8.5" fill="#18212f">«Tablero de 2440 por 1220, melamina blanca,</text><text x="100" y="64" font-size="8.5" fill="#18212f">de 18 de grosor. Necesito cortar 20 piezas</text><text x="100" y="76" font-size="8.5" fill="#18212f">de 600 por 400 y 5 piezas de 800 por 300»</text>`+
   tB(92,96,80,'Interpretar')+`<g font-size="8.5"><rect x="92" y="122" width="248" height="18" fill="#fff4c2" stroke="#e0a800"/><text x="98" y="134" fill="#18212f">Tablero · Melamina · 2440×1220 · 18 mm · cant. 10 (asumida)</text><rect x="92" y="140" width="248" height="16" fill="#fff" stroke="#e2e8f1"/><text x="98" y="151" fill="#18212f">Pieza · 600×400 · cant. 20      Pieza · 800×300 · cant. 5</text></g>`),
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
  grupos:[['Preparar','Tableros','Registra tus tableros: medidas, material, precio, veta y cuántos tienes.','tableros'],['Preparar','Piezas','Captura lo que debes cortar o impórtalo desde Excel.','piezas'],['Preparar','Dictado por voz','Dicta tableros y piezas y revisa la tabla antes de cargarlos.','voz'],['Preparar','Importar Excel','Convierte una lista de materiales en piezas automáticamente.','importar'],['Preparar','Habilitados','Cada Excel es un habilitado: elige cuántos muebles y cuáles cortar juntos.','habilitados'],['Calcular','Parámetros','Ancho de sierra, márgenes, veta, rotación y criterio de prioridad.','parametros'],['Calcular','Optimización','Tres métodos de corte y comparación para elegir el mejor.','optimizacion'],['Resultados','Planos y PDF','Ve cada tablero a escala, gíralo y exporta el PDF.','planos'],['Resultados','Hoja de corte','Documento imprimible para el operador.','hoja'],['Resultados','Sobrantes','Guarda los retazos reutilizables.','sobrantes'],['Archivo','Reportes y proyectos','Excel, guardar, cargar y compartir proyectos.','reportes']]},
 {id:'tableros',tab:'Tableros',titulo:'Tableros',go:'tableros',ill:'tableros',lead:'Aquí das de alta el material con el que vas a cortar. El sistema solo usa un tablero para piezas del mismo material y espesor.',
  pasos:['Escribe un nombre (ej. «Melamina blanca») y elige el material.','Indica largo, ancho y espesor en milímetros (ej. 2440 × 1220 × 18).','Pon el precio, el color, la dirección de la veta y cuántos tableros tienes.','Pulsa «Agregar tablero».'],
  tips:['Con los iconos de la tabla puedes editar, duplicar o eliminar.','«Exportar Excel» guarda tu lista de tableros.','Si importas un Excel con un material sin tablero, se crea uno de 2440 × 1220 automáticamente.'],tip:'La «Cantidad disponible» limita cuántos tableros puede usar el cálculo.'},
 {id:'piezas',tab:'Piezas',titulo:'Piezas a cortar',go:'piezas',ill:'piezas',lead:'Registra cada pieza con sus medidas y cantidad. Puedes escribirlas a mano o traerlas de Excel.',
  pasos:['Escribe nombre, largo, ancho, cantidad y espesor.','Elige material y veta (si la pieza debe respetar el sentido de la veta).','Decide si se permite girar la pieza (rotación).','Pulsa «Agregar pieza». Usa «Cargar ejemplo» para probar rápido.'],
  tips:['Edita, duplica o elimina desde la tabla.','«Limpiar» borra todas las piezas.','La columna «Total a cortar» multiplica por los muebles del habilitado.'],tip:'Largo y ancho siempre son mayores que cero; la cantidad mínima es 1.'},
 {id:'voz',tab:'Dictado por voz',titulo:'Dictado por voz',go:'piezas',ill:'voz',lead:'Di tus tableros y piezas en voz alta (o escríbelos como frase) y CUTFIX PRO los convierte en una tabla que tú revisas antes de cargarla.',
  pasos:['Pulsa «Dictar por voz» (en Inicio, Tableros o Piezas).','Pulsa «Escuchar» y di, por ejemplo: «Tengo un tablero de dos mil cuatrocientos cuarenta por mil doscientos veinte, melamina blanca, de 18 de grosor. Necesito cortar 20 piezas de 600 por 400 y 5 piezas de 800 por 300».','Pulsa «Detener», corrige el texto si hace falta y elige milímetros o centímetros.','Pulsa «Interpretar» y revisa la tabla: amarillo = dudoso o asumido, rojo = error.','Pulsa «Cargar al proyecto» y luego «Ir a Optimización».'],
  tips:['Si tu navegador no tiene dictado, escribe o pega la frase: el análisis es el mismo.','Veta y giro: «veta a lo largo», «sin veta», «se puede girar», «no girar».','Si repites un tablero o pieza que ya existe, te pregunta si sumas la cantidad o lo ignoras.','El navegador puede enviar el audio a sus servidores y necesita internet.'],tip:'Nada se carga hasta que pulses «Cargar al proyecto», y el cálculo nunca se ejecuta solo.'},
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

/* =========================================================
   DICTADO POR VOZ — ANALIZADOR DE TEXTO
   ========================================================= */
/* <<VOZ-ANALIZADOR-START (sin DOM ni STATE; se prueba por separado)
   ---------------------------------------------------------------
   CutfixVoz.analizar(texto, opciones) -> { tableros:[], piezas:[], avisos:[] }
   CutfixVoz.validar(tipo, fila, contexto) -> [{campo, nivel:'error'|'warn', msg}]
   Opciones de analizar():
     unidad      'mm' (por defecto) | 'cm'   unidad de largo/ancho cuando la frase no dice otra
     materiales  ['Melamina','MDF',...]      materiales que ya existen en el programa
     tablerosBase [{material,espesor,...}]   tableros ya cargados (solo para suponer datos faltantes)
   --------------------------------------------------------------- */
const CutfixVoz = (function(){
  'use strict';

  const tiene = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
  const mk = obj => Object.assign(Object.create(null), obj);

  /* ---------- Números en palabras ---------- */
  const UNI = mk({cero:0,un:1,uno:1,una:1,dos:2,tres:3,cuatro:4,cinco:5,seis:6,siete:7,ocho:8,nueve:9,diez:10,
    once:11,doce:12,trece:13,catorce:14,quince:15,dieciseis:16,diecisiete:17,dieciocho:18,diecinueve:19,veinte:20,
    veintiun:21,veintiuno:21,veintiuna:21,veintidos:22,veintitres:23,veinticuatro:24,veinticinco:25,veintiseis:26,
    veintisiete:27,veintiocho:28,veintinueve:29});
  const DEC = mk({treinta:30,cuarenta:40,cincuenta:50,sesenta:60,setenta:70,ochenta:80,noventa:90});
  const CEN = mk({cien:100,ciento:100,doscientos:200,doscientas:200,trescientos:300,trescientas:300,
    cuatrocientos:400,cuatrocientas:400,quinientos:500,quinientas:500,seiscientos:600,seiscientas:600,
    setecientos:700,setecientas:700,ochocientos:800,ochocientas:800,novecientos:900,novecientas:900});

  const esEsp = t => /^\s+$/.test(t);
  const RE_TOKENS = /\d+(?:[.,]\d+)*|[a-z]+|\s+|[^\sa-z0-9]/g;

  /** Quita acentos, pasa a minúsculas y unifica símbolos. */
  function normalizar(raw){
    let s = String(raw==null ? '' : raw).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    s = s.replace(/[\u00a0\u2009\u202f]/g,' ').replace(/[×✕✖*]/g,' x ').replace(/[“”"'`´¿¡()\[\]]/g,' ');
    return s.replace(/\s+/g,' ').trim();
  }

  /**
   * Lee un número escrito con palabras a partir de tk[i].
   * Devuelve {texto, fin} (fin = índice del último token usado) o null.
   * Gramática: [miles] [centenas] [decenas [y unidad] | unidad/teens] [punto decimales | y medio]
   */
  function leerNumero(tk, i, permitirDec){
    let total=0, cur=0, last='', fin=-1, n=0, hayMil=false, frac='', primera=null, k=i;
    const sig = x => { x++; while(x<tk.length && esEsp(tk[x])) x++; return x; };
    while(k<tk.length){
      const w = tk[k];
      if(esEsp(w)){ k++; continue; }
      let ok = false;
      if(tiene(UNI,w)){
        const v = UNI[w];
        if(last===''){ cur+=v; last='u'; ok=true; }
        else if(last==='m' || last==='c'){ if(v>0){ cur+=v; last='u'; ok=true; } }
        else if(last==='dy'){ if(v>=1 && v<=9){ cur+=v; last='u'; ok=true; } }
      } else if(tiene(DEC,w)){
        if(last==='' || last==='m' || last==='c'){ cur+=DEC[w]; last='d'; ok=true; }
      } else if(tiene(CEN,w)){
        if(last==='' || last==='m'){ cur+=CEN[w]; last='c'; ok=true; }
      } else if(w==='mil'){
        if(!hayMil && last!=='dy'){ total+=(cur||1)*1000; cur=0; last='m'; hayMil=true; ok=true; }
      } else if(w==='y' && last!==''){
        const nx = sig(k);
        if(nx<tk.length && /^medi[oa]$/.test(tk[nx])){ frac='.5'; fin=nx; n++; break; }        // "veinte y medio"
        if(last==='d' && nx<tk.length && tiene(UNI,tk[nx]) && UNI[tk[nx]]>=1 && UNI[tk[nx]]<=9){ last='dy'; ok=true; } // "treinta y cinco"
      } else if((w==='punto' || w==='coma') && permitirDec && last!==''){
        let m = sig(k), dec='', finDec=-1;
        while(m<tk.length && tk[m]==='cero'){ dec+='0'; finDec=m; m=sig(m); }
        if(m<tk.length){
          if(/^\d+$/.test(tk[m])){ dec+=tk[m]; finDec=m; }
          else { const r = leerNumero(tk,m,false); if(r){ dec+=r.texto; finDec=r.fin; } }
        }
        if(dec!==''){ frac='.'+dec; fin=finDec; n+=2; }
        break;
      }
      if(!ok) break;
      fin=k; n++; if(!primera) primera=w; k++;
    }
    if(n===0) return null;
    if(n===1 && /^(un|uno|una)$/.test(primera) && frac==='') return null;   // "un tablero": artículo, no número
    return { texto: String(total+cur) + frac, fin };
  }

  /** Cambia los números escritos con palabras por cifras y arregla separadores de miles/decimales. */
  function palabrasANumeros(s){
    // Miles con coma o punto ("2,440" / "2.440") y decimales con coma ("1,5")
    s = s.replace(/\b(\d{1,3})([.,])(\d{3})\b(?!\s*[.,]?\d)/g, (m,a,sep,b,off,full)=>{
      if(sep==='.' && /^\s*(metros?|mts?|m)(?![a-z])/.test(full.slice(off+m.length))) return a+'.'+b;
      return a+b;
    });
    s = s.replace(/(\d),(\d{1,2})(?!\d)/g,'$1.$2');
    const tk = s.match(RE_TOKENS) || [];
    let out = '';
    for(let i=0;i<tk.length;i++){
      const w = tk[i];
      if(/^[a-z]+$/.test(w) && (tiene(UNI,w)||tiene(DEC,w)||tiene(CEN,w)||w==='mil')){
        const r = leerNumero(tk,i,true);
        if(r){ out+=r.texto; i=r.fin; continue; }
      }
      out+=w;
    }
    out = out.replace(/(\d+(?:\.\d+)?)\s+y\s+medi[oa](?![a-z])/g, (m,a)=> String(+a+0.5));   // "20 y medio"
    out = out.replace(/(\d+)\s*(?:punto|coma)\s*(\d+)/g,'$1.$2');                              // "1 punto 5"
    return out.replace(/\s+/g,' ').trim();
  }

  /* ---------- Materiales, colores y palabras clave ---------- */
  const SINONIMOS = [
    ['melamina|melaminico|melaminica|melamine','Melamina'],
    ['mdf|emedefe|eme de efe','MDF'],
    ['triplay|tripley|triplai|multilaminado|contrachapado|plywood|playwood|multiplex|fenolico','Triplay'],
    ['aglomerado|aglomerada|mdp|chipboard|particulas','Aglomerado'],
    ['madera solida|madera maciza|madera natural|madera','Madera sólida']
  ];
  const COLORES = mk({blanco:'#f4f4f0',blanca:'#f4f4f0',negro:'#1f1f1f',negra:'#1f1f1f',gris:'#9ca3af',grafito:'#4b5563',
    beige:'#d9c7a3',crema:'#efe3c2',marfil:'#f1ead2',roble:'#b98a52',nogal:'#6b4a2f',cerezo:'#8c4a2f',caoba:'#7a3b2e',
    wengue:'#3a2a24',haya:'#d8b184',maple:'#e0c48f',cafe:'#7b5538',chocolate:'#5a3a29',rojo:'#c0392b',roja:'#c0392b',
    azul:'#2d5bd1',verde:'#2e8b57',amarillo:'#e6c229',amarilla:'#e6c229',arena:'#d7bf94',natural:'#e8d3a8'});
  const SIGLAS = ['osb','mdf','mdp','hdf','hpl','pvc'];
  const NO_MATERIAL = ['largo','ancho','alto','grosor','espesor','grueso','veta','medida','medidas','milimetros','centimetros',
    'metros','color','que','para','con','sin','unos','unas','los','las','del','cada','cortar','corte','cortes','pieza','piezas',
    'tablero','tableros','plancha','planchas','hoja','hojas','tipo','medio','media','mismo','misma','este','esta','ese','esa'];

  const mayus1 = t => t.charAt(0).toUpperCase() + t.slice(1);
  const escRe = t => t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');

  function canonicoExistente(nombre, mats){
    const n = normalizar(nombre);
    for(const m of mats){ if(normalizar(m)===n) return m; }
    return nombre;
  }

  /** Busca el material en un texto: primero los conocidos/sinónimos, luego uno nuevo dicho tal cual. */
  function detectarMaterial(txt, mats){
    if(!txt) return null;
    let mejor = null;
    SINONIMOS.forEach(([fuente,canon])=>{
      const m = new RegExp('(?:^|[^a-z])('+fuente+')(?![a-z])').exec(txt);
      if(m && (!mejor || m.index<mejor.pos)) mejor = {nombre: canonicoExistente(canon,mats), pos:m.index};
    });
    (mats||[]).forEach(mat=>{
      const n = normalizar(mat); if(!n || n==='otro') return;
      const m = new RegExp('(?:^|[^a-z])('+escRe(n)+')(?![a-z])').exec(txt);
      if(m && (!mejor || m.index<mejor.pos)) mejor = {nombre: mat, pos:m.index};
    });
    if(mejor) return {nombre:mejor.nombre, nuevo:false};
    const nu = /\b(?:tableros?|planchas?|piezas?|cortes?|hojas?)\s+(?:de|en)\s+([a-z]{3,})(?![a-z])/.exec(txt) || /\bmaterial\s+(?:de\s+)?([a-z]{3,})(?![a-z])/.exec(txt);
    if(nu && NO_MATERIAL.indexOf(nu[1])<0 && !tiene(COLORES,nu[1]) && !tiene(UNI,nu[1]) && !tiene(DEC,nu[1]) && !tiene(CEN,nu[1])){
      return {nombre: SIGLAS.indexOf(nu[1])>=0 ? nu[1].toUpperCase() : mayus1(nu[1]), nuevo:true};
    }
    return null;
  }

  function detectarColor(txt){
    const re = /(?:^|[^a-z])([a-z]+)(?![a-z])/g; let m;
    while((m=re.exec(txt))){ if(tiene(COLORES,m[1])) return {palabra:m[1], hex:COLORES[m[1]]}; }
    return null;
  }

  function detectarVeta(txt){
    if(/\bsin\s+veta\b/.test(txt)) return {valor:'ninguna'};
    let m = /\bveta\b[^.,;]{0,22}?\b(largo|ancho)\b/.exec(txt) || /\b(largo|ancho)\s+de\s+la\s+veta\b/.exec(txt);
    if(m) return {valor:m[1]};
    if(/\bcon\s+(?:la\s+)?veta\b|\bveta\b/.test(txt)) return {valor:'largo', dudoso:true};
    return null;
  }

  function detectarRotacion(txt){
    if(/\b(?:no|sin)\s+(?:se\s+)?(?:pued[ea]n?\s+|debe[n]?\s+)?(?:girar|rotar|rotacion|giro)/.test(txt)) return false;
    if(/\b(?:se\s+)?(?:pued[ea]n?\s+|con\s+)?(?:girar|rotar|rotacion)\b/.test(txt)) return true;
    return null;
  }

  const aMm = (valor, u) => { const v=+valor; if(!u) return v; return /^c/.test(u) ? v*10 : v; };   // espesor: mm salvo que digan cm
  const factorUnidad = u => !u ? null : /^(mm|milimetro)/.test(u) ? 1 : /^(cm|centimetro)/.test(u) ? 10 : 1000;
  const nombreUnidad = u => !u ? null : /^(mm|milimetro)/.test(u) ? 'mm' : /^(cm|centimetro)/.test(u) ? 'cm' : 'm';

  /* ---------- Segmentación ---------- */
  const LEAD = new Set(['de','del','y','mas','piezas','pieza','cortes','corte','cortar','corta','necesito','necesitamos','quiero',
    'ocupo','requiero','tengo','tenemos','hay','un','una','uno','unos','unas','otro','otra','otros','otras','tablero','tableros',
    'plancha','planchas','hoja','hojas','cantidad','cant','unidades','unidad','para','cada','ademas','tambien','luego','despues',
    'con','el','la','los','las','son','es','material','medida','medidas','tabla','tablas','panel','paneles','partes','parte',
    'que','mide','miden','en','a','al','mas']);
  const reDelim = /(?:\.(?!\d)|[;?!\n])/g;
  function ultimoDelim(txt){ let idx=-1, m; reDelim.lastIndex=0; while((m=reDelim.exec(txt))) idx=m.index; return idx; }

  /** Dentro de un hueco entre dos medidas, índice donde empieza la "entrada" de la siguiente (ej. "20 piezas de"). */
  function cortePorEntrada(gap){
    const tk = gap.match(/\d+(?:\.\d+)?|[a-z]+|\s+|[^\sa-z0-9]/g) || [];
    let pos = gap.length, cut = gap.length;
    for(let i=tk.length-1;i>=0;i--){
      const t = tk[i];
      if(esEsp(t)){ pos-=t.length; continue; }
      if(/^\d/.test(t) || LEAD.has(t)){ pos-=t.length; cut=pos; continue; }
      break;
    }
    return cut;
  }

  const PRE = '(?:(largo|ancho|alto|longitud)\\s*(?:de\\s+)?)?';
  const NUM = '(\\d+(?:\\.\\d+)?)';
  const UNID = '(?:\\s*(mm|milimetros?|cm|centimetros?|metros?|mts?|m)(?![a-z]))?';
  const LAB = '(?:\\s*(?:de\\s+)?(largo|ancho|alto|longitud)(?![a-z]))?';
  const SEP = '\\s*(?:por|x)\\s*';
  const U = '(mm|milimetros?|cm|centimetros?)';

  const GENERICOS = ['pieza','piezas','corte','cortes','unidad','unidades','parte','partes','tabla','tablas','hoja','hojas','panel',
    'paneles','plancha','planchas','tablero','tableros','mas','veces','de'];

  /* ---------- Analizador principal ---------- */
  function analizar(texto, opts){
    opts = opts || {};
    const unidadSel = opts.unidad==='cm' ? 'cm' : 'mm';
    const mats = opts.materiales || [];
    const base = opts.tablerosBase || [];
    const avisos = [];

    let s = palabrasANumeros(normalizar(texto));
    if(!s) return {tableros:[], piezas:[], avisos:['No hay texto para interpretar.'], texto:''};

    /* 1) Espesores con palabra clave ("18 de grosor", "espesor 18") -> marcadores */
    const esp = [];
    const marca = v => { esp.push(v); return ' \u0002'+(esp.length-1)+'\u0003 '; };
    s = s.replace(new RegExp(NUM+'\\s*'+U+'?\\s*(?:de\\s+)?(?:grosor|espesor|grueso|gruesa)(?![a-z])','g'),
      (m,n,u,off,full)=> /(?:por|x)\s*$/.test(full.slice(0,off)) ? m : marca(aMm(n,u)));
    s = s.replace(new RegExp('(?:grosor|espesor|grueso|gruesa)\\s*(?:de\\s+)?'+NUM+'\\s*'+U+'?(?![a-z])','g'),
      (m,n,u)=> marca(aMm(n,u)));
    s = s.replace(/\s+/g,' ');

    /* 2) Medidas "A por B" */
    const reMed = new RegExp(PRE+NUM+UNID+LAB+SEP+PRE+NUM+UNID+LAB,'g');
    const meds = []; let m;
    while((m = reMed.exec(s))){
      if(m[0].length===0){ reMed.lastIndex++; continue; }
      const it = { ini:m.index, fin:m.index+m[0].length, n1:+m[2], n2:+m[6],
        u1:nombreUnidad(m[3]), u2:nombreUnidad(m[7]),
        l1:m[1]||m[4]||null, l2:m[5]||m[8]||null, orden:null };
      const suf = /^\s*,?\s*(?:de\s+)?(ancho|largo)\s+por\s+(ancho|largo)(?![a-z])/.exec(s.slice(it.fin));
      if(suf){ it.orden = suf[1]; it.fin += suf[0].length; }
      const ter = /^\s*,?\s*(x|por)\s*(\d+(?:\.\d+)?)(?![\d.]|\s*(?:por|x)\s*\d)/.exec(s.slice(it.fin));   // tercer número: "... x 5"
      if(ter){ it.tercer = {op:ter[1], val:+ter[2]}; it.fin += ter[0].length; }
      meds.push(it);
    }
    if(!meds.length){
      return {tableros:[], piezas:[], avisos:['No encontré medidas. Di o escribe algo como: "20 piezas de 600 por 400".'], texto:s};
    }

    /* 3) Zonas de texto de cada medida: prefijo (antes) y cola (después) */
    const zonas = meds.map(()=>({prefijo:'', cola:''}));
    for(let i=0;i<meds.length;i++){
      const gap = s.slice(i? meds[i-1].fin : 0, meds[i].ini);
      let corte = 0;
      if(i>0){ const d = ultimoDelim(gap); corte = d>=0 ? d+1 : cortePorEntrada(gap); zonas[i-1].cola = gap.slice(0,corte); }
      zonas[i].prefijo = gap.slice(corte);
    }
    zonas[meds.length-1].cola = s.slice(meds[meds.length-1].fin);

    /* 4) Unidades: explícita > misma oración (hacia atrás) > "en centímetros" global > selector */
    const gl = /\ben\s+(centimetros|milimetros|metros)(?![a-z])/.exec(s);
    const uGlobal = gl ? nombreUnidad(gl[1]) : null;
    meds.forEach(it=>{ it.uExp = it.u2 || it.u1; });
    for(let i=meds.length-2;i>=0;i--){
      if(!meds[i].uExp && meds[i+1].uExp && ultimoDelim(s.slice(meds[i].fin, meds[i+1].ini))<0){ meds[i].uHer = meds[i+1].uExp; }
    }

    /* 5) Armado de cada renglón */
    let prevTipo = null;
    const items = meds.map((it,i)=>{
      const z = zonas[i];
      const flags = {};
      const aviso = (campo,msg)=>{ if(!flags[campo]) flags[campo]=msg; };

      /* tipo: tablero o pieza (última palabra clave antes de la medida) */
      let tipo = null, pos = -1, mm2;
      const reB = /(?:^|[^a-z])(tableros?|planchas?)(?![a-z])/g, reP = /(?:^|[^a-z])(piezas?|cortes?|cortar|cortarlas?|partes?)(?![a-z])/g;
      while((mm2 = reB.exec(z.prefijo))){ if(mm2.index>=pos){ pos=mm2.index; tipo='tablero'; } }
      while((mm2 = reP.exec(z.prefijo))){ if(mm2.index>=pos){ pos=mm2.index; tipo='pieza'; } }

      /* cantidad y nombre desde la "entrada" (final del prefijo) */
      let cantidad = null, articulo = false, nombre = null;
      const pf = z.prefijo.replace(/\s+$/,'');
      let q = /(?:^|[^\d.])(\d+)\s+([a-z]+)\s+(?:mas\s+)?(?:de|del)$/.exec(pf);
      if(q && GENERICOS.indexOf(q[2])<0 && !LEAD.has(q[2]) && !tiene(COLORES,q[2])){ cantidad=+q[1]; nombre=q[2]; if(!tipo) tipo='pieza'; }
      else {
        q = /(?:^|[^\d.])(\d+)\s*(?:piezas?|cortes?|unidades|unidad|tableros?|planchas?|hojas?|tablas?|paneles?|partes?)?\s*(?:mas\s+)?(?:de|del)?$/.exec(pf);
        if(q){ cantidad=+q[1]; }
        else {
          q = /(?:^|\s)(un|una|uno)\s*(?:tablero|plancha|pieza|corte|hoja)?\s*(?:de|del)?$/.exec(pf);
          if(q){ cantidad=1; articulo=true; }
          q = /(?:^|\s)(?:un|una)\s+([a-z]+)\s+(?:de|del)$/.exec(pf);
          if(q && GENERICOS.indexOf(q[1])<0 && !LEAD.has(q[1])){ nombre=q[1]; cantidad=1; articulo=false; if(!tipo) tipo='pieza'; }
        }
      }
      if(cantidad===null){
        q = /(?:^|\s)(\d+)\s*(?:piezas?|cortes?|tableros?|planchas?|unidades)(?![a-z])/g; let ult=null, qq;
        while((qq=q.exec(pf))) ult=qq; if(ult) cantidad=+ult[1];
      }
      if(cantidad===null){
        const cc = /\b(?:cantidad|cant)\s*(?:de\s*)?(\d+)/.exec(z.prefijo+' '+z.cola);
        if(cc) cantidad=+cc[1];
      }
      const colaX = it.tercer ? [null, it.tercer.op, it.tercer.val] : null;
      const colaN = /^\s*,?\s*(?:son\s+)?(\d+)\s*(?:piezas?|cortes?|unidades)(?![a-z])/.exec(z.cola);

      /* tipo por cantidad, herencia o tamaño */
      if(!tipo && cantidad!==null && !articulo) tipo = 'pieza';
      if(!tipo){
        if(prevTipo) tipo = prevTipo;
        else {
          const f0 = factorUnidad(it.uExp || it.uHer || uGlobal || unidadSel);
          tipo = (Math.max(it.n1,it.n2)*f0>=1000 && Math.min(it.n1,it.n2)*f0>=400) ? 'tablero' : 'pieza';
          aviso('_fila','No dijiste si es tablero o pieza: se supuso por el tamaño. Revísalo.');
        }
      }
      prevTipo = tipo;

      /* orientación: etiquetas largo/ancho dichas > orden dictado (1.º = largo) */
      let a=it.n1, b=it.n2, l1=it.l1, l2=it.l2;
      if(it.orden && !l1 && !l2){ l1=it.orden; l2=it.orden==='largo'?'ancho':'largo'; }
      const norm = l => l==='alto'||l==='longitud' ? 'largo' : l;
      l1=norm(l1); l2=norm(l2);
      let largoV, anchoV, uL, uA;
      const u1 = it.u1 || it.u2, u2 = it.u2 || it.u1;
      if(l1==='ancho' || l2==='largo'){ anchoV=a; largoV=b; uA=u1; uL=u2; }
      else { largoV=a; anchoV=b; uL=u1; uA=u2; }
      const uDef = it.uExp || it.uHer || uGlobal || unidadSel;
      const fL = factorUnidad(uL || uDef), fA = factorUnidad(uA || uDef);
      largoV = Math.round(largoV*fL*100)/100; anchoV = Math.round(anchoV*fA*100)/100;
      if(!(it.uExp||it.uHer||uGlobal) && unidadSel==='cm') aviso('largo','Medidas leídas en centímetros (selector) y pasadas a mm.');

      /* atributos: primero la cola, luego el prefijo */
      const zonasTxt = [z.cola, z.prefijo];
      const buscar = fn => { for(const t of zonasTxt){ const r = fn(t); if(r!==null && r!==undefined) return r; } return null; };
      const matD = buscar(t=>detectarMaterial(t,mats));
      const colD = buscar(t=>detectarColor(t));
      const vetaD = buscar(t=>detectarVeta(t));
      const rotD = buscar(t=>detectarRotacion(t));
      let espV = buscar(t=>{ const e=/\u0002(\d+)\u0003/.exec(t); return e ? esp[+e[1]] : null; });
      if(espV===null) espV = buscar(t=>{ const e=new RegExp('\\bde\\s+'+NUM+'\\s*'+U+'(?![a-z])').exec(t); return e ? aMm(e[1],e[2]) : null; });
      if(espV===null){
        const e = new RegExp('\\bde\\s+'+NUM+'(?!\\s*(?:\\d|por\\b|x\\b|piezas?|cortes?|unidades|tableros?|planchas?|hojas?|tablas?|paneles?|partes?|mm|cm|metros?))(?![a-z.\\d])').exec(z.cola);
        if(e && +e[1]>=1 && +e[1]<=60) espV = +e[1];
      }

      /* tercer número pegado a la medida: tablero -> espesor, pieza -> cantidad ("x 5") */
      if(colaX){
        if(tipo==='tablero' && espV===null){ espV=colaX[2]; }
        else if(tipo==='pieza' && colaX[1]==='x' && cantidad===null){ cantidad=colaX[2]; }
      }
      if(tipo==='pieza' && cantidad===null && colaN) cantidad=+colaN[1];

      return { tipo, i, largo:largoV, ancho:anchoV, cantidad, articulo, nombre, flags, aviso,
               mat:matD, col:colD, veta:vetaD, rot:rotD, esp:espV, ordenOriginal:(l1==='ancho'||l2==='largo') };
    });

    /* 6) Tableros primero (las piezas toman datos de ellos) */
    const tableros = [], piezas = [];
    items.forEach(it=>{
      if(it.tipo!=='tablero') return;
      let L=it.largo, A=it.ancho;
      if(L<A){ const t=L; L=A; A=t; it.aviso('largo','Orientación corregida: en un tablero el largo es la medida mayor.'); }
      else if(it.ordenOriginal){ it.aviso('largo','Dijiste el ancho primero; se tomó el largo como la medida mayor.'); }
      const matN = it.mat ? it.mat.nombre : 'Melamina';
      if(!it.mat) it.aviso('material','No dijiste el material: se supuso Melamina.');
      else if(it.mat.nuevo) it.aviso('material','Material nuevo, tomado tal cual como lo dijiste.');
      let espesor = it.esp;
      if(espesor===null){ espesor = 18; it.aviso('espesor','No dijiste el espesor: se supuso 18 mm.'); }
      let cant = it.cantidad;
      if(cant===null || it.articulo){ cant = 10; it.aviso('cantidad','No dijiste cuántos tableros hay: se supusieron 10 (el cálculo usa solo los que necesite).'); }
      let veta = 'largo';
      if(it.veta){ veta = it.veta.valor; if(it.veta.dudoso) it.aviso('veta','Dijiste "veta" sin dirección: se supuso a lo largo.'); }
      const nombre = mayus1(matN + (it.col ? ' '+it.col.palabra : ''));
      tableros.push({ nombre, material:matN, espesor, largo:L, ancho:A, cantidad:cant, veta,
        color: it.col ? it.col.hex : '#c8a878', precio:0, margen:0, _asumido:it.flags, _i:it.i });
    });

    const baseT = tableros.concat(base.map(t=>({material:t.material, espesor:+t.espesor, _i:-1})));
    items.forEach(it=>{
      if(it.tipo!=='pieza') return;
      let material = it.mat ? it.mat.nombre : null;
      let espesor = it.esp;
      /* tablero de referencia para suponer lo que falta */
      let cand = baseT.filter(t=>!material || normalizar(t.material)===normalizar(material));
      if(espesor!==null){ const c2 = cand.filter(t=>Math.abs(t.espesor-espesor)<0.01); if(c2.length) cand=c2; }
      if(!cand.length) cand = baseT;
      let ref = null;
      for(const t of cand){ if(t._i>=0 && t._i<it.i) ref=t; }
      if(!ref) ref = cand[0] || null;
      if(!material){
        material = ref ? ref.material : 'Melamina';
        it.aviso('material', ref ? 'No dijiste el material: se tomó el del tablero ('+material+').' : 'No dijiste el material: se supuso Melamina.');
      } else if(it.mat && it.mat.nuevo) it.aviso('material','Material nuevo, tomado tal cual como lo dijiste.');
      if(espesor===null){
        espesor = ref ? ref.espesor : 18;
        it.aviso('espesor', ref ? 'Espesor asumido del tablero ('+espesor+' mm).' : 'No dijiste el espesor: se supuso 18 mm.');
      }
      let cant = it.cantidad;
      if(cant===null){ cant = 1; it.aviso('cantidad','No dijiste la cantidad: se supuso 1.'); }
      let veta = 'ninguna', rot = true;
      if(it.veta){ veta = it.veta.valor; rot = (veta==='ninguna'); if(it.veta.dudoso) it.aviso('veta','Dijiste "veta" sin dirección: se supuso a lo largo.'); }
      if(it.rot!==null) rot = it.rot;
      piezas.push({ nombre: it.nombre ? mayus1(it.nombre) : 'Pieza', material, espesor, largo:it.largo, ancho:it.ancho,
        cantidad:cant, veta, rot, obs:'Dictado por voz', _asumido:it.flags, _i:it.i });
    });

    /* 7) Unir renglones idénticos (suma cantidades) */
    const unir = (lista, claves)=>{
      const out = [];
      lista.forEach(f=>{
        const k = claves.map(c=>String(f[c]).toLowerCase()).join('|');
        const ex = out.find(o=>o._k===k);
        if(ex){ ex.cantidad += f.cantidad; } else { f._k = k; out.push(f); }
      });
      out.forEach(f=>{ delete f._k; });
      return out;
    };
    const tabF = unir(tableros, ['nombre','material','espesor','largo','ancho','veta']);
    const pzaF = unir(piezas, ['nombre','material','espesor','largo','ancho','veta','rot']);
    tabF.concat(pzaF).forEach(f=>{ delete f._i; });

    if(!tabF.length && pzaF.length) avisos.push('No dictaste ningún tablero: las piezas usarán los tableros que ya tengas en el proyecto.');
    return {tableros:tabF, piezas:pzaF, avisos, texto:s};
  }

  /* ---------- Validación (sirve también al editar la tabla) ---------- */
  const igualN = (a,b) => normalizar(a)===normalizar(b);
  function cabeSimple(p,b){
    const L=+p.largo, A=+p.ancho;
    return (L<=b.largo && A<=b.ancho) || (!!p.rot && L<=b.ancho && A<=b.largo);
  }

  /**
   * tipo: 'tablero' | 'pieza'.  ctx: { tableros:[...], cabe:(pieza,tablero)=>bool }
   * Rojo ('error') bloquea la carga; amarillo ('warn') solo avisa.
   */
  function validar(tipo, f, ctx){
    ctx = ctx || {};
    const out = [];
    const add = (campo,nivel,msg)=>out.push({campo,nivel,msg});
    const L=Number(f.largo), A=Number(f.ancho), E=Number(f.espesor), C=Number(f.cantidad);
    if(!String(f.material==null?'':f.material).trim()) add('material','error','Falta el material.');
    if(!(L>0)) add('largo','error','El largo debe ser mayor a 0.');
    if(!(A>0)) add('ancho','error','El ancho debe ser mayor a 0.');
    if(!(E>0)) add('espesor','error','El espesor debe ser mayor a 0.');
    if(!(C>=1) || Math.floor(C)!==C) add('cantidad','error','La cantidad debe ser un entero de 1 o más.');
    if(tipo==='tablero'){
      if(L>0 && A>0 && L<A) add('largo','warn','En un tablero el largo suele ser la medida mayor.');
      if((L>6000||A>6000) && L>0 && A>0) add('largo','warn','Medida muy grande para un tablero: ¿unidad correcta?');
      if(L>0 && A>0 && (L<100||A<100)) add('largo','warn','Medida muy pequeña para un tablero: ¿unidad correcta?');
    } else {
      if(L>3000||A>3000) add('largo','warn','Medida muy grande para una pieza: ¿unidad correcta?');
      if(L>0 && A>0 && (L<5||A<5)) add('largo','warn','Medida muy pequeña para una pieza: ¿unidad correcta?');
      if(L>0 && A>0 && E>0 && String(f.material||'').trim() && ctx.tableros){
        const cabe = ctx.cabe || cabeSimple;
        const mismos = ctx.tableros.filter(t=>igualN(t.material,f.material) && Math.abs(Number(t.espesor)-E)<0.01 && Number(t.largo)>0 && Number(t.ancho)>0);
        if(!mismos.length) add('espesor','warn','No hay tablero de '+f.material+' de '+E+' mm (ni dictado ni en el proyecto).');
        else if(!mismos.some(t=>cabe(f,t))){
          const mayor = mismos.reduce((m,t)=> (t.largo*t.ancho>m.largo*m.ancho ? t : m), mismos[0]);
          add('largo','error','No cabe en el tablero ('+mayor.largo+'×'+mayor.ancho+'). Revisa medidas, margen, veta y giro.');
        }
      }
    }
    return out;
  }

  return { analizar, validar, normalizar, palabrasANumeros };
})();
/* VOZ-ANALIZADOR-END >> */

/* =========================================================
   DICTADO POR VOZ — INTERFAZ (usa CutfixVoz; no toca el motor de corte)
   Flujo: dictar/escribir -> Interpretar -> tabla editable -> Cargar al proyecto.
   La carga reutiliza validarTablero/validarPieza (las mismas de los formularios manuales),
   renderTableros/renderPiezas (guardado, estadísticas) y actualizarAvisoResultado.
   ========================================================= */
const VOZ_UI = { rec:null, escuchando:false, fallo:false, base:'', segs:[], filas:{tableros:[],piezas:[]}, abridor:null, n:0 };
const VOZ_FRASE = 'Tengo un tablero de 2440 por 1220, melamina blanca, de 18 de grosor. Necesito cortar 20 piezas de 600 por 400 y 5 piezas de 800 por 300.';

const vozSR = () => window.SpeechRecognition || window.webkitSpeechRecognition || null;

/** Materiales que ya existen en el programa (listas desplegables + los usados en tableros/piezas). */
function vozMateriales(){
  const mapa = new Map();
  ['tMaterial','pMaterial'].forEach(id=>{ const el=$(id); if(el) [...el.options].forEach(o=>{ const v=(o.value||o.text||'').trim(); if(v && normTxt(v)!=='otro') mapa.set(normTxt(v),v); }); });
  STATE.tableros.concat(STATE.piezas).forEach(x=>{ if(x.material) mapa.set(normTxt(x.material), mapa.get(normTxt(x.material))||x.material); });
  return [...mapa.values()];
}
const vozMatCanon = m => { const n = normTxt(m); return vozMateriales().find(x=>normTxt(x)===n) || String(m).trim(); };

function vozMsg(txt, tipo){
  const el = $('vozEstado'); if(!el) return;
  el.textContent = txt || ''; el.className = 'voz-estado' + (txt ? ' on' : '') + (tipo ? ' '+tipo : '');
}
function vozPaso(n){
  [1,2,3].forEach(i=>{ $('vozPaso'+i).hidden = (i!==n); });
  const b = document.querySelector('#vozPaso'+n+' .voz-body'); if(b) b.scrollTop = 0;
}
function vozAvisoVisto(){ try{ return localStorage.getItem('cutfix_voz_aviso')==='1'; }catch(e){ return false; } }
function vozAvisoOk(){ try{ localStorage.setItem('cutfix_voz_aviso','1'); }catch(e){} $('vozAviso').hidden = true; }

function vozAbrir(origen){
  VOZ_UI.abridor = origen || null;
  $('vozPanel').hidden = false; document.body.classList.add('voz-abierto');
  $('vozAviso').hidden = vozAvisoVisto();
  vozPaso(1); vozMsg('');
  const mic = $('vozMic');
  if(!vozSR()){
    mic.disabled = true;
    vozMsg('Tu navegador no permite el dictado por voz (prueba con Chrome, Edge o Safari actualizado). Puedes escribir o pegar la frase en el cuadro y pulsar «Interpretar»: funciona igual.','error');
    $('vozMicTxt').textContent = 'Dictado no disponible';
    $('vozTexto').focus();
  } else { mic.disabled = false; $('vozMicTxt').textContent = 'Escuchar'; mic.focus(); }
}
function vozCerrar(){
  vozDetener();
  $('vozPanel').hidden = true; document.body.classList.remove('voz-abierto');
  if(VOZ_UI.abridor && VOZ_UI.abridor.focus) VOZ_UI.abridor.focus();
}

/* ---------- Reconocimiento de voz ---------- */
function vozMarcar(on){
  const mic = $('vozMic'); mic.classList.toggle('rec', on); mic.setAttribute('aria-pressed', on?'true':'false');
  if(vozSR()) $('vozMicTxt').textContent = on ? 'Detener' : 'Escuchar';
}
function vozMostrar(interim){
  const partes = [VOZ_UI.base, VOZ_UI.segs.filter(Boolean).join(' '), interim||''].map(x=>x.trim()).filter(Boolean);
  $('vozTexto').value = partes.join(' ');
}
function vozError(code){
  const msgs = {
    'not-allowed':'No diste permiso al micrófono. Actívalo en el navegador o escribe la frase en el cuadro.',
    'service-not-allowed':'El navegador no permite el dictado en este momento. Escribe la frase en el cuadro.',
    'no-speech':'No se escuchó nada. Acerca el micrófono y pulsa «Escuchar» otra vez.',
    'audio-capture':'No se encontró un micrófono disponible. Escribe la frase en el cuadro.',
    'network':'Sin conexión a internet: el dictado la necesita. Escribe la frase en el cuadro.',
    'language-not-supported':'El navegador no soporta el idioma español para dictar. Escribe la frase en el cuadro.'
  };
  if(code==='aborted') return;
  VOZ_UI.fallo = true; VOZ_UI.escuchando = false; vozMarcar(false);
  vozMsg(msgs[code] || 'No se pudo usar el micrófono. Puedes escribir la frase en el cuadro.', 'error');
}
function vozIniciar(){
  const SR = vozSR();
  if(!SR){ vozMsg('Tu navegador no permite el dictado por voz. Escribe la frase en el cuadro.','error'); return; }
  vozAvisoOk();
  const rec = new SR();
  rec.lang = 'es-MX'; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
  VOZ_UI.base = $('vozTexto').value.trim(); VOZ_UI.segs = []; VOZ_UI.fallo = false; VOZ_UI.escuchando = true;
  rec.onstart = ()=>{ vozMarcar(true); vozMsg('Escuchando… habla con calma y pulsa «Detener» al terminar.','ok'); };
  rec.onresult = e=>{
    let interim = '';
    for(let i=e.resultIndex;i<e.results.length;i++){
      const r = e.results[i];
      if(r.isFinal) VOZ_UI.segs[i] = r[0].transcript.trim(); else interim += r[0].transcript;
    }
    vozMostrar(interim);
  };
  rec.onerror = e=> vozError(e.error);
  rec.onend = ()=>{
    // El navegador corta solo tras un silencio: si el usuario no pulsó «Detener», se reanuda.
    if(VOZ_UI.escuchando && !VOZ_UI.fallo){
      VOZ_UI.base = $('vozTexto').value.trim(); VOZ_UI.segs = [];
      try{ rec.start(); }catch(e){ VOZ_UI.escuchando=false; vozMarcar(false); }
    } else vozMarcar(false);
  };
  VOZ_UI.rec = rec;
  try{ rec.start(); }catch(e){ vozError('service-not-allowed'); }
}
function vozDetener(){
  VOZ_UI.escuchando = false;
  try{ if(VOZ_UI.rec) VOZ_UI.rec.stop(); }catch(e){}
  vozMarcar(false);
}

/* ---------- Interpretar y tabla de confirmación ---------- */
const vozNuevaFila = (f, tipo) => ({ ...f, _id: 'v'+(++VOZ_UI.n), _asumido: {...(f._asumido||{})}, _tipo: tipo });

function vozInterpretar(){
  vozDetener();
  const txt = $('vozTexto').value.trim();
  if(!txt){ vozMsg('Dicta o escribe una frase primero.','error'); return; }
  const r = CutfixVoz.analizar(txt, { unidad:$('vozUnidad').value, materiales:vozMateriales(), tablerosBase:STATE.tableros });
  if(!r.tableros.length && !r.piezas.length){ vozMsg((r.avisos[0]||'No entendí ninguna medida.')+' Puedes corregir el texto y volver a pulsar «Interpretar».','error'); return; }
  VOZ_UI.filas = { tableros:r.tableros.map(f=>vozNuevaFila(f,'tablero')), piezas:r.piezas.map(f=>vozNuevaFila(f,'pieza')) };
  $('vozAvisos').innerHTML = r.avisos.map(a=>'<li>'+escapeHtml(a)+'</li>').join('');
  $('vozMatList').innerHTML = vozMateriales().map(m=>'<option value="'+escapeHtml(m)+'">').join('');
  $('vozDup').hidden = true;
  vozPintar(); vozPaso(2);
}

const vozOpcVeta = (v, tablero) => (tablero ? [['largo','A lo largo'],['ancho','A lo ancho'],['ninguna','Sin veta']] : [['ninguna','Sin restricción'],['largo','A lo largo'],['ancho','A lo ancho']])
  .map(o=>'<option value="'+o[0]+'"'+(o[0]===v?' selected':'')+'>'+o[1]+'</option>').join('');
const vozInp = (f,k,l,tipo,extra) => '<td data-l="'+l+'" data-c="'+k+'"><input data-k="'+k+'" '+(tipo==='number'?'type="number" step="any" inputmode="decimal"':'type="text"')+' value="'+escapeHtml(f[k]==null||Number.isNaN(f[k])?'':f[k])+'" '+(extra||'')+' aria-label="'+l+'"></td>';

function vozFilaHtml(f){
  const t = f._tipo==='tablero';
  const acc = '<td class="vz-acc"><button class="icon-btn" type="button" data-a="dup" title="Duplicar" aria-label="Duplicar fila">'+ico('copy')+'</button><button class="icon-btn del" type="button" data-a="del" title="Eliminar" aria-label="Eliminar fila">'+ico('delete')+'</button></td>';
  return '<tr data-id="'+f._id+'">'
    + '<td class="vz-wide" data-l="Nombre" data-c="nombre"><input data-k="nombre" type="text" value="'+escapeHtml(f.nombre)+'" aria-label="Nombre"><div class="vz-notas"></div></td>'
    + vozInp(f,'material','Material','text','list="vozMatList"')
    + vozInp(f,'largo','Largo (mm)','number') + vozInp(f,'ancho','Ancho (mm)','number') + vozInp(f,'espesor','Espesor (mm)','number') + vozInp(f,'cantidad','Cantidad','number')
    + '<td data-l="Veta" data-c="veta"><select data-k="veta" aria-label="Veta">'+vozOpcVeta(f.veta,t)+'</select></td>'
    + (t ? '<td data-l="Color" data-c="color"><input data-k="color" type="color" value="'+escapeHtml(f.color||'#c8a878')+'" aria-label="Color"></td>'
         : '<td data-l="Permitir giro" data-c="rot"><select data-k="rot" aria-label="Permitir giro"><option value="true"'+(f.rot?' selected':'')+'>Sí</option><option value="false"'+(!f.rot?' selected':'')+'>No</option></select></td>')
    + acc + '</tr>';
}
function vozPintar(){
  $('vozTbT').querySelector('tbody').innerHTML = VOZ_UI.filas.tableros.map(vozFilaHtml).join('');
  $('vozTbP').querySelector('tbody').innerHTML = VOZ_UI.filas.piezas.map(vozFilaHtml).join('');
  $('vozTbT').style.display = VOZ_UI.filas.tableros.length ? '' : 'none';
  $('vozTbP').style.display = VOZ_UI.filas.piezas.length ? '' : 'none';
  vozRevalidar();
}

/** ¿Cabe la pieza en el tablero? Usa el mismo criterio del motor (márgenes, veta y giro). */
function vozCabe(p, b){
  const d = applyTolerance({ancho:+p.ancho, largo:+p.largo});
  return pieceFitsInBoard({w:d.w, h:d.h, rot:!!p.rot && !STATE.params.rotGlobal, veta:p.veta}, b);
}
function vozFlagsFila(f){
  const ctx = { tableros: VOZ_UI.filas.tableros.concat(STATE.tableros), cabe: vozCabe };
  const res = CutfixVoz.validar(f._tipo, f, ctx);
  Object.entries(f._asumido||{}).forEach(([campo,msg])=>res.push({campo, nivel:'warn', msg}));
  return res;
}
/** Repinta colores, notas y resumen sin reconstruir las tablas (para no perder el cursor al escribir). */
function vozRevalidar(){
  let err = 0, warn = 0;
  const todas = VOZ_UI.filas.tableros.concat(VOZ_UI.filas.piezas);
  todas.forEach(f=>{
    const tr = document.querySelector('#vozPaso2 tr[data-id="'+f._id+'"]'); if(!tr) return;
    const flags = vozFlagsFila(f);
    tr.querySelectorAll('td[data-c]').forEach(td=>{
      const c = td.dataset.c, fs = flags.filter(x=>x.campo===c);
      const e = fs.some(x=>x.nivel==='error'), w = fs.some(x=>x.nivel==='warn');
      td.classList.toggle('vz-err', e); td.classList.toggle('vz-warn', !e && w);
    });
    // campos sin columna propia (_fila) y mensajes de todas las columnas, juntos bajo el nombre
    const notas = tr.querySelector('.vz-notas');
    const uniq = []; flags.forEach(x=>{ if(!uniq.some(u=>u.msg===x.msg)) uniq.push(x); });
    notas.innerHTML = uniq.map(x=>'<div class="vz-nota '+(x.nivel==='error'?'e':'w')+'">'+(x.nivel==='error'?'⛔ ':'⚠ ')+escapeHtml(x.msg)+'</div>').join('');
    if(flags.some(x=>x.campo==='_fila')) tr.querySelector('td[data-c="nombre"]').classList.add('vz-warn');
    else tr.querySelector('td[data-c="nombre"]').classList.remove('vz-warn');
    err += flags.filter(x=>x.nivel==='error').length; warn += flags.filter(x=>x.nivel==='warn').length;
  });
  const nT = VOZ_UI.filas.tableros.length, nR = VOZ_UI.filas.piezas.length;
  const totP = VOZ_UI.filas.piezas.reduce((a,f)=>a+(+f.cantidad||0),0);
  $('vozResumen').textContent = nT+' tablero'+(nT===1?'':'s')+', '+totP+' pieza'+(totP===1?'':'s')+' en '+nR+' '+(nR===1?'renglón':'renglones')
    + (err ? ' · '+err+' error'+(err===1?'':'es')+' por corregir' : '') + (warn ? ' · '+warn+' aviso'+(warn===1?'':'s') : '');
  const vacio = !nT && !nR;
  $('vozCargar').disabled = err>0 || vacio;
  $('vozCargar').title = err>0 ? 'Corrige los campos en rojo para poder cargar' : '';
}

/* edición de celdas, duplicar y eliminar (delegación de eventos) */
function vozEditar(e){
  const el = e.target, tr = el.closest('tr[data-id]'); if(!tr || !el.dataset.k) return;
  const f = VOZ_UI.filas.tableros.concat(VOZ_UI.filas.piezas).find(x=>x._id===tr.dataset.id); if(!f) return;
  const k = el.dataset.k;
  f[k] = el.type==='number' ? (el.value==='' ? NaN : +el.value) : k==='rot' ? el.value==='true' : el.value;
  if(f._asumido) delete f._asumido[k];          // el usuario ya confirmó ese dato
  if(k==='veta' && f._tipo==='pieza' && e.type==='change'){ f.rot = (f.veta==='ninguna'); const s=tr.querySelector('[data-k="rot"]'); if(s) s.value=String(f.rot); }
  vozRevalidar();
}
function vozAccion(e){
  const b = e.target.closest('[data-a]'); if(!b) return;
  const tr = b.closest('tr[data-id]'); const id = tr.dataset.id;
  [VOZ_UI.filas.tableros, VOZ_UI.filas.piezas].forEach(lista=>{
    const i = lista.findIndex(x=>x._id===id); if(i<0) return;
    if(b.dataset.a==='del') lista.splice(i,1);
    else lista.splice(i+1,0,vozNuevaFila(lista[i], lista[i]._tipo));
  });
  vozPintar();
}
function vozAgregar(tipo){
  const f = tipo==='tablero'
    ? { nombre:'Tablero', material:'Melamina', espesor:18, largo:2440, ancho:1220, cantidad:10, veta:'largo', color:'#c8a878', precio:0, margen:0 }
    : { nombre:'Pieza', material:'Melamina', espesor:18, largo:0, ancho:0, cantidad:1, veta:'ninguna', rot:true, obs:'Dictado por voz' };
  VOZ_UI.filas[tipo==='tablero'?'tableros':'piezas'].push(vozNuevaFila(f,tipo));
  vozPintar();
}

/* ---------- Carga al proyecto ---------- */
const vozMismoTablero = (a,b) => normTxt(a.material)===normTxt(b.material) && +a.espesor===+b.espesor && +a.largo===+b.largo && +a.ancho===+b.ancho && a.veta===b.veta;
const vozMismaPieza = (a,b) => !b.habId && normTxt(a.material)===normTxt(b.material) && +a.espesor===+b.espesor && +a.largo===+b.largo
  && +a.ancho===+b.ancho && a.veta===b.veta && !!a.rot===!!b.rot && normTxt(a.nombre||'Pieza')===normTxt(b.nombre);

function vozCargar(){
  if($('vozCargar').disabled) return;
  const dT = VOZ_UI.filas.tableros.filter(f=>STATE.tableros.some(t=>vozMismoTablero(f,t)));
  const dP = VOZ_UI.filas.piezas.filter(f=>STATE.piezas.some(p=>vozMismaPieza(f,p)));
  if(!dT.length && !dP.length){ vozAplicar('sumar'); return; }
  const caja = $('vozDup');
  caja.innerHTML = '<b>Ya existen en el proyecto:</b> '+dT.length+' tablero(s) y '+dP.length+' pieza(s) idénticos.<br>¿Qué hago con ellos?'
    + '<div class="form-actions"><button class="btn btn-primary" type="button" id="vozDupSumar">Sumar la cantidad</button>'
    + '<button class="btn btn-outline" type="button" id="vozDupIgn">Ignorar los repetidos</button>'
    + '<button class="btn btn-ghost" type="button" id="vozDupCan">Volver a la tabla</button></div>';
  caja.hidden = false; caja.scrollIntoView({behavior:'smooth', block:'center'});
  $('vozDupSumar').onclick = ()=>vozAplicar('sumar');
  $('vozDupIgn').onclick = ()=>vozAplicar('ignorar');
  $('vozDupCan').onclick = ()=>{ caja.hidden = true; };
}

function vozAplicar(modo){
  $('vozDup').hidden = true;
  const tabEx = STATE.tableros.slice(), pzaEx = STATE.piezas.slice();   // solo se comparan con lo que ya existía
  let nT=0, nP=0, sumT=0, sumP=0, ign=0, pzas=0, errores=0;
  VOZ_UI.filas.tableros.forEach(f=>{
    const ex = tabEx.find(t=>vozMismoTablero(f,t));
    if(ex){ if(modo==='sumar'){ ex.cantidad += +f.cantidad; sumT++; } else ign++; return; }
    const t = { id:uid(), nombre:String(f.nombre||'').trim()||'Tablero', material:vozMatCanon(f.material), largo:+f.largo, ancho:+f.ancho,
      espesor:+f.espesor, precio:+f.precio||0, color:f.color||'#c8a878', veta:f.veta, cantidad:+f.cantidad, margen:+f.margen||0 };
    const err = validarTablero(t); if(err){ errores++; return; }
    STATE.tableros.push(t); ensureOption('tMaterial',t.material); ensureOption('pMaterial',t.material); nT++;
  });
  VOZ_UI.filas.piezas.forEach(f=>{
    const ex = pzaEx.find(p=>vozMismaPieza(f,p));
    if(ex){ if(modo==='sumar'){ ex.cantidad += +f.cantidad; sumP++; pzas += +f.cantidad; } else ign++; return; }
    const p = { id:uid(), nombre:String(f.nombre||'').trim()||'Pieza', largo:+f.largo, ancho:+f.ancho, cantidad:+f.cantidad,
      espesor:+f.espesor, material:vozMatCanon(f.material), veta:f.veta, rot:!!f.rot, obs:f.obs||'Dictado por voz' };
    const err = validarPieza(p); if(err){ errores++; return; }
    STATE.piezas.push(p); ensureOption('tMaterial',p.material); ensureOption('pMaterial',p.material); nP++; pzas += p.cantidad;
  });
  renderTableros(); renderPiezas(); actualizarAvisoResultado();    // guarda, actualiza tablas, estadísticas y aviso de desactualizado
  const partes = [];
  if(nT) partes.push(nT+' tablero(s) nuevo(s)'); if(nP) partes.push(nP+' renglón(es) de piezas nuevo(s)');
  if(sumT||sumP) partes.push('cantidades sumadas en '+(sumT+sumP)+' renglón(es) existente(s)');
  if(ign) partes.push(ign+' repetido(s) ignorado(s)');
  $('vozOkMsg').textContent = 'Se agregó al proyecto: '+(partes.join(', ')||'nada nuevo')+'. Piezas a cortar agregadas: '+pzas+'.'+(errores?' ('+errores+' renglón(es) omitido(s) por inválidos.)':'');
  toast('Dictado cargado al proyecto','success');
  vozPaso(3);
}

/* ---------- Eventos ---------- */
document.querySelectorAll('[data-voz-abrir]').forEach(b=>b.addEventListener('click', ()=>vozAbrir(b)));
$('vozX').onclick = $('vozCancelar1').onclick = $('vozCancelar2').onclick = $('vozCerrar3').onclick = vozCerrar;
$('vozAvisoOk').onclick = vozAvisoOk;
$('vozMic').onclick = ()=>{ if(VOZ_UI.escuchando) vozDetener(); else vozIniciar(); };
$('vozTexto').addEventListener('input', ()=>{ VOZ_UI.base = $('vozTexto').value.trim(); VOZ_UI.segs = []; });   // si editas a mano, se respeta
$('vozEjemplo').onclick = ()=>{ $('vozTexto').value = VOZ_FRASE; VOZ_UI.base = VOZ_FRASE; VOZ_UI.segs = []; };
$('vozInterpretar').onclick = vozInterpretar;
$('vozRedictar').onclick = ()=>{ vozPaso(1); vozMsg(''); $('vozTexto').focus(); };
$('vozAddT').onclick = ()=>vozAgregar('tablero');
$('vozAddP').onclick = ()=>vozAgregar('pieza');
['vozTbT','vozTbP'].forEach(id=>{ $(id).addEventListener('input',vozEditar); $(id).addEventListener('change',vozEditar); $(id).addEventListener('click',vozAccion); });
$('vozCargar').onclick = vozCargar;
$('vozMas').onclick = ()=>{ $('vozTexto').value=''; VOZ_UI.base=''; VOZ_UI.segs=[]; vozPaso(1); vozMsg(''); $('vozTexto').focus(); };
$('vozIrOpt').onclick = ()=>{ vozCerrar(); irSeccion('optimizacion'); };
document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !$('vozPanel').hidden) vozCerrar(); });

document.addEventListener('DOMContentLoaded', init);

/* =========================================================
   FIN DEL ARCHIVO script.js
   ========================================================= */
