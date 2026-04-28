"use client";

import { useMemo, useState } from "react";
import { Clock3, DollarSign, MoreHorizontal, Plus, Search, SlidersHorizontal, SquarePen, Trash2, X } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { useDashboard } from "@/store/dashboard-context";

const FALLBACK_SERVICE_IMAGES = [
  "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1593702275687-f8b402bfdbdd?w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=900&auto=format&fit=crop"
];

type ServiceCard = {
  id: string;
  name: string;
  description: string;
  duration: number;
  price: number;
  image: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function ServiciosPage() {
  const { merged } = useDashboard();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const services = useMemo<ServiceCard[]>(() => {
    return merged.services.map((item, index) => {
      const name = text(item.nombre ?? item.name) || `Servicio ${index + 1}`;
      const duration = Math.max(15, numberValue(item.duracion_min ?? item.duration_minutes, 45));
      const price = Math.max(5, numberValue(item.precio ?? item.price, 40));
      const image = text(item.image_url ?? item.foto_url ?? item.cover_url) || FALLBACK_SERVICE_IMAGES[index % FALLBACK_SERVICE_IMAGES.length];

      return {
        id: text(item.id) || `service-${index}`,
        name,
        description: text(item.descripcion ?? item.description) || `${name} con acabado premium y detalle profesional.`,
        duration,
        price,
        image
      };
    });
  }, [merged.services]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter((service) => service.name.toLowerCase().includes(q) || service.description.toLowerCase().includes(q));
  }, [services, query]);
  const selected = filtered.find((service) => service.id === selectedId) ?? null;

  return (
    <DashboardShell>
      <section className="ba-services-layout">
        <div className="ba-services-main ba-card">
          <header className="ba-services-head">
            <h1>Servicios</h1>
            <button type="button" className="ba-mini-gold">
              <Plus size={12} />
              Añadir Servicio
            </button>
          </header>

          <div className="ba-services-toolbar">
            <button type="button" className="ba-services-filter">
              <SlidersHorizontal size={12} />
              Filtro
            </button>
            <label className="ba-mini-search">
              <Search size={12} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                aria-label="Buscar servicios"
              />
            </label>
          </div>

          <div className="ba-services-grid">
            {filtered.map((service) => (
              <article
                key={service.id}
                className={`ba-service-card ${selected?.id === service.id ? "is-selected" : ""}`}
                onClick={() => setSelectedId(service.id)}
              >
                <div className="ba-service-media">
                  <img src={service.image} alt={service.name} loading="lazy" />
                  <button type="button" aria-label="Opciones" className="ba-card-menu">
                    <MoreHorizontal size={12} />
                  </button>
                </div>
                <div className="ba-service-body">
                  <h3>{service.name}</h3>
                  <p>{service.description}</p>
                  <div className="ba-service-meta">
                    <span><Clock3 size={11} />{service.duration} min</span>
                    <strong><DollarSign size={11} />{service.price}</strong>
                  </div>
                  <div className="ba-service-actions">
                    <button type="button" aria-label="Editar"><SquarePen size={12} /></button>
                    <button type="button" aria-label="Eliminar"><Trash2 size={12} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {selected ? (
            <article className="ba-overlay-card">
              <header className="ba-overlay-head">
                <div className="ba-overlay-user">
                  <img src={selected.image} alt={selected.name} loading="lazy" />
                  <div>
                    <strong>{selected.name}</strong>
                    <small>{selected.description}</small>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedId(null)} aria-label="Cerrar ficha">
                  <X size={12} />
                </button>
              </header>
              <div className="ba-overlay-grid">
                <p><span>Duración</span><strong>{selected.duration} min</strong></p>
                <p><span>Precio</span><strong>${selected.price}</strong></p>
                <p><span>Estado</span><strong>Activo</strong></p>
              </div>
              <footer className="ba-overlay-actions">
                <button type="button" className="ba-btn-ghost">Editar</button>
                <button type="button" className="ba-card-gold">Aplicar</button>
              </footer>
            </article>
          ) : null}

          {!filtered.length ? (
            <div className="ba-services-empty">
              <p>{`No hay servicios para "${query}".`}</p>
            </div>
          ) : null}
        </div>

        <aside className="ba-services-right">
          <article className="ba-card ba-right-widget">
            <header className="ba-right-header">
              <h3>Tasa de Ocupacion</h3>
              <MoreHorizontal size={12} />
            </header>
            <p className="ba-client-kpi">88%</p>
            <div className="ba-client-progress"><span /></div>
          </article>

          <article className="ba-card ba-right-widget">
            <header className="ba-right-header">
              <h3>Servicios</h3>
              <MoreHorizontal size={12} />
            </header>
            <div className="ba-client-mini-services">
              <img src={FALLBACK_SERVICE_IMAGES[0]} alt="Servicio uno" />
              <img src={FALLBACK_SERVICE_IMAGES[1]} alt="Servicio dos" />
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
