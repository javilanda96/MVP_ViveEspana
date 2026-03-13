================================================================================
GUÍA RÁPIDA DE INICIO - FASE 1
MVP: Integración de datos PYME
================================================================================

PASO 1: Crea folder
================================================================================

mkdir pyme-data-integration-mvp
cd pyme-data-integration-mvp
mkdir -p src/lib src/types src/routes src/utils scripts

================================================================================
PASO 2: Copiar archivos desde outputs
================================================================================

ARCHIVOS RAÍZ (copiar a la raíz del proyecto):
  cp ../outputs/01_package.json package.json
  cp ../outputs/02_tsconfig.json tsconfig.json
  cp ../outputs/08_env.example .env.example

CÓDIGO FUENTE (copiar en las carpetas src/):
  cp ../outputs/03_src_index.ts src/index.ts
  cp ../outputs/04_src_lib_supabase.ts src/lib/supabase.ts
  cp ../outputs/05_src_types_models.ts src/types/models.ts
  cp ../outputs/06_src_config.ts src/config.ts

SCHEMA SQL (copiar en scripts/):
  cp ../outputs/schema_COMPLETO.sql scripts/schema.sql

================================================================================
PASO 3: Crear 2 archivos adicionales
================================================================================

A) Crear archivo: .eslintrc.json
{
  "env": {
    "node": true,
    "es2020": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-types": "warn",
    "no-console": "off",
    "prefer-const": "error"
  }
}

B) Crear archivo: .gitignore
node_modules/
dist/
*.log
.env
.env.local
.env.*.local
.DS_Store
.vscode/settings.json
.idea/
*.swp
*.swo
*~
coverage/
.nyc_output/

================================================================================
PASO 4: Configurar variables de entorno
================================================================================

cp .env.example .env

Abre .env y edita con tus credenciales Supabase:
  SUPABASE_URL=https://tu-proyecto.supabase.co
  SUPABASE_SERVICE_KEY=tu-service-key-aqui
  PORT=3000
  NODE_ENV=development

Dónde conseguir las keys:
  → https://app.supabase.com
  → Selecciona tu proyecto
  → Settings → API → Keys and tokens
  → Copia SUPABASE_URL y SERVICE_KEY (no ANON KEY)

================================================================================
PASO 5: Instalar dependencias
================================================================================

npm install

Esto descargará:
  - Fastify
  - @supabase/supabase-js
  - TypeScript
  - ESLint
  - Otras herramientas

================================================================================
PASO 6: Setup de Base de Datos (EN SUPABASE)
================================================================================

OPCIÓN A: Supabase Dashboard (RECOMENDADO para MVP)
  1. Ve a https://app.supabase.com
  2. Abre tu proyecto
  3. Menú izquierdo → SQL Editor
  4. Botón "+" → New Query
  5. Copia TODO el contenido de: ../outputs/schema_COMPLETO.sql
  6. Pégalo en el SQL Editor
  7. Botón "Run" (esquina superior derecha)
  8. Espera a que termine (2-3 segundos)

OPCIÓN B: Si tienes Supabase CLI
  supabase link --project-ref tu-project-ref
  supabase db push

OPCIÓN C: Si tienes PostgreSQL en tu máquina
  psql $DATABASE_URL < scripts/schema.sql

================================================================================
PASO 7: Verificar que todo funciona
================================================================================

Terminal 1 (dentro de tu proyecto):
  npm run dev

Deberías ver algo como:
  [pino] Server running on port 3000
  [pino] Environment: development

Terminal 2 (nueva terminal, desde cualquier lado):
  curl http://localhost:3000/health

Respuesta esperada:
  {"status":"ok","timestamp":"2024-03-12T...","environment":"development"}

Si ves eso → ¡ÉXITO! ✅

================================================================================
TROUBLESHOOTING
================================================================================

ERROR: "Missing SUPABASE_URL"
  → Verifica que .env existe en la raíz
  → Verifica que SUPABASE_URL y SUPABASE_SERVICE_KEY no están vacíos
  → Comprueba que copiaste desde Settings → API → Keys

ERROR: "Cannot find module 'fastify'"
  → Ejecuta: npm install
  → Luego: npm run build

ERROR: "Table 'contacts' does not exist"
  → Probablemente no ejecutaste schema_COMPLETO.sql en Supabase
  → Ve a Supabase Dashboard → SQL Editor
  → Crea nueva query
  → Pega schema_COMPLETO.sql
  → Haz Run

ERROR de conexión a Supabase
  → Asegúrate que usas SUPABASE_SERVICE_KEY (no ANON KEY)
  → El URL debe ser: https://xxx.supabase.co (con https)

================================================================================
ESTRUCTURA FINAL (cómo debe verse tu carpeta)
================================================================================

pyme-data-integration-mvp/
├── src/
│   ├── index.ts                 (servidor Fastify)
│   ├── config.ts                (validación env vars)
│   ├── lib/
│   │   └── supabase.ts          (cliente Supabase)
│   ├── types/
│   │   └── models.ts            (tipos TypeScript)
│   ├── routes/                  (vacío en MVP, para Fase 2+)
│   └── utils/                   (vacío en MVP, para Fase 2+)
├── scripts/
│   └── schema.sql               (schema base)
├── node_modules/                (creado por npm install)
├── dist/                         (se crea cuando haces npm run build)
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .gitignore
├── .env                         (GITIGNORED - privado, no subir)
├── .env.example                 (template, público)
└── README.md                    (tu documentación)

================================================================================
NEXT STEPS
================================================================================

Cuando todo esto funcione:

✅ npm run dev → servidor en puerto 3000
✅ curl http://localhost:3000/health → responde OK
✅ Schema.sql ejecutado en Supabase
✅ Proyecto localizado y gitignored

Pasa a FASE 2:
  → Documentación de webhooks
  → Integración con Zapier
  → Mapeos GoHighLevel → contacts
  → Mapeos Stripe → payments

AVÍSAME cuando todo esté corriendo. 🚀

================================================================================
NOTAS FINALES
================================================================================

• Este es MVP: Zapier escribe directo a Supabase. Backend está listo pero vacío.

• Si necesitas lógica de validación o transformación compleja → Fase 3.

• Todo está diseñado para crecer: carpetas routes/ y utils/ esperan código.

• Los tipos TypeScript están listos para cuando agregues validaciones Zod.

• El schema SQL está pensado para Stripe, GHL, Holded. Sin sobreingenierizar.

¡Adelante! 🚀