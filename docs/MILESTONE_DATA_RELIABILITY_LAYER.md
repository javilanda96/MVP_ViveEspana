# MILESTONE_DATA_RELIABILITY_LAYER

**Posición en el roadmap DataQuick!:** Entre Sales MVP (completado) y la conexión de Holded/MongoDB.
**Referencia:** `docs/ROADMAP.md` — ver sección "Siguiente milestone recomendado".

## 1. Objetivo

Transformar el sistema actual (Sales MVP) en una herramienta fiable para la toma de decisiones antes de escalar a nuevas fuentes y departamentos.

Este milestone no añade nuevas features de negocio.
Se centra en:
- Garantizar que los datos son correctos o marcar claramente cuando no lo son
- Evitar que el equipo interprete mal las métricas por campos ausentes en GHL
- Preparar el sistema para recibir Holded, MongoDB y fuentes adicionales con garantías

---

## 2. Contexto de partida

Estado actual:
- Funnel y KPIs funcionando
- Period filtering implementado
- Conversión entre etapas correcta

Problema:
- Datos incompletos desde GHL
- Campos clave ausentes (assigned_to, monetary_value)
- Riesgo de tomar decisiones incorrectas

Conclusión:
> El sistema funciona, pero no es fiable todavía

---

## 3. Principios del milestone

1. Nunca mostrar datos engañosos
2. Diferenciar claramente entre “0” y “no hay datos”
3. Hacer explícitas las limitaciones
4. Priorizar claridad sobre sofisticación

---

## 4. Bloques de trabajo

### 4.1 Data Source Reliability

Objetivo:
Detectar si los datos que llegan son utilizables

Implementación:
- Crear flags en backend:
  - is_revenue_reliable
  - is_salesperson_reliable
  - is_qualification_reliable

Lógica:
- revenue_reliable = monetary_value no null en % suficiente
- salesperson_reliable = assigned_to presente
- qualification_reliable = customFields presentes

Output:
- Flags disponibles en endpoints

---

### 4.2 Data Completeness Metrics

Objetivo:
Medir calidad de datos en tiempo real

Implementación:
- Endpoint: /admin/sales/health

Métricas:
- % opportunities con monetary_value
- % opportunities con assigned_to
- % contacts con metadata/customFields
- número total de eventos recientes

Output:
- JSON consumible por frontend

---

### 4.3 UI Data States

Objetivo:
Evitar que el usuario interprete mal los datos

Implementación:
- Sustituir valores engañosos:
  - 0 → "Sin datos"
  - null → "No disponible"

- Mensajes explícitos:
  - "No hay datos de facturación (GHL no envía monetaryValue)"

- Estados:
  - loading
  - empty
  - partial data

---

### 4.4 KPI Guardrails

Objetivo:
Bloquear KPIs cuando no son fiables

Implementación:
- Si is_revenue_reliable = false:
  - ocultar revenue KPIs
  - mostrar warning

- Si is_salesperson_reliable = false:
  - ocultar breakdown por vendedor

---

### 4.5 Logging y Diagnóstico

Objetivo:
Detectar problemas rápido

Implementación:
- Queries estándar sobre events_log
- Logs de campos ausentes

Ejemplo:
SELECT payload FROM events_log ORDER BY created_at DESC LIMIT 5;

---

## 5. Definition of Done

El milestone se considera completado cuando:

1. El sistema distingue entre datos reales y datos incompletos
2. Ningún KPI muestra valores engañosos
3. El usuario entiende claramente las limitaciones
4. Existe un endpoint de salud de datos
5. Los bloqueos externos están documentados

---

## 6. No Scope

No se incluye:
- Nuevos dashboards
- Nuevas fuentes de datos
- Nuevas métricas de negocio

---

## 7. Riesgos

- Subestimar impacto de datos incompletos
- Ocultar demasiado y perder visibilidad

Mitigación:
- Mostrar warnings en lugar de ocultar completamente

---

## 8. Siguiente paso tras este milestone

Una vez completado este milestone, el orden de prioridad es:

1. **Actualizar workflows GHL** para incluir `assignedTo` y `monetaryValue` (Laura, sin ingeniería) → desbloquea revenue KPIs y desglose por vendedor
2. **Bronze GHL Users** — tabla de usuarios GHL para mapear `assigned_to` ID → nombre real de vendedor
3. **Bronze Holded** — facturas y Daily Ledger (nóminas 640*, SS 642*) → desbloquea comisiones y US4 Finanzas
4. **Bronze MongoDB/Nomool** → desbloquea US3 Operaciones, US7 y US9

Ver condiciones detalladas en `docs/ROADMAP.md`.

---

## 9. Resumen

Este milestone convierte el sistema de:

→ "Dashboard técnico"

En:

→ "Herramienta fiable para decisiones"

Sin este paso, escalar el sistema generará errores de negocio.

