"use client";

import { useMemo, useState } from "react";
import { Cake, ChevronLeft, ChevronRight, Clock3, Eye, Gift, MoreHorizontal, Plus, RefreshCcw, Scissors, Send, X } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";

type RequestStatus = "Pendiente" | "Enviada" | "Aceptada";

type RequestItem = {
  id: string;
  client: string;
  service: string;
  date: string;
  status: RequestStatus;
  avatar: string;
  stampCurrent: number;
  stampRequired: number;
  birthdayBenefit: string;
  inactiveDays: number;
  reactivationBenefit: string;
  offPeakBenefit: string;
};

type CreatedAppointment = {
  ticketId: string;
  client: string;
  date: string;
  items: Array<{ name: string; price: number }>;
  subtotal: number;
  tax: number;
  total: number;
};

const INITIAL_REQUESTS: RequestItem[] = [
  {
    id: "R-01",
    client: "Juan Perez",
    service: "Corte de Pelo",
    date: "15/05/2023",
    status: "Pendiente",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop",
    stampCurrent: 5,
    stampRequired: 8,
    birthdayBenefit: "20% OFF en cumpleanos",
    inactiveDays: 11,
    reactivationBenefit: "10% OFF si regresa esta semana",
    offPeakBenefit: "15% OFF Lun-Jue 2pm-5pm"
  },
  {
    id: "R-02",
    client: "Juan Perez",
    service: "Corte de Pelo",
    date: "11/06/2023",
    status: "Enviada",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop",
    stampCurrent: 5,
    stampRequired: 8,
    birthdayBenefit: "20% OFF en cumpleanos",
    inactiveDays: 11,
    reactivationBenefit: "10% OFF si regresa esta semana",
    offPeakBenefit: "15% OFF Lun-Jue 2pm-5pm"
  },
  {
    id: "R-03",
    client: "Olivik",
    service: "Corte de Pelo",
    date: "19/09/2023",
    status: "Aceptada",
    avatar: "https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?w=120&auto=format&fit=crop",
    stampCurrent: 7,
    stampRequired: 8,
    birthdayBenefit: "Servicio de barba gratis",
    inactiveDays: 4,
    reactivationBenefit: "Mensaje no programado",
    offPeakBenefit: "12% OFF Lun-Mie 3pm-5pm"
  }
];

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];
const DAYS = ["L", "M", "X", "J", "V", "S", "D"];

function statusClass(status: RequestStatus): string {
  if (status === "Pendiente") return "is-pending";
  if (status === "Enviada") return "is-sent";
  return "is-accepted";
}

