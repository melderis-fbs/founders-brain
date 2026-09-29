-- Cuatro cosas que faltaban y que el equipo pidió con nombre y apellido.

-- ── 1 · Los números, mes por mes ──────────────────────────────────────────
-- La ficha guardaba «ventas del último mes» y «facturación de hoy»: un número
-- que se pisa a sí mismo cada vez que se actualiza. Así no se puede ver si el
-- cliente está creciendo, que es la única pregunta que importa. Ahora cada mes
-- es una fila y el total se suma.
create table if not exists cliente_mes (
  id           bigint generated always as identity primary key,
  cliente_id   bigint not null references clientes(id) on delete cascade,
  anio         integer not null check (anio between 2020 and 2100),
  mes          integer not null check (mes between 1 and 12),
  ventas       integer check (ventas >= 0),
  ticket       numeric(14,2) check (ticket >= 0),
  facturacion  numeric(14,2) check (facturacion >= 0),
  nota         text,
  cargado_por  bigint references usuarios(id) on delete set null,
  creado_en    timestamptz not null default now(),
  unique (cliente_id, anio, mes)
);
create index if not exists idx_mes_cliente on cliente_mes(cliente_id, anio desc, mes desc);

-- ── 2 · Los clientes que no siguen el Road Map ────────────────────────────
-- Los M2 no tienen estructura definida: se trabaja sobre el caso puntual. Hasta
-- acá todos se comparaban contra las catorce etapas en dieciséis semanas, así
-- que un M2 salía «grave» por no hacer algo que nunca le tocó hacer. Comparar
-- contra un camino que no es el suyo no es medir: es ensuciar el tablero.
alter table clientes
  add column if not exists sigue_el_programa boolean not null default true,
  add column if not exists plan_propio       text;   -- el camino que le arma su coach

-- ── 3 · Las encuestas de satisfacción ─────────────────────────────────────
-- Entraban como «otro», que se lee sin reglas. Son otra cosa: las contesta el
-- cliente sobre NOSOTROS, no sobre su negocio.
alter table documentos drop constraint if exists documentos_tipo_check;
alter table documentos add constraint documentos_tipo_check
  check (tipo in ('onboarding', 'match_de_marca', 'llamada_venta', 'contrato',
                  'sesion', 'notas', 'encuesta', 'otro'));

-- ── 4 · El archivo original, para poder verlo como es ─────────────────────
-- De un contrato se extrae el texto para leerlo, pero el texto plano pierde los
-- bloques, las cláusulas y las firmas: hay que poder abrir el PDF como es.
--
-- Vive en su propia tabla y no en `documentos` a propósito: así ninguna consulta
-- de la lista arrastra los bytes sin querer. El tope de peso lo pone la
-- aplicación, no la base.
create table if not exists documento_archivo (
  documento_id  bigint primary key references documentos(id) on delete cascade,
  bytes         bytea not null,
  tipo_mime     text not null,
  peso          integer not null,
  creado_en     timestamptz not null default now()
);

alter table cliente_mes enable row level security;
alter table documento_archivo enable row level security;
