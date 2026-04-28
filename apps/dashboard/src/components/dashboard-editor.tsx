"use client";

import { CalendarClock, LayoutDashboard, CircleDollarSign, Users, RefreshCw, Save, Send, Settings, Store, Scissors } from "lucide-react";
import { useState } from "react";
import { useDashboard } from "@/store/dashboard-context";

function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function tryParseArray(value: string): Array<Record<string, unknown>> {
  const parsed = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error("El JSON debe ser un arreglo.");
  return parsed as Array<Record<string, unknown>>;
}

export function DashboardEditor() {
  const { merged, loading, saving, publishing, refresh, setField, setCollection, saveDraft, publish } = useDashboard();
  const [servicesText, setServicesText] = useState("");
  const [barbersText, setBarbersText] = useState("");
  const [hoursText, setHoursText] = useState("");

  const stats = [
    { label: "Ingresos Mensuales", value: "$15,450", hint: "+6.8% del mes pasado", icon: CircleDollarSign },
    { label: "Citas de Hoy", value: String(merged.hours.length || 24), hint: "15 confirmadas, 6 pendientes", icon: CalendarClock },
    { label: "Nuevos Clientes", value: "45", hint: "+12 esta semana", icon: Users },
    { label: "Tasa de Ocupación", value: "88%", hint: "Rendimiento general", icon: LayoutDashboard }
  ];

  const applyJson = () => {
    setCollection("services", tryParseArray(servicesText || prettyJson(merged.services)));
    setCollection("barbers", tryParseArray(barbersText || prettyJson(merged.barbers)));
    setCollection("hours", tryParseArray(hoursText || prettyJson(merged.hours)));
  };

  return (
    <>
      <section className="ba-stats-grid">
        {stats.map((stat) => (
          <article className="ba-card ba-stat" key={stat.label}>
            <div className="ba-stat-head">
              <p>{stat.label}</p>
              <stat.icon size={16} />
            </div>
            <strong>{stat.value}</strong>
            <small>{stat.hint}</small>
          </article>
        ))}
      </section>

      <section className="ba-content-grid">
        <article className="ba-card ba-calendar">
          <div className="ba-card-title">
            <h2>Agenda / Reserva de Citas</h2>
            <CalendarClock size={16} />
          </div>
          <div className="ba-calendar-board">
            {["9:00", "10:00", "11:00", "12:00", "14:00", "16:00"].map((hour) => (
              <div key={hour} className="ba-calendar-row">
                <span>{hour}</span>
                <div className="ba-calendar-slot" />
                <div className="ba-calendar-slot is-gold" />
                <div className="ba-calendar-slot" />
              </div>
            ))}
          </div>
        </article>

        <div className="ba-side-stack">
          <article className="ba-card">
            <div className="ba-card-title">
              <h2>Gestión de Barberos</h2>
              <Users size={16} />
            </div>
            <ul className="ba-list">
              {merged.barbers.slice(0, 4).map((item, i) => (
                <li key={`barber-${i}`}>
                  <span>{String(item.nombre ?? item.name ?? "Barbero")}</span>
                  <small>Activo</small>
                </li>
              ))}
            </ul>
          </article>

          <article className="ba-card">
            <div className="ba-card-title">
              <h2>Servicios</h2>
              <Scissors size={16} />
            </div>
            <ul className="ba-list">
              {merged.services.slice(0, 4).map((item, i) => (
                <li key={`service-${i}`}>
                  <span>{String(item.nombre ?? item.name ?? "Servicio")}</span>
                  <small>{String(item.precio ?? item.price ?? "$0")}</small>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="ba-editor-grid">
        <article className="ba-card">
          <div className="ba-card-title">
            <h2>Configuración de Landing</h2>
            <Store size={16} />
          </div>
          <div className="ba-form-grid">
            <label className="ba-field">Nombre barbería<input className="ba-input" value={merged.biz_name} onChange={(e) => setField("biz_name", e.target.value)} /></label>
            <label className="ba-field">Slug<input className="ba-input" value={merged.biz_slug} onChange={(e) => setField("biz_slug", e.target.value)} /></label>
            <label className="ba-field ba-span-2">Dirección<input className="ba-input" value={merged.address} onChange={(e) => setField("address", e.target.value)} /></label>
            <label className="ba-field">Template ID<input className="ba-input" value={merged.template_id} onChange={(e) => setField("template_id", e.target.value)} /></label>
            <label className="ba-field">Hero título<input className="ba-input" value={merged.hero_title} onChange={(e) => setField("hero_title", e.target.value)} /></label>
            <label className="ba-field">Hero subtítulo<input className="ba-input" value={merged.hero_subtitle} onChange={(e) => setField("hero_subtitle", e.target.value)} /></label>
            <label className="ba-field">Color primario<input className="ba-input" value={merged.palette_primary} onChange={(e) => setField("palette_primary", e.target.value)} /></label>
          </div>
        </article>

        <article className="ba-card">
          <div className="ba-card-title">
            <h2>Publicación</h2>
            <Settings size={16} />
          </div>
          <div className="ba-form-grid">
            <label className="ba-field">Public landing URL<input className="ba-input" value={merged.public_landing_url} onChange={(e) => setField("public_landing_url", e.target.value)} /></label>
            <label className="ba-field">Reservation URL<input className="ba-input" value={merged.reservation_url} onChange={(e) => setField("reservation_url", e.target.value)} /></label>
            <label className="ba-field">QR URL<input className="ba-input" value={merged.qr_url} onChange={(e) => setField("qr_url", e.target.value)} /></label>
          </div>
          <div className="ba-action-row">
            <button className="ba-btn-ghost" onClick={() => refresh()} disabled={loading} type="button"><RefreshCw size={15} />Recargar</button>
            <button className="ba-btn-ghost" onClick={applyJson} type="button">Aplicar JSON</button>
            <button className="ba-btn-main" onClick={() => saveDraft()} disabled={saving || publishing} type="button"><Save size={15} />Guardar</button>
            <button className="ba-btn-main" onClick={() => publish()} disabled={publishing || saving} type="button"><Send size={15} />Publicar</button>
          </div>
        </article>
      </section>

      <section className="ba-json-grid">
        <article className="ba-card">
          <div className="ba-card-title"><h2>Servicios JSON</h2></div>
          <textarea className="ba-textarea" value={servicesText || prettyJson(merged.services)} onChange={(e) => setServicesText(e.target.value)} />
        </article>
        <article className="ba-card">
          <div className="ba-card-title"><h2>Barberos JSON</h2></div>
          <textarea className="ba-textarea" value={barbersText || prettyJson(merged.barbers)} onChange={(e) => setBarbersText(e.target.value)} />
        </article>
        <article className="ba-card">
          <div className="ba-card-title"><h2>Horarios JSON</h2></div>
          <textarea className="ba-textarea" value={hoursText || prettyJson(merged.hours)} onChange={(e) => setHoursText(e.target.value)} />
        </article>
      </section>
    </>
  );
}
