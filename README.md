# Founders Brain

Aplicación interna de FOUNDERS. La única pregunta que tiene que contestar de un
vistazo es **dónde está cada cliente y dónde tendría que estar**.

Este repositorio va por pasos. Lo que hay hoy es el **paso 1**: entrar, cargar
la cartera subiendo el CSV de la planilla madre, ver qué filas no entraron y por
qué, y abrir la ficha de un cliente.

---

## Cómo levantarla

Necesitás Node 22 y un proyecto de Supabase (o cualquier Postgres).

```bash
npm install
cp .env.example .env.local        # y poné ahí tu DATABASE_URL
npm run migrar                    # crea las tablas
npm run seed -- tu@email.com "Tu Nombre" tuclave
npm run dev                       # http://localhost:3000
```

`DATABASE_URL` sale de Supabase → **Project Settings → Database → Connection
string → URI**. En producción usá la cadena del *pooler* (puerto 6543).

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Levanta la aplicación en desarrollo |
| `npm run build` / `npm start` | Compila y sirve la versión de producción |
| `npm run typecheck` | Corre los tipos |
| `npm test` | Corre las pruebas (las de importación necesitan `DATABASE_URL`) |
| `npm run migrar` | Aplica `supabase/migrations/*.sql` en orden |
| `npm run seed -- <email> "<nombre>" <clave>` | Crea o actualiza un usuario admin |
| `npm run fixture` | Genera una planilla de prueba de 199 filas en `fixtures/` |

## Por qué se conecta así a Supabase

La aplicación habla con Postgres **por conexión directa desde el servidor**
(`pg`), no con `supabase-js`. Es la regla 8: `supabase-js` devuelve el error y
sigue, así que un permiso mal puesto termina informando «155 filas aplicadas»
sobre una base vacía. `pg` tira excepción, y además en `src/lib/db.ts` toda
escritura declara cuántas filas tenía que tocar y se verifica.

Las tablas tienen RLS prendido y **ninguna política**: la clave anónima de
Supabase no puede leer ni escribir nada, ni siquiera si se filtra. Nadie entra
por la API pública; se entra por el servidor de la aplicación, con su sesión.

## Cómo está armado

```
src/lib/campos.ts            El registro de los 32 datos de un cliente.
                             De acá salen el mapeo de la planilla, qué le falta
                             a cada uno y cómo se dibuja la ficha.
src/lib/valores.ts           Lee celdas: vacío / valor / error. Nunca cero por defecto.
src/lib/db.ts                Conexión y escrituras verificadas.
src/lib/importar/mapeo.ts    De los encabezados de la planilla a los campos.
src/lib/importar/importar.ts La importación entera, con las reglas 1, 3, 7, 8 y 10.
src/lib/clientes.ts          Las consultas de la lista y de la ficha.
src/lib/programa.ts          En qué semana va cada cliente. Restas de fechas.
src/app/api/importar/        El archivo entra por acá, no por una acción de servidor.
supabase/migrations/         Las tablas.
```

### El archivo va por un endpoint, no por una acción de servidor

Una acción de servidor tiene tope de 1 MB. En la versión anterior la planilla no
entraba y la carga se trababa sin decir por qué. Por eso el formulario de
`/importar` postea a `/api/importar`, que es un route handler.

## Las reglas, y dónde viven

| Regla | Dónde |
|---|---|
| 1 · Celda vacía no es cero | `valores.ts` devuelve tres estados; el importador saltea `vacio` sin escribir |
| 3 · Nunca adivinar el cliente por parecido | `texto.ts`: `clave()` compara nombres sin plegar acentos; el parecido se informa y la fila no entra |
| 7 · Volver a importar corrige, no duplica | Se busca por `ref_externa` o por nombre exacto; los documentos de planilla tienen índice único por (cliente, tipo) |
| 8 · Toda escritura verifica su error | `escribir()` compara filas tocadas contra las esperadas y rompe si no coinciden |
| 10 · Lo que se saltea se informa | `importacion_filas` guarda motivo y avisos por número de fila; el reporte arranca por lo que **no** entró |

Las reglas 2, 4, 5, 6 y 9 entran con los pasos que las necesitan (alertas,
extracción con IA).

## Qué entiende de la planilla

Los encabezados no tienen que estar escritos exactamente igual: no importan los
acentos ni las mayúsculas, y cada campo acepta varios nombres. La lista completa
está en la pantalla **Importar**, y desde ahí se baja una plantilla con los
encabezados que la aplicación reconoce.

Si la planilla trae una columna `id_cliente`, esa manda: se le puede corregir el
nombre a un cliente sin que se duplique.

## Cómo se publica en Vercel

1. En Vercel: **Add New → Project** e importá este repositorio. El framework lo
   detecta solo (Next.js); no hay que tocar los comandos de build.
2. En **Settings → Environment Variables** cargá `DATABASE_URL` con la cadena del
   **pooler** de Supabase (puerto 6543, modo transacción). La conexión directa
   del puerto 5432 no sirve en serverless: se queda sin conexiones.
3. Antes del primer deploy, corré las migraciones una vez contra ese mismo
   proyecto de Supabase — `npm run migrar` desde tu máquina con la misma
   `DATABASE_URL`, o pegando `supabase/migrations/0001_estructura.sql` en el SQL
   Editor de Supabase.
4. Creá el primer usuario: `npm run seed -- tu@email.com "Tu Nombre" tuclave`,
   también desde tu máquina y apuntando a la misma base.

La cookie de sesión sale con `Secure` en producción, así que la aplicación tiene
que servirse por HTTPS: en Vercel ya lo está.

## Lo que todavía no está

Paso 2 (editar la ficha en el lugar), 2 bis (cargar documentos y completar
campos desde los documentos), 3 (la comparación con lo esperado), 4 (la grilla
por semanas), 5 (las alertas), 6 (sesiones) y 7 (el análisis del caso).
