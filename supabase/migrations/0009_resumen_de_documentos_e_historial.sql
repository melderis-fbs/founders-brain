-- Que nada empiece de cero dos veces.
--
-- Dos cosas distintas, las dos por el mismo motivo.
--
-- 1. El resumen de cada documento. Leer un documento cuesta plata; leerlo otra
--    vez para el diagnóstico, y otra para la próxima sesión, cuesta tres veces
--    lo mismo por la misma información. El resumen se hace una vez, queda
--    guardado con su fecha, y de ahí en adelante el diagnóstico trabaja sobre
--    los resúmenes de TODOS los documentos en vez de sobre el texto de los
--    pocos que entraban por tamaño.
--
-- 2. El historial de cada campo. Hasta acá se sabía de dónde salió el valor de
--    hoy, pero no qué decía antes. Sin eso no se puede ver que el cliente ideal
--    cambió tres veces en dos meses, que es justamente lo que hay que mirar.

alter table documentos add column if not exists resumen        text;
alter table documentos add column if not exists resumen_en     timestamptz;
alter table documentos add column if not exists resumen_modelo text;

create table if not exists campo_historial (
  id             bigint generated always as identity primary key,
  cliente_id     bigint not null references clientes(id) on delete cascade,
  campo          text not null,
  valor_anterior text,                    -- null la primera vez que se carga
  valor_nuevo    text,                    -- null cuando se vacía el campo
  origen         text not null,           -- 'planilla' | 'persona' | 'documento'
  cita           text,
  usuario_id     bigint references usuarios(id) on delete set null,
  creado_en      timestamptz not null default now()
);
create index if not exists idx_historial_cliente on campo_historial(cliente_id, campo, creado_en desc);

alter table campo_historial enable row level security;
