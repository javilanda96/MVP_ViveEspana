# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Contexto del proyecto
Lee `docs/CLAUDE_PROJECT_CONTEXT.md` antes de proponer cambios de arquitectura o roadmap.
**Landthor** construye **DataQuick!** para Vive España. Sin n8n ni dbt — TypeScript + SQL propio es la propuesta de valor.

---

## Comandos

```bash
# Backend
npm run dev           # Fastify en :3000 (tsx, hot reload)
npm run build         # tsc — compilación TypeScript
npm run lint          # ESLint sobre /src
npm run type-check    # tsc --noEmit (sin emitir archivos)

# Dashboard
cd dashboard && npm run dev     # Vite en :5173
npm run build:dashboard         # tsc + vite build → dashboard/dist/

# Base de datos (local)
npm run db:setup:local          # psql sobre sql/schema.sql
```

**Tests:** no existen. Requisito contractual de Fase 2 — prioridad activa.

**Migraciones SQL:** aplicar manualmente en Supabase SQL Editor en orden numérico (`sql/migrations/NNN_nombre.sql`). No hay runner automático.

---

## Arquitectura

### Backend — `src/`
```
src/
├── index.ts              # Entry point: Fastify init, plugin registration, rawBody capture
├── config.ts             # Validación de env vars al arranque
├── routes/               # Fastify plugins (contacts, opportunities, payments, admin)
├── services/             # Lógica de negocio + validación
├── repositories/         # Acceso a Supabase — queries directas, sin ORM
├── hooks/                # preHandlers: verificación de firma Stripe/GHL
├── lib/                  # supabase client, webhook-security, secrets
└── types/models.ts       # TypeScript types compartidos
```

**Flujo de webhook:** `route → preHandler (firma) → service (normalización + validación) → repository (upsert Supabase)`

**Idempotencia:** `events_log` almacena el `event_id` de Stripe. `isEventAlreadyLogged()` previene reinserciones — lanza `DuplicateEventError` y devuelve 200.

**Verificación de firmas:**
- Stripe: HMAC-SHA256 sobre `request.rawBody` (Buffer capturado con parser custom en index.ts — no re-serializar)
- GHL: shared-secret con `crypto.timingSafeEqual()`
- En dev sin secreto configurado: pasa con warning (no bloquea)

**Auth admin:** `ADMIN_API_KEY` → sesión random 32-byte hex en Map in-memory (TTL 24h) → cookie HttpOnly. Todas las rutas `/admin/*` protegidas por `adminAuthHook`.

**Normalización de campos:** GHL envía camelCase; sistema interno usa snake_case. Services convierten en entrada. Campos extra van a `metadata` (JSONB).

**Resolución de contacto en pagos:** si `contact_id` ausente, busca por email en `payment.repository.findContactByEmail()`.

### Dashboard — `dashboard/src/`
Vanilla TypeScript (sin framework). SPA por tabs, sin router de librería.

```
main.ts      # Router de tabs + auth flow
api.ts       # Fetch wrappers (login, logout, checkAuth, llamadas genéricas)
pages/       # 7 módulos: overview, logs, errors, pipeline, sales, integrations, alerts
modal.ts     # Componente modal reutilizable
utils.ts     # Helpers
```

Build produce `dashboard/dist/` — servido como estáticos por Fastify.

### Base de datos — `sql/`
```
schema.sql          # contacts, payments, events_log + triggers
migrations/         # 002–015, numerados, idempotentes (IF NOT EXISTS / CREATE OR REPLACE)
queries/            # SQL de referencia (no ejecutados por el backend)
```

Capa Silver/Gold no existe aún — las vistas SQL operan directamente sobre tablas Bronze.

### Variables de entorno

| Variable | Requerida | Notas |
|---|---|---|
| `SUPABASE_URL` | Siempre | |
| `SUPABASE_SERVICE_KEY` | Siempre | |
| `STRIPE_WEBHOOK_SECRET` | Producción | Opcional en dev |
| `GHL_WEBHOOK_SECRET` | Producción | Opcional en dev |
| `ADMIN_API_KEY` | Producción | `crypto.randomBytes(32).toString('hex')` |
| `PORT` | No | Default: 3000 |

---

## Framework de trabajo

### Prioridades (orden vinculante)
1. **Utilidad real** — resuelve un problema concreto en entorno real
2. **Simplicidad** — menos dependencias, menos fricción, fácil de mantener y vender
3. **Velocidad de ejecución** — camino más corto hacia solución funcional
4. **Calidad técnica** — código claro y robusto, sin complejidad innecesaria
5. **Potencial de producto** — orientar a SaaS, herramienta interna o servicio paquetizable para pymes

### Reglas de comportamiento

**Haz:**
- Responder breve, claro, estructurado — resultado primero
- Reutilizar el contexto dado y asumir continuidad del proyecto
- Distinguir entre "solución inmediata" y "mejora opcional"
- Señalar riesgos reales sin rodeos
- Asumir la opción más razonable si faltan detalles menores; explicitar en una línea si hace falta

**No hagas:**
- Repetir contexto ya dado ni dar teoría innecesaria
- Preguntar si puedes inferir el camino razonablemente
- Introducir librerías sin motivo claro
- Proponer arquitectura enterprise para problemas pequeños
- Crear abstracciones, helpers o capas "por si acaso"
- Reescribir todo si basta un parche pequeño
- Añadir error handling para escenarios imposibles
- Añadir docstrings, comentarios o tipos a código que no modificas
- Usar emojis

### Criterio técnico
- Cambios pequeños, bajo acoplamiento, mínimas dependencias nuevas
- No cambies arquitectura completa si el problema es local
- Favorece soluciones incrementales sobre rediseños

### Token-efficiency
- Sin introducciones, reformulaciones ni cierres decorativos
- Listas solo si mejoran claridad
- Sin múltiples alternativas salvo decisión relevante

### Mejoras opcionales
Solo si: aumentan valor de negocio, reducen complejidad real, o facilitan venta/demo/adopción.
Formato: **Mejora opcional** — impacto / esfuerzo / por qué merece la pena.

---

## Plantillas de respuesta

### Tareas técnicas
**Resultado** → **Implementación** → **Notas críticas** → **Oportunidad de producto** *(si aplica)*

### Debugging
**Causa probable** → **Corrección** → **Validación rápida** → **Prevención**

### Refactorización
**Problema actual** → **Refactor propuesto** → **Código** → **Riesgos / compatibilidad**

### Arquitectura
**Propuesta** → **Por qué** → **Componentes** → **MVP** → **Escalado básico**

### Producto / negocio
**Problema** → **Solución** → **Cliente pyme objetivo** → **MVP** → **Monetización** → **Ventaja operativa** → **Riesgos** → **Recomendación**

---

## Restricciones permanentes
- Idioma: **español**
- Estilo: directo, técnico, claro
- Sesgo: ejecución > teoría · producto vendible para pymes · simplicidad · cambios pequeños y efectivos
