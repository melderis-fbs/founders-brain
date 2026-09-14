-- Los hitos clave de cada fase, marcados por cliente.
--
-- El programa dice qué tiene que quedar hecho en cada fase: la presentación en
-- Telegram el día 1, la oferta en video con #mioferta, el reto de 21 días, la
-- primera venta. Eso no sale de ningún campo de la ficha ni de ningún
-- documento: lo sabe la consultora, y hasta acá no tenía dónde ponerlo.
--
-- La fila existe cuando está hecho. No hay «pendiente» guardado: pendiente es
-- la ausencia de fila, y así no hay dos lugares donde pueda decir cosas
-- distintas.

create table if not exists hitos_clave (
  id          bigint generated always as identity primary key,
  cliente_id  bigint not null references clientes(id) on delete cascade,
  clave       text not null,
  hecho_en    date not null default current_date,
  usuario_id  bigint references usuarios(id) on delete set null,
  creado_en   timestamptz not null default now(),
  unique (cliente_id, clave)
);
create index if not exists idx_hitos_clave_cliente on hitos_clave(cliente_id);

alter table hitos_clave enable row level security;
