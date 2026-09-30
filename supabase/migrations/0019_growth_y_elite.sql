-- Los dos programas que existen hoy: Growth y Elite.
--
-- Antes eran tres —M1, M1+ y M2— y en la aplicación no eran nada: había una
-- casilla suelta, «sigue el Road Map», que alguien tenía que acordarse de
-- destildar. Ahora el programa es un dato del cliente y de él sale todo lo
-- demás: Growth se compara contra las catorce etapas en dieciséis semanas;
-- Elite no tiene estructura fija —se trabaja sobre el caso— así que no se lo
-- compara contra nada y su plan lo escribe su coach.
--
-- M1 pasó a ser Growth. M1+ y M2 pasaron a ser Elite.

alter table clientes
  add column if not exists programa text check (programa in ('growth', 'elite'));

-- Lo que ya estaba marcado como fuera del Road Map es Elite; el resto, Growth.
-- Se toca sólo lo que está en null: si alguien ya eligió, no se le pisa.
update clientes set programa = case when sigue_el_programa then 'growth' else 'elite' end
 where programa is null;

create index if not exists idx_clientes_programa on clientes(programa);
