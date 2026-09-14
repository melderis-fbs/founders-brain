-- En qué etapa está el cliente, elegida a mano.
--
-- La aplicación deduce en qué etapa tendría que estar por el calendario. Pero
-- la consultora sabe en cuál está de verdad, que muchas veces no es la misma:
-- el cliente se atrasó, se saltó una, o la está rehaciendo.
--
-- Las dos se guardan y ninguna pisa a la otra. Cuando no coinciden, eso no es
-- un error: es la conversación. «Por calendario le tocaría Ventas y Cierre y
-- está en Match de Marca» dice más que cualquiera de las dos sola.
--
-- Es distinto de `etapa_declarada`, que es el texto que venía en la planilla
-- de trabajo y no usa este vocabulario.

alter table clientes add column if not exists etapa_actual text;
