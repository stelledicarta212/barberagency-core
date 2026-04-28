"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, MoreHorizontal, Plus, Search, Star, X } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { useDashboard } from "@/store/dashboard-context";

const FALLBACK = [
  "https://images.unsplash.com/photo-1622288432450-277d0fef5ed6?w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1593702275687-f8b402bfdbdd?w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1605497788044-5a32c7078486?w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1622287162716-f311baa1a2b8?w=900&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1517832606299-7ae9b720a186?w=900&auto=format&fit=crop"
];

type BarberCard = {
  id: string;
  name: string;
  role: string;
  score: number;
  month: number;
  rank: number;
  image: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function num(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function imageFrom(item: Record<string, unknown>, index: number): string {
  return (
    text(item.foto_url ?? item.photo_url ?? item.avatar_url ?? item.image_url ?? item.imagen_url) ||
    FALLBACK[index % FALLBACK.length]
  );
}

export default function BarberosPage() {
  const { merged } = useDashboard();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const cards = useMemo<BarberCard[]>(() => {
    return merged.barbers.map((item, index) => {
      const score = Number(num(item.rating, 4.6).toFixed(1));
      return {
        id: text(item.id) || `barber-${index}`,
        name: text(item.nombre ?? item.name) || `Alex ${index + 1}.`,
        role: text(item.especialidad ?? item.speciality) || "Corte & Barba",
        score,
        month: Math.max(120, Math.round(score * 80 + (index + 1) * 8)),
        rank: 40 + index * 7,
        image: imageFrom(item, index)
      };
    });
  }, [merged.barbers]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((card) => card.name.toLowerCase().includes(q) || card.role.toLowerCase().includes(q));
  }, [cards, query]);
  const selected = list.find((card) => card.id === selectedId) ?? null;

  return (
    <DashboardShell>
      <section className="ba-barbers-wrap">
        <div className="ba-barbers-main ba-card">
          <div className="ba-barbers-title-row">
            <h1>Barberos</h1>
            <button className="ba-mini-gold" type="button">
              <Plus size={12} />
              Estar barberos
            </button>
          </div>

          <label className="ba-mini-search">
            <Search size={12} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search"
              aria-label="Buscar barberos"
            />
          </label>

          <div className="ba-barbers-cards-grid">
            {list.map((card) => (
              <article
                key={card.id}
                className={`ba-barber-v2-card ${selected?.id === card.id ? "is-selected" : ""}`}
                onClick={() => setSelectedId(card.id)}
              >
                <div className="ba-barber-v2-media">
                  <img src={card.image} alt={card.name} loading="lazy" />
                  <button type="button" className="ba-card-menu" aria-label="Opciones">
                    <MoreHorizontal size={13} />
                  </button>
                </div>
                <div className="ba-barber-v2-body">
                  <strong>{card.name}</strong>
                  <small>{card.role}</small>
                  <div className="ba-stars">
                    <Star size={10} />
                    <Star size={10} />
                    <Star size={10} />
                    <Star size={10} />
                    <Star size={10} />
                    <span>{card.score.toFixed(1)}</span>
                  </div>
                  <button className="ba-card-gold" type="button">
                    Ver Perfil
                  </button>
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
                    <small>{selected.role}</small>
                  </div>
                </div>
                <button type="button" onClick={() => setSelectedId(null)} aria-label="Cerrar ficha">
                  <X size={12} />
                </button>
              </header>
              <div className="ba-overlay-grid">
                <p><span>Rating</span><strong>{selected.score.toFixed(1)}</strong></p>
                <p><span>Rendimiento mes</span><strong>{selected.month}</strong></p>
                <p><span>Ranking interno</span><strong>{selected.rank}</strong></p>
              </div>
              <footer className="ba-overlay-actions">
                <button type="button" className="ba-btn-ghost">Editar</button>
                <button type="button" className="ba-card-gold">Ver Perfil</button>
              </footer>
            </article>
          ) : null}
        </div>

        <aside className="ba-barbers-right">
          <article className="ba-card ba-right-widget">
            <header className="ba-right-header">
              <h3>Desempeño de Barberos</h3>
              <MoreHorizontal size={12} />
            </header>
            <ul className="ba-performance-list">
              {list.slice(0, 5).map((card) => (
                <li key={`perf-${card.id}`}>
                  <img src={card.image} alt={card.name} loading="lazy" />
                  <div>
                    <strong>{card.name}</strong>
                    <small>Alex Pigmail.com</small>
                  </div>
                  <div className="ba-performance-metrics">
                    <span>{card.month}</span>
                    <small>{card.rank}</small>
                  </div>
                </li>
              ))}
            </ul>
            <button className="ba-card-gold" type="button">
              Ver Perfil
            </button>
          </article>

          <article className="ba-card ba-right-widget">
            <header className="ba-right-header">
              <h3>Calendario de Barberos</h3>
              <CalendarDays size={12} />
            </header>
            <div className="ba-calendar-nav">
              <button type="button" aria-label="Mes anterior">
                <ChevronLeft size={12} />
              </button>
              <span>Junio 2023</span>
              <button type="button" aria-label="Mes siguiente">
                <ChevronRight size={12} />
              </button>
            </div>
            <div className="ba-mini-calendar">
              {["L", "M", "M", "J", "V", "S", "D"].map((day, index) => (
                <span key={`head-${index}`} className="is-head">
                  {day}
                </span>
              ))}
              {Array.from({ length: 35 }, (_, index) => {
                const day = index - 1;
                const show = day > 0 && day <= 30;
                const active = day === 11 || day === 17 || day === 24;
                return (
                  <span key={`cell-${index}`} className={`is-cell ${active ? "is-active" : ""}`}>
                    {show ? day : ""}
                  </span>
                );
              })}
            </div>
          </article>
        </aside>
      </section>
    </DashboardShell>
  );
}
