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
| `npm test` | Corre las pruebas. Las que escriben en la base necesitan `DATABASE_URL_PRUEBAS` |
| `npm run migrar` | Aplica `supabase/migrations/*.sql` en orden |
| `npm run seed -- <email> "<nombre>" <clave>` | Crea o actualiza un usuario admin |
| `npm run fixture` | Genera una planilla de prueba de 199 filas en `fixtures/` |
| `npm run importar -- <archivo.csv>` | Importa un CSV sin tope de tiempo (la primera carga de la cartera) |

## Las pruebas corren sobre una base aparte

Las pruebas hacen `truncate`. Si `npm test` corriera contra la base de trabajo,
se llevaría puesta la cartera entera. Por eso el interruptor es **otra
variable**, `DATABASE_URL_PRUEBAS`: sin ella, las pruebas que escriben se
saltean solas y las demás corren igual.

```
Test Files  7 passed | 3 skipped (10)
Tests       56 passed | 28 skipped (84)
```

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

## La planilla sale de la aplicación, no al revés

Los campos mandan. `src/lib/campos.ts` define qué datos tiene un cliente, y de
ahí salen los encabezados de la planilla madre. Desde la pantalla **Importar**
se baja de dos formas:

- **vacía, con una fila de ejemplo** — para empezar la planilla;
- **con la cartera de hoy** — para rehacerla desde lo que ya está cargado.

El viaje de ida y vuelta no mueve un dato: bajar la cartera y volver a subirla
da *sin cambios* en todas las filas, y ninguna columna queda sin reconocer. Hay
una prueba que lo verifica.

Los sinónimos que acepta la importación (`meta`, `objetivo mensual`,
`facturacion objetivo`… para *meta mensual*) existen sólo para que lo que ya
está escrito hoy entre sin retocarlo. No son el contrato: el contrato es la
plantilla.

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

### La primera carga de la cartera, hacela por la línea de comandos

Una función de Vercel se corta al minuto. Subir la planilla entera por la
pantalla son cientos de escrituras seguidas contra Supabase, y con la cartera
completa puede no llegar. Para esa primera vez:

```bash
npm run importar -- ruta/a/la-planilla.csv
```

Corre exactamente el mismo código que la pantalla, con las mismas reglas, y
deja el mismo reporte guardado (te dice en qué `/importar/<n>` quedó). De ahí en
adelante las actualizaciones del día a día sí entran cómodas por la pantalla:
las filas que no cambiaron casi no escriben.

La cookie de sesión sale con `Secure` en producción, así que la aplicación tiene
que servirse por HTTPS: en Vercel ya lo está.

### Cada vez que agrego una migración, hay que correrla

Las migraciones se acumulan en `supabase/migrations/`. Correr sólo la primera y
no las siguientes deja la base conectando bien y reventando después contra una
tabla que no existe. Para no tener que acordarse:

```bash
npm run migrar          # las aplica todas en orden, desde tu máquina
npm run esquema         # las imprime todas juntas, para pegar en el SQL Editor
```

Son idempotentes: volver a correr una que ya está aplicada no rompe nada.

### Si algo de eso falta, la aplicación lo dice

Antes de tocar la base, el login y el marco de la aplicación revisan que la
conexión esté (`src/lib/revision.ts`). Si falta `DATABASE_URL`, si no se llega
al servidor, si la contraseña no es, si las tablas no están creadas o si todavía
no hay ningún usuario, sale una pantalla con el motivo y los pasos, en vez de un
«Application error» con un digest. Nunca muestra la cadena de conexión ni la
contraseña.

El chequeo mira **todo el esquema**, no sólo la primera tabla: si falta una
migración dice cuál, y qué tabla o columna le falta.

Y para lo que ningún chequeo puede prever están `src/app/error.tsx` y
`src/app/global-error.tsx`: cualquier excepción del servidor sale como una
pantalla que se lee, con la referencia del error para buscarla en los logs, en
vez del «Application error» de Vercel.

El caso más común al publicar: **usar la conexión directa en vez del pooler**.
La directa (`db.PROYECTO.supabase.co`, puerto 5432) va sólo por IPv6 y desde
Vercel no se llega.

## La comparación: dónde está y dónde tendría que estar

`src/lib/hitos.ts` tiene el catálogo del método —los doce hitos con su semana,
su etapa y cuáles bloquean lo que viene después— y se compara contra la semana
en la que va cada cliente. Se dibuja en tres lugares: las cinco etapas en cada
fila de la lista, el cuadro completo en la ficha y los números en el tablero.

### Un hito puede decir tres cosas, no dos

Además de «hecho» y «falta», un hito puede decir **«sin datos»**. Cada hito
declara de qué lee, y si esa fuente está vacía **en toda la cartera**, no opina.
Hoy las ventas, las reuniones, las llamadas, el tracker y el seguimiento no se
cargan en ninguna parte, así que sus hitos dicen «sin datos» y el tablero tiene
una tarjeta que lista exactamente eso.

Es la regla 2. Decir «no hizo la primera venta» cuando nadie cargó ninguna venta
no es un dato flojo: es una afirmación falsa sobre el cliente, y acierta por la
razón equivocada.

## El semáforo

Cuatro colores, no tres, y la diferencia es el punto: **gris no es verde**.

| Color | Palabra | Cuándo |
|---|---|---|
| Rojo | grave | Falta algo que **bloquea** lo que viene después, o el atraso llegó a 4 semanas |
| Amarillo | atrasado | Hay algo vencido, poco y que no bloquea |
| Verde | en tiempo | No hay nada vencido de lo que hoy se puede medir |
| Gris | sin datos | No hay con qué compararlo |

