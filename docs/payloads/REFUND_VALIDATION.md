# Validación de refunds — pendiente antes de implementar

## Por qué esto está pendiente

El sistema acepta `status: "refunded"` pero no tiene lógica diferenciada para refunds.
El comportamiento actual depende de un dato que **no está documentado en el repositorio**:
qué valor contiene `external_id` cuando el proveedor (Stripe/Flywire) comunica un refund.

Hay dos hipótesis. La que aplique determina qué debe implementarse.

---

## Hipótesis A — `external_id` = ID del PaymentIntent original (`pi_xxx`)

**Archivo de ejemplo:** `payment-refund-option-a.json`

```json
{
  "external_id": "pi_3OxKL2Stripe12345",   ← mismo que el pago original
  "status": "refunded",
  ...
}
```

**Comportamiento actual del sistema con este payload:**

El pago con `external_id = pi_3OxKL2Stripe12345` ya existe en la tabla `payments`.
`insertPayment()` falla con error 23505 (unique constraint), devuelve `null`,
`processPayment()` lanza `DuplicatePaymentError`, el endpoint responde `200 ok`
y **no se persiste nada** — ni en `payments` ni en `events_log`.

**El refund es silenciosamente descartado.**

**Implicación para implementación:** Se necesita una rama de actualización (`UPDATE payments SET status='refunded'`) en lugar de inserción.

---

## Hipótesis B — `external_id` = ID del Refund de Stripe (`re_xxx`)

**Archivo de ejemplo:** `payment-refund-option-b.json`

```json
{
  "external_id": "re_3OxRefundStripe001",   ← ID propio del refund
  "status": "refunded",
  ...
}
```

**Comportamiento actual del sistema con este payload:**

`re_xxx` no existe en `payments` → inserción exitosa → nuevo registro con `status = 'refunded'`.
Se registra en `events_log` con `event_type = 'payment.created'` (semánticamente incorrecto).
El registro original con `status = 'succeeded'` permanece sin cambios.

**El refund se persiste como una fila nueva, sin vínculo con el pago original.**

**Implicación para implementación:** El sistema no silencia el refund, pero la semántica es incorrecta y `totalPaymentsAmount` (que suma todos los `succeeded`) sobrecontabiliza ingresos porque el pago original no cambia de estado.

---

## Pregunta a responder antes de implementar

> Cuando Stripe emite un `charge.refunded` y el sistema lo transforma en un payload
> para `/webhooks/payments`, ¿qué valor lleva el campo `external_id`?
>
> — ¿El `PaymentIntent.id` original (`pi_xxx`)? → **Hipótesis A**
> — ¿El `Refund.id` del objeto refund (`re_xxx`)? → **Hipótesis B**

Para responder esta pregunta, basta con revisar un webhook real de Stripe CLI o
el Stripe Dashboard → Webhooks → un evento `charge.refunded` reciente, e identificar
qué campo se usa para poblar `external_id` al construir el payload normalizado.

---

## Estado

- [ ] ViveEspaña ha revisado un evento `charge.refunded` real en Stripe
- [ ] Se ha confirmado cuál es el `external_id` que llega al sistema
- [ ] Se ha elegido hipótesis A o B para proceder con implementación
