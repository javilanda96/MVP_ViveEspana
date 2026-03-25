# Estado actual del repositorio

**Última actualización:** 2026-03-25
**Objetivo en curso:** MVP_ViveEspaña — DataQuick!
**Data Owner:** Marcos Olmo (CFO) · Ventas: Laura · Operaciones: Ignacio
**Fecha fin estimada proyecto:** 30 junio 2026
**Roadmap completo:** `docs/ROADMAP.md`

---

## Qué hace este repositorio ahora mismo

Este repositorio implementa un **middleware de ingesta de webhooks** con un **panel de operaciones interno** y un **módulo de analítica de ventas**. No es la plataforma DataQuick! completa. Es la capa de ingesta (Bronze parcial), la capa de observabilidad operativa y el primer entregable de inteligencia de negocio.

DataQuick! tiene como objetivo conectar GHL, Stripe, Holded y MongoDB/Nomool para producir dashboards de Ventas, Marketing, Operaciones y Finanzas. Este repositorio cubre actualmente: Bronze GHL + Stripe y el dashboard de Ventas (US1 parcial). El resto de fuentes y departamentos están pendientes — ver `docs/ROADMAP.md` para el estado completo.

En concreto:
- Recibe eventos en tiempo real de **GoHighLevel** (contactos, oportunidades) y **Stripe** (pagos).
- Persiste cada evento en **Supabase/PostgreSQL** con idempotencia y auditoría completa.
- Detecta anomalías en cobros y genera alertas operativas automáticas.
- Expone un **panel de administración interno** (`/dashboard/`) con monitorización operativa y analítica de ventas.

---

## Componentes activos

### Backend — Fastify + TypeScript (`src/`)

| Capa | Archivos | Descripción |
|------|----------|-------------|
| Entrada | `index.ts` | Servidor Fastify, parser de rawBody para Stripe, servicio de estáticos |
| Config | `config.ts`, `lib/secrets.ts` | Validación de env vars, acceso a secretos |
| Seguridad | `lib/webhook-security.ts`, `hooks/` | Verificación HMAC-SHA256 (Stripe) y shared-secret (GHL) |
| Rutas | `routes/contacts.ts` | `POST /webhooks/contacts` |
| Rutas | `routes/payments.ts` | `POST /webhooks/payments` |
| Rutas | `routes/opportunities.ts` | `POST /webhooks/opportunities` |
| Rutas | `routes/admin.ts` | Todos los endpoints `/admin/*` |
| Servicios | `services/` | Lógica de procesamiento, validación e idempotencia por entidad |
| Repositorios | `repositories/` | Acceso a Supabase por entidad |
| Alertas | `services/alert.service.ts` | Evaluación de reglas de anomalía en cobros |

### Endpoints activos

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| GET | `/health` | ninguna | Estado del servidor y BD |
| POST | `/webhooks/contacts` | GHL shared-secret | Upsert de contactos (persiste customFields en metadata) |
| POST | `/webhooks/payments` | HMAC-SHA256 (Stripe) | Insert de pagos + alertas |
| POST | `/webhooks/opportunities` | GHL shared-secret | Upsert de oportunidades + historial de etapas |
| POST | `/admin/login` | ADMIN_API_KEY en body | Crea sesión; devuelve cookie HttpOnly |
| POST | `/admin/logout` | cookie de sesión | Invalida sesión |
| GET | `/admin/stats` | cookie de sesión | KPIs del sistema (últimas 24 h) |
| GET | `/admin/events` | cookie de sesión | Log de eventos con filtros |
| GET | `/admin/events/:id` | cookie de sesión | Detalle de evento individual |
| GET | `/admin/errors` | cookie de sesión | Eventos fallidos con filtros |
| GET | `/admin/alerts` | cookie de sesión | Alertas de cobros con filtros |
| GET | `/admin/pipeline` | cookie de sesión | Vista de oportunidades (`opportunity_overview`) |
| GET | `/admin/integrations` | cookie de sesión | Actividad y estado de integraciones |
| GET | `/admin/connections` | cookie de sesión | Lista de conexiones registradas |
| POST | `/admin/connections` | cookie de sesión | Crear nueva conexión |
| PATCH | `/admin/connections/:id` | cookie de sesión | Editar conexión existente |
| GET | `/admin/sales/funnel` | cookie de sesión | KPIs globales + etapas del funnel con filtrado por periodo opcional |
| GET | `/admin/sales/deals` | cookie de sesión | Tabla paginada de operaciones con filtros por estado, pipeline y fecha |

