# Demo Flow – pyme-data-integration-mvp

Guía para demostrar el MVP a un tercero sin acceso a los sistemas reales del cliente.
Cubre los endpoints disponibles, los flujos de datos, y cómo verificar cada resultado.

---

## Stack y entorno

| Pieza       | Detalle                          |
|-------------|----------------------------------|
| Runtime     | Node.js + TypeScript (tsx)       |
| Framework   | Fastify v4                       |
| Base de datos | Supabase (PostgreSQL)          |
| Exposición  | ngrok (para pruebas externas)    |

Arrancar el servidor:
```bash
npm run dev
```

El servidor escucha en `http://localhost:3000`.

---

## Endpoints disponibles

### Webhooks (ingesta de datos)

| Método | Ruta                       | Descripción                                              |
|--------|----------------------------|----------------------------------------------------------|
| GET    | /health                    | Verifica que el servidor y Supabase están vivos          |
| POST   | /webhooks/contacts         | Recibe y guarda contactos (GHL o manual)                 |
| POST   | /webhooks/payments         | Recibe y guarda pagos (Stripe o manual)                  |
| POST   | /webhooks/opportunities    | Recibe cambios de etapa y estado de oportunidades (GHL)  |

### Panel de administración (requiere sesión)

El panel de operaciones está disponible en `/dashboard/`. Para acceder, es necesario iniciar sesión con `ADMIN_API_KEY` en la pantalla de login. El panel tiene seis secciones:

| Sección         | Descripción                                                                   |
|-----------------|-------------------------------------------------------------------------------|
| Resumen         | KPIs de actividad del sistema: eventos, errores, alertas, pagos cobrados      |
| Actividad       | Log completo de eventos con filtros por fuente, estado, tipo y fecha          |
| Incidencias     | Vista filtrada de eventos fallidos con agrupación por tipo                    |
| Pipeline        | Estado actual de oportunidades GHL con filtros por estado y pipeline          |
| Integraciones   | Gestión de conexiones activas (crear, editar, ver estado por endpoint)        |
| Alertas         | Alertas operativas de cobros (importes anómalos, divisas inesperadas)         |

Para acceder a los endpoints del panel directamente vía API, usar la cookie de sesión obtenida en `POST /admin/login`.

---

## Tablas que toca cada flujo

| Flujo                        | Tablas escritas                                              |
|------------------------------|--------------------------------------------------------------|
| POST /webhooks/contacts      | `contacts`, `events_log`                                     |
| POST /webhooks/payments      | `payments`, `events_log`, `payment_alerts`                   |
| POST /webhooks/opportunities | `opportunities`, `opportunity_stage_history`, `events_log`   |
| GET /health                  | `contacts` (solo lectura, 1 fila)                            |

---

## Flujo 1 – Health check

### Request
```bash
curl http://localhost:3000/health
```

### Respuesta esperada
```json
{
  "status": "ok",
  "timestamp": "2026-03-13T10:00:00.000Z",
  "environment": "development"
}
```

Si `status` es `"db_error"`, la conexión con Supabase ha fallado. Verificar `.env`.

---

## Flujo 2 – Crear / actualizar contacto

### Descripción
- Recibe un payload con datos de contacto.
- Hace upsert en `contacts` (conflict en `email` si hay email, o en `phone` si solo hay teléfono).
- Registra el evento en `events_log`.
- Acepta tanto el formato interno (snake_case) como el formato nativo de GoHighLevel (camelCase).

### Campos aceptados

| Campo         | Tipo     | Obligatorio       | Descripción                         |
|---------------|----------|-------------------|-------------------------------------|
| email         | string   | sí (o phone)      | Email del contacto                  |
| phone         | string   | sí (o email)      | Teléfono del contacto               |
| first_name    | string   | no                | Nombre (formato interno)            |
| last_name     | string   | no                | Apellido (formato interno)          |
| firstName     | string   | no                | Nombre (formato GHL)                |
| lastName      | string   | no                | Apellido (formato GHL)              |
| name          | string   | no                | Nombre completo (se hace splitting) |
| external_id   | string   | no                | ID en el sistema de origen          |
| id            | string   | no                | ID de contacto en GHL               |
| source        | string   | no                | "ghl" / "stripe" / "manual"         |
| metadata      | object   | no                | Datos adicionales libres            |

