"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useDashboard } from "@/store/dashboard-context";

const NAV_ITEMS = [
  { href: "/", label: "Panel" },
  { href: "/citas", label: "Citas" },
  { href: "/clientes", label: "Clientes" },
  { href: "/barberos", label: "Barberos" },
  { href: "/servicios", label: "Servicios" },
  { href: "/finanzas", label: "Programa de Lealtad" },
  { href: "/inventario", label: "Caja / POS" },
  { href: "/configuracion", label: "Configuración" },
  { href: "/soporte", label: "Soporte" }
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { identity, error, message } = useDashboard();

  return (
    <main className="ba-dashboard-shell">
      <div className="ba-dashboard-frame">
        <aside className="ba-sidebar">
          <div className="ba-brand">
            <span className="ba-brand-dot" />
            <strong>BarberAgency</strong>
          </div>

          <nav className="ba-nav">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link key={item.href} className={`ba-nav-item ${isActive ? "is-active" : ""}`} href={item.href}>
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ba-sidebar-footer">
            <p>id: {identity?.barberia_id ?? "-"}</p>
            <p>slug: {identity?.slug ?? "-"}</p>
          </div>
        </aside>

        <section className="ba-main">
          <header className="ba-topbar ba-card">
            <div className="ba-search">Buscar barbería, cliente o cita...</div>
            <div className="ba-topbar-actions">
              <button className="ba-icon-btn" type="button" aria-label="Notificaciones">
                <Bell size={15} />
              </button>
              <ThemeToggle />
              <button className="ba-btn-gold" type="button">
                Plan Pro
              </button>
            </div>
          </header>

          {(error || message) && (
            <section className="ba-alert-stack">
              {error ? <p className="ba-alert ba-alert-error">{error}</p> : null}
              {message ? <p className="ba-alert ba-alert-ok">{message}</p> : null}
            </section>
          )}

          {children}
        </section>
      </div>
    </main>
  );
}
