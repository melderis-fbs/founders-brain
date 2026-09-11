-- Cada consultora ve sus clientes; el admin ve todo.
--
-- El usuario que entra se ata a una consultora. Con eso la lista, la ficha y
-- todo lo que cuelga de un cliente se filtran por quién es el que mira.
--
-- Queda en null a propósito para los que ya existen: null no es «ve todo», es
-- «todavía no le asignaron ninguna». La aplicación lo dice con esas palabras
-- en vez de mostrar una lista vacía, que se lee como «no tenés clientes».

alter table usuarios add column if not exists consultora_id bigint references consultoras(id) on delete set null;

create index if not exists idx_usuarios_consultora on usuarios(consultora_id);
