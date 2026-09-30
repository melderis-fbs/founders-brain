-- La temperatura: cómo viene la relación del cliente CON NOSOTROS.
--
-- No es lo mismo que estar atrasado. Un cliente puede ir último en el Road Map
-- y estar contento, y otro puede ir al día y estar a una semana de pedir la
-- plata de vuelta. Eso segundo no se ve en ninguna fecha: sólo se ve en lo que
-- dijo, en una sesión o en la encuesta de satisfacción.
--
-- Cuatro valores, y lo que hacen es distinto:
--   · bien      — no dijo nada en contra nuestro. Es lo normal.
--   · tibio     — algo le molesta y lo dice de costado. YELLOW FLAG: se mira,
--                 NO es grave. Que un tibio pinte rojo es exactamente lo que
--                 rompió el tablero la vez pasada.
--   · caliente  — se queja de nosotros con todas las letras. Eso sí es grave.
--   · quemando  — habla de irse, de la plata o de la garantía. Grave.
--
-- Cada fila guarda la CITA TEXTUAL. Sin cita no hay temperatura arriba de
-- «bien»: una alarma que no puede mostrar la frase que la prendió no se puede
-- discutir, y una consultora no va a tener una conversación incómoda porque un
-- modelo dijo que sí.
--
-- La detecta el modelo y la confirma o la descarta una persona (regla 4). Lo
-- que escribe la persona en `nota` no lo pisa nunca un análisis nuevo
-- (regla 9), y volver a analizar la misma sesión corrige la fila en vez de
-- agregar otra (regla 7): de ahí el unique.

create table if not exists temperaturas (
  id             bigint generated always as identity primary key,
  cliente_id     bigint not null references clientes(id) on delete cascade,
  -- De dónde salió: de una sesión o de una encuesta de satisfacción.
  de             text not null check (de in ('sesion', 'encuesta')),
  -- El id de esa sesión o de ese documento. No es una FK: son dos tablas.
  origen_id      bigint not null,
  temperatura    text not null check (temperatura in ('bien', 'tibio', 'caliente', 'quemando')),
  -- De qué se queja, cuando se queja de algo.
  de_que         text check (de_que in ('tiempo', 'material', 'acompanamiento', 'resultados',
                                        'precio', 'lo_que_le_vendieron', 'la_consultora', 'otra')),
  porque         text,
  -- Las frases del cliente, palabra por palabra. Vacío si la temperatura es «bien».
  citas          text[] not null default '{}',
  -- Lo que está frustrado de SU negocio: no prende ninguna alarma, sirve para
  -- preparar la próxima sesión.
  lo_otro        text,
  que_preguntar  text,
  detectada_en   timestamptz not null default now(),

  -- Lo de la persona. Esto manda sobre lo del modelo.
  descartada_en    timestamptz,
  descartada_por   bigint references usuarios(id) on delete set null,
  por_que_se_descarto text,
  nota           text,
  nota_por       bigint references usuarios(id) on delete set null,
  nota_en        timestamptz,

  unique (cliente_id, de, origen_id)
);

create index if not exists idx_temperaturas_cliente on temperaturas(cliente_id, detectada_en desc);
-- La que usa el semáforo de toda la cartera: las que siguen valiendo.
create index if not exists idx_temperaturas_vigentes on temperaturas(cliente_id)
  where descartada_en is null and temperatura <> 'bien';

alter table temperaturas enable row level security;