### Ejemplo A – Payload tipo GoHighLevel
```bash
curl -X POST http://localhost:3000/webhooks/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "id": "ghl_contact_abc123",
    "email": "maria.garcia@ejemplo.com",
    "phone": "+34612345678",
    "firstName": "Maria",
    "lastName": "Garcia",
    "source": "ghl"
  }'
```

### Ejemplo B – Payload manual (snake_case)
```bash
curl -X POST http://localhost:3000/webhooks/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "email": "carlos.lopez@empresa.es",
    "phone": "+34699111222",
    "first_name": "Carlos",
    "last_name": "Lopez",
    "external_id": "manual_001",
    "source": "manual",
    "metadata": { "tag": "demo" }
  }'
```

### Respuesta esperada (200)
```json
{ "status": "ok" }
```

### Error esperado (400 – sin identificador)
```bash
curl -X POST http://localhost:3000/webhooks/contacts \
  -H "Content-Type: application/json" \
  -d '{ "first_name": "Sin", "last_name": "Email" }'
```
```json
{ "error": "Payload must include at least one of: email, phone" }
```

### Verificar en Supabase
1. Ir a **Table Editor → contacts**
2. Buscar por email o external_id
3. Verificar que `source`, `first_name`, `last_name` están correctos

También verificar en **Table Editor → events_log**:
- `event_type` = `"contact.upsert"`
- `status` = `"processed"`
- `webhook_source` = `"ghl"` o `"manual"`

---

## Flujo 3 – Registrar un pago

### Descripción
- Recibe un payload de pago.
- Si solo llega `contact_email` (sin `contact_id`), busca el contacto en `contacts`.
- Si el contacto no existe, devuelve 400 con mensaje claro.
- Inserta el pago en `payments`.
- Registra el evento en `events_log`.

### Campos aceptados

| Campo          | Tipo     | Obligatorio            | Descripción                                  |
|----------------|----------|------------------------|----------------------------------------------|
| external_id    | string   | sí                     | ID del pago en Stripe / Flywire              |
| contact_id     | string   | sí (o contact_email)   | UUID del contacto en nuestra BD              |
| contact_email  | string   | sí (o contact_id)      | Email para lookup automático del contacto    |
| amount         | number   | sí                     | Importe en centavos (ej: 9900 = 99,00 EUR)   |
| currency       | string   | sí                     | Código ISO 4217: "EUR", "USD"                |
| status         | string   | sí                     | pending / succeeded / failed / refunded      |
| provider       | string   | sí                     | "stripe" / "flywire"                         |
| invoice_id     | string   | no                     | UUID de la factura relacionada               |
| metadata       | object   | no                     | Datos adicionales libres                     |

### Ejemplo A – Pago exitoso (lookup por email)
```bash
curl -X POST http://localhost:3000/webhooks/payments \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "pi_3OxKL2Stripe12345",
    "contact_email": "maria.garcia@ejemplo.com",
    "amount": 9900,
    "currency": "EUR",
    "status": "succeeded",
    "provider": "stripe",
    "metadata": {
      "description": "Pago mensual plan básico"
    }
  }'
```

### Ejemplo B – Pago con contact_id directo
```bash
curl -X POST http://localhost:3000/webhooks/payments \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "pi_3OxKL2Stripe67890",
    "contact_id": "<UUID_DEL_CONTACTO>",
    "amount": 4900,
    "currency": "EUR",
    "status": "succeeded",
    "provider": "stripe"
  }'
```

### Ejemplo C – Pago fallido (contacto inexistente → error 400)

Este caso es útil para demostrar que el sistema detecta inconsistencias:

```bash
curl -X POST http://localhost:3000/webhooks/payments \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "pi_3OxKL2Stripe99999",
    "contact_email": "contacto.inexistente@ejemplo.com",
    "amount": 4900,
    "currency": "EUR",
    "status": "failed",
    "provider": "stripe"
  }'
```
```json
{ "error": "No contact found with email: contacto.inexistente@ejemplo.com" }
```