El color nunca va solo: siempre lleva su palabra al lado y, al pasar el mouse,
la frase que lo explica —«"oferta y promesa cerradas" bloquea todo lo que viene
después y falta hace 6 semanas»—. No hay puntaje: el color sale de hitos que se
pueden nombrar.

Un cliente sin datos **no puede salir en verde**. Verde es el color que hace
que nadie lo mire, y ahí es donde un tablero empieza a mentir.

## Preguntar sobre un cliente

En la ficha, el bloque **Preguntar sobre X**. Corre **sólo al apretar Enviar**,
nunca al abrir la pantalla: cada pregunta cuesta plata, y esa es toda la razón
de que haya un botón.

Le llega el expediente armado por `src/lib/expediente.ts`: la ficha con los
campos vacíos marcados **NO CARGADO**, la comparación con lo esperado con los
hitos que no se pueden evaluar marcados **SIN DATOS**, y los documentos
cargados, de lo más nuevo a lo más viejo hasta un tope de 60.000 caracteres. Lo
que no entró por tamaño **se dice al final de la respuesta**: un expediente que
en silencio incluye tres de once documentos es un expediente en el que nadie
puede confiar.

Las reglas del método van en el prompt del sistema (`REGLAS` en
`src/lib/modelo.ts`) y son las del documento: sin cita textual no se afirma
nada; lo que no está en el expediente no está; un campo vacío no es cero; un
hito «sin datos» no se cuenta como incumplido; tres a cinco puntos como máximo.

### Qué cuesta, y dónde se ve

Modelo `claude-opus-5`. Un cliente con un documento son unos 850 tokens de
expediente: **menos de dos centavos de dólar por pregunta**. Las repreguntas de
una misma conversación cuestan menos, porque el expediente y las reglas viajan
cacheados.

Cada llamada queda registrada en `llamadas_modelo` con sus tokens, su costo y
cuánto tardó. «El chat cuesta plata» tiene que ser un número, no una intuición.

### La clave

`ANTHROPIC_API_KEY` en `.env.local` y en Vercel. Si la clave **no** está
asignada a un workspace, la API la rechaza; en ese caso hay que cargar también
`ANTHROPIC_WORKSPACE_ID`. Los errores de la API salen traducidos y con el
arreglo al lado, no en inglés.

Sin clave, el bloque de preguntar avisa y **el resto de la aplicación anda
igual**.

## La grilla

Dos vistas de la misma cosa, en `/grilla`:

- **Por etapa** — un kanban: cada cliente en la etapa donde se corta, ordenado
  por gravedad y por semanas de atraso. Si muchos se amontonan en la misma
  columna, suele ser el programa y no el cliente.
- **Por semanas** — clientes en filas, semanas en columnas. Sólo las semanas en
  las que el método espera algo: las otras no son columnas.

Las dos se filtran por consultora, porque nadie trabaja sobre 196 tarjetas.

## Un cliente nuevo, a mano

Desde la lista, botón **Cliente nuevo**. Pide cuatro datos —nombre, consultora,
programa y fecha de inicio— y abre la ficha, donde se completa el resto. Un
formulario de 51 campos no lo llena nadie.

La regla 3 rige igual que en la importación: un nombre que ya existe, o que sólo
se diferencia por acentos o mayúsculas, no entra y se dice contra cuál choca.

## La ficha se edita donde está

Cada dato de la ficha se edita en el lugar: se hace clic sobre el valor y se
escribe. No hay pantalla de edición ni botón «modificar». Se guarda con Enter
(en los textos largos, Ctrl+Enter) o al salir del campo, y se cancela con
Escape.

La validación es **la misma** que la de la importación —el mismo módulo, no una
copia—, así que la ficha nunca acepta algo que la planilla rechaza: escribir
«lo que salga» en el ticket devuelve el mismo mensaje en los dos lados.

### Los documentos se cargan desde la ficha

Dos caminos, los dos en el bloque «Documentos»:

- **Pegar texto** — el principal, el que siempre funciona. Va por una acción de
  servidor, que para texto está bien.
- **Subir archivo** — PDF, .docx y texto plano, por `POST /api/documentos`, que
  es un endpoint. Nunca por una acción de servidor: el tope de 1 MB es lo que
  trababa la carga en la versión anterior.

`src/lib/extraer-archivo.ts` viene tal cual del Brain anterior: el problema ya
estaba resuelto ahí. Un PDF escaneado no tiene texto adentro, y lo dice en vez
de guardar un documento vacío.

El texto completo de un documento viaja al navegador **sólo cuando alguien lo
abre**. En la lista se ven el título, el tipo, la fecha y el tamaño.

### De dónde salió cada dato

Toda escritura queda anotada en `campo_origen`: si vino de la planilla, si lo
corrigió una persona o si lo propuso un documento, con su cita. Se ve al pasar
el mouse sobre el valor.

Eso es lo que va a permitir cumplir la **regla 9** en el paso 2 bis: un análisis
automático no puede pisar lo que escribió una persona. Y mientras tanto ya
sirve para algo concreto: cuando la planilla cambia un dato que alguien había
corregido a mano, la planilla manda —es la fuente— pero **el reporte lo dice**,
fila por fila, en vez de hacerlo en silencio.

## Lo que todavía no está

Paso (cargar documentos y completar campos desde los documentos), 3 (la
comparación con lo esperado), 4 (la grilla por semanas), 5 (las alertas),
6 (sesiones) y 7 (el análisis del caso).
