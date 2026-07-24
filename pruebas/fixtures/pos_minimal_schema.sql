-- Schema minimo real para pruebas unitarias de POS
DROP TABLE IF EXISTS public.pagos CASCADE;
DROP TABLE IF EXISTS public.citas CASCADE;
DROP TABLE IF EXISTS public.horarios CASCADE;
DROP TABLE IF EXISTS public.servicios CASCADE;
DROP TABLE IF EXISTS public.barberos CASCADE;
DROP TABLE IF EXISTS public.barberias CASCADE;

CREATE TABLE public.barberias (
    id INT PRIMARY KEY,
    name VARCHAR(255),
    slot_min INT DEFAULT 15,
    deleted_at TIMESTAMP DEFAULT NULL
);

CREATE TABLE public.barberos (
    id INT PRIMARY KEY,
    barberia_id INT REFERENCES public.barberias(id),
    name VARCHAR(255)
);

CREATE TABLE public.servicios (
    id INT PRIMARY KEY,
    barberia_id INT REFERENCES public.barberias(id),
    duracion_min INT NOT NULL
);

CREATE TABLE public.horarios (
    barberia_id INT REFERENCES public.barberias(id),
    dia_semana INT NOT NULL,
    hora_abre TIME NOT NULL,
    hora_cierra TIME NOT NULL,
    activo BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (barberia_id, dia_semana)
);

CREATE TABLE public.citas (
    id SERIAL PRIMARY KEY,
    barberia_id INT REFERENCES public.barberias(id),
    barbero_id INT REFERENCES public.barberos(id),
    servicio_id INT REFERENCES public.servicios(id),
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME,
    cliente_nombre VARCHAR(255),
    cliente_tel VARCHAR(50),
    estado VARCHAR(50) DEFAULT 'confirmada'
);

CREATE TABLE public.pagos (
    id SERIAL PRIMARY KEY,
    cita_id INT UNIQUE REFERENCES public.citas(id),
    total NUMERIC NOT NULL,
    metodo VARCHAR(50) NOT NULL,
    pagado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    barberia_id INT REFERENCES public.barberias(id)
);
