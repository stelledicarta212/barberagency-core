"use client";

import { useMemo, useState } from "react";
import { Cake, Clock3, CreditCard, DollarSign, Gift, Receipt, RefreshCcw, Scissors, Wallet, X } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";

type Movement = {
  id: string;
  client: string;
  service: string;
  method: string;
  amount: string;
  status: "Pendiente" | "Enviada" | "Aceptada";
  date: string;
  hour: string;
  barber: string;
  tip: string;
  avatar: string;
  stampCurrent: number;
  stampRequired: number;
  birthdayBenefit: string;
  inactiveDays: number;
  reactivationBenefit: string;
  offPeakBenefit: string;
  barberAvatar: string;
};

type BarberClose = {
  id: string;
  barber: string;
  avatar: string;
  cuts: string;
  ticketAvg: string;
  total: string;
  commission: string;
  pending: string;
};

const MOVEMENTS: Movement[] = [
  {
    id: "m1",
    client: "Juan Perez",
    service: "Corte + Barba",
    method: "Tarjeta",
    amount: "$32.00",
    status: "Aceptada",
    date: "19/09/2023",
    hour: "10:20",
    barber: "Alex M.",
    tip: "$4.00",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&auto=format&fit=crop",
    stampCurrent: 5,
    stampRequired: 8,
    birthdayBenefit: "15% OFF en cumpleanos",
    inactiveDays: 12,
    reactivationBenefit: "Reactiva con 20% OFF",
    offPeakBenefit: "Promo 2x1 en horas muertas",
    barberAvatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop"
  },
  {
    id: "m2",
    client: "Luis G.",
    service: "Corte Clasico",
    method: "Efectivo",
    amount: "$20.00",
    status: "Enviada",
    date: "18/09/2023",
    hour: "11:05",
    barber: "James R.",
    tip: "$2.00",
    avatar: "https://images.unsplash.com/photo-1542909168-82c3e7fdca5c?w=120&auto=format&fit=crop",
    stampCurrent: 3,
    stampRequired: 8,
    birthdayBenefit: "Servicio especial en cumpleanos",
    inactiveDays: 23,
    reactivationBenefit: "Hace rato no vienes... 20% OFF",
    offPeakBenefit: "15% OFF en horario valle",
    barberAvatar: "https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=120&auto=format&fit=crop"
  },
  {
    id: "m3",
    client: "Maria S.",
    service: "Barba Premium",
    method: "Transferencia",
    amount: "$12.00",
    status: "Aceptada",
    date: "17/09/2023",
    hour: "12:35",
    barber: "Aldo H.",
    tip: "$0.00",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&auto=format&fit=crop",
    stampCurrent: 6,
    stampRequired: 8,
    birthdayBenefit: "20% OFF en cumpleanos",
    inactiveDays: 8,
    reactivationBenefit: "Cliente activa",
    offPeakBenefit: "10% OFF horas muertas",
    barberAvatar: "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=120&auto=format&fit=crop"
  },
  {
    id: "m4",
    client: "Carlos R.",
    service: "Fade",
    method: "Tarjeta",
    amount: "$24.00",
    status: "Pendiente",
    date: "17/09/2023",
    hour: "13:10",
    barber: "Alex M.",
    tip: "$3.00",
    avatar: "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?w=120&auto=format&fit=crop",
    stampCurrent: 2,
    stampRequired: 8,
    birthdayBenefit: "Servicio de barba gratis",
    inactiveDays: 31,
    reactivationBenefit: "Mensaje de reactivacion activo",
    offPeakBenefit: "Promo tardes L-J",
    barberAvatar: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=120&auto=format&fit=crop"
  }
];

