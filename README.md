[README.md](https://github.com/user-attachments/files/35089505/README.md)
# ✂️ CUTFIX PRO — Optimizador de tableros

Aplicación web para **optimizar el corte de tableros** (melamina, MDF, triplay, etc.) en carpintería y fabricación de muebles. A partir de una lista de piezas y de los tableros disponibles, calcula cómo acomodarlas para **usar menos tableros, generar menos desperdicio y reducir costos**, y produce planos a escala, hojas de corte y PDF listos para el taller.

Funciona 100 % en el navegador: no necesita servidor, base de datos ni instalación.

---

## 📑 Contenido

1. [Características principales](#-características-principales)
2. [Estructura del proyecto](#-estructura-del-proyecto)
3. [Tecnologías](#-tecnologías)
4. [Cómo ejecutarlo](#-cómo-ejecutarlo)
5. [Flujo de trabajo](#-flujo-de-trabajo)
6. [Secciones de la aplicación](#-secciones-de-la-aplicación)
7. [Parámetros de corte](#-parámetros-de-corte)
8. [Motor de optimización](#-motor-de-optimización)
9. [Veta y rotación](#-veta-y-rotación)
10. [Planos y PDF](#-planos-y-pdf)
11. [Importación desde Excel y habilitados](#-importación-desde-excel-y-habilitados)
12. [Dictado por voz](#-dictado-por-voz)
13. [Guardado y exportación](#-guardado-y-exportación)
14. [Arquitectura del código](#-arquitectura-del-código)
15. [Limitaciones conocidas](#-limitaciones-conocidas)

---

## ✨ Características principales

- **Cuatro estrategias de corte**: por longitud, por anchura, mixto (largo + ancho) y modo **Óptimo** que compara todas y elige la mejor.
- **Criterio de prioridad configurable**: menos tableros, menos desperdicio, menor costo o menos cortes.
- **Respeto de la veta** del tablero y de cada pieza, con control de rotación (global y por pieza).
- **Kerf (grosor del disco de sierra)**, márgenes perimetrales, tolerancias y compensación de corte.
- **Planos a escala en SVG** con zoom vectorial, cotas, líneas de corte, flechas de veta, etiquetas y sobrantes.
- **PDF de optimización** completo (resumen general + una hoja por patrón de corte) y **PDF del tablero actual**.
- **Importación desde Excel** (uno o varios archivos), con mapeo automático de columnas y revisión previa.
- **Habilitados**: cada Excel es un conjunto de piezas por mueble; se elige cuántos muebles cortar.
- **Modo sin stock**: tableros ilimitados para calcular cuántos se necesitan.
- **Dictado por voz** de tableros y piezas, con tabla editable antes de cargar.
- **Gestión de sobrantes** reutilizables.
- **Hoja de corte** imprimible para el operador.
- **Guardado automático** en el navegador y exportación/importación de proyectos en `.json`.
- **Tutorial integrado** e interfaz adaptable a móvil (barra inferior).

---

## 📁 Estructura del proyecto

```
.
├── index.html     # Estructura de la interfaz: secciones, formularios, modales y sprite de iconos SVG
├── styles.css     # Sistema de diseño (variables CSS, componentes, layout responsive)
├── script.js      # Toda la lógica: estado, motor de optimización, planos, PDF, Excel, voz, tutorial
└── README.md      # Este documento
```

| Archivo | Líneas aprox. | Responsabilidad |
|---|---|---|
| `index.html` | ~670 | 11 secciones (`sec-*`), modales de tutorial y dictado por voz, navegación lateral y móvil |
| `styles.css` | ~440 | Tema (variables `--primary`, `--brand`, `--nav`…), tarjetas, tablas, botones, responsive |
| `script.js` | ~4 450 | Estado global, algoritmos de corte, render SVG, generación de PDF, importadores, analizador de voz |

---

## 🧰 Tecnologías

- **HTML5 + CSS3 + JavaScript** (vanilla, sin framework ni paso de compilación).
- Librerías cargadas por CDN (jsDelivr):

| Librería | Versión | Uso |
|---|---|---|
| [SheetJS (xlsx)](https://sheetjs.com/) | 0.18.5 | Leer y escribir archivos Excel |
| [jsPDF](https://github.com/parallax/jsPDF) | 2.5.1 | Generar los PDF |
| [jsPDF-AutoTable](https://github.com/simonbengtsson/jsPDF-AutoTable) | 3.8.2 | Tablas dentro de los PDF |

- **Web Speech API** del navegador para el dictado por voz.
- **localStorage** para el guardado automático.

---

## 🚀 Cómo ejecutarlo

1. Descarga o clona el repositorio, manteniendo `index.html`, `styles.css` y `script.js` en la misma carpeta.
2. Abre `index.html` en un navegador moderno (Chrome, Edge, Firefox, Safari).
3. Se requiere **conexión a internet** la primera vez para cargar las librerías CDN (Excel y PDF).

> Para servirlo localmente (opcional):
> ```bash
> python3 -m http.server 8000
> # abrir http://localhost:8000
> ```

> El dictado por voz funciona mejor en Chrome/Edge y puede enviar el audio a los servidores del navegador.

---

## 🔄 Flujo de trabajo

```
Tableros ─┐
          ├─► Parámetros ─► Optimización ─► Planos / PDF ─► Hoja de corte
Piezas ───┘                                      │
(manual, Excel o voz)                            └─► Sobrantes · Reportes
```

1. **Registra los tableros** (o activa «No tengo stock»).
2. **Captura las piezas** a mano, importa un Excel o dicta por voz.
3. **Ajusta los parámetros** (kerf, márgenes, veta, criterio).
4. **Calcula** con el método que prefieras o con **ÓPTIMO**.
5. **Revisa los planos**, gira el tablero si lo necesitas y **genera el PDF**.

---

## 🧭 Secciones de la aplicación

| Grupo | Sección | Qué hace |
|---|---|---|
| **Proyecto** | Inicio | Resumen y accesos rápidos; contador de tableros y modo stock |
| | Tableros | Alta de tableros: nombre, material, largo × ancho × espesor, precio, color, veta, cantidad y margen |
| | Piezas | Alta de piezas: nombre, medidas, cantidad, espesor, material, veta, rotación y observaciones; carga de ejemplo |
| | Importar Excel | Importación individual o múltiple con mapeo de columnas, unidades y filtros de revisión |
| | Habilitados | Lista de conjuntos importados, con número de muebles a cortar y casilla de inclusión |
| **Cálculo** | Parámetros | Kerf, márgenes, tolerancias, rotación global, respeto de veta y criterio de prioridad |
| | Optimización | Botones de cálculo, comparación de modos y ahorro de material |
| **Resultados** | Planos de corte | Vista a escala de cada tablero, zoom, giro 90° y exportación a PDF |
| | Hoja de corte | Documento imprimible con nombre de proyecto, operador y fecha |
| | Sobrantes | Retazos reutilizables (manuales o detectados del último cálculo) |
| | Reportes | Exportaciones a Excel y proyectos `.json` |

---

## ⚙️ Parámetros de corte

Definidos en `STATE.params`:

| Parámetro | Valor por defecto | Descripción |
|---|---|---|
| `kerf` | 3 mm | Grosor del disco; se suma al espacio **entre** piezas, no a la pieza |
| `margenPer` | 10 mm | Margen perimetral libre en los bordes del tablero |
| `sepMin` | 3 mm | Separación mínima entre piezas |
| `margenSeg` | 0 mm | Margen de seguridad adicional |
| `tolPos` / `tolNeg` | 0 | Tolerancias positiva y negativa |
| `comp` | 0 | Compensación de corte |
| `rotGlobal` | `false` | Permite rotar todas las piezas |
| `veta` | `true` | «Respetar veta siempre» |
| `criterio` | `tableros` | `tableros` · `desperdicio` · `costo` · `cortes` |
| `nombreGuion` | `true` | Usa solo lo que sigue al último guion como nombre de la pieza en los planos |

---

## 🧮 Motor de optimización

Es un problema de **bin packing 2D** con restricciones de corte. El código del motor está delimitado por `// <<ALGO-START` y no depende del DOM, por lo que puede probarse por separado.

| Modo | Función | Descripción |
|---|---|---|
| Guillotine | `optimizeGuillotine` | Coloca cada pieza en la región libre que mejor encaja y divide la región con un corte de lado a lado |
| MaxRects | `optimizeMaxRects` | Anidado libre mediante rectángulos libres máximos |
| Franjas (por longitud / anchura) | `optimizeFranjas` | Guillotina de dos etapas: franjas paralelas al largo o al ancho |
| Mixto largo + ancho | `optimizeLargoAncho`, `optimizarMixtoGlobal` | Búsqueda global sobre todo el lote, mezclando tipos de piezas; verifica que el resultado sea cortable (`esGuillotinable`) |
| Inteligente | `optimizeMixed` | Ejecuta variantes de los anteriores y conserva la mejor |
| **ÓPTIMO** | `runMode` + `pickBest` | Compara todos los resultados con el criterio elegido |

Funciones de apoyo relevantes:

- `expandPieces()` — expande cantidades y multiplica por el número de muebles de cada habilitado.
- `getTablerosFor()` — elige tableros por material y espesor (ilimitados si no hay stock).
- `applyTolerance()` — aplica tolerancias una sola vez.
- `validarResultado()` — comprueba que no haya traslapes, que cada pieza respete la veta y que el total coincida.
- `computeMetrics()` / `estimateCuts()` — métricas de tableros, desperdicio, costo y cortes.
- `firmaDatos()` — detecta si los datos cambiaron después del último cálculo y avisa que el resultado quedó desactualizado.

---

## 🌾 Veta y rotación

La función `orientaciones(piece, board)` decide qué orientaciones son válidas:

- La veta del **tablero** (`largo` / `ancho`) y la de la **pieza** (`largo` / `ancho` / `ninguna`) deben coincidir cuando «Respetar veta siempre» está activo.
- Si la pieza o el tablero no tienen veta, solo manda la opción de rotación.
- Una pieza con `rot: false` nunca se gira.

En los planos, una **flecha café** indica el sentido de la veta de cada pieza (vertical hacia abajo, horizontal hacia la derecha), calculado con:

```js
vertical = ((p.veta === 'largo') !== !!p.rotated) !== R   // R = dibujo girado 90°
```

---

## 🗺️ Planos y PDF

### Vista en pantalla (SVG)

`construirPlanoSVG()` dibuja cada tablero a escala con:

- Cotas del tablero y medidas sobre cada lado de la pieza.
- Piezas numeradas con color estable por material + nombre.
- Franjas de kerf, margen perimetral y **sobrantes en verde punteado** (`calcularSobrantes`).
- Flechas de veta, líneas de corte y etiquetas (cada una activable con casillas).
- Leyenda de piezas con totales y medidas de sobrantes.
- **Zoom vectorial** (cambia el tamaño real del SVG, así se mantiene nítido) y **giro 90°** solo visual.

### PDF de optimización

`construirPdfOptimizacion()` genera:

1. **Página de resumen**: fecha, proyecto, método, kerf, margen, aprovechamiento global, habilitados incluidos y tablas por material.
2. **Una hoja por patrón de corte**: los tableros idénticos se agrupan (`agruparPatronesTablero`) y se indica la **cantidad de tableros** que se cortan con ese patrón.

Cada hoja incluye cotas, piezas con medidas, **flecha de veta**, franjas de kerf, sobrantes, leyenda en 1–3 columnas y nota explicativa. Las líneas punteadas se dibujan como trazos vectoriales (`rectPunteadoPdf`) para que se vean nítidas con zoom. La hoja sigue la orientación elegida (horizontal = apaisada, vertical = vertical).

El botón **«PDF (tablero actual)»** (`btnPdfPlano`) exporta un PDF más simple, con un tablero por página; también incluye la flecha de veta.

> La función `flechaVetaPdf()` dibuja la flecha en ambos PDF. En las piezas con veta vertical la flecha se coloca junto al borde derecho para no encimarse con la medida del lado izquierdo; en las de veta horizontal, junto al borde inferior. No se dibuja en piezas menores a 9 × 9 mm.

---

## 📥 Importación desde Excel y habilitados

- Detección automática de columnas: descripción, cantidad, ancho, largo, grueso/espesor, material, unidad, **veta** y tolerancias (`detectarColumna`, `procesarFilasExcel`).
- Solo se importan los renglones cuya **unidad** esté en la lista indicada (por defecto `HOJA`).
- Las medidas pueden venir en **cm o mm**.
- Las tolerancias solo son válidas si la celda es **texto con formato `+número`** (ej. `+2`, `+0.5`).
- Tabla de **revisión previa** con filtros por columna antes de importar.
- **Importación múltiple** (`loteAgregar`): varios archivos a la vez, con el número de muebles por archivo.
- Cada Excel se convierte en un **habilitado** (`STATE.habilitados`) con su nombre, número de muebles y casilla de inclusión; así se pueden cortar juntos varios muebles distintos.
- Si no hay tableros registrados para un material, se crean automáticamente tableros `(auto)` de 2440 × 1220 mm.

---

## 🎙️ Dictado por voz

Módulo `CutfixVoz` (analizador de texto, sin DOM) más su interfaz:

1. Dicta o escribe una frase (por ejemplo, medidas, cantidades, material, «veta a lo largo», «sin veta», «se puede girar»).
2. **Interpretar** → el texto se convierte en tableros y piezas.
3. Se muestra una **tabla editable** con avisos de validación y comprobación de que la pieza cabe en el tablero.
4. **Cargar al proyecto** → usa las mismas validaciones que los formularios manuales.

Nada se carga hasta confirmar, y el cálculo nunca se ejecuta solo.

---

## 💾 Guardado y exportación

| Función | Detalle |
|---|---|
| **Autoguardado** | `localStorage` (clave `opticorte_autosave`): tableros, piezas, habilitados, sobrantes, parámetros y nombre del proyecto |
| **Guardar / Cargar / Nuevo** | Botones en la barra lateral |
| **Proyecto `.json`** | Exportar e importar desde *Reportes* |
| **Excel** | Piezas, tableros, resultados y sobrantes (`exportXLS`) |
| **PDF** | Optimización completa y tablero actual; el nombre del archivo se pregunta antes de descargar |
| **Hoja de corte** | Imprimible o guardable como PDF desde el navegador |

---

## 🏗️ Arquitectura del código

`script.js` está organizado en bloques por comentarios:

| Bloque | Contenido |
|---|---|
| Estado global | Objeto `STATE` y utilidades (`$`, `uid`, `fmt`, `ico`) |
| Tableros / Piezas / Parámetros | Formularios, tablas, validaciones (`validarTablero`, `validarPieza`) |
| Motor de optimización | Algoritmos de corte y métricas (`ALGO-START`) |
| Optimización global y botón principal | `calcularResultados`, `ejecutarOptimizacion`, comparación y ahorro |
| Planos (SVG) | `construirPlanoSVG`, zoom, giro, sobrantes, leyendas |
| PDF | Bloque `PDF-START … PDF-END`, sin DOM: `construirPdfOptimizacion`, `flechaVetaPdf`, `rectPunteadoPdf` |
| Hoja de corte y Sobrantes | Documento imprimible y gestión de retazos |
| Importación Excel | Mapeo, revisión, filtros, importación múltiple |
| Exportar | Excel y PDF del plano |
| Habilitados | Gestión y migración de datos antiguos |
| Proyectos | Autoguardado y carga desde `localStorage` |
| Interfaz | Navegación, menú móvil y giro visual |
| Tutorial | Contenido de ayuda paso a paso |
| Dictado por voz | Analizador `CutfixVoz` + interfaz |

**Decisiones de diseño**

- Los bloques `ALGO` y `PDF` no usan el DOM, de modo que se pueden probar de forma aislada.
- El giro del tablero (90°) es **solo visual**: no recalcula ni mueve piezas; el PDF lo respeta.
- El kerf y las tolerancias son independientes: no se suman dos veces.
- El tamaño del lote está limitado para proteger la memoria del navegador.

---

## ⚠️ Limitaciones conocidas

- Requiere internet para cargar las librerías CDN la primera vez.
- Los algoritmos son **heurísticos**: dan buenos resultados, pero no garantizan el óptimo matemático.
- El guardado automático depende de `localStorage` (se pierde si se borran los datos del navegador); usa «Exportar proyecto» para respaldos.
- El dictado por voz depende de la compatibilidad del navegador con la Web Speech API.

---

## 📄 Licencia y autoría

Proyecto original basado en conceptos públicos de *Guillotine bin packing* y *MaxRects*. Añade aquí la licencia que prefieras (por ejemplo, MIT) y tus datos de contacto.
