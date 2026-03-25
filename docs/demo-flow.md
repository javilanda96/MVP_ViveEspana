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

El panel está disponible en `/dashboard/`. Para acceder, iniciar sesión con `ADMIN_API_KEY`. El panel tiene siete secciones:

| Sección         | Descripción                                                                                      |
|-----------------|--------------------------------------------------------------------------------------------------|
| Resumen         | KPIs de actividad del sistema: eventos, errores, alertas, pagos cobrados                         |
| Actividad       | Log completo de eventos con filtros por fuente, estado, tipo y fecha                             |
| Incidencias     | Vista filtrada de eventos fallidos con agrupación por tipo                                       |
| Pipeline        | Estado actual de oportunidades GHL con filtros por estado y pipeline                             |
| Integraciones   | Gestión de conexiones activas (crear, editar, ver estado por endpoint)                           |
| Alertas         | Alertas operativas de cobros (importes anómalos, divisas inesperadas)                            |
| **Ventas**      | Funnel por etapas en orden CRM, conversión etapa a etapa, KPIs globales, clasificación de deals  |

### Endpoints de analítica de ventas (requieren sesión)

| Método | Ruta                      | Descripción                                                                 |
|--------|---------------------------|-----------------------------------------------------------------------------|
| GET    | /admin/sales/funnel       | KPIs globales + etapas del funnel. Acepta `?from=YYYY-MM-DD&to=YYYY-MM-DD` |
| GET    | /admin/sales/deals        | Tabla de operaciones. Acepta `?status=`, `?pipeline_name=`, `?from=`, `?to=` |

---

## Tablas que toca cada flujo

| Flujo                        | Tablas escritas                                              |
|------------------------------|--------------------------------------------------------------|
| POST /webhooks/contacts      | `contacts`, `events_log`                                     |
| POST /webhooks/payments      | `payments`, `events_log`, `payment_alerts`                   |
| POST /webhooks/opportunities | `opportunities`, `opportunity_stage_history`, `events_log`   |
| GET /health                  | `contacts` (solo lectura, 1 fila)                            |
| GET /admin/sales/funnel      | `pipeline_stages`, `opportunities` (solo lectura, vía RPC)  |
| GET /admin/sales/deals       | `sales_deals_outcomes` (solo lectura, vista)                 |

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
  "timestamp": "2026-03-25T10:00:00.000Z",
  "environment": "development"
}
```

Si `status` es `"db_error"`, la conexión con Supabase ha fallado. Verificar `.env`.

---

## Flujo 2 – Crear / actualizar contacto

### Descripción
- Recibe un payload con datos de contacto.
- Hace upsert en `contacts` (conflict en `email` si hay email, o en `phone` si solo hay teléfono).
- Persiste `customFields` de GHL en `contacts.metadata` si están presentes.
- Registra el evento en `events_log`.
- Acepta tanto el formato interno (snake_case) como el formato nativo de GoHighLevel (camelCase).

### Campos aceptados

| Campo         | Tipo     | Obligatorio       | Descripción                                        |
|---------------|----------|-------------------|----------------------------------------------------|
| email         | string   | sí (o phone)      | Email del contacto                                 |
| phone         | string   | sí (o email)      | Teléfono del contacto                              |
| first_name    | string   | no                | Nombre (formato interno)                           |
| last_name     | string   | no                | Apellido (formato interno)                         |
| firstName     | string   | no                | Nombre (formato GHL)                               |
| lastName      | string   | no                | Apellido (formato GHL)                             |
| name          | string   | no                | Nombre completo (se hace splitting)                |
| external_id   | string   | no                | ID en el sistema de origen                         |
| id            | string   | no                | ID de contacto en GHL                              |
| source        | string   | no                | "ghl" / "stripe" / "manual"                        |
| metadata      | object   | no                | Datos adicionales libres                           |
| customFields  | array    | no                | Campos personalizados GHL `[{id, field_value}]`    |

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
    "source": "ghl",
    "customFields": [
      { "id": "cuali_field_id", "field_value": "cuali" }
    ]
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
4. Si se envió `customFields`, verificar que `metadata->customFields` contiene el array

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

### Respuesta esperada (200)
```json
{ "status": "ok" }
```

### Error esperado (400 – contacto inexistente)
```bash
curl -X POST http://localhost:3000/webhooks/payments \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "pi_test_99999",
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

