# Vive España – CRM Design System & UX Guidelines

**Versión:** 1.0 · **Fecha:** Marzo 2026
**Propósito:** Referencia de diseño para el CRM interno DataQuick!
**Fuente:** Análisis directo de viveespana.es (homepage, servicios, pricing)

---

## 1. Brand Identity & Visual Style

### Color Palette

La web de Vive España utiliza Webflow con clases semánticas (`bg-red`, `bg-yellow`, `color-neutral-800`). Los valores exactos están en las hojas de estilo hospedadas. Los valores siguientes se han inferido del análisis visual + nomenclatura de clases:

| Token | Nombre | HEX estimado | Uso principal |
|---|---|---|---|
| `--color-primary` | Rojo Vive España | `#D9342B` | Acentos, iconos, CTAs primarios |
| `--color-secondary` | Amarillo cálido | `#F5C842` | Elementos decorativos, badges |
| `--color-accent-blue` | Azul pastel | `#6BA8C4` | Checkmarks, destacados de plan |
| `--color-neutral-900` | Texto principal | `#1A1A2E` | Headings, texto de alta jerarquía |
| `--color-neutral-800` | Texto secundario | `#374151` | Body text, descripciones |
| `--color-neutral-400` | Texto muted | `#9CA3AF` | Placeholders, metadata |
| `--color-neutral-100` | Fondo suave | `#F5F5F5` | Fondos de sección alternados |
| `--color-white` | Blanco | `#FFFFFF` | Fondo principal, cards |

**Nota de implementación:** Antes de producción, capturar los valores exactos desde Chrome DevTools sobre viveespana.es → Inspector → Computed Styles en los elementos `.bg-red` y `.bg-yellow`.

### Decorativos geométricos
El site usa círculos y semicírculos SVG como elementos de fondo en rojo, amarillo y azul. En el CRM estos elementos deben usarse con moderación — solo en pantallas de bienvenida, estados vacíos o modales de onboarding.

---

### Typography

**Familia principal:** Inter (Google Fonts)
- Pesos cargados: 300, 400, 500, 600, 700
- Fallback: system-ui, -apple-system, sans-serif

**Razón de uso:** Inter es la elección correcta para un CRM. Es legible en densidades altas de información, tiene un excelente rendimiento en tablas y formularios, y la fuente ya está cargada en el contexto de la marca.

**Escala tipográfica recomendada para el CRM:**

| Token | Tamaño | Peso | Uso |
|---|---|---|---|
| `--text-display` | 28px / 1.75rem | 700 | Títulos de página principal |
| `--text-h1` | 22px / 1.375rem | 600 | Títulos de sección, modales |
| `--text-h2` | 18px / 1.125rem | 600 | Subtítulos, cabeceras de card |
| `--text-h3` | 15px / 0.9375rem | 600 | Labels de grupo, títulos de tabla |
| `--text-body` | 14px / 0.875rem | 400 | Contenido principal, celdas de tabla |
| `--text-small` | 12px / 0.75rem | 400 | Metadata, timestamps, badges |
| `--text-caption` | 11px / 0.6875rem | 500 | Labels de campo, tooltips |

**Jerarquía de tono tipográfico:**
- Headings: negros/muy oscuros (`neutral-900`) — autoridad y claridad
- Body: gris oscuro (`neutral-800`) — legibilidad sostenida
- Muted: gris medio (`neutral-400`) — información secundaria sin ruido

---

### Imagery & Visual Language

- **Fotografía:** lifestyle de estudiantes en contextos universitarios españoles. Cálida, aspiracional, real (no stock genérico).
- **Iconos:** GIFs animados pequeños (~60px) para features. SVGs para navegación y acciones.
- **Formas decorativas:** círculos y semicírculos geométricos en los colores de marca como elementos de fondo, nunca en primer plano.
- **Social proof visual:** flags de países en testimonios, estrellas de valoración, fotos de clientes reales.

**Para el CRM:** No usar fotografía de personas. Sí usar el lenguaje geométrico decorativo en estados vacíos. Los iconos funcionales deben ser SVG lineales consistentes (recomendado: Heroicons o Lucide — mismo estilo que usa Tailwind).

---

### Brand Personality & Tone

