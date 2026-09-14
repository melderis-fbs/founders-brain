-- Las notas de la consultora sobre un cliente.
--
-- Lo que se escribe entre sesiones y no es ni un dato de la ficha ni una
-- bandera: «llamé y no atendió», «pidió mover la del jueves», «está con un
-- tema familiar». Hoy eso vive en el WhatsApp de cada una y se pierde cuando
-- el cliente cambia de mano.
--
-- Cada nota queda con su fecha y quién la escribió. No se editan: si algo
-- cambió, se escribe abajo. Una nota editada pierde lo único que la hace
-- útil, que es qué se sabía en ese momento.

create table if not exists notas (
  id          bigint generated always as identity primary key,
  cliente_id  bigint not null references clientes(id) on delete cascade,
  texto       text not null,
  usuario_id  bigint references usuarios(id) on delete set null,
  creado_en   timestamptz not null default now()
);
create index if not exists idx_notas_cliente on notas(cliente_id, creado_en desc);

alter table notas enable row level security;
