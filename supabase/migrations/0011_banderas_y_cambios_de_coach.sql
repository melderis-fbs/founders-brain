-- Dos cosas que hasta acá no tenían dónde vivir.
--
-- 1. LAS BANDERAS. Lo que la aplicación calcula sale de fechas y de datos
--    cargados. Una consultora que sale de una sesión sabiendo que el cliente
--    está por irse no tiene ningún campo donde poner eso, y el sistema lo
--    muestra en verde. La bandera es el lugar: la levanta una persona, dice
--    por qué, y se baja cuando se resolvió, diciendo cómo.
--
--    Una sola abierta por cliente: la bandera es el estado del cliente, no una
--    lista de pendientes. Cambiarle el color es cambiar la que está.
--
-- 2. LOS CAMBIOS DE CONSULTORA. Pasar un cliente de mano es una decisión que
--    se toma por algo, y después nadie se acuerda de por qué. Queda con su
--    fecha, su motivo y quién lo hizo. Se guarda además del historial de
--    campos porque ahí no entra el motivo.

create table if not exists banderas (
  id              bigint generated always as identity primary key,
  cliente_id      bigint not null references clientes(id) on delete cascade,
  color           text not null check (color in ('roja', 'naranja', 'amarilla')),
  motivo          text not null,
  puesta_por      bigint references usuarios(id) on delete set null,
  puesta_en       timestamptz not null default now(),
  resuelta_en     timestamptz,
  resuelta_por    bigint references usuarios(id) on delete set null,
  como_se_resolvio text
);
create index if not exists idx_banderas_cliente on banderas(cliente_id, puesta_en desc);

-- Una sola bandera abierta por cliente.
create unique index if not exists idx_bandera_abierta
  on banderas(cliente_id) where resuelta_en is null;

alter table banderas enable row level security;

create table if not exists cambios_de_consultora (
  id              bigint generated always as identity primary key,
  cliente_id      bigint not null references clientes(id) on delete cascade,
  de_consultora   bigint references consultoras(id) on delete set null,
  a_consultora    bigint references consultoras(id) on delete set null,
  motivo          text not null,
  usuario_id      bigint references usuarios(id) on delete set null,
  creado_en       timestamptz not null default now()
);
create index if not exists idx_cambios_consultora_cliente on cambios_de_consultora(cliente_id, creado_en desc);

alter table cambios_de_consultora enable row level security;
