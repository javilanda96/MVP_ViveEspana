# Roadmap DataQuick! — Vive España

**Última actualización:** 2026-03-25
**Data Owner:** Marcos Olmo (CFO)
**Fecha fin estimada proyecto:** 30 junio 2026
**Repositorio:** MVP_ViveEspana (Supabase + Fastify + TypeScript)

---

## Contexto del proyecto

DataQuick! es la infraestructura de datos centralizada de Vive España. Su objetivo es ingestar datos de todas las herramientas del negocio (GHL, Stripe, Holded, MongoDB/Nomool), normalizarlos y producir dashboards y KPIs para cuatro departamentos: **Ventas, Marketing, Operaciones y Finanzas**.

Prioridad establecida por el cliente: **Ventas primero**. El dominio de ventas debe estar completo antes de escalar a los demás departamentos.

**Stakeholders:**
- **Marcos Olmo** — CFO, Data Owner global, validador de finanzas y contabilidad
- **Laura** — Responsable de Ventas, validadora del dashboard de ventas
- **Ignacio** — Responsable de Operaciones, validador del dashboard de operaciones

---

## Estado real de las fases DataQuick

| Fase | Descripción original | Estado real |
|---|---|---|
| **Fase 0** | Decisión de proveedor/stack | ✅ Cerrada de facto — stack elegido: Supabase + Fastify + TypeScript (propuesta Aitor) |
| **Fase 1** | Workshops de métricas, APIs y tablas | ⚠️ No ejecutada formalmente. El conocimiento de negocio está en DataQuick_CLAUDE.md pero los workshops con los departamentos no han ocurrido |
| **Fase 2** | Construcción del pipeline Bronze/Silver/Gold | 🔄 Parcialmente en curso — Bronze GHL y Stripe activos, Holded y MongoDB ausentes, Silver/Gold no construidos |
| **Fase 3** | Dashboards, validación cruzada y formación | 🔄 Inicio — dashboard de Ventas operativo, resto de departamentos sin empezar |

**Nota:** Hemos ejecutado directamente Fase 2 + inicio de Fase 3 para el dominio de Ventas sin pasar por Fase 1. Esto es coherente con la decisión de "Ventas primero", pero la deuda de los workshops (definición formal de métricas por departamento, mapeo de campos, tabla de productos) sigue pendiente.

---

## Cobertura actual por User Story

| US | Descripción | Estado | Bloqueado por |
|---|---|---|---|
| US1 | Dashboard de ventas con funnel lead→asistencia→cierre, filtrable por vendedor y source | 🔄 Parcial | `assigned_to` ausente en GHL, lógica de asistencia (stage umbral) no implementada, source no capturado en oportunidades |
| US2 | Dashboard de marketing con atribución por canal e influencer | ❌ No iniciado | UTMs, source, form_id no capturados; Holded gastos ausente; tabla influencers no creada |
| US3 | Dashboard de operaciones con productividad por asesor | ❌ No iniciado | MongoDB/Nomool no conectado; Holded nóminas (cuentas 640*, 642*) ausente |
| US4 | Dashboard financiero con margen por línea de servicio | ❌ No iniciado | Holded facturas y contabilidad no conectados |
| US5 | Identificar gaps y columnas incoherentes en fuentes | ⚠️ Parcial | Gaps identificados en GHL (ver MILESTONE_SALES_MVP_CLOSURE.md); Holded y MongoDB no inspeccionados |
| US6 | Informe mensual de vendedores con base comisionable y comisiones | ❌ No iniciado | `assigned_to` ausente, `monetary_value` ausente, lógica de comisiones no implementada |
| US7 | Informe mensual de asesores con expedientes y rentabilidad | ❌ No iniciado | MongoDB/Nomool no conectado |
| US8 | IU de edición para vendedores/asesores (cross-sell, upsell, asesor) | ❌ No iniciado | — |
| US9 | Registro de movimientos de expediente para calcular ratios | ❌ No iniciado | MongoDB/Nomool no conectado |

---

## Arquitectura objetivo vs estado actual

### Bronze — Ingesta de datos

