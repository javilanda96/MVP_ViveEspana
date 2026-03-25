# Punto de situación del proyecto
### Sistema middleware de integración de datos — MVP

**Fecha:** Marzo 2026
**Destinatarios:** Equipo interno · Responsables de negocio · Cliente
**Estado del proyecto:** Sales MVP completado y validado

---

## 1. Introducción

Este proyecto — **DataQuick!** — es la infraestructura de datos centralizada de Vive España. Su objetivo es conectar todas las herramientas del negocio (GHL, Stripe, Holded, MongoDB/Nomool), normalizar los datos y producir dashboards y KPIs para cuatro departamentos: **Ventas, Marketing, Operaciones y Finanzas**.

El problema de partida era claro: las herramientas utilizadas funcionaban de forma aislada. La información generada en cada una no se comunicaba con las demás, lo que obligaba a cálculos manuales en hojas de cálculo, generaba duplicidades y dificultaba tener una visión fiable del negocio.

El sistema actúa como **intermediario inteligente** entre esas herramientas. Recibe automáticamente los eventos de cada plataforma, los normaliza y los almacena de forma centralizada. El equipo puede consultar la información desde un único punto y tomar decisiones basadas en datos reales, no en Sheets.

**Estado actual:** El módulo de Ventas está operativo (primer departamento, según priorización del cliente). Los módulos de Marketing, Operaciones y Finanzas están en la hoja de ruta pero aún no construidos.

---

## 2. Qué hace el sistema

El sistema realiza cuatro funciones principales:

### Recepción automática de eventos
Cada vez que ocurre algo relevante en una de las plataformas conectadas —se crea un contacto, se actualiza una oportunidad comercial, se completa un pago— esa plataforma envía una notificación automática al sistema. Esta notificación se denomina **webhook**.

### Normalización de datos
Los datos que llegan de distintas plataformas no tienen siempre el mismo formato. El sistema los traduce a un formato unificado antes de almacenarlos, garantizando coherencia independientemente de la fuente de origen.

### Almacenamiento centralizado
Toda la información procesada queda guardada en una base de datos estructurada. Esto permite consultarla, filtrarla y analizarla en cualquier momento, y sirve como registro de auditoría de todo lo que ha ocurrido en el sistema.

### Visibilidad del negocio
Los datos almacenados alimentan directamente el panel de operaciones interno. Incluye monitorización técnica (contactos, pagos, incidencias) y analítica de ventas: funnel por etapas, tasa de conversión entre etapas, clasificación de operaciones (nueva venta / cross-sell) y filtrado por periodo.

---

## 3. Arquitectura general

El sistema está compuesto por los siguientes componentes:

- **Backend (Fastify / Node.js):** El núcleo del sistema. Recibe los webhooks entrantes, aplica las reglas de negocio, verifica la seguridad de las peticiones y coordina el flujo de datos. Está diseñado para ser eficiente, robusto y fácilmente ampliable.

- **Base de datos (Supabase / PostgreSQL):** Almacena de forma estructurada toda la información procesada: contactos, oportunidades, pagos y el registro completo de eventos. Supabase ofrece además capacidades de consulta avanzadas mediante vistas SQL precalculadas.

- **Integraciones externas:** El sistema se conecta actualmente con dos plataformas mediante webhooks. Cada integración tiene su propio mecanismo de autenticación y verificación de seguridad para garantizar que solo se procesan peticiones legítimas.

- **Panel de operaciones interno:** Una interfaz web accesible en `/dashboard`, de uso exclusivo del equipo interno, que permite visualizar la actividad del sistema, revisar registros, detectar errores y consultar el estado del pipeline comercial.

---

## 4. Integraciones y fuentes de datos

### Fuentes previstas en el roadmap completo

| Fuente | Qué aporta | Estado |
|---|---|---|
| GoHighLevel (CRM) | Leads, pipeline, etapas, cualificación, UTMs | ✅ Activo (parcial — faltan UTMs, customFields, assignedTo) |
| Stripe | Pagos, suscripciones, refunds | ✅ Activo |
| Holded | Facturas, nóminas, contabilidad, comisiones | ❌ No conectado |
| MongoDB / Nomool | Expedientes y eventos de estudiantes (Operaciones) | ❌ No conectado |
| Google Sheets | Catálogo de productos, pesos bundle, tabla influencers | ❌ No conectado |

### Integraciones actuales

### GoHighLevel (CRM)

GoHighLevel es la plataforma CRM utilizada para la gestión de contactos y oportunidades comerciales. El sistema procesa los siguientes tipos de eventos provenientes de esta herramienta:

