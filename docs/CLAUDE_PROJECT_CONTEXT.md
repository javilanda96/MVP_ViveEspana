# Contexto del Proyecto — Landthor / DataQuick! / Vive España

**Última actualización:** 2026-03-31
**Para uso en:** Claude Project compartido (claude.ai)

---

## Qué es este proyecto

**Landthor** es el nombre comercial del integrador de datos que se está construyendo. Es este repositorio (`pyme-data-integration-mvp`). No es un proveedor externo — es el motor propio de Aitor Artieda.

**DataQuick!** es el nombre del producto/sistema de datos para el cliente **Vive España**. Landthor construye DataQuick!.

**Vive España** es la empresa cliente — academia de estudiantes internacionales. Tiene 4 departamentos: Ventas, Marketing, Operaciones y Finanzas.

**Repositorio:** `MVP_ViveEspana` en GitHub (javilanda96)
**Stack:** Supabase (PostgreSQL) + Fastify + TypeScript + Vite (dashboard)
**Stack intencional:** TypeScript + SQL custom ES la propuesta de valor de Landthor. n8n y dbt están explícitamente fuera del scope — no son desviaciones, es arquitectura deliberada.
**Fecha límite contractual:** 30 junio 2026
**Inicio oficial:** Semana del 7 de abril 2026. El trabajo actual (Bronze GHL, Stripe, dashboard Ventas) es trabajo adelantado sobre Landthor, **no consume horas del contrato**.

---

## Términos económicos del contrato

| Concepto | Valor |
|---|---|
| Presupuesto total | **4.200 EUR / 168 horas** |
| Horas consumidas a fecha | **0 horas** (todo el trabajo previo es inversión en Landthor) |
| Deadline contractual | 30 junio 2026 |

### Hitos de pago

| Hito | Cuándo | Importe | Condición |
|---|---|---|---|
| **Hito 1** | Semana 2 de abril (≈ 17 abril) | **600 EUR** | Sign-off de Marcos sobre documento de diseño técnico (Fase 1) |
| **Hito 4** | Semana 6 (≈ mediados mayo) | **2.400 EUR** | Entrega Fase 2 — pipeline Bronze→Gold + tests |
| **Fase 3** | Semana 12 (≈ finales junio) | **1.200 EUR** | Dashboards completos + formación + cierre contractual |

---

## Stakeholders

| Persona | Rol | Responsabilidad en DataQuick! |
|---|---|---|
| **Marcos Olmo** | CFO, Data Owner | Sign-off Hito 1. Acceso a MongoDB y Holded. Validación finanzas |
| **Laura** | Responsable de Ventas | Validadora dashboard ventas. Administra GHL. Actualizar webhooks |
| **Ignacio** | Responsable de Operaciones | Validador dashboard operaciones. Input workshops Fase 1 |
| **Aitor Artieda** | Desarrollador (Landthor) | Construye el sistema. IP del motor Landthor es suya |

---

## Propiedad intelectual (estructura confirmada)

- **Motor Landthor** (Fastify + TypeScript + arquitectura de ingestión) → propiedad de Aitor Artieda, licenciado a Vive España para uso
- **Customizaciones de negocio** (vistas SQL, lógica de comisiones, dashboards específicos de Vive España) → propiedad de Vive España
- Esta estructura está acordada en el contrato y no tiene ambigüedad

---

## Arquitectura objetivo: Bronze → Silver → Gold → Dashboards

### Bronze — Ingesta de datos

| Fuente | Qué aporta | Estado |
|---|---|---|
| GHL — Contactos | Leads, cualificación, customFields | ✅ Activo (faltan UTMs, customFields confirmados, is_incomplete_profile) |
| GHL — Oportunidades | Pipeline, etapas, valor, vendedor | ✅ Activo (faltan `assignedTo` y `monetaryValue` — bloqueados en configuración GHL, no en código) |
| GHL — Stage events | Historial de cambio de etapa | ✅ Parcial (`opportunity_stage_history`) |
| GHL — Usuarios | Mapeo ID → nombre de vendedor | ❌ No construido (`bronze_ghl_users` pendiente, ~4h) |
| Stripe — Pagos | Pagos completados | ✅ Activo (suscripciones y refunds pendientes) |
| Holded — Facturas | Ingresos, comisiones base | ❌ No conectado — bloquea US4, US6, comisiones |
| Holded — Contabilidad | Nóminas (640\*), SS (642\*) | ❌ No conectado — bloquea rentabilidad por asesor |
| MongoDB / Nomool | Expedientes de estudiantes | ❌ No conectado — bloquea US3, US7, US9 |
| Google Sheets | Catálogo productos, pesos bundle, influencers | ❌ No conectado |

### Silver — Normalización y lógica de negocio

