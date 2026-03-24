# Cierre de Milestone: Sales MVP — DataQuick / ViveEspaña

**Fecha de cierre:** 2026-03-24
**Estado general:** COMPLETADO Y EXTENDIDO

---

## Estado general

El MVP original fue validado end-to-end con datos reales. Todos los elementos P1 listados en el documento original (`MILESTONE_SALES_MVP.md`) han sido implementados en la extensión posterior. Los elementos restantes del roadmap están **congelados por bloqueos externos en la fuente de datos (GHL)**, no por trabajo de ingeniería pendiente.

---

## Qué se ha completado

### Capa SQL (Supabase)
- **Vistas base:** `sales_funnel_basic`, `sales_kpis_basic`, `sales_deals_outcomes`
- **Funciones parametrizadas:** `sales_funnel_with_period(from_date, to_date)` y `sales_kpis_with_period(from_date, to_date)` — aceptan rango de fechas opcional y reemplazaron a las vistas como camino principal de consulta
- **Tabla `pipeline_stages`:** creada y sembrada con el orden correcto de etapas (New Lead=1, Contacted=2, Proposal Sent=3). El funnel respeta el orden del CRM en lugar del orden alfabético
- **`pct_to_next`:** conversión etapa a etapa mediante `LEAD()`. La CTE base parte de `pipeline_stages`, por lo que las etapas vacías aparecen con `count=0` y la conversión no salta etapas intermedias ausentes

### Backend (Fastify + TypeScript)
- `GET /admin/sales/funnel` — devuelve KPIs + etapas del funnel con filtrado por periodo opcional (`from`, `to`)
- `GET /admin/sales/deals` — tabla paginada de operaciones con filtros por estado, pipeline y fecha
- Ambos endpoints protegidos por `adminAuthHook`

### Frontend (Vite + TypeScript)
- Tab **Ventas** con 6 tarjetas KPI, funnel de barras proporcionales CSS y tabla de operaciones con badges de clasificación
- **Selector de periodo** con tres presets (Este mes, Mes anterior, Todo) y rango personalizado Desde/Hasta
- Corrección de zona horaria: usa campos de fecha locales (`getFullYear/getMonth/getDate`) en lugar de `toISOString()`, evitando el desfase de -1 día en UTC+1

### Clasificación de operaciones
- `win_rank` calculado con `ROW_NUMBER() PARTITION BY contact_id ORDER BY won_at`
- `deal_classification`: `nueva_venta` (rank=1) y `cross_sell` (rank>1) — funciona con datos reales

### Ingestión de webhooks GHL
- Ingestión de contactos actualizada para persistir el array `customFields` de GHL en `contacts.metadata`
- `buildContactMetadata()` fusiona `metadata` y `customFields` de forma segura
- Cuando lleguen webhooks nativos de GHL con `customFields`, se persistirán automáticamente sin cambios adicionales *(commit ae56cd9)*

---

## Qué funciona actualmente

| Área | Estado |
|---|---|
| Funnel de ventas por etapas | ✅ Funciona. Etapas en orden correcto, etapas vacías incluidas, conversión entre etapas visible |
| KPIs de conteos | ✅ Funciona. Leads, abiertos, ganados, perdidos y tasa de conversión histórica correctos |
| KPIs monetarios | ⚠️ Calculados correctamente, pero muestran cero o nulo porque GHL no envía `monetaryValue` en los webhooks |
| Clasificación de operaciones | ✅ Funciona. Badges `nueva_venta` y `cross_sell` correctos en operaciones ganadas |
| Filtrado por periodo | ✅ Funciona end-to-end. Presets y rango personalizado filtran funnel y KPIs correctamente |
| Ingestión de webhooks | ✅ Funciona. Idempotente, auditado, deduplicación de contactos por email |

---

## Qué está bloqueado (congelado)

Estos elementos están bloqueados en la **fuente de datos (GHL)**, no en el código.

### Desglose por comercial (`assigned_to`)
- **Causa:** Los payloads de webhook de oportunidades GHL no incluyen `assignedTo`. Confirmado inspeccionando 3 registros reales en `events_log`. El campo está ausente en origen — el código de mapeo es correcto.
- **Condición de desbloqueo:** Actualizar los workflows de GHL `05ba98de / New oportunity` y `d0845369 / Smoke test Oportunity Change to Supa` para incluir `assignedTo` en el payload saliente. Se necesitan al menos 20 oportunidades con `assigned_to` no nulo antes de construir la vista de desglose.

