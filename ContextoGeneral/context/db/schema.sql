-- BarberAgency Database Schema

-- Tabla: Barberías (Tenants)
CREATE TABLE IF NOT EXISTS barbershops (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  website_url VARCHAR(255),
  whatsapp_number VARCHAR(20),
  logo_url VARCHAR(255),
  color_primary VARCHAR(7),
  color_secondary VARCHAR(7),
  timezone VARCHAR(50),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_slug (slug),
  INDEX idx_active (active)
);

-- Tabla: Barberos
CREATE TABLE IF NOT EXISTS barbers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  barbershop_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  specialties JSON COMMENT 'Lista de especialidades',
  hourly_rate DECIMAL(10, 2),
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
  INDEX idx_barbershop (barbershop_id),
  INDEX idx_active (active)
);

-- Tabla: Servicios
CREATE TABLE IF NOT EXISTS services (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  barbershop_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  duration_minutes INT,
  price DECIMAL(10, 2),
  icon_url VARCHAR(255),
  active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
  INDEX idx_barbershop (barbershop_id),
  INDEX idx_active (active)
);

-- Tabla: Disponibilidad de Barberos
CREATE TABLE IF NOT EXISTS barber_availability (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  barber_id BIGINT UNSIGNED NOT NULL,
  day_of_week INT COMMENT '0=Sunday, 6=Saturday',
  start_time TIME,
  end_time TIME,
  lunch_start TIME,
  lunch_end TIME,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE,
  INDEX idx_barber (barber_id),
  UNIQUE KEY unique_availability (barber_id, day_of_week)
);

-- Tabla: Excepciones a Disponibilidad (días libres, vacaciones)
CREATE TABLE IF NOT EXISTS barber_exceptions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  barber_id BIGINT UNSIGNED NOT NULL,
  exception_date DATE,
  reason VARCHAR(255),
  status ENUM('available', 'unavailable') DEFAULT 'unavailable',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (barber_id) REFERENCES barbers(id) ON DELETE CASCADE,
  INDEX idx_barber (barber_id),
  INDEX idx_date (exception_date)
);

-- Tabla: Clientes
CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  barbershop_id BIGINT UNSIGNED NOT NULL,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(255),
  whatsapp VARCHAR(20),
  total_visits INT DEFAULT 0,
  last_visit DATETIME,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
  INDEX idx_barbershop (barbershop_id),
  INDEX idx_phone (phone)
);

-- Tabla: Reservas
CREATE TABLE IF NOT EXISTS reservations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  barbershop_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED,
  barber_id BIGINT UNSIGNED NOT NULL,
  service_id BIGINT UNSIGNED NOT NULL,
  reservation_date DATETIME NOT NULL,
  duration_minutes INT,
  status ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending',
  price DECIMAL(10, 2),
  notes TEXT,
  reminder_sent BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
  FOREIGN KEY (barber_id) REFERENCES barbers(id),
  FOREIGN KEY (service_id) REFERENCES services(id),
  INDEX idx_barbershop (barbershop_id),
  INDEX idx_reservation_date (reservation_date),
  INDEX idx_status (status),
  INDEX idx_customer (customer_id)
);

-- Tabla: Transacciones/Pagos
CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  barbershop_id BIGINT UNSIGNED NOT NULL,
  reservation_id BIGINT UNSIGNED,
  amount DECIMAL(10, 2),
  payment_method VARCHAR(50),
  status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
  transaction_date DATETIME,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (barbershop_id) REFERENCES barbershops(id) ON DELETE CASCADE,
  FOREIGN KEY (reservation_id) REFERENCES reservations(id) ON DELETE SET NULL,
  INDEX idx_barbershop (barbershop_id),
  INDEX idx_status (status),
  INDEX idx_date (transaction_date)
);
