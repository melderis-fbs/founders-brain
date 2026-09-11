-- Lo que la inteligencia artificial propone para la ficha.
--
-- Regla 4: la IA propone, una persona confirma. Ninguna extracción se aplica
-- sola. Cada propuesta queda acá con la frase del documento de donde salió, y
-- se acepta o se rechaza de a una. Una meta mensual mal deducida no es un dato
-- flojo: es el objetivo que la consultora persigue toda la semana.

create table if not exists propuestas_campo (
  id            bigint generated always as identity primary key,
  cliente_id    bigint not null references clientes(id) on delete cascade,
  campo         text not null,
  valor         text not null,
  cita          text,                    -- la frase textual que la sostiene
  documento_id  bigint references documentos(id) on delete set null,
  estado        text not null default 'pendiente'
                check (estado in ('pendiente', 'aceptada', 'rechazada')),
  decidida_por  bigint references usuarios(id) on delete set null,
  decidida_en   timestamptz,
  creada_en     timestamptz not null default now()
);
create index if not exists idx_propuestas_cliente on propuestas_campo(cliente_id, estado);
-- Una sola propuesta pendiente por campo: volver a correr la extracción
-- reemplaza la anterior en vez de acumular tres versiones del mismo dato.
create unique index if not exists idx_propuestas_pendientes
  on propuestas_campo(cliente_id, campo) where estado = 'pendiente';

alter table propuestas_campo enable row level security;
