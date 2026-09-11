import type { Expedientito, Lectura, Parte } from '@/lib/lectura'

/**
 * Lo que se puede afirmar con aritmética, antes de gastar un peso en el modelo.
 *
 * Primero la frase, después el número. Un número solo no se puede discutir:
 * «9» no le dice nada a nadie, «la oferta falta hace 27 semanas» se puede
 * confirmar, corregir o llevar a la sesión del martes.
 */
export function LecturaDelCaso({ lectura, ficha }: { lectura: Lectura; ficha: Expedientito }) {
  return (
    <section className="lectura">
      <header>
        <h2>La lectura del caso</h2>
        <p className="mini">Esto sale de restar fechas y contar. No cuesta nada y está siempre al día.</p>
      </header>

      <p className="titular">{lectura.titular}</p>

      {lectura.corte ? (
        <div className={`corte ${lectura.corte.alcanzaParaConcluir ? '' : 'flojo'}`}>
          <span className="rotulo">Dónde se corta · {lectura.corte.etapa}</span>
          <h3>{lectura.corte.etiqueta}</h3>
          <p>{lectura.corte.porque}</p>
          {lectura.corte.alcanzaParaConcluir ? null : (
            <p className="poca-info">La información no alcanza para concluir. Antes de cambiar nada, juntar dato.</p>
          )}
          <p><b>Qué hacer:</b> {lectura.corte.accion}</p>
          <p className="no-hacer"><b>Qué no hacer:</b> {lectura.corte.queNoHacer}</p>
        </div>
      ) : null}

      <div className="bloques">
        {ficha.bloques.map((b) => (
          <div className={`bloque ${b.estado}`} key={b.grupo} title={`${b.cargados} de ${b.total} datos`}>
            <span className="que">{b.etiqueta}</span>
            <span className="cuantos">{b.cargados}/{b.total}</span>
          </div>
        ))}
      </div>
      <p className="que-va-a-poder">{ficha.queVaAPoder}</p>

      <div className="partes">
        {lectura.partes.map((p) => <ParteDeLaLectura key={p.clave} parte={p} />)}
      </div>

      <p className="cobertura">
        {lectura.puntaje === null ? (
          <>Todavía no se puede poner un número: no hay nada medible cargado.</>
        ) : (
          <>
            <b>{lectura.puntaje} de 100</b>, calculado sobre el <b>{lectura.cobertura}%</b> de la información.
            {lectura.cobertura < 60 ? ' Con tan poco cargado, el número todavía no significa mucho.' : ''}
          </>
        )}
      </p>

      {lectura.paraQueValgaMas.length > 0 ? (
        <div className="para-que-valga">
          <span className="rotulo">Para que esto valga más</span>
          <ul>{lectura.paraQueValgaMas.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </div>
      ) : null}
    </section>
  )
}

function ParteDeLaLectura({ parte }: { parte: Parte }) {
  const medido = parte.estado === 'medido'
  return (
    <div className={`parte ${medido ? '' : 'sin-datos'}`}>
      <div className="arriba">
        <span className="que">{parte.etiqueta}</span>
        <span className="cuanto">
          {medido ? parte.valor : 'sin datos'}
          <i> · pesa {parte.peso}%</i>
        </span>
      </div>
      <div className="barra"><i style={{ width: medido ? `${parte.valor}%` : 0 }} /></div>
      <p className="mini">{medido ? parte.detalle : `No opina: ${parte.porque}.`}</p>
      <p className="pregunta">{parte.pregunta}</p>
    </div>
  )
}
