-- La etapa que dice la consultora, al lado de la que sale de los hitos.
--
-- En la planilla de trabajo hay una columna con la etapa del método —
-- «Onboarding», «Target y Promesa», «Ventas y Cierre»— que la escribe la
-- consultora. La aplicación, por su lado, deduce dónde está el cliente de lo
-- que está hecho y lo que no.
--
-- Las dos cosas se guardan y ninguna pisa a la otra. Cuando no coinciden, eso
-- no es un error de carga: es la conversación que hay que tener. «La planilla
-- dice Ventas y Cierre y la oferta todavía no está cerrada» es exactamente el
-- tipo de cosa para la que existe esto.

alter table clientes add column if not exists etapa_declarada text;