No existe capa Silver formal. Las vistas SQL actuales operan directamente sobre tablas Bronze (aceptable a escala actual). Pendiente: `silver_leads_master`, `silver_funnel_events`, `silver_deals_outcomes` (parcial ya existe), `silver_orders_invoices`, `silver_products_catalog`.

### Gold — Métricas agregadas

No existe ninguna tabla Gold. Pendiente: `gold_cases`, `gold_case_payments`, `gold_funnel_performance_monthly`, `gold_finance_unit_economics`.

---

## Estado actual del sistema (Marzo 2026)

### Lo que funciona hoy (disponible desde día 1 como Landthor)

- **Ingesta GHL + Stripe** — webhooks idempotentes, auditados, deduplicados por email/phone
- **Dashboard operativo** — 7 tabs: Resumen, Actividad, Incidencias, Pipeline, Ventas, Integraciones, Alertas
- **Tab Ventas** — funnel por etapas (orden CRM), conversión etapa-a-etapa (`pct_to_next`), 6 KPIs, tabla de operaciones clasificadas, filtrado por periodo
- **Clasificación de operaciones** — `nueva_venta` (primera compra) vs `cross_sell` (compras posteriores)
- **Alertas de cobros** — detección de anomalías en pagos Stripe
- **CRUD de integraciones** — wizard 4 pasos, estado de actividad por endpoint
- **Autenticación** — cookie HttpOnly + rate limiting

### Bloqueado en fuente (GHL) — no es problema de código

- `assigned_to` — 100% nulo. GHL no envía `assignedTo` en webhooks de oportunidades. **Responsable: Laura** (workflows `05ba98de` y `d0845369`)
- `monetary_value` — ~75% nulo. Misma causa. Mismo responsable.
- `qualified` / `customFields` contactos — ningún webhook nativo ha disparado con este campo todavía

### Deuda técnica relevante

- **0 tests** — es el único gap contractual activo. La propuesta incluye 8h explícitas de integration tests como criterio de aceptación de Fase 2. Sin tests no se puede cobrar el Hito 4.
- Sin Dockerfile ni CI/CD
- Sin runner automático de migraciones (15 migraciones aplicadas manualmente en Supabase)
- Sin capa Silver/Gold formal

---

## User Stories y estado

| US | Descripción | Estado | Bloqueado por |
|---|---|---|---|
| US1 | Dashboard ventas — funnel, filtro vendedor/source | 🔄 Parcial | `assigned_to` ausente en GHL |
| US2 | Dashboard marketing — atribución canal/influencer | ❌ No iniciado | UTMs, Holded gastos, tabla influencers |
| US3 | Dashboard operaciones — productividad por asesor | ❌ No iniciado | MongoDB no conectado |
| US4 | Dashboard financiero — margen por línea | ❌ No iniciado | Holded no conectado |
| US5 | Identificar gaps en fuentes | ⚠️ Parcial | GHL inspeccionado, Holded/MongoDB no |
| US6 | Informe mensual vendedores — comisiones | ❌ No iniciado | `assigned_to`, `monetary_value`, Holded |
| US7 | Informe mensual asesores — expedientes/rentabilidad | ❌ No iniciado | MongoDB no conectado |
| US8 | IU edición vendedores/asesores | ❌ No iniciado | — |
| US9 | Registro movimientos expediente | ❌ No iniciado | MongoDB no conectado |

---

## Lógica de negocio clave (pendiente de implementar)

### Comisiones de vendedores
- Base imputable: 100% nuevas ventas, 66% upsell, 33% cross-sell
- Comisión: 12% sobre ventas > 8.500€/mes, +1% equipo (Cassandra)
- PCE/seguro: 1,8% vendedor, 1,5% asesor
- Requiere `monetary_value` en GHL + Holded facturas + `bronze_ghl_users`

### Cualificación de leads
- `qualified_flag` = TRUE si `funding_source` ∈ {"parents pay", "own resources"}
- Score: +10 universidad privada, -5 foco beca, +5 timeline "este año"
- `is_incomplete_profile` = TRUE si sin email ni teléfono (leads chatbot)
- Requiere `customFields` de GHL confirmados en payloads reales

### Umbral de asistencia (ventas)
- No todo cambio de etapa = asistencia. Solo cuando `stage >= umbral configurable`
- El umbral no está definido por el cliente todavía — pendiente de workshop

### Clasificación tipo de venta
- Sin pago previo → Nuevo cliente ✅
- Último pago = mentoría → Upsell ❌ (requiere catálogo de productos)
- Último pago = servicio → Cross-sell ✅ (parcial)

### Identidad unificada de cliente
- Clave primaria: email (lowercase, trimmed)
- Fallback 1: teléfono
- Fallback 2: contact_id GHL (perfiles incompletos de chatbot)
- No hay UI de merge — merge manual, responsable: Marcos