---

## Flujo 4 – Consultar el funnel de ventas

### Descripción
- Devuelve KPIs globales + etapas del funnel en orden CRM.
- Incluye `pct_to_next` (conversión a la siguiente etapa) en cada fila.
- Acepta filtrado por periodo.

### Sin filtro de periodo
```bash
curl -b admin_cookie.txt http://localhost:3000/admin/sales/funnel
```

### Con filtro de periodo
```bash
curl -b admin_cookie.txt \
  "http://localhost:3000/admin/sales/funnel?from=2026-03-01&to=2026-03-31"
```

### Respuesta esperada
```json
{
  "kpis": {
    "total_leads": 4,
    "total_open": 4,
    "total_won": 0,
    "total_lost": 0,
    "value_pipeline_active": 0,
    "value_won_total": 0,
    "conversion_pct": 0,
    "avg_deal_value_won": null
  },
  "stages": [
    {
      "pipeline_name": "Sales",
      "stage_name": "New Lead",
      "display_order": 1,
      "count_open": 1,
      "count_won": 0,
      "count_lost": 0,
      "count_total": 1,
      "pct_to_next": 0
    },
    {
      "pipeline_name": "Sales",
      "stage_name": "Contacted",
      "display_order": 2,
      "count_open": 0,
      "count_total": 0,
      "pct_to_next": null
    }
  ]
}
```

> Nota: las etapas sin oportunidades aparecen con `count=0` (no se omiten). `pct_to_next=null` en la última etapa y cuando la etapa actual tiene `count_open=0`.

---

## Flujo 5 – Demo completo end-to-end

Secuencia para demostrar el sistema completo a un tercero:

### Paso 1: Verificar que el sistema está vivo
```bash
curl http://localhost:3000/health
```

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
→ Mostrar en Supabase: nueva fila en `payments` + nuevo evento en `events_log`.

### Paso 4: Ver el funnel de ventas en el dashboard
- Abrir `/dashboard/` en el navegador
- Hacer login con `ADMIN_API_KEY`
- Ir al tab **Ventas**
- Mostrar el funnel por etapas, el selector de periodo y la tabla de operaciones

---

## Notas de integración real

### GoHighLevel
- Configurar webhook en: **Settings → Workflows → [workflow] → Webhook action**
- URL oportunidades: `https://<tu-dominio>/webhooks/opportunities`
- URL contactos: `https://<tu-dominio>/webhooks/contacts`
- ⚠️ Los workflows actuales no envían `assignedTo` ni `monetaryValue` — ver `docs/MILESTONE_SALES_MVP_CLOSURE.md` para instrucciones de desbloqueo.

### Stripe
- Configurar webhook en: **Developers → Webhooks**
- URL: `https://<tu-dominio>/webhooks/payments`
- Eventos: `payment_intent.succeeded`, `payment_intent.payment_failed`

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
    opportunities.ts              # POST /webhooks/opportunities
    admin.ts                      # GET /admin/sales/funnel, GET /admin/sales/deals, ...
  services/
    contact.service.ts            # Lógica de contactos (incluye buildContactMetadata)
    opportunity.service.ts        # Lógica de oportunidades, win_rank, idempotencia
    payment.service.ts            # Lógica de pagos
  repositories/
    admin.repository.ts           # getSalesFunnel(), getSalesDeals()
    contact.repository.ts         # Upsert de contactos
    opportunity.repository.ts     # Upsert de oportunidades + stage history
    event.repository.ts           # Insert en events_log (no-throw)

dashboard/src/
  pages/sales.ts                  # Tab Ventas: funnel, KPIs, tabla de deals, selector de periodo
  api.ts                          # getSalesFunnel(), getSalesDeals()

sql/migrations/
  009–011                         # Vistas sales_funnel_basic, sales_deals_outcomes, sales_kpis_basic
  012                             # Funciones RPC sales_funnel_with_period, sales_kpis_with_period
  013–014                         # pipeline_stages + ordenación por display_order
  015                             # pct_to_next con etapas vacías incluidas

docs/
  demo-flow.md                    # Este archivo
  MILESTONE_SALES_MVP_CLOSURE.md  # Estado final del milestone y condiciones de desbloqueo
  payloads/                       # Payloads de ejemplo para tests manuales
```