const BARBER_CLOSE: BarberClose[] = [
  {
    id: "b1",
    barber: "Alex M.",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=120&auto=format&fit=crop",
    cuts: "6",
    ticketAvg: "$28.00",
    total: "$168.00",
    commission: "$50.40",
    pending: "$0.00"
  },
  {
    id: "b2",
    barber: "James R.",
    avatar: "https://images.unsplash.com/photo-1531384441138-2736e62e0919?w=120&auto=format&fit=crop",
    cuts: "4",
    ticketAvg: "$31.00",
    total: "$124.00",
    commission: "$37.20",
    pending: "$12.00"
  },
  {
    id: "b3",
    barber: "Aldo H.",
    avatar: "https://images.unsplash.com/photo-1521119989659-a83eee488004?w=120&auto=format&fit=crop",
    cuts: "4",
    ticketAvg: "$19.00",
    total: "$76.00",
    commission: "$22.80",
    pending: "$0.00"
  }
];

export default function InventarioPage() {
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null);
  const [selectedBarberId, setSelectedBarberId] = useState<string | null>(null);
  const [receiptBarberId, setReceiptBarberId] = useState<string | null>(null);
  const [closeReceiptOpen, setCloseReceiptOpen] = useState(false);

  const selectedMovement = useMemo(
    () => MOVEMENTS.find((row) => row.id === selectedMovementId) ?? null,
    [selectedMovementId]
  );

  const selectedBarber = useMemo(
    () => BARBER_CLOSE.find((row) => row.id === selectedBarberId) ?? null,
    [selectedBarberId]
  );

  const receiptBarber = useMemo(
    () => BARBER_CLOSE.find((row) => row.id === receiptBarberId) ?? null,
    [receiptBarberId]
  );

  const handlePrintReceipt = () => {
    if (!receiptBarber) return;
    const printWindow = window.open("", "_blank", "width=420,height=780");
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Tirilla de Cierre</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #111; }
            .ticket { width: 280px; margin: 0 auto; border: 1px dashed #888; padding: 14px; }
            h1 { margin: 0 0 6px; font-size: 16px; text-align: center; }
            .muted { font-size: 12px; color: #555; text-align: center; margin-bottom: 12px; }
            .row { display: flex; justify-content: space-between; font-size: 13px; margin: 6px 0; }
            .total { font-weight: 700; border-top: 1px dashed #777; margin-top: 10px; padding-top: 8px; }
            .foot { margin-top: 14px; font-size: 11px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="ticket">
            <h1>BarberAgency POS</h1>
            <div class="muted">Tirilla de cierre por barbero</div>
            <div class="row"><span>Barbero</span><strong>${receiptBarber.barber}</strong></div>
            <div class="row"><span>Cortes</span><strong>${receiptBarber.cuts}</strong></div>
            <div class="row"><span>Ticket prom.</span><strong>${receiptBarber.ticketAvg}</strong></div>
            <div class="row"><span>Comision</span><strong>${receiptBarber.commission}</strong></div>
            <div class="row"><span>Pendiente</span><strong>${receiptBarber.pending}</strong></div>
            <div class="row total"><span>Total cierre</span><strong>${receiptBarber.total}</strong></div>
            <div class="foot">Emitido: ${new Date().toLocaleString()}</div>
          </div>
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrintCloseReceipt = () => {
    const printWindow = window.open("", "_blank", "width=420,height=780");
    if (!printWindow) return;

    const html = `
      <html>
        <head>
          <title>Tirilla Cierre Caja</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #111; }
            .ticket { width: 280px; margin: 0 auto; border: 1px dashed #888; padding: 14px; }
            h1 { margin: 0 0 6px; font-size: 16px; text-align: center; }
            .muted { font-size: 12px; color: #555; text-align: center; margin-bottom: 12px; }
            .row { display: flex; justify-content: space-between; font-size: 13px; margin: 6px 0; }
            .total { font-weight: 700; border-top: 1px dashed #777; margin-top: 10px; padding-top: 8px; }
            .foot { margin-top: 14px; font-size: 11px; color: #666; text-align: center; }
          </style>
        </head>
        <body>
          <div class="ticket">
            <h1>BarberAgency POS</h1>
            <div class="muted">Tirilla de cierre de caja</div>
            <div class="row"><span>Cortes del dia</span><strong>$280.00</strong></div>
            <div class="row"><span>Servicios extra</span><strong>$88.00</strong></div>
            <div class="row"><span>Descuentos aplicados</span><strong>$22.00</strong></div>
            <div class="row"><span>Propinas</span><strong>$46.00</strong></div>
            <div class="row total"><span>Neto cierre</span><strong>$392.00</strong></div>
            <div class="foot">Emitido: ${new Date().toLocaleString()}</div>
          </div>
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <DashboardShell>
      <section className="ba-pos-layout">
        <div className="ba-pos-top-grid">
          <article className="ba-card ba-pos-kpi">
            <header>
              <span>Ventas del dia</span>
              <DollarSign size={14} />
            </header>
            <strong>$368.00</strong>
            <small>14 servicios cobrados</small>
          </article>

          <article className="ba-card ba-pos-kpi">
            <header>
              <span>Tickets cerrados</span>
              <Receipt size={14} />
            </header>
            <strong>12</strong>
            <small>2 pendientes por cobrar</small>
          </article>

          <article className="ba-card ba-pos-kpi">
            <header>
              <span>Pago digital</span>
              <CreditCard size={14} />
            </header>
            <strong>68%</strong>
            <small>Tarjeta/transferencia</small>
          </article>

          <article className="ba-card ba-pos-kpi">
            <header>
              <span>Efectivo</span>
              <Wallet size={14} />
            </header>
            <strong>$118.00</strong>
            <small>Caja fisica actual</small>
          </article>
        </div>

        <div className="ba-pos-main-grid">
          <article className="ba-card ba-pos-checkout">
            <header className="ba-card-title">
              <h2>Caja Rapida POS</h2>
              <span className="ba-editable-chip">Frontend demo</span>
            </header>

            <div className="ba-pos-lines">
              <div>
                <span>Corte Clasico</span>
                <strong>$20.00</strong>
              </div>
              <div>
                <span>Barba Premium</span>
                <strong>$12.00</strong>
              </div>
              <div>
                <span>Lavado</span>
                <strong>$8.00</strong>
              </div>
            </div>

            <div className="ba-pos-summary">
              <p><span>Subtotal</span><strong>$40.00</strong></p>
              <p><span>Impuesto</span><strong>$3.20</strong></p>
              <p><span>Descuento lealtad</span><strong>-$5.00</strong></p>
              <p className="is-total"><span>Total</span><strong>$38.20</strong></p>
            </div>

            <div className="ba-pos-actions">
              <button type="button" className="ba-btn-ghost">Guardar ticket</button>
              <button type="button" className="ba-card-gold">Cobrar ahora</button>
            </div>
          </article>

          <article className="ba-card ba-pos-close">
            <header className="ba-card-title">
              <h2>Cierre de Caja del Dia</h2>
              <Scissors size={14} />
            </header>
            <div className="ba-pos-close-grid">
              <p><span>Cortes del dia</span><strong>$280.00</strong></p>
              <p><span>Servicios extra</span><strong>$88.00</strong></p>
              <p><span>Descuentos aplicados</span><strong>$22.00</strong></p>
              <p><span>Propinas</span><strong>$46.00</strong></p>
              <p className="is-net"><span>Neto cierre</span><strong>$392.00</strong></p>
            </div>
            <div className="ba-pos-actions">
              <button type="button" className="ba-btn-ghost" onClick={() => setCloseReceiptOpen(true)}>Imprimir tirilla</button>
              <button type="button" className="ba-btn-main">Cerrar caja</button>
            </div>
          </article>
        </div>

        <div className="ba-pos-bottom-grid">
          <article className="ba-card ba-pos-table">
            <header className="ba-card-title">
              <h2>Movimientos recientes</h2>
            </header>
            <div className="ba-pos-table-head ba-pos-table-head-movements">
              <span>Cliente</span>
              <span>Servicio</span>
              <span>Barbero</span>
              <span>Metodo</span>
              <span>Monto</span>
            </div>
            {MOVEMENTS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`ba-pos-table-row ba-pos-table-row-movements ba-pos-table-row-selectable ${selectedMovement?.id === item.id ? "is-selected" : ""}`}
                onClick={() => {
                  setSelectedBarberId(null);
                  setSelectedMovementId(item.id);
                }}
              >
                <span>{item.client}</span>
                <span>{item.service}</span>
                <span className="ba-pos-user-cell">
                  <img src={item.barberAvatar} alt={item.barber} loading="lazy" />
                  {item.barber}
                </span>
                <span>{item.method}</span>
                <strong>{item.amount}</strong>
              </button>
            ))}

            {selectedMovement ? (
              <article className="ba-overlay-card ba-pos-overlay-card">
                <header className="ba-overlay-head">
                  <div className="ba-overlay-user">
                    <img src={selectedMovement.avatar} alt={selectedMovement.client} loading="lazy" />
                    <div>
                      <strong>{selectedMovement.client}</strong>
                      <small>{selectedMovement.service}</small>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedMovementId(null)} aria-label="Cerrar ficha">
                    <X size={12} />
                  </button>
                </header>
                <div className="ba-overlay-grid">
                  <p><span>Fecha</span><strong>{selectedMovement.date}</strong></p>
                  <p><span>Estado</span><strong>{selectedMovement.status}</strong></p>
                  <p><span>Servicio</span><strong>{selectedMovement.service}</strong></p>
                  <p><span>Metodo de pago</span><strong>{selectedMovement.method}</strong></p>
                  <p><span>Barbero</span><strong>{selectedMovement.barber}</strong></p>
                  <p><span>Hora</span><strong>{selectedMovement.hour}</strong></p>
                  <p><span>Propina</span><strong>{selectedMovement.tip}</strong></p>
                  <p><span>Total</span><strong>{selectedMovement.amount}</strong></p>
                </div>
                <section className="ba-client-loyalty-card">
                  <header>
                    <h4><Gift size={12} />Beneficios de Lealtad</h4>
                  </header>
                  <div className="ba-client-stamp-track">
                    {Array.from({ length: selectedMovement.stampRequired }, (_, idx) => (
                      <span key={`stamp-move-${idx}`} className={idx < selectedMovement.stampCurrent ? "is-on" : ""}>
                        <Scissors size={11} />
                      </span>
                    ))}
                  </div>
                  <small className="ba-client-stamp-note">
                    {selectedMovement.stampCurrent} / {selectedMovement.stampRequired} sellos
                  </small>
                  <ul>
                    <li><Cake size={11} /><span>{selectedMovement.birthdayBenefit}</span></li>
                    <li><RefreshCcw size={11} /><span>{selectedMovement.inactiveDays} dias sin visita - {selectedMovement.reactivationBenefit}</span></li>
                    <li><Clock3 size={11} /><span>{selectedMovement.offPeakBenefit}</span></li>
                  </ul>
                </section>
                <footer className="ba-overlay-actions">
                  <button type="button" className="ba-btn-ghost">Ver</button>
                  <button type="button" className="ba-card-gold">Enviar</button>
                </footer>
              </article>
            ) : null}
          </article>

          <article className="ba-card ba-pos-table">
            <header className="ba-card-title">
              <h2>Cierre por barbero</h2>
            </header>
            <div className="ba-pos-table-head">
              <span>Barbero</span>
              <span>Cortes</span>
              <span>Ticket prom.</span>
              <span>Total</span>
            </div>
            {BARBER_CLOSE.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`ba-pos-table-row ba-pos-table-row-selectable ${selectedBarber?.id === item.id ? "is-selected" : ""}`}
                onClick={() => {
                  setSelectedMovementId(null);
                  setSelectedBarberId(item.id);
                }}
              >
                <span className="ba-pos-user-cell">
                  <img src={item.avatar} alt={item.barber} loading="lazy" />
                  {item.barber}
                </span>
                <span>{item.cuts}</span>
                <span>{item.ticketAvg}</span>
                <strong>{item.total}</strong>
              </button>
            ))}

            {selectedBarber ? (
              <article className="ba-overlay-card ba-pos-overlay-card">
                <header className="ba-overlay-head">
                  <div className="ba-overlay-user">
                    <img src={selectedBarber.avatar} alt={selectedBarber.barber} loading="lazy" />
                    <div>
                      <strong>{selectedBarber.barber}</strong>
                      <small>Resumen de cierre</small>
                    </div>
                  </div>
                  <button type="button" onClick={() => setSelectedBarberId(null)} aria-label="Cerrar ficha">
                    <X size={12} />
                  </button>
                </header>
                <div className="ba-overlay-grid">
                  <p><span>Cortes</span><strong>{selectedBarber.cuts}</strong></p>
                  <p><span>Ticket promedio</span><strong>{selectedBarber.ticketAvg}</strong></p>
                  <p><span>Total facturado</span><strong>{selectedBarber.total}</strong></p>
                  <p><span>Comision</span><strong>{selectedBarber.commission}</strong></p>
                  <p><span>Pendiente</span><strong>{selectedBarber.pending}</strong></p>
                </div>
                <footer className="ba-overlay-actions">
                  <button type="button" className="ba-btn-ghost" onClick={() => setReceiptBarberId(selectedBarber.id)}>Imprimir</button>
                  <button type="button" className="ba-card-gold">Liquidar</button>
                </footer>
              </article>
            ) : null}
          </article>
        </div>

        {receiptBarber ? (
          <aside className="ba-pos-receipt-modal" role="dialog" aria-modal="true">
            <article className="ba-pos-receipt-slip">
              <header>
                <h3>Tirilla de Cierre</h3>
                <button type="button" onClick={() => setReceiptBarberId(null)} aria-label="Cerrar tirilla">
                  <X size={12} />
                </button>
              </header>
              <p className="ba-pos-receipt-subtitle">Resumen de caja por barbero</p>
              <div className="ba-pos-receipt-rows">
                <p><span>Barbero</span><strong>{receiptBarber.barber}</strong></p>
                <p><span>Cortes</span><strong>{receiptBarber.cuts}</strong></p>
                <p><span>Ticket prom.</span><strong>{receiptBarber.ticketAvg}</strong></p>
                <p><span>Comision</span><strong>{receiptBarber.commission}</strong></p>
                <p><span>Pendiente</span><strong>{receiptBarber.pending}</strong></p>
                <p className="is-total"><span>Total cierre</span><strong>{receiptBarber.total}</strong></p>
              </div>
              <small className="ba-pos-receipt-date">Emitido: {new Date().toLocaleString()}</small>
              <footer>
                <button type="button" className="ba-btn-ghost" onClick={() => setReceiptBarberId(null)}>Cerrar</button>
                <button type="button" className="ba-card-gold" onClick={handlePrintReceipt}>Imprimir</button>
              </footer>
            </article>
          </aside>
        ) : null}

        {closeReceiptOpen ? (
          <aside className="ba-pos-receipt-modal" role="dialog" aria-modal="true">
            <article className="ba-pos-receipt-slip">
              <header>
                <h3>Tirilla Cierre Caja</h3>
                <button type="button" onClick={() => setCloseReceiptOpen(false)} aria-label="Cerrar tirilla">
                  <X size={12} />
                </button>
              </header>
              <p className="ba-pos-receipt-subtitle">Resumen general del dia</p>
              <div className="ba-pos-receipt-rows">
                <p><span>Cortes del dia</span><strong>$280.00</strong></p>
                <p><span>Servicios extra</span><strong>$88.00</strong></p>
                <p><span>Descuentos aplicados</span><strong>$22.00</strong></p>
                <p><span>Propinas</span><strong>$46.00</strong></p>
                <p className="is-total"><span>Neto cierre</span><strong>$392.00</strong></p>
              </div>
              <small className="ba-pos-receipt-date">Emitido: {new Date().toLocaleString()}</small>
              <footer>
                <button type="button" className="ba-btn-ghost" onClick={() => setCloseReceiptOpen(false)}>Cerrar</button>
                <button type="button" className="ba-card-gold" onClick={handlePrintCloseReceipt}>Imprimir</button>
              </footer>
            </article>
          </aside>
        ) : null}
      </section>
    </DashboardShell>
  );
}
