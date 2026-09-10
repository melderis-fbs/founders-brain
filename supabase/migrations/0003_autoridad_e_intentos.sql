-- Los campos que ya existían en el Brain anterior y acá faltaban.
--
-- No son campos de más: son método. El bloque de autoridad existe porque nunca
-- se descarta la experiencia previa de un cliente porque él diga que no quiere
-- trabajar en ese mercado — la oportunidad suele estar justo donde ya tiene
-- lenguaje, contactos y credibilidad. Y «lo que ya probó» existe para no
-- volver a proponerle una estrategia que ya le falló.

alter table clientes
  add column if not exists fuente           text,   -- de dónde vino: IG, referido…
  add column if not exists closer           text,
  add column if not exists setter           text,
  add column if not exists horas_por_semana numeric(4,1);   -- las declaradas en la sesión 1, no las del pitch

alter table cliente_negocio
  add column if not exists a_quien_hoy      text,   -- a quién le vende HOY, distinto del cliente ideal
  add column if not exists como_entrega     text,
  add column if not exists cantidad_clientes integer,
  add column if not exists origen_clientes  text,
  add column if not exists deseo            text,   -- qué quiere, distinto del problema que tiene
  add column if not exists mecanismo        text;   -- cómo logra el resultado que promete

create table if not exists cliente_autoridad (
  cliente_id               bigint primary key references clientes(id) on delete cascade,
  hace_bien                text,
  experiencia_profesional  text,
  resultados_propios       text,
  resultados_terceros      text,
  industrias_que_conoce    text,
  autoridad_desperdiciada  text
);

create table if not exists cliente_intentos (
  cliente_id             bigint primary key references clientes(id) on delete cascade,
  que_funciono           text,
  que_no_funciono        text,
  facturacion_historica  text
);

alter table cliente_autoridad enable row level security;
alter table cliente_intentos enable row level security;
