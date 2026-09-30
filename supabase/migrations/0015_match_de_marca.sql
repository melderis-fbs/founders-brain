-- El match de marca entra como tipo de documento propio.
--
-- Hasta acá caía en «otro», y «otro» se lee sin reglas: el motor no sabía que
-- ese texto es trabajo hecho DENTRO del programa, en la etapa 3, y que por lo
-- tanto le gana al formulario de onboarding en cliente ideal, problema, deseo,
-- diferencial, mecanismo y mensaje. El onboarding lo contestó el cliente antes
-- de entrar; el match de marca es lo que salió de trabajarlo.
--
-- Sin esta migración, guardar un documento de este tipo revienta contra el
-- check de la columna. Por eso el chequeo de la base la busca: es una
-- restricción, no una tabla ni una columna, y si no se mira no se ve.

alter table documentos drop constraint if exists documentos_tipo_check;

-- «encuesta» lo agrega formalmente la 0018, pero tiene que estar también acá.
-- Las migraciones se corren todas, en orden, cada vez: si esta restricción
-- prohíbe un tipo que la 0018 permite, la primera vez que alguien vuelva a
-- correrlas sobre una base que YA tiene una encuesta cargada, esto falla y
-- ninguna de las migraciones siguientes llega a aplicarse. Una migración vieja
-- no puede ser más angosta que la base que va a encontrar.
alter table documentos add constraint documentos_tipo_check
  check (tipo in ('onboarding', 'match_de_marca', 'llamada_venta', 'contrato',
                  'sesion', 'notas', 'encuesta', 'otro'));