### Base de datos — Supabase PostgreSQL (`sql/`)

| Archivo | Tablas / objetos creados |
|---------|--------------------------|
| `schema.sql` | `contacts`, `invoices`, `payments`, `subscriptions`, `events_log`, `sync_queue`, función `claim_event()`, triggers `updated_at` |
| `002_opportunities.sql` | `opportunities`, `opportunity_stage_history` |
| `003_opportunity_overview_view.sql` | vista `opportunity_overview` |
| `005_admin_indexes.sql` | índices adicionales en `events_log` |
| `006_connections.sql` | `connections` (seed de 3 conexiones iniciales) |
| `007_connections_extended_fields.sql` | columnas `base_url`, `account_id`, `public_key`, `notes` en `connections` |
| `008_payment_alerts.sql` | `payment_alerts` |
| `009_sales_funnel_basic.sql` | vista `sales_funnel_basic` |
| `010_sales_deals_outcomes.sql` | vista `sales_deals_outcomes` (con `win_rank` y `deal_classification`) |
| `011_sales_kpis_basic.sql` | vista `sales_kpis_basic` |
| `012_sales_funnel_with_period.sql` | funciones RPC `sales_funnel_with_period()` y `sales_kpis_with_period()` |
| `013_pipeline_stages_ordered_funnel.sql` | actualiza `sales_funnel_basic` con JOIN a `pipeline_stages` |
| `014_pipeline_stages.sql` | tabla `pipeline_stages` (seed: New Lead=1, Contacted=2, Proposal Sent=3) |
| `015_sales_funnel_pct_to_next.sql` | reescribe `sales_funnel_with_period` con `pct_to_next` y etapas vacías incluidas |

> **Las migraciones no tienen runner automatizado.** Aplicarlas manualmente en Supabase SQL Editor en orden numérico (schema.sql primero, luego 002, 003, ..., 015).

### Panel de administración — Vite + TypeScript (`dashboard/`)

Servido en `/dashboard/` como estático por Fastify (`dashboard/dist/` generado con `npm run build:dashboard`).

| Sección (tab) | Descripción |
|---------------|-------------|
| Resumen | KPIs: eventos 24 h, tasa de error, alertas abiertas, pagos cobrados, oportunidades abiertas |
| Actividad | Log completo de `events_log` con filtros por fuente, estado, tipo, ID externo y rango de fechas |
| Incidencias | Vista filtrada de eventos fallidos; agrupación por tipo de evento |
| Pipeline | Tabla de `opportunity_overview`; filtrable por estado y nombre de pipeline |
| Integraciones | CRUD de conexiones (`connections`); wizard de 4 pasos; estado de actividad por endpoint |
| Alertas | Lista de `payment_alerts`; filtrable por estado y severidad |
| **Ventas** | Funnel por etapas con orden CRM, conversión etapa a etapa, KPIs globales, tabla de operaciones con clasificación nueva_venta/cross_sell y filtrado por periodo |

---

## Reglas de seguridad activas

- Webhooks GHL: header `X-GHL-Signature` con valor de `GHL_WEBHOOK_SECRET`. Sin secreto → modo permisivo en desarrollo, requerido en producción.
- Webhooks Stripe: header `Stripe-Signature` con HMAC-SHA256 sobre `rawBody`. Tolerancia de ±5 minutos. Sin secreto → modo permisivo en desarrollo, requerido en producción.
- Panel: login con `ADMIN_API_KEY` → cookie `admin_session` HttpOnly + SameSite=Strict + 24 h. Rate limit: 10 intentos / 15 min por IP. Sesiones en memoria (invalidadas al reiniciar el servidor).

---

## Qué no está implementado

Esto es lo que el roadmap DataQuick! requiere y el repositorio **no tiene**:

### Fuentes de datos
- **Holded** — ningún conector. Sin facturas, sin Daily Ledger (nóminas 640\*, SS 642\*, comisiones 7005).
- **MongoDB / Nomool** — ningún sync. Todo el dominio de Operaciones está bloqueado.
- **GHL custom fields** — el webhook de oportunidades no envía `assignedTo` ni `monetaryValue`. El webhook de contactos no ha disparado nativamente con `customFields`. El código de ingestión está preparado para capturar `customFields` cuando lleguen, pero los datos no están disponibles aún.
- **Webflow** — no evaluado.

