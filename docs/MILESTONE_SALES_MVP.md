# Milestone: Sales MVP — DataQuick / ViveEspaña

**Fecha:** 2026-03-24
**Estado:** Completado y validado con datos reales

---

## Resumen del milestone

Antes de este milestone, el sistema era únicamente una capa de ingestión y observabilidad: capturaba webhooks de GHL y Stripe, persistía los datos en Supabase y exponía un panel operativo de monitorización. No existía ninguna capa de análisis de ventas ni métricas de negocio.

Se ha construido y validado end-to-end el primer entregable funcional de ventas sobre ese sistema de ingestión existente. El sistema es capaz de mostrar un funnel de ventas real, calcular métricas básicas de conversión y clasificar automáticamente cada operación como nueva venta o cross-sell. El MVP no es una demo sintética: opera sobre datos reales provenientes de GHL almacenados en Supabase.

---

## Capacidades actuales

- **Funnel por etapas:** agrupación de oportunidades por `stage_name` y `pipeline_name`, con conteos abiertos, ganados, perdidos y valor monetario por etapa.
- **KPIs globales:** leads totales, ventas cerradas, operaciones abiertas, tasa de conversión histórica acumulada, valor del pipeline activo y ticket medio de operaciones ganadas.
- **Tabla de operaciones:** listado paginado con filtros por estado, pipeline y rango de fechas. Cada operación ganada incluye `win_rank` y clasificación `nueva_venta` / `cross_sell`.
- **Endpoints disponibles:**
  - `GET /admin/sales/funnel` — devuelve KPIs + etapas del funnel
  - `GET /admin/sales/deals` — devuelve tabla paginada de operaciones con filtros opcionales
- **Dashboard:** tab "Ventas" integrado en el panel existente con 6 tarjetas KPI, visualización de funnel por barras proporcionales y tabla de operaciones con badges de clasificación.

---

## Arquitectura implicada

**Capa SQL (Supabase):**
- `sales_funnel_basic` — vista de agregación por etapa a partir de `opportunities`
- `sales_deals_outcomes` — vista con `win_rank` calculado mediante `ROW_NUMBER() PARTITION BY contact_id` y `deal_classification` derivado del rango
- `sales_kpis_basic` — vista de fila única con KPIs globales calculados

**Backend (Fastify + TypeScript):**
- `src/repositories/admin.repository.ts` — funciones `getSalesFunnel()` y `getSalesDeals()`. `getSalesFunnel()` ejecuta las consultas a `sales_funnel_basic` y `sales_kpis_basic` en paralelo mediante `Promise.all`. Ambas funciones acceden a las vistas vía Supabase PostgREST (`.from('view_name').select(...)`).
- `src/routes/admin.ts` — dos rutas nuevas protegidas con `adminAuthHook` existente

**Frontend (Vite + TypeScript):**
- `dashboard/src/pages/sales.ts` — tab completo sin dependencias de librerías de gráficos externas
- `dashboard/src/api.ts` — funciones `getSalesFunnel()` y `getSalesDeals()` con tipos explícitos

**Flujo de datos:** GHL webhook → `opportunities` (tabla base) → vistas SQL → endpoints `/admin/sales/*` → tab Ventas del dashboard.

---

## Validación realizada

La validación se ejecutó sobre datos reales de producción (oportunidades GHL sincronizadas vía webhook). El conjunto de datos incluía múltiples oportunidades distribuidas en al menos un pipeline, con presencia confirmada de operaciones en estado `won`, lo que permitió verificar el cálculo de `win_rank` y `deal_classification` con casos reales de nueva venta y cross-sell.

- Consistencia SQL verificada: `sales_kpis_basic.total_leads = SUM(sales_funnel_basic.count_total) = COUNT(opportunities)`
- `win_rank` verificado: rank 1 en todos los primeros cierres por contacto; rank >1 en cierres sucesivos
- Endpoints probados con sesión real: respuestas coherentes con datos en base de datos
- Dashboard validado visualmente: KPIs con datos reales, funnel con barras, badges de clasificación en filas ganadas
- Filtro estado/pipeline/fecha probado con ciclo aplicar → limpiar

---

## Limitaciones actuales

