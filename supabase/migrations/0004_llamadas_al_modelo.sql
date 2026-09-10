-- Cada llamada al modelo, con lo que costó.
--
-- La regla es que nada corre solo si cuesta dinero. El otro lado de esa regla
-- es poder mirar cuánto se gastó y en qué: sin este registro, «el chat cuesta
-- plata» es una intuición y no un número.

create table if not exists llamadas_modelo (
  id                 bigint generated always as identity primary key,
  cliente_id         bigint references clientes(id) on delete set null,
  usuario_id         bigint references usuarios(id) on delete set null,
  para               text not null,          -- 'preguntar' | 'diagnostico' | 'ficha' | 'sesion'
  modelo             text not null,
  pregunta           text,
  tokens_entrada     integer not null default 0,
  tokens_salida      integer not null default 0,
  tokens_cache_leido integer not null default 0,
  tokens_cache_escrito integer not null default 0,
  costo_usd          numeric(10,6) not null default 0,
  ms                 integer not null default 0,
  error              text,
  creado_en          timestamptz not null default now()
);
create index if not exists idx_llamadas_cliente on llamadas_modelo(cliente_id, creado_en desc);
create index if not exists idx_llamadas_fecha on llamadas_modelo(creado_en desc);

alter table llamadas_modelo enable row level security;