- **Contactos:** creación y actualización de registros de contacto (nombre, email, teléfono).
- **Oportunidades:** creación, actualización y cambio de fase dentro del pipeline comercial. Se registra el nombre de la oportunidad, el valor económico, la fase en la que se encuentra y el estado (abierta, ganada, perdida, abandonada).

Dado que GoHighLevel puede enviar identificadores internos propios que no son compatibles directamente con la base de datos, el sistema incluye lógica de normalización para resolver esta situación de forma automática (por ejemplo, buscando el contacto por su dirección de email cuando el identificador no es válido).

### Stripe (Pagos)

Stripe es la plataforma de procesamiento de pagos. El sistema recibe y almacena los eventos de pago completados, incluyendo el importe, la moneda y el estado del cobro.

La integración con Stripe incluye verificación criptográfica de cada petición entrante mediante firma HMAC, lo que garantiza que los eventos procesados provienen exclusivamente de Stripe y no de terceros no autorizados.

---

## 5. Panel de operaciones

El panel de operaciones es una herramienta interna de solo lectura, accesible mediante clave de administrador. Está diseñado para que el equipo pueda supervisar el funcionamiento del sistema sin necesidad de acceder directamente a la base de datos.

El panel se compone de cinco secciones:

### Resumen
Vista general de la actividad reciente. Muestra el número de eventos procesados en las últimas 24 horas, los fallos detectados, la tasa de error, el número de oportunidades abiertas y el total de pagos cobrados. Es la primera pantalla que se ve al acceder y permite detectar de un vistazo si hay algo inusual.

### Registros
Listado completo de todos los eventos que han sido recibidos y procesados por el sistema. Permite filtrar por origen (GHL o Stripe), por estado (procesado, fallido, recibido), por tipo de evento, por identificador externo y por rango de fechas. Al hacer clic en cualquier evento, se puede ver su detalle completo, incluyendo el payload original tal y como fue recibido.

### Errores
Vista filtrada que muestra únicamente los eventos que han producido algún error durante el procesamiento. Facilita la detección de incidencias y permite investigar la causa raíz de un fallo consultando el mensaje de error y el payload original. Incluye también un resumen agrupado por tipo de evento para identificar patrones de error.

### Pipeline de oportunidades
Tabla con el estado actual de todas las oportunidades comerciales sincronizadas desde el CRM. Permite ver la fase en la que se encuentra cada oportunidad, su valor económico, el contacto asociado y los pagos cobrados vinculados a ese contacto. Se puede filtrar por estado y por nombre de pipeline.

### Ventas
Módulo de analítica comercial. Muestra el funnel de ventas con las etapas en el orden definido en el CRM, incluyendo etapas sin oportunidades activas. Para cada etapa se muestra el volumen de leads, la tasa de conversión a la siguiente etapa y los valores económicos disponibles. Incluye un selector de periodo (este mes, mes anterior, todo o rango personalizado) y una tabla de operaciones con clasificación automática entre nueva venta y cross-sell.

### Integraciones
Registro de las integraciones activas y su actividad reciente. Muestra, para cada integración, el endpoint configurado, el tipo de autenticación utilizado, si el secreto de verificación está correctamente configurado, la fecha del último evento registrado y el volumen de eventos y fallos en las últimas 24 horas.

---

## 6. Límites actuales del sistema

Es importante entender qué cosas el sistema **no puede ver ni monitorizar** en su estado actual, para no interpretar erróneamente la ausencia de datos.

### Peticiones rechazadas antes de procesarse
Si una petición llega al sistema pero es rechazada por un error de autenticación (por ejemplo, una firma incorrecta) o por un problema de formato antes de ser registrada, esa petición **no queda almacenada** y, por tanto, **no aparece en el panel**. El panel solo muestra lo que ha llegado a procesarse.

### Errores de validación internos
Del mismo modo, si una petición supera la autenticación pero su contenido no cumple el formato esperado y es rechazada antes de persistirse, tampoco aparecerá en el registro de eventos.

### Estado de los proveedores externos
El panel no realiza comprobaciones activas sobre si GoHighLevel o Stripe están funcionando correctamente en un momento dado. La sección de integraciones muestra la última actividad registrada, pero no puede confirmar si el proveedor externo está operativo en tiempo real.

### Métricas de infraestructura
El panel no ofrece información sobre el rendimiento del servidor, el uso de recursos, los tiempos de respuesta o el estado de la conexión con la base de datos. Estos aspectos requieren herramientas de monitorización de infraestructura específicas.

### Logs técnicos del servidor
Los mensajes internos del servidor (logs de Pino) no son accesibles desde el panel. Para acceder a ellos es necesario consultar directamente el entorno de ejecución.