| Dimensión | Web marketing | CRM interno |
|---|---|---|
| Tono | Aspiracional, cálido, motivador | Eficiente, claro, de confianza |
| Voz | "Tu éxito es nuestro compromiso" | Datos precisos, sin ambigüedad |
| Emoción | Ilusión, seguridad, pertenencia | Confianza, control, velocidad |
| Audiencia | Estudiantes latinoamericanos | Vendedores, asesores, dirección |

El CRM hereda la paleta y tipografía pero adopta un tono funcional. **La marca debe sentirse presente sin interferir con el trabajo.**

---

## 2. UI Patterns Observed on Website

### Navigation Structure

```
Header (sticky)
├── Logo (izquierda)
├── Nav principal (centro): Servicios ▾ | Equipo | Cómo empezar | FAQ | Blog
└── Acciones (derecha): Carrito 🛒 | CTA primario

Servicios (dropdown)
├── Comenzar universidad
├── Continuar universidad
├── Comenzar master
└── Otros servicios legales
```

**Patrón clave:** La navegación está organizada por **journey del usuario** (etapa del proceso), no por tipo de producto. Esto es un insight válido para el CRM: organizar tabs por flujo de trabajo (pipeline → deals → contactos), no por entidad técnica.

---

### Layout Patterns

- **Hero:** 2 columnas — texto + imagen lifestyle. Fullwidth.
- **Cards de servicio:** Grid de 3 columnas con imagen de fondo y texto superpuesto.
- **Pricing:** Grid de 3-4 columnas con cards estandarizadas: icono → nombre → precio → CTA → features.
- **Testimonios:** Carrusel horizontal. 24+ testimonios con foto, nombre, país.
- **Sección de dudas:** 2 columnas — texto + formulario inline.
- **Footer:** 4-5 columnas con links agrupados por categoría.

**Spacing entre secciones:** generoso. Las secciones respiran (~80-120px vertical entre bloques). El contenido nunca se siente comprimido.

---

### Buttons & CTAs

| Tipo | Estilo | Uso |
|---|---|---|
| Primary | Fondo rojo, texto blanco, border-radius suave | Acción principal de conversión |
| Secondary | Texto con flecha `→`, sin fondo | Exploración, "ver más" |
| Ghost | Borde + texto, sin relleno | Acciones secundarias en contexto |
| Link | Solo texto, subrayado on hover | Navegación interna |

**Patrón de CTA:** siempre verbo de acción claro. "Explorar este plan", "Cómo empezar", "Ver servicios". Nunca "Click aquí" ni "Más información" genérico.

---

### Forms

- Formularios inline dentro de secciones (no en páginas separadas).
- Campos simples, pocos a la vez (máximo 3-4 por sección visible).
- Labels sobre los campos, no dentro (placeholder de apoyo, no sustituto).
- Sin asteriscos de obligatorio — se asume que los campos visibles son requeridos.

---

## 3. Core UX Principles

### Cómo guía la atención el usuario

1. **Jerarquía visual clara:** headline grande → subheadline → CTA. El ojo tiene un camino definido en cada sección.
2. **Progresión por journey:** la navegación y las secciones siguen el orden mental del estudiante (¿qué quiero estudiar? → ¿cómo empiezo? → planes → reserva).
3. **Social proof distribuido:** testimonios no están solo en una sección — aparecen a lo largo del scroll como refuerzo continuo.
4. **Reducción de fricción:** el pricing tiene CTA directo sin necesidad de crear cuenta primero.

### Principios reutilizables para el CRM

- **Progresión visible:** el usuario del CRM (vendedor, asesor) también tiene un journey. Las pantallas deben reflejar en qué punto del proceso está cada lead.
- **Jerarquía de datos:** en una tabla o dashboard, lo más importante visualmente debe ser lo más accionable, no lo más completo.
- **Feedback inmediato:** la web usa contadores en el carrito y estados de hover claros. El CRM debe confirmar cada acción (guardado, enviado, actualizado) sin requerir que el usuario busque confirmación.

---

## 4. CRM Adaptation Strategy

### Principio general

Vive España tiene una identidad cálida y aspiracional que funciona en marketing. El CRM es una herramienta de trabajo para vendedores y asesores — la marca debe estar **presente pero subordinada a la usabilidad**. Los colores de marca se usan como acentos y señales, no como decoración.

---

### Dashboard Layout