### Respuesta esperada (200)
```json
{ "status": "ok" }
```

### Verificar en Supabase
1. Ir a **Table Editor → payments**
2. Verificar `external_id`, `contact_id`, `amount`, `currency`, `status`, `provider`
3. Ir a **Table Editor → events_log**
4. Verificar `event_type` = `"payment.created"`, `status` = `"processed"`

---

## Flujo 4 – Demo completo end-to-end

Secuencia de 3 pasos para demostrar el MVP completo a un tercero:

### Paso 1: Verificar que el sistema está vivo
```bash
curl http://localhost:3000/health
```
Resultado esperado: `{ "status": "ok", ... }`

### Paso 2: Crear un contacto
```bash
curl -X POST http://localhost:3000/webhooks/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@empresa.com",
    "first_name": "Demo",
    "last_name": "Cliente",
    "source": "manual"
  }'
```
Resultado esperado: `{ "status": "ok" }`
→ Mostrar en Supabase: nueva fila en `contacts` + evento en `events_log`.

### Paso 3: Registrar un pago para ese contacto
```bash
curl -X POST http://localhost:3000/webhooks/payments \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "demo_payment_001",
    "contact_email": "demo@empresa.com",
    "amount": 9900,
    "currency": "EUR",
    "status": "succeeded",
    "provider": "stripe"
  }'
```
Resultado esperado: `{ "status": "ok" }`
→ Mostrar en Supabase: nueva fila en `payments` + nuevo evento en `events_log`.

### Lo que demuestra este flujo
- El backend recibe eventos externos (contactos, pagos).
- Los datos se guardan correctamente en tablas relacionadas.
- El sistema tiene trazabilidad completa: cada operación queda registrada en `events_log`.
- El sistema detecta errores y los comunica con mensajes claros.
- La arquitectura está preparada para conectar GoHighLevel (contactos) y Stripe (pagos) cuando estén disponibles — el endpoint ya existe y acepta el formato nativo de cada plataforma.

---

## Notas de integración real

### GoHighLevel
- Configurar webhook en: **Settings → Integrations → Webhooks**
- URL: `https://<tu-dominio>/webhooks/contacts`
- Método: POST
- Eventos: Contact Created, Contact Updated
- El endpoint ya acepta el formato nativo de GHL (`firstName`, `lastName`, `id`).

### Stripe
- Configurar webhook en: **Developers → Webhooks**
- URL: `https://<tu-dominio>/webhooks/payments`
- Método: POST
- Eventos: `payment_intent.succeeded`, `payment_intent.payment_failed`
- El endpoint ya acepta `external_id` (= `payment_intent.id`), `amount`, `currency`, `status`.

### ngrok (para pruebas locales con webhooks reales)
```bash
ngrok http 3000
```
Usar la URL HTTPS que genera ngrok como destino en GHL o Stripe.

---

## Estructura de archivos relevantes

```
src/
  index.ts                        # Arranque del servidor, registro de rutas
  routes/
    contacts.ts                   # POST /webhooks/contacts
    payments.ts                   # POST /webhooks/payments
  services/
    contact.service.ts            # Lógica de negocio: contactos
    payment.service.ts            # Lógica de negocio: pagos
  repositories/
    contact.repository.ts         # Upsert de contactos en Supabase
    payment.repository.ts         # Insert de pagos + lookup por email
    event.repository.ts           # Insert en events_log (no-throw)
  types/
    models.ts                     # Interfaces: Contact, Payment, EventLog...
  lib/
    supabase.ts                   # Cliente Supabase

docs/
  demo-flow.md                    # Este archivo
  payloads/
    contact-ghl.json              # Payload de ejemplo – contacto GHL
    contact-manual.json           # Payload de ejemplo – contacto manual
    payment-stripe.json           # Payload de ejemplo – pago Stripe exitoso
    payment-failed.json           # Payload de ejemplo – pago con contacto inexistente

sql/
  schema.sql                      # Schema completo de la base de datos
```
