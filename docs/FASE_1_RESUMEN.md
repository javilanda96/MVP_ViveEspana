# FASE 1: RESUMEN EJECUTIVO

## Decisión Técnica Resumida

**Stack confirmado:**
- **Backend**: Node.js + Fastify (moderno, rápido, limpio)
- **Database**: Supabase PostgreSQL (no cambia)
- **Tipos**: TypeScript (strict mode)
- **Build**: TypeScript compiler + tsx para dev
- **Linting**: ESLint + Prettier ready

**Por qué Fastify**: rendimiento nativo, estructura cómoda para crecer, ecosistema sólido, sin over-engineering de Express.

**Por qué raw SQL**: máxima transparencia del schema, alineación directa con Supabase, sin abstracciones innecesarias en MVP.

---

## Árbol de Carpetas

```
pyme-data-integration-mvp/
├── src/
│   ├── index.ts                 # Entrada Fastify (servidor, /health)
│   ├── config.ts                # Validación y centralización de env vars
│   ├── lib/
│   │   └── supabase.ts          # Cliente Supabase + healthcheck
│   ├── types/
│   │   └── models.ts            # Interfaces TS (contacts, payments, etc)
│   ├── routes/                  # (vacío, para webhooks en Fase 2+)
│   └── utils/                   # (vacío, para helpers en Fase 2+)
├── scripts/
│   ├── schema.sql               # Schema completo ejecutable
│   └── setup-db.ts              # Script de setup (informativo en MVP)
├── .eslintrc.json               # ESLint config
├── .env.example                 # Template de variables
├── .gitignore                   # Ignora node_modules, .env, etc
├── package.json                 # Dependencies (mínimas)
├── tsconfig.json                # TypeScript strict
└── README.md                    # Instrucciones de arranque
```

---

## Archivos Principales

### 1. **package.json**
Dependencias mínimas:
- `@supabase/supabase-js`: cliente Supabase
- `fastify`: servidor
- `dotenv`: variables de entorno
- DevDeps: `typescript`, `tsx`, `eslint`, `@typescript-eslint`

Scripts:
- `npm run dev`: servidor en hot reload
- `npm run build`: compilar a dist/
- `npm run db:setup`: script informativo (ver instrucciones en README)
- `npm run lint`: ESLint

### 2. **schema.sql**
**7 bloques organizados:**
1. Extensiones PostgreSQL (uuid, pg_trgm)
2. Tablas core: contacts, payments, invoices, subscriptions
3. Tablas resiliencia: events_log, sync_queue
4. Función `claim_event()`: detecta webhooks duplicados
5. Triggers: auto-update de `updated_at`
6. Comentarios: documentación de tablas
7. Índices: performance en queries frecuentes

**Características:**
- Foreign keys correctas (contacts → payments, invoices)
- Unique constraints: email, external_id, etc
- Índices compuestos para queries de negocio (contact_id + created_at)
- JSONB metadata en todas las tablas (flexibilidad futura)
- Timestamps con timezone
- Función SQL para idempotencia (MVP ready)

### 3. **src/index.ts**
- Servidor Fastify minimalista
- Logger con pino-pretty en dev
- Endpoint `GET /health`: verifica DB
- Error handler centralizado
- Estructura lista para agregar rutas

### 4. **src/lib/supabase.ts**
- Cliente Supabase inicializado con service role
- Función `checkDatabaseConnection()`: para health checks
- Comentario: este cliente lo usará backend futuro (Zapier no lo usa en MVP)

### 5. **src/types/models.ts**
- Interfaces TypeScript para 7 tablas
- Reflejan exactamente el schema SQL
- Sin lógica, solo tipos
- Ready para validaciones Zod en Fase 2+

### 6. **src/config.ts**
- Validación de variables de entorno al startup
- Centraliza toda la configuración
- Fail-fast: si falta var, error inmediato
- Ready para agregar más config futura

### 7. **README.md**
- Instrucciones claras: clone → npm install → .env → schema → npm run dev
- 3 opciones de setup DB (Dashboard, CLI, psql)
- Troubleshooting común
- Tabla de status MVP (qué está listo, qué no)
- Referencia de arquitectura
- Links a documentación externa

---

## Script SQL: Características Clave

### Tabla `events_log` (idempotencia MVP)
```sql
CREATE TABLE events_log (
  ...
  CONSTRAINT events_log_idempotency_unique 
    UNIQUE(webhook_source, external_event_id, event_type)
);
```
**Por qué:** Stripe y GHL reintentan webhooks. Si webhook duplicado llega:
- Intenta insertar
- Viola UNIQUE constraint
- Zapier recibe 200 OK sin duplicar