```
┌─────────────────────────────────────────────────────┐
│ Sidebar (240px, fijo)    │ Content area (flex)       │
│                          │                           │
│ Logo + marca             │ Header de página          │
│ ─────────────────        │ ───────────────────────   │
│ Nav items con iconos     │ KPI cards (4 columnas)    │
│ (journey-based):         │                           │
│  · Resumen               │ Sección principal         │
│  · Ventas                │ (tabla / gráfico / form)  │
│  · Contactos             │                           │
│  · Pipeline              │ Sección secundaria        │
│  · Operaciones           │                           │
│  · Finanzas              │                           │
│  · Ajustes               │                           │
│                          │                           │
│ Footer: avatar + logout  │                           │
└─────────────────────────────────────────────────────┘
```

**Sidebar:** fondo `neutral-900` (oscuro) con acentos en `color-primary` para el ítem activo. Logo en blanco. Nav items con iconos SVG + label.

**Content area:** fondo `neutral-100` (#F5F5F5). Cards y tablas sobre fondo blanco con sombra suave.

---

### KPI Cards

Siguiendo el patrón de las pricing cards del site:

```
┌──────────────────────┐
│  Icono (24px, rojo)  │
│  Número grande (28px)│
│  Label (12px, muted) │
│  ↑ +12% vs anterior  │  ← verde/rojo según tendencia
└──────────────────────┘
```

- Fondo blanco, border-radius 8px, sombra `--shadow-sm`
- 4 cards por fila en desktop, 2 en tablet, 1 en móvil
- El número es el protagonista — tipografía `--text-display` en `neutral-900`

---

### Data Tables

La web usa cards para presentar información. En el CRM, las tablas deben ser **scannables y densas sin ser agotadoras**:

- Header de tabla: fondo `neutral-100`, texto `--text-caption` en `neutral-600`, uppercase
- Filas: alternancia muy suave (blanco / `neutral-50`) o solo separadores horizontales
- Celda activa/hover: fondo `primary` al 8% de opacidad (`#D9342B14`)
- Badges de estado: usando el vocabulario de color de la marca:
  - Abierta: azul pastel `#6BA8C4`
  - Ganada: verde `#22C55E`
  - Perdida: gris `#9CA3AF`
  - Urgente: rojo `#D9342B`
- Acciones de fila: visibles solo en hover (tres puntos o iconos inline)

---

### Forms & Filters

Siguiendo el patrón inline de la web:

- **Filtros:** barra horizontal encima de la tabla. Inputs compactos (32px altura), sin labels si el placeholder es suficientemente claro.
- **Formularios de detalle:** panel lateral derecho (drawer, 480px) que se abre sin abandonar la tabla. Nunca modal fullscreen para edición de registros.
- **Agrupación de campos:** 2 columnas en desktop para campos del mismo grupo (nombre / apellido, desde / hasta). 1 columna para campos largos (notas, descripción).
- **Acciones del form:** siempre en la parte inferior derecha. "Cancelar" (ghost) + "Guardar" (primary rojo).

---

### Filtering, Search & Workflows

- **Búsqueda global:** barra en el header, `⌘K` como shortcut. Resultados inline con preview de tipo de entidad.
- **Filtros de tabla:** chips eliminables encima de la tabla. Un chip = un filtro activo. Color `primary` al 15% con texto `primary`.
- **Periodos:** presets visibles como botones (Este mes / Mes anterior / Todo) + inputs de rango manual. Mismo patrón ya implementado en el tab Ventas.
- **Workflows de pipeline:** pasos visualizados como etapas horizontales (breadcrumb de proceso). El stage actual en `primary`.

---

## 5. Suggested UI Components

### Componentes core

| Componente | Descripción | Prioridad |
|---|---|---|
| `KpiCard` | Icono + valor grande + label + tendencia | Alta |
| `DataTable` | Tabla con sort, filtros, paginación, acciones por fila | Alta |
| `SideDrawer` | Panel lateral para edición de registro sin salir de la tabla | Alta |
| `FilterBar` | Barra horizontal con chips de filtros activos + search | Alta |
| `PeriodSelector` | Presets + custom range (ya implementado en Ventas) | Alta |
| `StatusBadge` | Badge de color semántico por estado (abierta/ganada/perdida...) | Alta |
| `FunnelBar` | Barra proporcional de funnel por etapa (ya implementado) | Media |
| `StatCard` | Variante de KpiCard sin icono, para métricas secundarias | Media |
| `EmptyState` | Ilustración geométrica (círculos de marca) + mensaje + CTA | Media |
| `Toast / Notification` | Feedback de acción (guardado, error, advertencia) — esquina inferior derecha | Alta |
| `Modal` | Para confirmaciones destructivas únicamente (eliminar, etc.) | Media |
| `Tabs` | Navegación horizontal dentro de una sección (en el estilo del dashboard actual) | Alta |
| `Avatar` | Iniciales del usuario en círculo con fondo `primary` | Baja |
| `DropdownMenu` | Menú contextual de acciones. Abre hacia abajo, cierra en clic exterior | Media |
| `Tooltip` | Texto corto on hover para iconos o datos truncados | Media |

---

### Componentes específicos DataQuick! CRM

| Componente | Descripción |
|---|---|
| `DealClassificationBadge` | `nueva_venta` (verde) / `cross_sell` (azul) / `upsell` (amarillo) |
| `QualificationScore` | Score numérico con barra de progreso. Solo visible cuando el dato existe |
| `StageProgressBar` | Etapas del pipeline como barra de progreso horizontal |
| `ConversionArrow` | `↓ X%` entre etapas del funnel. Gris si el dato no está disponible |
| `DataReliabilityFlag` | Icono de advertencia ⚠️ con tooltip cuando un campo es NULL en >75% de registros |

---

## 6. Design Tokens (Developer-Oriented)

### Colors

```css
:root {
  /* Brand */
  --color-primary:         #D9342B;   /* Rojo Vive España */
  --color-primary-hover:   #B82B23;   /* Primary oscurecido 15% */
  --color-primary-light:   #D9342B1A; /* Primary al 10% opacidad — fondos activos */
  --color-secondary:       #F5C842;   /* Amarillo cálido */
  --color-accent:          #6BA8C4;   /* Azul pastel */

  /* Neutrals */
  --color-neutral-900:     #111827;
  --color-neutral-800:     #1F2937;
  --color-neutral-700:     #374151;
  --color-neutral-600:     #4B5563;
  --color-neutral-400:     #9CA3AF;
  --color-neutral-200:     #E5E7EB;
  --color-neutral-100:     #F3F4F6;
  --color-neutral-50:      #F9FAFB;
  --color-white:           #FFFFFF;

  /* Semantic */
  --color-success:         #22C55E;
  --color-success-light:   #22C55E1A;
  --color-warning:         #F59E0B;
  --color-warning-light:   #F59E0B1A;
  --color-danger:          #EF4444;
  --color-danger-light:    #EF44441A;
  --color-info:            #6BA8C4;
  --color-info-light:      #6BA8C41A;

  /* Sidebar (dark) */
  --color-sidebar-bg:      #111827;
  --color-sidebar-hover:   #1F2937;
  --color-sidebar-active:  #D9342B;
  --color-sidebar-text:    #D1D5DB;
  --color-sidebar-muted:   #6B7280;
}
```

---

### Typography Scale

```css
:root {
  --font-family:           'Inter', system-ui, -apple-system, sans-serif;

  --text-display:          1.75rem;   /* 28px — títulos de página */
  --text-h1:               1.375rem;  /* 22px — secciones principales */
  --text-h2:               1.125rem;  /* 18px — subtítulos, headers de card */
  --text-h3:               0.9375rem; /* 15px — labels de grupo */
  --text-body:             0.875rem;  /* 14px — contenido estándar */
  --text-small:            0.75rem;   /* 12px — metadata, timestamps */
  --text-caption:          0.6875rem; /* 11px — labels de campo */

  --font-weight-regular:   400;
  --font-weight-medium:    500;
  --font-weight-semibold:  600;
  --font-weight-bold:      700;

  --line-height-tight:     1.25;
  --line-height-normal:    1.5;
  --line-height-relaxed:   1.75;
}
```

---

### Spacing System

Base unit: **4px**

```css
:root {
  --space-1:   4px;
  --space-2:   8px;
  --space-3:   12px;
  --space-4:   16px;
  --space-5:   20px;
  --space-6:   24px;
  --space-8:   32px;
  --space-10:  40px;
  --space-12:  48px;
  --space-16:  64px;
  --space-20:  80px;
}

/* Layout */
--sidebar-width:     240px;
--drawer-width:      480px;
--content-max-width: 1280px;
--header-height:     56px;
--table-row-height:  44px;
--input-height:      36px;
--input-height-sm:   28px;
```

---

### Border Radius

```css
:root {
  --radius-sm:    4px;   /* inputs, badges, chips */
  --radius-md:    8px;   /* cards, modals, dropdowns */
  --radius-lg:    12px;  /* paneles, drawers */
  --radius-full:  9999px; /* pills, avatares */
}
```

---

### Shadows

```css
:root {
  --shadow-sm:  0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md:  0 4px 6px -1px rgba(0, 0, 0, 0.07), 0 2px 4px -1px rgba(0, 0, 0, 0.04);
  --shadow-lg:  0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04);
  --shadow-xl:  0 20px 25px -5px rgba(0, 0, 0, 0.10), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
}
```

---

### Transitions

```css
:root {
  --transition-fast:    150ms ease;
  --transition-normal:  250ms ease;
  --transition-slow:    350ms ease;
}
```

---

## 7. Do's and Don'ts

### DO — Preservar de la marca

| Qué | Por qué |
|---|---|
| Usar Inter en todos los pesos disponibles | Es la fuente de la marca y la mejor opción para CRM |
| Usar el rojo `#D9342B` como color de acción primaria | Consistencia de marca. Los usuarios del CRM son el mismo equipo que ve la web |
| Mantener whitespace generoso entre secciones | La web respira. El CRM no debe sentirse comprimido aunque sea data-heavy |
| Usar journey-based navigation (no entidad-based) | Organizar por flujo de trabajo, no por tabla de base de datos |
| Badges de estado con semántica de color consistente | El equipo aprende los colores rápido y los asocia a estados reales |
| Sidebar oscura con acentos en primary | Contraste claro entre navegación y contenido. Profesional y moderno |
| CTAs con verbo de acción claro | "Guardar cambios", "Crear contacto", "Ver detalle" — nunca "OK" o "Submit" |

---

### DON'T — Evitar en el contexto CRM

| Qué | Por qué no |
|---|---|
| No usar fotografías de personas en la interfaz | En un CRM no hay contexto para ello y añade ruido visual |
| No usar elementos decorativos geométricos (círculos) en pantallas de trabajo | Distracción en interfaces densas. Solo en onboarding o estados vacíos |
| No usar amarillo (`#F5C842`) en acciones o estados funcionales | El amarillo es decorativo en la marca, no semántico. Puede confundirse con warning |
| No animar elementos en pantallas de trabajo habitual | Las animaciones cansan en uso repetitivo (8h/día). Solo transiciones funcionales |
| No ocultar información relevante detrás de "ver más" en tablas | El equipo comercial necesita el dato rápido. Priorizar densidad controlada sobre minimalismo |
| No usar más de 3 colores de marca en una misma pantalla | Rojo + un semántico (verde/rojo de estado) + neutral es suficiente |
| No separar filtros y resultados en páginas distintas | Toda la interacción de búsqueda/filtro debe ser en la misma vista, sin navegación |
| No mostrar datos con NULL como "0" | Un 0 implica que se midió y el resultado fue cero. NULL implica que no hay dato. Son cosas distintas y el equipo debe saberlo siempre |

---

## Apéndice — Estado de implementación

| Elemento | Estado en el CRM actual |
|---|---|
| Font Inter | ✅ Cargada en el dashboard |
| Color primario rojo | ⚠️ Pendiente de aplicar desde este doc |
| Sidebar oscura | ✅ Implementada |
| Tabs de navegación | ✅ Implementadas (Resumen, Ventas, Pipeline...) |
| KPI cards | ✅ Implementadas en tab Resumen y Ventas |
| PeriodSelector | ✅ Implementado en tab Ventas |
| FunnelBar + pct_to_next | ✅ Implementado |
| StatusBadge | ✅ Implementado (badge-processed, badge-failed...) |
| DataTable | ✅ Implementado en Ventas, Actividad, Pipeline |
| Design tokens en CSS | ❌ Pendiente — variables CSS no definidas formalmente |
| SideDrawer | ❌ Pendiente |
| EmptyState | ❌ Pendiente |
| Toast/Notifications | ❌ Pendiente |
| DataReliabilityFlag | ❌ Pendiente — milestone Data Reliability Layer |