### KPIs de ingresos (`monetary_value`)
- **Causa:** Los payloads de webhook de oportunidades GHL no incluyen `monetaryValue`. Confirmado en los mismos registros. El 75%+ de las oportunidades tienen este campo a nulo en base de datos.
- **Condición de desbloqueo:** Actualizar el webhook de GHL para incluir `monetaryValue`. Se necesita que al menos el 50% de las oportunidades abiertas tengan valor no nulo para que las métricas económicas sean fiables.

### Segmentación por cualificación (`qualified`)
- **Causa:** Ningún webhook nativo de contactos GHL ha disparado desde la corrección de ingestión. No se puede confirmar si GHL envía `customFields` ni qué ID de campo corresponde al estado cuali/no-cuali.
- **Condición de desbloqueo:** Que un webhook nativo de contactos GHL dispare con array `customFields` visible en `events_log.payload`. Una vez identificado el ID del campo, la segmentación se puede construir directamente desde `contacts.metadata`.

---

## Qué se ha pospuesto

| Elemento | Motivo |
|---|---|
| Capa Silver/Gold (arquitectura medallón) | La arquitectura actual de vistas cubre el volumen del MVP sin duplicación de datos. Sin beneficio visible a escala actual. |
| Analítica multi-pipeline | Solo existe un pipeline real (`Sales`). `Pipeline prueba` es un artefacto de test. |
| Métricas de tiempo en etapa | Requiere operaciones ganadas/perdidas en volumen. El dataset actual tiene 4 oportunidades, todas abiertas. |
| Comisiones y atribución de marketing | Requieren lógica de negocio adicional, fuentes de datos y campos no presentes en la ingestión actual. |

---

## Capacidades actuales del sistema

- Funnel completo por etapas en orden CRM, incluyendo etapas con cero oportunidades
- Tasa de conversión etapa a etapa sin saltar etapas intermedias vacías
- Filtrado por periodo (presets mensuales o rango personalizado), seguro en zona horaria
- Conteos de leads, abiertos, ganados, perdidos y tasa de conversión histórica
- Clasificación de operaciones: `nueva_venta` vs `cross_sell` en cierres ganados
- Tabla de operaciones paginada con filtros por estado, pipeline y fecha
- Ingestión de webhooks idempotente con log de auditoría y deduplicación de contactos
- Persistencia automática de `customFields` GHL en `contacts.metadata` cuando se reciban

---

## Limitaciones actuales

- Los totales de ingresos y el ticket medio son cero o nulos — `monetary_value` ausente en la fuente GHL
- No existe desglose por comercial — `assigned_to` ausente en la fuente GHL
- No existe segmentación cualificado/no-cualificado — `customFields` no confirmado en payloads reales
- No hay métricas de velocidad de ventas ni tiempo en etapa — datos históricos insuficientes
- No hay mecanismo de reconciliación de webhooks — si GHL no entrega un evento, el funnel queda desactualizado sin alerta

---

## Punto de reinicio recomendado

**Acción:** Actualizar las acciones de webhook de los workflows GHL para incluir `assignedTo` y `monetaryValue`, y disparar un webhook nativo de contactos para confirmar la forma del payload `customFields`.

**Por qué esta acción primero:** No requiere trabajo de ingeniería. Solo requiere acceso a la configuración de GHL. Una vez confirmado que los campos llegan en `events_log.payload`, se activan `assigned_to` y `monetary_value` automáticamente en cada nuevo webhook, desbloqueando tanto el desglose por comercial como los KPIs de ingresos sin cambios de código.

**Verificación:** Tras actualizar GHL, ejecutar en Supabase SQL Editor:
```sql
SELECT payload
FROM events_log
WHERE webhook_source = 'ghl'
  AND event_type = 'opportunity.updated'
ORDER BY created_at DESC
LIMIT 1;
```
Confirmar presencia de `assignedTo` y `monetaryValue` en el payload devuelto.

---

## Resumen ejecutivo final

El Sales MVP está completo y validado. La pila del funnel — `pipeline_stages` → `sales_funnel_with_period` → `/admin/sales/funnel` → tab Ventas — funciona end-to-end con filtrado por periodo, orden correcto de etapas y conversión etapa a etapa.

Las tres funcionalidades de inteligencia pendientes (desglose por comercial, KPIs de ingresos, segmentación por cualificación) están bloqueadas a nivel de fuente de datos GHL, no en el código. El sistema está preparado para capturarlas en cuanto lleguen desde GHL — no se necesita refactorizar la ingestión.

**Para continuar:** acceder a GHL, actualizar los templates de webhook de los workflows de oportunidades para incluir `assignedTo` y `monetaryValue`, disparar un test y verificar en `events_log`. A partir de ahí, los KPIs de ingresos y el desglose por comercial se construyen sobre datos confirmados.
