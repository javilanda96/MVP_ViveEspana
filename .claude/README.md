# .claude/ — Sistema de Agentes Landthor

## Estructura

```
.claude/
├── agents/
│   ├── ORCHESTRATOR.md             — Siempre primero. Descompone peticiones en tareas.
│   ├── AGENT-MIGRATION.md          — Nuevas tablas Bronze (SQL + tipos TS + repo skeleton)
│   ├── AGENT-CODE.md               — Implementación TypeScript concreta
│   ├── AGENT-TEST-WRITER.md        — Integration tests (crítico para Hito 4)
│   ├── AGENT-WEBHOOK-INSPECTOR.md  — Analiza payloads nuevos vs esquema actual
│   ├── AGENT-SILVER-BUILDER.md     — Vistas Silver/Gold con lógica de negocio
│   ├── AGENT-REVIEWER.md           — Code review + security review
│   └── AGENT-DOCS.md               — Documentación para cliente (Hito 1 — Marcos)
└── context/
    └── PROJECT_CORE.md             — Contexto comprimido. Pegar en agentes, no el contexto completo.
```

## Cómo usar cada agente

### Opción A — Claude.ai Projects (recomendado ahora)
1. Crea una conversación nueva
2. Pega el contenido del `.md` del agente correspondiente al inicio
3. Añade el contexto mínimo necesario (`PROJECT_CORE.md` si el agente lo necesita)
4. Escribe tu petición

### Opción B — Claude Code (recomendado para código)
```bash
claude  # desde la raíz del repo
/read .claude/agents/AGENT-CODE.md
# luego tu petición
```

### Opción C — Cline / Continue en VS Code
Configura `systemPromptPath: .claude/agents/AGENT-CODE.md` en la config del modo de trabajo.

---

## Flujo estándar para una feature nueva

```
1. ORCHESTRATOR     → recibe petición, devuelve plan con tareas asignadas
2. AGENT-MIGRATION  → si hay tabla nueva: SQL + tipos + repo skeleton
3. AGENT-CODE       → implementa service + route usando los tipos de MIGRATION
4. AGENT-TEST-WRITER → tests del service implementado
5. AGENT-REVIEWER   → code review + security review antes de mergear
```

## Cuándo usar Opus vs Sonnet

| Usar Opus | Usar Sonnet |
|---|---|
| Diseño de identidad unificada con múltiples fallbacks | Todo lo demás |
| Lógica de comisiones ambigua | Migraciones SQL |
| Arquitectura Silver/Gold cuando hay ambigüedad de negocio | Integration tests |
| | Code review / security review |
| | Documentación para cliente |

**Regla práctica:** empieza con Sonnet. Cambia a Opus solo si la respuesta no captura la complejidad de la lógica de negocio.

---

## Ahorro de tokens — 5 reglas

1. **Pega `PROJECT_CORE.md`**, no `CLAUDE_PROJECT_CONTEXT.md` completo (~6x más corto)
2. **Una conversación por agente** — no acumules SQL + código + docs en el mismo hilo
3. **Al ORCHESTRATOR nunca le pegues código** — solo la petición en lenguaje natural
4. **Para tests:** pega solo la firma pública del service, no la implementación completa
5. **Para REVIEWER en audit completo:** pide que te solicite archivos uno a uno

---

## Prioridad esta semana (semana del 7 abril)

| Agente | Tarea | Hito |
|---|---|---|
| AGENT-DOCS | Documento de diseño técnico para Marcos | **Hito 1 — 600€** |
| AGENT-TEST-WRITER | Tests sobre GHL contacts + opportunities + Stripe | **Hito 4 — 2.400€** |
| AGENT-REVIEWER | Security review de los webhook handlers actuales | Calidad / riesgo |