| Fuente | Tablas objetivo | Estado actual |
|---|---|---|
| GHL — Leads/Contactos | `bronze_ghl_leads` | ✅ Activo (`contacts`) — falta: UTMs, source, custom fields (qualified_flag, score), is_incomplete_profile |
| GHL — Oportunidades | `bronze_ghl_pipeline` | ✅ Activo (`opportunities`) — falta: `assigned_to` (ausente en webhook GHL), `monetary_value` (ausente en webhook GHL) |
| GHL — Stage events | `bronze_ghl_events` | ✅ Parcial (`opportunity_stage_history`) — captura cambios de etapa y estado |
| GHL — Usuarios/Vendedores | `bronze_ghl_users` | ❌ Ausente — necesario para mapear `assigned_to` (ID GHL) → nombre real de vendedor |
| Stripe — Pagos | `bronze_stripe_payments` | ✅ Activo (`payments`) |
| Holded — Facturas | `bronze_holded_bills` | ❌ Ausente — bloquea US4 y lógica de comisiones |
| Holded — Contabilidad | `bronze_holded_accounting` | ❌ Ausente — nóminas (640*) y SS (642*) necesarios para rentabilidad por asesor |
| MongoDB / Nomool | `bronze_mongo_students` | ❌ Ausente — bloquea US3, US7, US9 |
| Google Sheets | Tablas auxiliares | ❌ Ausente — catálogo de productos, pesos bundle, tabla influencers |

### Silver — Normalización y lógica de negocio

| Tabla | Descripción | Estado |
|---|---|---|
| `silver_leads_master` | Una fila por persona, identidad unificada por email, qualified_flag, score | ❌ No construido |
| `silver_funnel_events` | Eventos normalizados del funnel, is_assistance_milestone con umbral configurable | ❌ No construido |
| `silver_deals_outcomes` | win_rank, deal_classification (nuevo/upsell/cross-sell) | ⚠️ Vista SQL existe (`sales_deals_outcomes`) — clasificación nuevo/cross-sell ✓, upsell pendiente |
| `silver_orders_invoices` | Facturas limpias con tipo de venta, credit notes como negativos | ❌ No construido (requiere Holded) |
| `silver_products_catalog` | Catálogo productos → service_line → department | ❌ No construido |

### Gold — Métricas y dashboards

| Tabla | Descripción | Estado |
|---|---|---|
| `gold_cases` | Una fila por expediente/case con case_id generado | ❌ No construido |
| `gold_case_payments` | Líneas de factura mapeadas a case, granularidad por departamento | ❌ No construido |
| `gold_funnel_performance_monthly` | Métricas mensuales por source/canal/vendedor — leads cuali/no cuali, asistidos, won, lost, time-to-close | ❌ No construido |
| `gold_finance_unit_economics` | Revenue, CAC, costes por departamento, margen | ❌ No construido |

---

## Lógica de negocio pendiente de implementar

### Clasificación de tipo de venta (actualmente solo nuevo/cross-sell)
- Sin pago previo → **Nuevo cliente**
- Último pago fue mentoría → **Upsell**
- Último pago fue servicio → **Cross-sell**
- Requiere catálogo de productos para clasificar el tipo del pago anterior

### Cualificación de leads
- `qualified_flag` = TRUE si `funding_source` = "parents pay" o "own resources"
- Score: +10 private uni, -5 scholarship focus, +5 timeline "this year"
- `is_incomplete_profile` = TRUE si no tiene email ni phone (leads de chatbot)
- Requiere `customFields` de GHL — ver estado en MILESTONE_SALES_MVP_CLOSURE.md

### Base imputable y comisiones
- Vendedor: 100% nuevos, 66% upsell, 33% cross-sell
- Asesor: 66% cross-sell, 33% upsell → × 10%
- Comisión vendedor: 12% sobre ventas > 8.500€/mes, +1% equipo (Cassandra)
- PCE/seguro: 1,8% vendedor, 1,5% asesor
- Requiere `monetary_value` en origen y tabla Holded para validar

### Umbral de asistencia
- No todo cambio de etapa cuenta como asistencia — solo cuando `stage >= umbral X`
- El umbral debe ser configurable sin reprocesar datos históricos
- Actualmente no implementado — el stage umbral no está definido por el cliente

### LTV/VLP
- Suma de todos los pedidos del cliente + comisiones asociadas
- Ventana: 1 año desde primera compra
- Requiere Holded + Stripe + MongoDB conectados

---

## Siguiente milestone recomendado

### Opción A — Desbloquear GHL (acción inmediata, sin ingeniería)
Actualizar workflows GHL para incluir `assignedTo` y `monetaryValue` en los webhooks.
- **Impacto:** desbloquea desglose por vendedor y KPIs de ingresos en el dashboard actual
- **Esfuerzo:** configuración en GHL (0h ingeniería)
- **Responsable:** Laura (Ventas)

