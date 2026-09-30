-- Las consultoras son una lista cerrada, no un texto que alguien escribe.
--
-- Hasta acá se creaban solas: el importador creaba una por cada nombre nuevo de
-- la planilla, el alta de usuario creaba una si el nombre no existía, y el
-- equipo tenía un campo de texto. Cada error de tipeo era una consultora nueva
-- —«Romina», «romina», «Romi»— y los clientes quedaban repartidos entre ellas
-- sin que nadie se enterara: el filtro por consultora mostraba de menos y nadie
-- podía saber por qué.
--
-- El equipo son estas ocho. Cualquier otra que ya esté en la base se queda
-- —tiene clientes colgando— pero queda marcada como de afuera, y en la pantalla
-- del equipo se ve con sus clientes para poder pasarlos a quien corresponda.
--
-- No se adivina nada por parecido (regla 3): que exista una «Romina Gómez» NO
-- la convierte en la «Romina» del equipo. Eso lo decide una persona pasando los
-- clientes, no una consulta con LIKE.

alter table consultoras
  add column if not exists del_equipo boolean not null default false;

-- Las ocho, por su nombre exacto. Si alguna ya estaba escrita igual, se la
-- marca; no se duplica.
insert into consultoras (nombre, nombre_pleg, del_equipo)
values ('Romina', 'romina', true),
       ('Natalia', 'natalia', true),
       ('Jhosanna', 'jhosanna', true),
       ('Johann', 'johann', true),
       ('Catalina', 'catalina', true),
       ('Victoria P', 'victoria p', true),
       ('Victoria A', 'victoria a', true),
       ('Kathering', 'kathering', true)
on conflict (nombre_pleg) do update set del_equipo = true;

create index if not exists idx_consultoras_equipo on consultoras(del_equipo) where del_equipo;