- **Orden de etapas:** las etapas se muestran en orden alfabético. No existe tabla `pipeline_stages`. Si el nombre de una etapa cambia en GHL, aparecerá como etapa nueva en el funnel, fragmentando el histórico.
- **Conversión no periódica:** la tasa de conversión es histórica acumulada desde el inicio de los datos. Comparaciones por mes o trimestre no son posibles con los endpoints actuales.
- **Sin cualificación:** el campo `qualified_flag` (cuali/no-cuali) no está implementado. La presencia y formato del dato en `contacts.metadata` no ha sido inspeccionada — puede no existir o requerir mapeo manual desde campos personalizados de GHL.
- **Sin desglose por comercial:** `assigned_to` está presente en la vista pero no hay vista ni endpoint dedicado. El campo puede estar vacío si GHL no asigna responsable de forma consistente.
- **Riesgo de integridad en `monetary_value`:** el valor monetario de las oportunidades depende de que GHL envíe el campo correctamente. Oportunidades sin valor asignado contribuyen a conteos pero no a los totales económicos, lo que puede inflar la tasa de conversión y distorsionar el ticket medio.

---

## Decisiones técnicas clave

- **Vistas SQL en lugar de capa Silver/Gold:** se optó por vistas `CREATE OR REPLACE` para evitar duplicación de datos y mantener el tiempo de implementación acotado al MVP.
- **`win_rank` en SQL:** el cálculo se realiza en la vista mediante ventana analítica, sin lógica en capa de aplicación. Reproducible y auditable directamente en base de datos.
- **KPIs globales no filtrados por pipeline:** los KPIs del endpoint `/funnel` son siempre globales. El filtro por pipeline afecta únicamente a las etapas y a la tabla de deals.
- **Frontend sin librerías de gráficos:** el funnel usa barras CSS proporcionales. Elimina dependencias y mantiene el bundle reducido.

---

## Criterio de aceptación del MVP

El MVP se considera funcional cuando:

- Las tres vistas SQL existen y los conteos son consistentes entre sí y con la tabla base
- `GET /admin/sales/funnel` devuelve `kpis.total_leads > 0` y `stages` no vacío
- `GET /admin/sales/deals?status=won` devuelve filas con `win_rank >= 1` y `deal_classification` no nulo
- El tab Ventas muestra datos reales en KPIs, al menos una barra en el funnel y badges de clasificación en la tabla

Todos los criterios han sido verificados con datos reales.

---

## Cobertura vs roadmap DataQuick (dominio Ventas)

El roadmap DataQuick define para el dominio de Ventas: funnel de captación, cualificación (cuali/no-cuali), conversión, comisiones y atribución de marketing.

| Capacidad roadmap | Estado en este MVP |
|---|---|
| Funnel por etapas | Cubierto (orden alfabético, no CRM) |
| Métricas de conversión | Cubierto (histórico acumulado, sin periodos) |
| Nueva venta vs cross-sell | Cubierto |
| Cualificación cuali/no-cuali | No implementado |
| Comisiones | No implementado |
| Atribución de marketing | No implementado |
| Filtros por periodo | No implementado |
| Desglose por comercial | No implementado |

Este MVP cubre aproximadamente el 25–30% del dominio de Ventas definido en el roadmap. Las capacidades de cualificación, comisiones y atribución requieren trabajo adicional en ingesta, enriquecimiento de datos y lógica de negocio no construida aún.

---

## Dependencias externas críticas

El correcto funcionamiento del MVP depende de la calidad de los datos entrantes desde GHL:

- **Fiabilidad del webhook GHL:** si los webhooks de oportunidades no se entregan o se pierden, el funnel queda desactualizado sin notificación al sistema. No hay mecanismo de reconciliación activo.
- **`stage_name` poblado y estable:** el funnel se construye íntegramente sobre `stage_name`. Valores nulos agrupan bajo `NULL`; nombres inconsistentes (espacios, mayúsculas, renombrados en CRM) generan etapas duplicadas y rompen la continuidad del histórico.
- **`monetary_value` completo:** los KPIs de valor del pipeline y ticket medio dependen de que cada oportunidad tenga valor asignado en GHL. La ausencia parcial de este campo no rompe el sistema pero produce métricas económicas incorrectas.

---

## Estado actual

MVP funcional. Validado end-to-end con datos de producción. Listo para demo con cliente.

---

## Siguientes pasos no implementados (P1)

- Tabla `pipeline_stages` para orden correcto de etapas en funnel
- Filtros temporales en KPIs (este mes, mes anterior, rango personalizado)
- Verificación e integración de `qualified_flag` desde `contacts.metadata`
- Vista de desglose de rendimiento por comercial (`assigned_to`)