function buildCalendar(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDayJs = new Date(year, month, 1).getDay();
  const firstDayMondayIndex = (firstDayJs + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: Array<{ day: number | null; key: string }> = [];
  for (let i = 0; i < firstDayMondayIndex; i += 1) cells.push({ day: null, key: `pad-start-${i}` });
  for (let d = 1; d <= daysInMonth; d += 1) cells.push({ day: d, key: `d-${d}` });
  while (cells.length % 7 !== 0) cells.push({ day: null, key: `pad-end-${cells.length}` });
  return cells;
}

function toCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function parseServices(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatDate(day: number, month: number, year: number): string {
  const dd = String(day).padStart(2, "0");
  const mm = String(month + 1).padStart(2, "0");
  return `${dd}/${mm}/${year}`;
}

export default function CitasPage() {
  const [requests, setRequests] = useState<RequestItem[]>(INITIAL_REQUESTS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
  const [form, setForm] = useState({
    cliente: "camilo rodriguez",
    servicios: "Corte de Pelo, Barba",
    descripcion: "Descripcion de cita de lado..."
  });
  const [created, setCreated] = useState<CreatedAppointment | null>(null);

  const selected = requests.find((req) => req.id === selectedId) ?? null;
  const calendarCells = useMemo(() => buildCalendar(currentMonth), [currentMonth]);
  const monthLabel = `${MONTHS[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;

  const serviceList = useMemo(() => parseServices(form.servicios), [form.servicios]);
  const computedItems = useMemo(() => {
    const fallback = ["Servicio"];
    const names = serviceList.length ? serviceList : fallback;
    return names.map((name, idx) => ({ name, price: idx === 0 ? 15 : 6 }));
  }, [serviceList]);
  const subtotal = useMemo(() => computedItems.reduce((acc, item) => acc + item.price, 0), [computedItems]);
  const tax = useMemo(() => Number((subtotal * 0.13).toFixed(2)), [subtotal]);
  const total = useMemo(() => Number((subtotal + tax).toFixed(2)), [subtotal, tax]);

  const activeSummary = created ?? {
    ticketId: "1234",
    client: form.cliente || "cliente",
    date: selectedDay ? formatDate(selectedDay, currentMonth.getMonth(), currentMonth.getFullYear()) : "Sin fecha",
    items: computedItems,
    subtotal,
    tax,
    total
  };

  const prevMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setSelectedDay(null);
  };

  const nextMonth = () => {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setSelectedDay(null);
  };

  const handleCreateCita = () => {
    if (!selectedDay) return;
    const date = formatDate(selectedDay, currentMonth.getMonth(), currentMonth.getFullYear());
    const firstService = computedItems[0]?.name ?? "Servicio";
    const id = `R-${String(requests.length + 1).padStart(2, "0")}`;
    const ticketId = String(1234 + requests.length);

    const newRequest: RequestItem = {
      id,
      client: form.cliente || "Cliente",
      service: firstService,
      date,
      status: "Enviada",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop",
      stampCurrent: 1,
      stampRequired: 8,
      birthdayBenefit: "15% OFF en cumpleanos",
      inactiveDays: 0,
      reactivationBenefit: "Recien creada",
      offPeakBenefit: "Promo segun horario"
    };

    setRequests((prev) => [newRequest, ...prev]);
    setSelectedId(id);
    setCreated({
      ticketId,
      client: form.cliente || "Cliente",
      date,
      items: computedItems,
      subtotal,
      tax,
      total
    });
  };

  return (
    <DashboardShell>
      <section className="ba-citas-layout">
        <div className="ba-citas-left ba-card">
          <header className="ba-citas-head">
            <h1>Citas</h1>
            <button type="button" className="ba-mini-gold" onClick={() => setIsCreateOpen((v) => !v)}>
              <Plus size={12} />
              {isCreateOpen ? "Ocultar Nueva Cita" : "Crear Nueva Cita"}
            </button>
          </header>

          <nav className="ba-citas-tabs">
            <button type="button" className="is-active">Week</button>
            <button type="button">Nueva de Citas</button>
            <button type="button">Servicios</button>
          </nav>

          <article className="ba-card ba-citas-calendar-inline">
            <header className="ba-card-title">
              <h2>Calendario de Citas</h2>
              <button type="button" aria-label="Opciones"><MoreHorizontal size={12} /></button>
            </header>
            <div className="ba-calendar-nav">
              <button type="button" aria-label="Mes anterior" onClick={prevMonth}><ChevronLeft size={12} /></button>
              <span>{monthLabel}</span>
              <button type="button" aria-label="Mes siguiente" onClick={nextMonth}><ChevronRight size={12} /></button>
            </div>
            <div className="ba-mini-calendar">
              {DAYS.map((day) => (
                <div key={`head-${day}`} className="is-head">{day}</div>
              ))}
              {calendarCells.map((cell) => (
                <button
                  key={cell.key}
                  type="button"
                  className={`is-cell ${cell.day !== null && selectedDay === cell.day ? "is-active" : ""}`}
                  onClick={() => cell.day !== null && setSelectedDay(cell.day)}
                  disabled={cell.day === null}
                >
                  {cell.day ?? ""}
                </button>
              ))}
            </div>
          </article>

          <article className="ba-citas-table-wrap">
            <header className="ba-citas-table-head">
              <h3>Solicitudes de Cita</h3>
              <button type="button" aria-label="Opciones"><MoreHorizontal size={12} /></button>
            </header>

            <div className="ba-citas-table">
              <div className="ba-citas-row ba-citas-row-head">
                <span>Cliente</span>
                <span>Servicio</span>
                <span>Fecha</span>
                <span>Estado</span>
                <span>Acciones</span>
              </div>

              {requests.map((req) => (
                <div
                  className={`ba-citas-row ba-citas-row-selectable ${selected?.id === req.id ? "is-selected" : ""}`}
                  key={req.id}
                  onClick={() => setSelectedId(req.id)}
                >
                  <span className="ba-citas-client">
                    <img src={req.avatar} alt={req.client} loading="lazy" />
                    {req.client}
                  </span>
                  <span>{req.service}</span>
                  <span>{req.date}</span>
                  <span>
                    <em className={`ba-status-chip ${statusClass(req.status)}`}>{req.status}</em>
                  </span>
                  <span className="ba-citas-actions">
                    <button type="button"><Eye size={11} />Ver</button>
                    <button type="button"><Send size={11} />Enviar</button>
                  </span>
                </div>
              ))}
            </div>
          </article>

          {selected ? (
            <article className="ba-overlay-card">
              <header className="ba-overlay-head">
                <div className="ba-overlay-user">
                  <img src={selected.avatar} alt={selected.client} loading="lazy" />
                  <div>
                    <strong>{selected.client}</strong>
                    <small>{selected.service}</small>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedId(null)} aria-label="Cerrar ficha">
                  <X size={12} />
                </button>
              </header>
              <div className="ba-overlay-grid">
                <p><span>Fecha</span><strong>{selected.date}</strong></p>
                <p><span>Estado</span><strong>{selected.status}</strong></p>
                <p><span>Servicio</span><strong>{selected.service}</strong></p>
              </div>
              <section className="ba-client-loyalty-card">
                <header>
                  <h4><Gift size={12} />Beneficios de Lealtad</h4>
                </header>
                <div className="ba-client-stamp-track">
                  {Array.from({ length: selected.stampRequired }, (_, idx) => (
                    <span key={`stamp-${idx}`} className={idx < selected.stampCurrent ? "is-on" : ""}>
                      <Scissors size={11} />
                    </span>
                  ))}
                </div>
                <small className="ba-client-stamp-note">
                  {selected.stampCurrent} / {selected.stampRequired} sellos
                </small>
                <ul>
                  <li><Cake size={11} /><span>{selected.birthdayBenefit}</span></li>
                  <li><RefreshCcw size={11} /><span>{selected.inactiveDays} dias sin visita · {selected.reactivationBenefit}</span></li>
                  <li><Clock3 size={11} /><span>{selected.offPeakBenefit}</span></li>
                </ul>
              </section>
              <footer className="ba-overlay-actions">
                <button type="button" className="ba-btn-ghost">Ver</button>
                <button type="button" className="ba-card-gold">Enviar</button>
              </footer>
            </article>
          ) : null}
        </div>

        <aside className="ba-citas-right">
          {isCreateOpen ? (
            <article className="ba-card ba-cita-form">
              <header className="ba-right-header">
                <h3>Crear Nueva Cita</h3>
                <button type="button" aria-label="Opciones"><MoreHorizontal size={12} /></button>
              </header>

              <label>Cliente</label>
              <input
                className="ba-mini-field"
                value={form.cliente}
                onChange={(e) => setForm((prev) => ({ ...prev, cliente: e.target.value }))}
              />

              <label>Seleccion de Servicios</label>
              <input
                className="ba-mini-field"
                value={form.servicios}
                onChange={(e) => setForm((prev) => ({ ...prev, servicios: e.target.value }))}
              />

              <label>Descripcion</label>
              <textarea
                className="ba-mini-textarea"
                value={form.descripcion}
                onChange={(e) => setForm((prev) => ({ ...prev, descripcion: e.target.value }))}
                placeholder="Descripcion de cita de lado..."
              />

              <div className="ba-mini-total">
                <small>Fecha seleccionada</small>
                <strong>{selectedDay ? formatDate(selectedDay, currentMonth.getMonth(), currentMonth.getFullYear()) : "Sin fecha"}</strong>
              </div>

              <div className="ba-mini-total">
                <small>Precio Total</small>
                <strong>{toCurrency(total)}</strong>
              </div>

              <button type="button" className="ba-card-gold" onClick={handleCreateCita} disabled={!selectedDay}>Enviar Cita</button>
            </article>
          ) : (
            <article className="ba-card ba-cita-form">
              <header className="ba-right-header">
                <h3>Nueva Cita Oculta</h3>
              </header>
              <p className="ba-loyal-note">Pulsa Crear Nueva Cita para mostrar el formulario.</p>
            </article>
          )}

          <article className="ba-card ba-cita-summary">
            <header className="ba-right-header">
              <h3>Cita #{activeSummary.ticketId} para {activeSummary.client || "cliente"}</h3>
              <button type="button" aria-label="Opciones"><MoreHorizontal size={12} /></button>
            </header>

            <ul>
              {activeSummary.items.map((item, idx) => (
                <li key={`${item.name}-${idx}`}><span>{item.name}</span><span>{toCurrency(item.price)}</span></li>
              ))}
              <li><span>Fecha</span><span>{activeSummary.date}</span></li>
              <li><span>Subtotal</span><span>{toCurrency(activeSummary.subtotal)}</span></li>
              <li><span>Impuesto</span><span>{toCurrency(activeSummary.tax)}</span></li>
              <li className="is-total"><span>Total</span><span>{toCurrency(activeSummary.total)}</span></li>
            </ul>

            <div className="ba-cita-summary-actions">
              <button type="button" className="ba-btn-ghost">Editar</button>
              <button type="button" className="ba-card-gold">Enviar</button>
            </div>
          </article>
        </aside>
      </section>
    </DashboardShell>
  );
}