> **En resumen:** el panel ofrece visibilidad sobre lo que el sistema ha procesado correctamente y los errores que se han producido durante ese procesamiento. Todo lo que ocurre antes de ese punto —o fuera del sistema— no es visible desde aquí.

---

## 7. Estado actual del proyecto

El sistema se encuentra actualmente en fase de **MVP (Producto Mínimo Viable)**.

Esto significa que las funcionalidades core están implementadas y operativas: el sistema recibe eventos, los procesa, los almacena y los expone a través del panel de operaciones. Sin embargo, como todo MVP, hay aspectos que están simplificados o que aún no están implementados.

En la práctica, un MVP cumple los siguientes criterios en este proyecto:

- ✅ Las integraciones con GHL y Stripe están activas y funcionando.
- ✅ Los eventos se almacenan de forma fiable con control de idempotencia (no se procesan dos veces el mismo evento).
- ✅ El panel de operaciones permite monitorizar la actividad del sistema.
- ✅ La seguridad está implementada: autenticación de webhooks, sesiones de panel protegidas.
- ✅ El módulo de analítica de ventas está operativo: funnel, KPIs, conversión etapa a etapa, clasificación de operaciones y filtrado por periodo.
- ⏳ Algunos campos de ventas no llegan desde GHL: el desglose por comercial y los KPIs de ingresos están bloqueados porque GHL no envía esos campos en el webhook. Requieren configuración en GHL, no cambios en el sistema.
- ⏳ No existe aún un mecanismo automático para reprocesar eventos fallidos.
- ⏳ El panel es mayoritariamente de lectura: la sección de Integraciones permite crear y editar conexiones, pero las demás secciones no permiten modificar datos directamente desde la interfaz.

---

## 8. Próximas fases del proyecto

### Inmediato — Desbloquear campos de ventas en GHL (sin ingeniería)
Actualizar los workflows de GHL para incluir `assignedTo` y `monetaryValue` en el payload del webhook de oportunidades. Responsable: Laura. Desbloquea desglose por vendedor y KPIs de ingresos sin cambios en el sistema.

### Siguiente milestone técnico — Fiabilidad de datos
Añadir indicadores en el dashboard que diferencien entre "dato = 0" y "dato no disponible". Evita que el equipo interprete mal las métricas mientras algunos campos de GHL sigan ausentes.

### Holded — Facturas y contabilidad
Conectar la API de Holded para ingestar facturas y el Daily Ledger (nóminas y Seguridad Social). Desbloquea el cálculo de comisiones de vendedores, el informe mensual de comisiones y el dashboard financiero.

### MongoDB/Nomool — Expedientes de estudiantes
Sync diario de la base de datos de Nomool a Supabase. Desbloquea el dashboard de productividad de asesores (expedientes, valor económico por asesor, work load). Acceso técnico: Marcos.

### Marketing — Atribución por canal e influencer
Capturar UTMs y source de GHL. Conectar la tabla de influencers. Desbloquea el dashboard de marketing con CPL, ROAS por canal e influencer y análisis de leads por país.

### Informes mensuales recurrentes
Una vez conectados Holded y GHL users: informe de vendedores (base comisionable, comisiones, listo para nómina) e informe de asesores (expedientes, rentabilidad). Objetivo: eliminar el 80% del trabajo manual actual en cálculo de comisiones.

### IU de edición para vendedores y asesores
Formulario con permisos restringidos para que vendedores y asesores editen campos de cross-sell, upsell y asesor asignado en registros de los últimos 30 días.

### Periodo de validación cruzada (criterio de entrega)
Antes de usar DataQuick! como fuente de verdad: mínimo 1 mes comparando el pipeline con los cálculos manuales. Criterio: discrepancia < 2% financiero, < 5% funnel. Sign-off de Laura, Ignacio y Marcos.

---

## 9. Conclusión

DataQuick! tiene como objetivo eliminar la dependencia de hojas de cálculo manuales y dar a Vive España una visión unificada y fiable del negocio. El módulo de Ventas ya está operativo y validado con datos reales. Las siguientes prioridades son: desbloquear los campos de GHL que aún faltan, conectar Holded para comisiones y finanzas, y conectar MongoDB para operaciones.

La base técnica está construida y es sólida. Cada nueva fuente de datos se incorpora siguiendo el mismo patrón, sin rediseñar el sistema. El camino hasta junio 2026 está definido — ver `docs/ROADMAP.md` para el estado completo y las decisiones pendientes.

---

*Documento elaborado por el equipo de desarrollo. Para cualquier consulta técnica o de negocio, contactar con el responsable del proyecto.*
