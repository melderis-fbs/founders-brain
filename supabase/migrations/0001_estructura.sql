-- FOUNDERS BRAIN · estructura base
--
-- Un cliente no vive en una columna JSON: vive en tablas, y los bloques de la
-- ficha son tablas 1 a 1 con el cliente. El texto largo de los documentos vive
-- aparte, así ninguna lista lo arrastra al navegador.

-- ── Quién entra a la aplicación ────────────────────────────────────────────
create table if not exists usuarios (
  id          bigint generated always as identity primary key,
  email       text not null unique,
  nombre      text not null,
  rol         text not null check (rol in ('admin', 'consultora')),
  clave_hash  text not null,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

create table if not exists sesiones_login (
  token       text primary key,
  usuario_id  bigint not null references usuarios(id) on delete cascade,
  creado_en   timestamptz not null default now(),
  expira_en   timestamptz not null
);
create index if not exists idx_sesiones_usuario on sesiones_login(usuario_id);

-- ── Las consultoras ────────────────────────────────────────────────────────
create table if not exists consultoras (
  id           bigint generated always as identity primary key,
  nombre       text not null,
  nombre_pleg  text not null unique,          -- sin acentos ni mayúsculas, para no crear dos veces la misma
  usuario_id   bigint references usuarios(id) on delete set null,
  activa       boolean not null default true,
  creado_en    timestamptz not null default now()
);

-- ── El cliente ─────────────────────────────────────────────────────────────
create table if not exists clientes (
  id                  bigint generated always as identity primary key,
  ref_externa         text unique,            -- el id que trae la planilla, si lo trae
  nombre              text not null,
  nombre_clave        text not null unique,   -- sólo espacios normalizados: «Maria» y «María» siguen siendo distintos (regla 3)
  nombre_pleg         text not null,          -- plegado: se usa para AVISAR de parecidos, nunca para decidir
  email               text,
  telefono            text,
  consultora_id       bigint references consultoras(id) on delete set null,
  programa_meses      integer,
  fecha_inicio        date,
  fecha_fin_prevista  date,
  estado              text check (estado in ('activo', 'pausado', 'baja', 'finalizado')),
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now()
);
create index if not exists idx_clientes_consultora on clientes(consultora_id);
create index if not exists idx_clientes_pleg on clientes(nombre_pleg);
create index if not exists idx_clientes_estado on clientes(estado);

create table if not exists cliente_negocio (
  cliente_id          bigint primary key references clientes(id) on delete cascade,
  rubro               text,
  que_vende           text,
  cliente_ideal       text,
  problema            text,
  oferta              text,
  promesa             text,
  mensaje             text,
  canal               text,
  diferencial         text,
  modelo_negocio      text check (modelo_negocio in ('servicio', 'producto', 'infoproducto', 'mixto')),
  antiguedad_negocio  numeric(5,1),
  equipo              integer
);

create table if not exists cliente_numeros (
  cliente_id            bigint primary key references clientes(id) on delete cascade,
  moneda                text,
  ticket                numeric(14,2),
  meta_mensual          numeric(14,2),
  facturacion_actual    numeric(14,2),
  precio_actual         numeric(14,2),
  ventas_ultimo_mes     integer,
  tiene_tracker         boolean,
  fecha_cuenta_inversa  date
);

create table if not exists cliente_comercial (
  cliente_id      bigint primary key references clientes(id) on delete cascade,
  valor_programa  numeric(14,2),
  forma_pago      text check (forma_pago in ('contado', 'cuotas')),
  cuotas_totales  integer,
  garantia        boolean
);

-- ── Los documentos del cliente ─────────────────────────────────────────────
create table if not exists documentos (
  id              bigint generated always as identity primary key,
  cliente_id      bigint not null references clientes(id) on delete cascade,
  tipo            text not null check (tipo in ('onboarding', 'llamada_venta', 'contrato', 'sesion', 'notas', 'otro')),
  titulo          text not null,
  fecha           date,
  texto           text,
  caracteres      integer not null default 0,
  archivo_nombre  text,
  origen          text not null check (origen in ('planilla', 'pegado', 'archivo')),
  creado_en       timestamptz not null default now()
);
create index if not exists idx_documentos_cliente on documentos(cliente_id, creado_en desc);
-- Regla 7: volver a importar corrige, no duplica. Un documento por (cliente, tipo)
-- para lo que viene de la planilla; lo que carga una persona no tiene este límite.
create unique index if not exists idx_documentos_planilla
  on documentos(cliente_id, tipo) where origen = 'planilla';

-- ── El reporte de cada importación ─────────────────────────────────────────
create table if not exists importaciones (
  id                     bigint generated always as identity primary key,
  usuario_id             bigint references usuarios(id) on delete set null,
  archivo                text not null,
  origen                 text not null,
  filas_leidas           integer not null default 0,
  clientes_nuevos        integer not null default 0,
  clientes_actualizados  integer not null default 0,
  filas_sin_cambios      integer not null default 0,
  filas_omitidas         integer not null default 0,
  columnas_ignoradas     text[],
  error_general          text,
  creado_en              timestamptz not null default now()
);
create index if not exists idx_importaciones_fecha on importaciones(creado_en desc);

create table if not exists importacion_filas (
  id              bigint generated always as identity primary key,
  importacion_id  bigint not null references importaciones(id) on delete cascade,
  nro_fila        integer not null,
  cliente_nombre  text,
  cliente_id      bigint,
  resultado       text not null check (resultado in ('nuevo', 'actualizado', 'sin_cambios', 'omitida')),
  motivo          text,      -- por qué no entró la fila entera
  avisos          text[]     -- datos sueltos que no entraron aunque la fila sí
);
create index if not exists idx_filas_importacion on importacion_filas(importacion_id, nro_fila);

-- ── Nada de esto se sirve por la API pública de Supabase ────────────────────
-- La aplicación entra por conexión Postgres del lado del servidor, con el rol
-- dueño de las tablas. Con RLS prendido y sin políticas, la clave anónima no
-- puede leer ni escribir nada, ni siquiera si se filtra.
do $$
declare t text;
begin
  foreach t in array array[
    'usuarios', 'sesiones_login', 'consultoras', 'clientes', 'cliente_negocio',
    'cliente_numeros', 'cliente_comercial', 'documentos', 'importaciones', 'importacion_filas'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
