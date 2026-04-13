# PROJECT_CORE — Landthor
# Versión comprimida para pegar como contexto en agentes

## Identidad del proyecto
- **Landthor** = el producto que estamos desarrollando. Motor de integración de datos. IP de Aitor Artieda.
- **DataQuick!** = nombre que el cliente (Vive España) ha dado a su implementación de Landthor. No es el nombre del motor.
- **Vive España** = cliente. Academia de estudiantes internacionales.

## Stack
Fastify + TypeScript + Supabase (PostgreSQL) + Vite dashboard
Arquitectura: routes → services → repositories
Sin n8n, sin dbt — decisión deliberada

## Tablas Bronze existentes
- bronze_ghl_contacts (contactos GHL — activo)
- bronze_ghl_opportunities (oportunidades — assignedTo y monetaryValue NULOS)
- bronze_ghl_stage_history (historial etapas — parcial)
- bronze_stripe_payments (pagos — activo)
- bronze_ghl_users — ❌ PENDIENTE (~4h)
- bronze_holded_invoices — ❌ PENDIENTE (bloquea comisiones)
- bronze_mongodb_cases — ❌ PENDIENTE (bloquea operaciones)

## Campos bloqueados en producción
- assigned_to: 100% nulo. GHL no envía en webhooks. Responsable: Laura (workflows 05ba98de, d0845369)
- monetary_value: ~75% nulo. Misma causa.
- customFields contactos: no ha disparado en payloads reales

## Reglas de negocio críticas
- identity_key = COALESCE(lower(trim(email)), phone, contact_id)
- qualified_flag = funding_source IN ('parents pay', 'own resources')
- nueva_venta = sin pago previo en Stripe / cross_sell = pago previo existe
- Comisión vendedor: 12% si ventas_mes > 8.500€, base imputable: 100% nueva / 66% upsell / 33% cross

## Hitos activos
- Hito 1 (~17 abril): 600€ — doc diseño técnico, sign-off Marcos
- Hito 4 (~mediados mayo): 2.400€ — pipeline Bronze→Gold + 8h integration tests
- Cierre (~junio): 1.200€ — dashboards + formación

## Convenciones
- Migraciones: sql/migrations/NNN_nombre.sql (aplicar en orden en Supabase SQL Editor)
- Tests: *.test.ts junto al archivo. Vitest + supertest.
- 0 tests existentes — URGENTE para Hito 4