### Campos bloqueados en origen (GHL)
- `assigned_to` — ausente en todos los payloads de oportunidades GHL observados. Código correcto, problema en configuración de GHL.
- `monetary_value` — ausente en todos los payloads de oportunidades GHL observados. Ídem.
- `qualified` / `customFields` de contactos — ningún webhook nativo de contactos ha disparado con este campo.

### Capas de datos (Bronze/Silver/Gold)
- No existe separación formal Bronze/Silver/Gold. Las vistas SQL actuales funcionan directamente sobre tablas de ingesta.
- No existe `silver_leads_master` con identidad unificada.
- No existe ninguna tabla Gold (`gold_funnel_performance_monthly`, `gold_cases`, `gold_finance_unit_economics`).

### Lógica de negocio
- Sin cálculo de comisiones (reglas de 12%, base imputable, PCE/seguro).
- Sin atribución de marketing (UTM → nombre de formulario → respuesta del formulario).
- Sin cualificación de leads (score, flag, perfil incompleto).
- Sin desglose por comercial — `assigned_to` ausente en origen.

### Dashboards de negocio
- No existe dashboard de Marketing (US2), Operaciones (US3), ni Finanzas (US4).
- No existen los informes mensuales de vendedores (US6), asesores (US7) ni socios.

### Funcionalidades de producto
- Sin IU de edición para vendedores/asesores (US8).
- Sin tabla de incidencias de clientes (distinta de `payment_alerts`).
- Sin vista de gastos de influencers para marketing.
- Sin tracking de influencers (SocialKit API).

### Infraestructura
- Sin Dockerfile ni configuración de hosting.
- Sin runner de migraciones (las 15 migraciones se aplican manualmente).
- Sin CI/CD.
- Sin tests (ni unitarios ni de integración).

---

## Cómo difiere del roadmap completo DataQuick!

El roadmap DataQuick! define 4 fases: Fase 0 (decisión de proveedor), Fase 1 (workshops y diseño), Fase 2 (construcción del pipeline), Fase 3 (dashboards, validación y formación).

Este repositorio implementa:
- **Fase 0:** parcialmente — el stack está en Supabase + Fastify, pero la decisión no está formalmente documentada.
- **Fase 1:** pendiente — los workshops de métricas, APIs y tablas no han ocurrido todavía.
- **Fase 2:** parcialmente — ingesta Bronze para GHL (contactos + oportunidades) y Stripe (pagos). Holded y MongoDB ausentes. Capas Silver y Gold inexistentes.
- **Fase 3:** inicio — existe el dashboard de Ventas con funnel, KPIs y clasificación de operaciones. Resto de dominios (Marketing, Operaciones, Finanzas) sin empezar.

---

## Archivos de referencia

| Propósito | Archivo |
|-----------|---------|
| **Roadmap completo y cobertura por US** | `docs/ROADMAP.md` ← punto de entrada principal |
| Cierre del milestone Sales MVP | `docs/MILESTONE_SALES_MVP_CLOSURE.md` |
| Detalle técnico del milestone Sales MVP | `docs/MILESTONE_SALES_MVP.md` |
| Siguiente milestone planificado | `docs/MILESTONE_DATA_RELIABILITY_LAYER.md` |
| Estado del sistema para el cliente | `docs/punto-de-situacion.md` |
| Guía de demo del sistema actual | `docs/demo-flow.md` |
| Payloads de ejemplo para tests | `docs/payloads/` |
| Documentos históricos de fase inicial | `docs/archive/phase-1-initial-foundation/` |
| Referencia original del cliente | `DataQuick_CLAUDE.md` (en `Downloads/`, fuera del repo) |

---

## Siguiente paso recomendado

Ver `docs/ROADMAP.md` sección "Siguiente milestone recomendado" para las opciones ordenadas por impacto/esfuerzo.

Acción inmediata sin ingeniería: acceder a GHL y actualizar los workflows de oportunidades (`05ba98de / New oportunity` y `d0845369`) para incluir `assignedTo` y `monetaryValue` en el payload del webhook. Responsable: Laura.
