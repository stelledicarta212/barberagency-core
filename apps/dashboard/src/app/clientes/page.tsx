"use client";

import { useMemo, useState } from "react";
import { Cake, Clock3, Gift, MoreHorizontal, RefreshCcw, Scissors, Plus, Search, X } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";

type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  lastVisit: string;
  status: "Confirmada" | "Pendiente";
  avatar: string;
  loyaltyPoints: number;
  preferredBarber: string;
  preferredService: string;
  stampCurrent: number;
  stampRequired: number;
  birthdayBenefit: string;
  inactiveDays: number;
  reactivationBenefit: string;
  offPeakBenefit: string;
};

const CLIENTS: Client[] = [
  {
    id: "C-01",
    name: "Juan P.",
    email: "juan.p@gmail.com",
    phone: "(37) 325-8302",
    lastVisit: "25 ene de 2023",
    status: "Confirmada",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop",
    loyaltyPoints: 1200,
    preferredBarber: "Alex M.",
    preferredService: "Corte y Barba",
    stampCurrent: 5,
    stampRequired: 8,
    birthdayBenefit: "20% OFF en cumpleaños",
    inactiveDays: 11,
    reactivationBenefit: "10% OFF si regresa esta semana",
    offPeakBenefit: "15% OFF Lun-Jue 2pm-5pm"
  },
  {
    id: "C-02",
    name: "Carlos R.",
    email: "carlos.r@gmail.com",
    phone: "(47) 327-9335",
    lastVisit: "22 ene de 2023",
    status: "Confirmada",
    avatar: "https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?w=120&auto=format&fit=crop",
    loyaltyPoints: 980,
    preferredBarber: "James R.",
    preferredService: "Fade",
    stampCurrent: 7,
    stampRequired: 8,
    birthdayBenefit: "Servicio de barba gratis",
    inactiveDays: 4,
    reactivationBenefit: "Mensaje no programado",
    offPeakBenefit: "12% OFF Lun-Mie 3pm-5pm"
  },
  {
    id: "C-03",
    name: "Luis G.",
    email: "luis.g@gmail.com",
    phone: "(27) 393-8900",
    lastVisit: "18 ene de 2023",
    status: "Pendiente",
    avatar: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=120&auto=format&fit=crop",
    loyaltyPoints: 640,
    preferredBarber: "Alex M.",
    preferredService: "Corte",
    stampCurrent: 2,
    stampRequired: 8,
    birthdayBenefit: "15% OFF en cumpleaños",
    inactiveDays: 23,
    reactivationBenefit: "Reactiva con 20% OFF",
    offPeakBenefit: "Promo 2x1 en horas muertas"
  },
  {
    id: "C-04",
    name: "Maria S.",
    email: "maria.s@gmail.com",
    phone: "(37) 327-9004",
    lastVisit: "17 ene de 2023",
    status: "Confirmada",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop",
    loyaltyPoints: 1330,
    preferredBarber: "James R.",
    preferredService: "Barba",
    stampCurrent: 8,
    stampRequired: 8,
    birthdayBenefit: "Corte gratis en cumpleaños",
    inactiveDays: 2,
    reactivationBenefit: "No aplica (cliente activa)",
    offPeakBenefit: "20% OFF horario valle"
  },
  {
    id: "C-05",
    name: "Maria S.",
    email: "maria.s@gmail.com",
    phone: "(47) 397-1902",
    lastVisit: "11 ene de 2023",
    status: "Pendiente",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=120&auto=format&fit=crop",
    loyaltyPoints: 520,
    preferredBarber: "Alex M.",
    preferredService: "Corte",
    stampCurrent: 3,
    stampRequired: 8,
    birthdayBenefit: "10% OFF + bebida",
    inactiveDays: 31,
    reactivationBenefit: "Recordatorio activo con 25% OFF",
    offPeakBenefit: "15% OFF horas muertas"
  }
];

function statusClass(status: Client["status"]): string {
  return status === "Confirmada" ? "is-accepted" : "is-pending";
}

