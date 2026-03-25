# Punto de situación del proyecto
### Sistema middleware de integración de datos — MVP

**Fecha:** Marzo 2026
**Destinatarios:** Equipo interno · Responsables de negocio · Cliente
**Estado del proyecto:** Sales MVP completado y validado

---

## 1. Introducción

Este proyecto es un sistema de integración de datos desarrollado a medida para una pyme que utiliza múltiples herramientas digitales en su operativa diaria.

El problema de partida era claro: las herramientas utilizadas —un CRM para gestión comercial y una plataforma de pagos— funcionaban de forma aislada. La información generada en cada una no se comunicaba con las demás, lo que obligaba a realizar actualizaciones manuales, generaba duplicidades y dificultaba tener una visión unificada del negocio.

El sistema desarrollado actúa como **intermediario inteligente** entre esas herramientas. Recibe automáticamente los eventos que ocurren en cada plataforma, los procesa, los normaliza y los almacena de forma centralizada. Esto permite que la información fluya de manera coherente y que el equipo pueda consultarla desde un único punto.

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

## 4. Integraciones actuales

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

## 8. Próximas mejoras posibles

A continuación se describen las mejoras más relevantes que podrían incorporarse en fases posteriores del proyecto:

### Reprocesamiento de eventos fallidos
Cuando un evento falla por un problema temporal (por ejemplo, un fallo momentáneo de base de datos), actualmente el sistema lo marca como fallido y no lo reintenta. Una mejora natural sería añadir un mecanismo de reintento automático o permitir al operador relanzar manualmente un evento fallido desde el panel.

### Mejor clasificación de errores
Actualmente todos los errores se agrupan en la misma categoría. Clasificarlos por tipo (errores de datos, errores de conectividad, errores de negocio) facilitaría su diagnóstico y priorización.

### Mayor observabilidad del sistema
Ampliar la visibilidad del panel para incluir peticiones rechazadas antes del procesamiento, tiempos de respuesta y métricas de salud del sistema en tiempo real.

### Alertas automáticas
Configurar notificaciones automáticas (por email o Slack) cuando se supere un umbral de errores o cuando una integración lleve un tiempo determinado sin actividad.

### Desbloqueo de campos de ventas desde GHL
Actualizar los workflows de GHL para incluir `assignedTo` y `monetaryValue` en el payload del webhook de oportunidades. Esto activará automáticamente el desglose por comercial y los KPIs de ingresos sin cambios en el sistema.

### Ampliación de integraciones
El sistema está diseñado para incorporar nuevas integraciones de forma modular. Podrían añadirse otras herramientas del ecosistema de la empresa siguiendo el mismo patrón arquitectónico.

### Panel con capacidad de acción ampliada
La sección de Integraciones ya permite crear y editar conexiones desde la interfaz. Una evolución natural sería ampliar esta capacidad a otras secciones: relanzar eventos fallidos, marcar alertas como resueltas directamente desde el panel, o gestionar configuraciones avanzadas del sistema.

---

## 9. Conclusión

El sistema desarrollado resuelve un problema real y concreto: la desconexión entre las herramientas digitales utilizadas por el negocio. Gracias a este middleware, los eventos generados en el CRM y en la plataforma de pagos se reciben, procesan y almacenan de forma automática y centralizada.

El MVP está operativo y cubre las necesidades básicas de integración y observabilidad. El panel de operaciones permite al equipo supervisar el funcionamiento del sistema sin depender de conocimientos técnicos avanzados.

El proyecto tiene una base sólida sobre la que construir. Las próximas fases pueden enfocarse en ampliar la observabilidad, mejorar la gestión de errores y añadir nuevas integraciones según las necesidades del negocio.

---

*Documento elaborado por el equipo de desarrollo. Para cualquier consulta técnica o de negocio, contactar con el responsable del proyecto.*
