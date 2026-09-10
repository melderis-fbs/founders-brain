-- El diagnóstico del caso.
--
-- Se guarda con su fecha porque no se vuelve a hacer solo: si ya se hizo, se
-- muestra el guardado. Correr de nuevo es una decisión de alguien, no un
-- efecto de abrir una pantalla.

create table if not exists diagnosticos (
  id              bigint generated always as identity primary key,
  cliente_id      bigint not null references clientes(id) on delete cascade,
  usuario_id      bigint references usuarios(id) on delete set null,
  texto           text not null,          -- la respuesta entera, tal cual
  donde_se_corta  text,
  de_quien_es     text,                   -- ¿es el cliente o somos nosotros?
  acciones        text[],                 -- tres como máximo
  falta_cargar    text[],
  creado_en       timestamptz not null default now()
);
create index if not exists idx_diagnosticos_cliente on diagnosticos(cliente_id, creado_en desc);

alter table diagnosticos enable row level security;