export default function ClientesPage() {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CLIENTS;
    return CLIENTS.filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [query]);

  const selected = CLIENTS.find((c) => c.id === selectedId) ?? null;

  return (
    <DashboardShell>
      <section className="ba-client-layout">
        <div className="ba-client-main ba-card">
          <header className="ba-client-head">
            <h1>Clientes</h1>
            <button className="ba-mini-gold" type="button">
              <Plus size={12} />
              Estar cliente
            </button>
          </header>

          <label className="ba-mini-search">
            <Search size={12} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Buscar clientes"
            />
          </label>

          <div className="ba-client-table">
            <div className="ba-client-row ba-client-row-head">
              <span>Nombre</span>
              <span>Contacto</span>
              <span>Ultima Vista</span>
              <span>Estatus</span>
            </div>

            {filtered.map((client) => (
              <button
                key={client.id}
                type="button"
                className={`ba-client-row ${selected?.id === client.id ? "is-selected" : ""}`}
                onClick={() => setSelectedId(client.id)}
              >
                <span className="ba-client-id">
                  <img src={client.avatar} alt={client.name} loading="lazy" />
                  <b>{client.name}</b>
                  <small>{client.email}</small>
                </span>
                <span>{client.phone}</span>
                <span>{client.lastVisit}</span>
                <span>
                  <em className={`ba-status-chip ${statusClass(client.status)}`}>{client.status}</em>
                </span>
              </button>
            ))}
          </div>

          {selected ? (
            <article className="ba-client-card-popup">
              <header>
                <div className="ba-client-popup-user">
                  <img src={selected.avatar} alt={selected.name} loading="lazy" />
                  <div>
                    <strong>{selected.name}</strong>
                    <small>{selected.email}</small>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedId(null)} aria-label="Cerrar ficha">
                  <X size={12} />
                </button>
              </header>

              <div className="ba-client-popup-grid">
                <p><span>Date</span><strong>28 Ene - 10:00 AM</strong></p>
                <p><span>Time</span><strong>Corte y Barba</strong></p>
                <p><span>Unitar</span><strong>{selected.preferredBarber}</strong></p>
              </div>

              <div className="ba-client-popup-meta">
                <p>
                  <span>Barbers Preferido</span>
                  <strong>{selected.preferredBarber}</strong>
                </p>
                <p>
                  <span>Preferencias servicios</span>
                  <strong>{selected.preferredService}</strong>
                </p>
                <p>
                  <span>Notas</span>
                  <strong>Automatico: avisar 1hr antes y ser puntual.</strong>
                </p>
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
                  <li><RefreshCcw size={11} /><span>{selected.inactiveDays} días sin visita · {selected.reactivationBenefit}</span></li>
                  <li><Clock3 size={11} /><span>{selected.offPeakBenefit}</span></li>
                </ul>
              </section>

              <footer>
                <span>Puntos de lealtad</span>
                <strong>{selected.loyaltyPoints}</strong>
              </footer>
            </article>
          ) : null}
        </div>

        <aside className="ba-client-right">
          <article className="ba-card ba-right-widget">
            <header className="ba-right-header">
              <h3>Tasa de Ocupación</h3>
              <MoreHorizontal size={12} />
            </header>
            <p className="ba-client-kpi">88%</p>
            <div className="ba-client-progress">
              <span />
            </div>
          </article>

          <article className="ba-card ba-right-widget">
            <header className="ba-right-header">
              <h3>Servicios</h3>
              <MoreHorizontal size={12} />
            </header>
            <div className="ba-client-mini-services">
              <img src="https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=320&auto=format&fit=crop" alt="Servicio 1" />
              <img src="https://images.unsplash.com/photo-1593702275687-f8b402bfdbdd?w=320&auto=format&fit=crop" alt="Servicio 2" />
            </div>
          </article>

          <article className="ba-card ba-right-widget">
            <header className="ba-right-header">
              <h3>Programa de Lealtad</h3>
              <MoreHorizontal size={12} />
            </header>
            <div className="ba-loyal-icons">
              <span>✕</span><span>✕</span><span>✕</span><span>✕</span>
            </div>
            <p className="ba-loyal-note">Ganancias por incentivdad: <strong>$150</strong></p>
          </article>

          <article className="ba-card ba-right-widget ba-pos-widget">
            <header className="ba-right-header">
              <h3>Caja del Dia</h3>
              <MoreHorizontal size={12} />
            </header>
            <div className="ba-pos-widget-kpis">
              <p><span>Cortes</span><strong>$280</strong></p>
              <p><span>Extras</span><strong>$88</strong></p>
            </div>
            <ul className="ba-pos-widget-list">
              <li><span>Tickets cerrados</span><strong>12</strong></li>
              <li><span>Pendientes</span><strong>2</strong></li>
              <li><span>Neto hoy</span><strong>$392</strong></li>
            </ul>
          </article>
        </aside>
      </section>
    </DashboardShell>
  );
}
