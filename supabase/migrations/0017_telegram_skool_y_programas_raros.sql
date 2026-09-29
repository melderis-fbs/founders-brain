-- Dónde encontrar al cliente todos los días, y los programas que no son de 4 ni 6.
--
-- El grupo de Telegram con el coach y el usuario de Skool son los dos lugares
-- por donde se le habla de verdad. Estaban en la cabeza de cada consultora, así
-- que cuando un cliente cambiaba de manos había que ir a buscarlos.
--
-- La duración del programa ya era un número libre en la base: lo que estaba
-- limitado a 4 y 6 era el desplegable de la pantalla. Se agregan 5 meses y 1 año
-- para las excepciones y los pagos full.

alter table clientes
  add column if not exists telegram  text,   -- el link del grupo
  add column if not exists skool     text;   -- el usuario en la comunidad
