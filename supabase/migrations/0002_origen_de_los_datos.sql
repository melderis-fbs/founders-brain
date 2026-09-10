-- De dónde salió cada dato de la ficha.
--
-- Sin esto no se puede cumplir la regla 9: un análisis automático no puede
-- pisar lo que escribió una persona, y para eso hay que saber quién lo escribió.
-- También guarda la cita, que es lo que va a necesitar la regla 4 cuando la
-- inteligencia artificial proponga campos: nada se afirma sin la frase que lo
-- sostiene.

create table if not exists campo_origen (
  cliente_id     bigint not null references clientes(id) on delete cascade,
  campo          text not null,
  origen         text not null check (origen in ('planilla', 'persona', 'documento')),
  usuario_id     bigint references usuarios(id) on delete set null,
  documento_id   bigint references documentos(id) on delete set null,
  cita           text,
  actualizado_en timestamptz not null default now(),
  primary key (cliente_id, campo)
);
create index if not exists idx_campo_origen_cliente on campo_origen(cliente_id);

alter table campo_origen enable row level security;