### Función `claim_event()`
Permite detectar si evento es nuevo o es reintento:
```sql
SELECT claim_event('stripe', 'evt_123', 'payment_intent.succeeded', '{...}')
-- Devuelve: (event_id, is_new BOOLEAN)
```
Ready para backend futuro, no necesaria en MVP (Zapier lo resuelve en DB directa).

### Tabla `sync_queue` (lista pero inactiva)
```sql
CREATE TABLE sync_queue (
  status: 'pending' | 'processing' | 'succeeded' | 'failed'
  ...
);
```
Cuando Zapier inserte pago → puede insertar fila en sync_queue.
Consumidor (cron backend) vendrá en Fase 2+.

---

## Comandos para Arrancar Local

```bash
# 1. Clonar y dependencias
git clone <repo>
cd pyme-data-integration-mvp
npm install

# 2. Variables (edita con tus credenciales Supabase)
cp .env.example .env

# 3. Schema en Supabase Dashboard (recomendado MVP)
# Copia scripts/schema.sql a Dashboard → SQL Editor → Run

# 4. Servidor
npm run dev

# 5. Verificar
curl http://localhost:3000/health
# Respuesta: {"status":"ok","timestamp":"...","environment":"development"}
```

---

## Qué Queda Pendiente Tras Esta Fase

### ✅ Completo en Fase 1
- [x] Estructura profesional de proyecto
- [x] TypeScript strict
- [x] Cliente Supabase listo
- [x] Schema SQL completo (eventos, contactos, pagos, facturas, suscripciones)
- [x] Tipos TypeScript alineados con schema
- [x] Servidor Fastify funcional
- [x] Health check DB
- [x] Validación de env vars
- [x] Idempotencia en schema SQL
- [x] README operativo

### 📋 Fase 2: Integración con Zapier (lógica en Zapier, no backend)
Aunque podría haber endpoints, MVP directo:
- [ ] Documentar formato de webhooks (GHL y Stripe)
- [ ] Zaps en Zapier para: GHL → Supabase (contacts), Stripe → Supabase (payments)
- [ ] Validación en Zapier: campos obligatorios
- [ ] Transformación en Zapier: renombrar campos si es necesario
- [ ] Registrar en events_log desde Zapier (para auditoría)

### 🔄 Fase 3: Validaciones y lógica en backend (opcional)
Si Zapier no es suficiente:
- [ ] Endpoint `POST /webhooks/contacts` (GoHighLevel)
- [ ] Endpoint `POST /webhooks/payments` (Stripe)
- [ ] Validación Zod de payloads
- [ ] Transformación centralizada
- [ ] Escritura en Supabase
- [ ] Tests

### 📊 Fase 4: Sincronización Holded
- [ ] Consumidor de sync_queue (cron)
- [ ] Lógica de creación de facturas en Holded
- [ ] Reintento automático
- [ ] Dead letter queue

### 📈 Fase 5: Monitoreo y escalabilidad
- [ ] Alertas
- [ ] Dashboards
- [ ] Particionamiento de events_log
- [ ] Optimización de índices
- [ ] CI/CD

---

## Notas de Implementación

### Por qué no hay endpoints aún
En MVP, **Zapier escribe directamente a Supabase**:
- Supabase REST API expone todas las tablas
- Zapier puede hacer POST a `https://project.supabase.co/rest/v1/contacts`
- Sin backend latency
- Más simple para demostración

Cuando necesites lógica (validaciones complejas, transformación), entonces:
- Zapier → Backend endpoint → Supabase

### Por qué raw SQL
Schema es definitivo, no va a cambiar semana a semana.
SQL puro es más transparent, más debuggable que Drizzle/Knex.
Si mañana necesitas agregar columna: solo editas schema.sql.

### Por qué Fastify
- ⚡ Rendimiento nativo (es más rápido que Express para este caso)
- 🏗️ Decoradores y plugins limpios
- 📝 Documentación excelente para TypeScript
- 🔌 Ecosistema sólido (validación, auth, CORS, etc)

---

## Configuración por Defecto

| Variable | Default | Producción |
|----------|---------|-----------|
| PORT | 3000 | Variable |
| NODE_ENV | development | production |
| Logging | pretty (colores) | JSON |

Todos validados en startup (config.ts).

---

## Próximo Paso

Confirma:
1. ¿Estructura está bien?
2. ¿Script SQL te parece completo?
3. ¿Listo para pasar a Fase 2 (integración Zapier)?

Si todo ok → puedo darte:
- Guía paso a paso para configurar Zaps en Zapier
- Documentación de formato de webhooks
- O comenzar con Fase 3 (endpoints en backend)