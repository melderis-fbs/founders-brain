-- Las sesiones 1:1 con el cliente.
--
-- Una fila por sesión: cuándo fue, qué pasó y en qué estado quedó. La
-- transcripción vive acá y se analiza sólo cuando alguien aprieta Analizar,
-- nunca al abrir la pantalla.

create table if not exists sesiones (
  id             bigint generated always as identity primary key,
  cliente_id     bigint not null references clientes(id) on delete cascade,
  numero         integer,
  fecha          date,
  estado         text not null default 'hecha'
                 check (estado in ('agendada', 'hecha', 'cancelada', 'no_asistio')),
  que_paso       text,           -- la línea que se lee en la lista
  transcripcion  text,
  analisis       text,           -- lo que devolvió el análisis, tal cual
  puntos         text[],         -- de tres a cinco, ni uno más
  compromisos    text[],
  analizada_en   timestamptz,
  creado_en      timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);
create index if not exists idx_sesiones_cliente on sesiones(cliente_id, fecha desc nulls last, numero desc nulls last);
create unique index if not exists idx_sesiones_numero on sesiones(cliente_id, numero) where numero is not null;

alter table sesiones enable row level security;