### Opción B — Bronze GHL Users (siguiente paso técnico más prioritario)
Crear tabla `bronze_ghl_users` con los vendedores de GHL (GET /users/search).
- **Impacto:** mapea `assigned_to` (ID alfanumérico GHL) → nombre real de vendedor
- **Esfuerzo:** ~4h (endpoint + tabla + seed)
- **Responsable:** equipo técnico

### Opción C — Bronze Holded Facturas
Conectar Holded API → tabla `bronze_holded_bills`.
- **Impacto:** desbloquea lógica de comisiones, US4 Finanzas, US6 Informe vendedores
- **Esfuerzo:** ~1-2 días (API Holded + normalización + upsert)
- **Prerequisito:** acceso a credenciales API Holded (Marcos)

### Opción D — Workshops Fase 1 (deuda de diseño)
Realizar los workshops de métricas por departamento con Laura, Ignacio y Marcos.
- **Impacto:** define formalmente qué se construye en US2, US3, US4 antes de empezar a codificar
- **Esfuerzo:** 2-3 sesiones de trabajo
- **Riesgo de no hacerlo:** construir dashboards incorrectos que no responden las preguntas reales del negocio

---

## Métricas clave por departamento (referencia rápida)

### Ventas (Laura)
Conversión funnel por etapa, ticket medio, CAC por vendedor, base imputable, tiempo de cierre, patrones de día de pago, VLP/LTV, split cuali/no cuali, clasificación nuevo/upsell/cross-sell.

### Marketing (directora de marketing)
CPL, % cualificación por canal, ROAS por canal e influencer, leads por país, pie chart marketing mix, evolución temporal vs periodo anterior, conversión web (click → formulario → completado).

### Operaciones (Ignacio)
Expedientes por asesor/mes, valor económico por asesor, ratio facturación/coste salarial, work load y ocupación, pasivo pendiente (tasks abiertas), time-in-stage por tipo de proceso.

### Finanzas (Marcos)
EBITDA, margen operativo, runway, ingresos por línea de servicio (nuevo/upsell/cross-sell/suscripción/comisión), % coste por departamento, margen bruto del servicio.

---

## Identidad unificada de cliente (clave de diseño)

El sistema necesita identificar a la misma persona a través de GHL, Holded, Stripe y MongoDB.

- **Clave primaria:** email (lowercase, trimmed)
- **Fallback 1:** teléfono (trimmed, sin caracteres especiales)
- **Fallback 2:** `contact_id` de GHL (para leads de chatbot sin email ni phone)
- **Perfiles incompletos:** flag `is_incomplete_profile` = TRUE — se mantienen para métricas de ToFu pero no se cruzan con datos financieros
- **Merge de identidades:** manual en base de datos. Marcos es el responsable. No hay UI de merge implementada.

---

## Calidad de datos — métricas a monitorizar

| Métrica | Umbral objetivo | Estado actual |
|---|---|---|
| Match rate GHL ↔ Holded (por email) | >90% | No medido — Holded no conectado |
| % oportunidades con `assigned_to` | >95% | 0% — campo ausente en webhook GHL |
| % oportunidades con `monetary_value` | >95% | ~25% — campo ausente en la mayoría de webhooks GHL |
| % contacts con `customFields` | >80% | No medido — no han llegado webhooks nativos con este campo |
| Tasa `is_incomplete_profile` | Monitorizar | No implementado |
| Pesos bundle Plan Integral | Deben sumar 100% | No implementado — tabla de pesos no creada |

---

## Preguntas abiertas del cliente (requieren respuesta antes de construir)

| Pregunta | Área | Prioridad |
|---|---|---|
| ¿Se cierra definitivamente con el stack actual (Supabase + Fastify) o se evalúa dbt/n8n? | Infraestructura | Alta |
| ¿Webflow entra como fuente o se resuelve todo vía Stripe + tabla interna de productos? | Marketing | Media |
| ¿Qué stage es el umbral de "asistencia" en el funnel de ventas? | Ventas | Alta |
| ¿Cuáles son los % exactos de pesos del bundle Plan Integral? | Finanzas | Alta |
| ¿Gastos: solo categorización por departamento, o vinculamos a presupuesto anual con desviaciones? | Finanzas | Media |

---

## Validación cruzada (criterio de entrega)

Antes de considerar DataQuick! como fuente de verdad, se requiere:
- Mínimo **1 mes** de ejecución paralela (DataQuick vs cálculos manuales en Sheets/Excel)
- Discrepancia < **2%** en métricas financieras
- Discrepancia < **5%** en métricas de funnel
- Sign-off por área: Laura (Ventas), Ignacio (Ops), Marcos (Finanzas)
