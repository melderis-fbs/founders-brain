-- La ficha pasa a tener los campos que los documentos realmente traen.
--
-- Hasta acá la ficha tenía 44 campos inventados de lo que parecía razonable.
-- El formulario de onboarding real hace muchas más preguntas, y el match de
-- marca es un documento con bloques y una estructura propia. Faltaba dónde
-- poner casi todo eso, y lo que no tiene dónde ir se pierde.
--
-- Dos cosas que esta migración NO hace:
--  · No borra ni una columna con datos. Lo que había sigue donde estaba.
--  · No mueve nada de tabla. Los campos trabajados que ya vivían en
--    cliente_negocio (cliente_ideal, problema, oferta, promesa, mensaje,
--    mecanismo, diferencial) se quedan ahí: qué bloque de la pantalla los
--    muestra lo decide el código, no la tabla.

-- ── El cliente: dos datos que el onboarding pide y no teníamos ─────────────
alter table clientes
  add column if not exists pais   text,
  add column if not exists redes  text;   -- una línea por red, con el usuario o el link

-- ── Quién es: la persona, no el negocio ───────────────────────────────────
-- El onboarding pregunta por sus frustraciones, sus miedos, cómo quiere que lo
-- acompañen y qué espera. Nada de eso es un dato del negocio y todo eso cambia
-- cómo se lo trabaja.
create table if not exists cliente_quien_es (
  cliente_id             bigint primary key references clientes(id) on delete cascade,
  profesion_actual       text,
  frustracion_negocio    text,
  frustraciones_top3     text,
  restricciones          text,   -- lo que le limita tiempo, espacio o capital
  como_coachearlo        text,
  miedos                 text,
  valores                text,
  motivo_ingreso         text,
  expectativas_programa  text,
  notas_cliente          text    -- el último recurso: lo que no encaja en ningún otro campo
);

-- ── Su negocio, como LLEGÓ ────────────────────────────────────────────────
-- Los tres `_inicial` son la clave de todo esto: lo que contestó en el
-- onboarding sobre su cliente ideal, su problema y su oferta es el punto de
-- partida, no la versión final. La distancia entre el _inicial y el trabajado
-- es el programa funcionando, y hasta acá se pisaban entre sí.
alter table cliente_negocio
  add column if not exists nombre_negocio         text,
  add column if not exists historia_negocio       text,
  add column if not exists etapa_percibida        text,
  add column if not exists vision_negocio         text,
  add column if not exists roles_equipo           text,
  add column if not exists cliente_ideal_inicial  text,
  add column if not exists problema_inicial       text,
  add column if not exists oferta_inicial         text;

-- ── Su negocio, TRABAJADO en el match de marca ────────────────────────────
-- Sale del match de marca y de ningún otro lado. Si el match no está, queda
-- vacío: completarlo con el onboarding sería mentir sobre en qué anda.
create table if not exists cliente_marca (
  cliente_id            bigint primary key references clientes(id) on delete cascade,
  expertise             text,
  nichos_candidatos     text,
  casos_reales          text,
  metodo_que_odia       text,
  capacidad_pago        text,
  soluciones_falsas     text,
  objeciones_cliente    text,   -- las de SU cliente con él, no las de la venta con Founders
  promesas_secundarias  text,
  pilares               text,
  frases_mercado        text,
  estado_encuesta       text
);

-- ── Cómo consigue clientes y cómo vende ───────────────────────────────────
create table if not exists cliente_comercializa (
  cliente_id                bigint primary key references clientes(id) on delete cascade,
  estrategia_marketing      text,
  hace_publicidad           boolean,
  usa_testimonios           boolean,
  plataformas_ok            boolean,
  proceso_ventas            text,
  oportunidad_sin_explotar  text
);

-- ── Lo que quiere lograr ──────────────────────────────────────────────────
create table if not exists cliente_objetivos (
  cliente_id           bigint primary key references clientes(id) on delete cascade,
  problemas_negocio    text,
  necesidad_percibida  text,
  objetivos_semanas    text,
  objetivo_meses       text
);

-- ── Lo que se dijo en la venta ────────────────────────────────────────────
-- Lo hablado, que no es lo firmado. Lo firmado está en cliente_comercial.
-- Tener los dos separados es lo que permite ver si no coinciden.
create table if not exists cliente_venta (
  cliente_id            bigint primary key references clientes(id) on delete cascade,
  dolor_textual         text,   -- cita literal, sin resumir
  objeciones_venta      text,
  valor_prometido       numeric(14,2),
  forma_pago_prometida  text check (forma_pago_prometida in ('contado', 'cuotas')),
  cuotas_prometidas     text,   -- «2000 + 1000 + 500»
  garantia_mencionada   boolean
);

-- ── Lo que ya probó: faltaba dónde poner todo lo que intentó ───────────────
alter table cliente_intentos
  add column if not exists intentos_captacion text;

-- ── El precio deja de ser un número y pasa a ser una lista ─────────────────
-- Un cliente no cobra UN precio: cobra distinto por cada cosa que vende, y
-- meterlo en un numeric obligaba a elegir uno y tirar el resto. El número para
-- la cuenta inversa sigue siendo `ticket`, que lo carga la consultora.
-- El `using` conserva lo que ya estaba cargado.
alter table cliente_numeros
  alter column precio_actual type text using precio_actual::text;

-- ── Se va la fecha de la cuenta inversa ───────────────────────────────────
-- Nadie entendía de dónde salía, y tenían razón: la cuenta inversa no es una
-- fecha que alguien tilda, es una cuenta que se hace con la meta mensual y el
-- ticket. Se deja de pedir como dato y se calcula.
-- La columna NO se borra: si alguien cargó una fecha, sigue ahí. Deja de
-- mostrarse y deja de contar como dato faltante.

-- ── Nada de esto se sirve por la API pública de Supabase ──────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'cliente_quien_es', 'cliente_marca', 'cliente_comercializa',
    'cliente_objetivos', 'cliente_venta'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