---

## Roadmap detallado

### Acciones semana 1 — 7-11 abril (arranque formal)

| Acción | Esfuerzo | Resultado |
|---|---|---|
| Kick-off Fase 1: workshops métricas + doc. diseño técnico | 2-3h (contenido en ROADMAP.md) | **Desbloquea Hito 1 (600 EUR)** y apertura formal de Fase 2 |
| Comunicar modelo Landthor a Marcos (arquitectura + licencia) | 0h — reunión | Alineación de expectativas sobre IP y stack |
| Laura actualiza webhooks GHL (`assignedTo` + `monetaryValue`) | 0h ingeniería | Desbloquea desglose por vendedor y KPIs de ingresos |

### Quick wins — semanas 2-4

| Acción | Esfuerzo | Resultado |
|---|---|---|
| `bronze_ghl_users` (tabla de vendedores) | ~4h | IDs ilegibles → nombres reales. Precondición para comisiones |
| Tests de integración Bronze (GHL, Stripe, funnel) | **~8h** | Cumple requisito contractual. **Desbloquea cobro Hito 4** |
| Bronze Holded (facturas + asientos) | ~10h + credenciales Marcos | Desbloquea US4, US6, comisiones. Mayor palanca por hora |

### Corto plazo — Abril 2026

| Semana | Tarea | Responsable |
|---|---|---|
| 1 | Kick-off Fase 1 + workshops métricas + doc. diseño + modelo Landthor a Marcos | Aitor + Marcos |
| 1 | Actualización webhooks GHL | Laura |
| 2 | `bronze_ghl_users` | Aitor |
| 2-3 | Tests de integración | Aitor |
| 3 | Workshop métricas Ventas (Laura) y Operaciones (Ignacio) | Aitor + equipo |
| 4 | Bronze Holded + credenciales | Aitor + Marcos |
| 4 | Workshop métricas Finanzas (Marcos) | Aitor + Marcos |

### Medio plazo — Mayo-Junio 2026

| Semanas | Bloque | Entregables |
|---|---|---|
| 5-6 | Bronze MongoDB/Nomool + Silver completo | Expedientes conectados, identidad unificada, cualificación, funnel completo |
| 6-7 | Stripe completo + Silver comisiones | Suscripciones, refunds, lógica comisiones con Holded + vendedores |
| 7-8 | Gold + Dashboard Ventas completo | Tablas Gold, dashboard con vendedor/fuente/cualificación/CAC |
| 8-9 | Dashboard Marketing + Operaciones | CPL, ROAS, influencers; productividad asesores |
| 9-10 | Dashboard Financiero + informes mensuales | EBITDA, márgenes, 3 informes recurrentes automatizados |
| 11 | Validación cruzada con datos reales | Pipeline vs. cálculos manuales del cliente |
| 12 | Formación al equipo + documentación técnica final | Entrega completa, cierre contractual |

---

## Criterios de entrega (validación cruzada)

Antes de usar DataQuick! como fuente de verdad:
- Mínimo **1 mes** de ejecución paralela vs cálculos manuales en Sheets
- Discrepancia **< 2%** en métricas financieras
- Discrepancia **< 5%** en métricas de funnel
- Sign-off: Laura (Ventas) + Ignacio (Ops) + Marcos (Finanzas)

---

## Convenciones del repositorio

- **Migraciones SQL:** `sql/migrations/NNN_nombre.sql` — aplicar manualmente en Supabase SQL Editor en orden numérico
- **Backend:** `src/` — Fastify + TypeScript, arquitectura routes → services → repositories
- **Dashboard:** `dashboard/src/` — Vite + TypeScript vanilla, build con `npm run build:dashboard`
- **Docs:** `docs/` — `ROADMAP.md` es el punto de entrada principal para el estado técnico
- **Tests:** 0 existentes — prioridad alta (requisito contractual Fase 2)

### Comandos clave

```bash
# Backend
npm run dev              # Fastify en :3000

# Dashboard
cd dashboard && npm run dev    # Vite en :5173
npm run build:dashboard        # Build para producción
```

---

## Preguntas abiertas del cliente

| Pregunta | Área | Prioridad |
|---|---|---|
| ¿Qué stage es el umbral de "asistencia" en el funnel? | Ventas | Alta |
| ¿Cuáles son los % exactos de pesos del bundle Plan Integral? | Finanzas | Alta |
| ¿Credenciales API Holded disponibles antes de semana 4 de abril? | Finanzas/Ops | Alta |
| ¿Acceso técnico a MongoDB/Nomool antes de semana 5? | Operaciones | Alta |
| ¿Webflow entra como fuente de datos? | Marketing | Media |
| ¿Gastos: categorización por departamento o vs presupuesto anual? | Finanzas | Media |
