const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const http = require("http");

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.eventListeners = [];

    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data.toString());
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const listener of this.eventListeners) listener(msg.method, msg.params);
      }
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw new Error(`Eval exception: ${JSON.stringify(res.exceptionDetails)}`);
    return res.result?.value;
  }

  async screenshot(filename) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    const buffer = Buffer.from(res.data, "base64");
    const filepath = path.join(__dirname, filename);
    fs.writeFileSync(filepath, buffer);
    console.log(`[Screenshot saved]: ${filename}`);
  }
}

(async () => {
  console.log("=== STARTING FULL DOM AUDIT FOR UPDATED HEADER USER MENU ===");

  const botonHtml = fs.readFileSync(path.resolve(__dirname, "../boton.html"), "utf8");

  // Create a minimal HTML test server that embeds the updated widget
  const pageHtml = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BarberAgency Header Test</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #0b0f17;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    header {
      padding: 16px 24px;
      display: flex;
      justify-content: flex-end;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
  </style>
</head>
<body>
  <header>
    ${botonHtml}
  </header>
</body>
</html>`;

  const server = http.createServer((req, res) => {
    if (req.url === "/api/session/me") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        ok: true,
        user_id: 7,
        email: "pildorasdeautomatizacion@gmail.com",
        nombre: "Carlos",
        apellido: "Alvis",
        product_state: {
          barberia_state: "multiple",
          subscription_state: "ZERO_BARBERIA",
          plan_code: null,
          plan_name: null
        },
        current_barberia: {
          id: 207,
          slug: "barberia-prueba-5",
          nombre: "Barberia prueba 5",
          role: "owner",
          subscription_state: "TRIAL_EXPIRED"
        },
        barberias: [
          {
            id: 207,
            slug: "barberia-prueba-5",
            nombre: "Barberia prueba 5",
            role: "owner",
            subscription_state: "TRIAL_EXPIRED"
          },
          {
            id: 198,
            slug: "barberia-prueba-4",
            nombre: "Barberia Prueba 4",
            role: "owner",
            subscription_state: "PAID_ACTIVE",
            billing_term: "annual",
            period_end: "2027-06-05T16:58:49.244Z"
          },
          {
            id: 197,
            slug: "barberia-prueba-3",
            nombre: "Barberia prueba 3",
            role: "owner",
            subscription_state: "PAID_ACTIVE",
            billing_term: "monthly",
            period_end: "2027-05-31T23:31:52.849Z"
          },
          {
            id: 193,
            slug: "barberia-prueba-2",
            nombre: "Barberia prueba 2",
            role: "owner",
            subscription_state: "TRIAL_EXPIRED"
          }
        ],
        barberias_count: 4
      }));
      return;
    }

    if (req.url.startsWith("/api/barberias/") && req.url.endsWith("/delete")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, message: "Barbería eliminada correctamente." }));
      return;
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(pageHtml);
  });

  await new Promise((r) => server.listen(3099, r));
  console.log("Mock test server listening on http://127.0.0.1:3099");

  const tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-audit-updated-"));
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=9226",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${tempUserDataDir}`
  ]);

  await sleep(2500);

  try {
    const pageRes = await fetch("http://127.0.0.1:9226/json/new?about:blank", { method: "PUT" });
    const pageJson = await pageRes.json();
    const ws = new WebSocket(pageJson.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res);
      ws.addEventListener("error", rej);
    });

    const cdp = new CDPClient(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    const viewports = [
      { width: 320, height: 700, key: "320" },
      { width: 360, height: 800, key: "360" },
      { width: 390, height: 844, key: "390" },
      { width: 430, height: 932, key: "430" },
      { width: 1440, height: 900, key: "1440" }
    ];

    const results = {};

    for (const vp of viewports) {
      console.log(`\n--- Testing Viewport: ${vp.width}x${vp.height} ---`);
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.width <= 480
      });

      await cdp.send("Page.navigate", { url: "http://127.0.0.1:3099" });
      await sleep(1500);

      // Open user dropdown
      const openResult = await cdp.eval(`(() => {
        const btn = document.querySelector('.ba5-user-btn-menu');
        if (btn) {
          btn.click();
          return { found: true };
        }
        return { found: false };
      })()`);

      if (!openResult?.found) {
        console.error(`Could not open menu at ${vp.width}`);
        results[vp.key] = "FAIL";
        continue;
      }
      await sleep(500);

      // 1. Audit presence of delete buttons
      const deleteAudit = await cdp.eval(`(() => {
        const cards = Array.from(document.querySelectorAll('.ba5-barberia-card'));
        const deleteBtns = Array.from(document.querySelectorAll('.ba-barberia-delete-btn'));
        const overflow = document.documentElement.scrollWidth > window.innerWidth;
        const rows = deleteBtns.map(btn => ({
          name: btn.getAttribute('data-name'),
          id: btn.getAttribute('data-id'),
          isActive: btn.getAttribute('data-active'),
          classes: btn.className,
          text: btn.innerText.trim()
        }));
        return { cardCount: cards.length, deleteBtnCount: deleteBtns.length, overflow, rows };
      })()`);

      console.log(`Viewport ${vp.width}: Cards = ${deleteAudit.cardCount}, Delete buttons = ${deleteAudit.deleteBtnCount}, Overflow = ${deleteAudit.overflow}`);
      await cdp.screenshot(`menu_viewport_${vp.key}.png`);

      // 2. Click active barberia delete button (Barberia Prueba 4)
      const activeClickResult = await cdp.eval(`(() => {
        const btn = Array.from(document.querySelectorAll('.ba-barberia-delete-btn')).find(b => b.getAttribute('data-name') === 'Barberia Prueba 4');
        if (btn) {
          btn.click();
          const banner = document.querySelector('.ba-blocked-notice-banner');
          return { clicked: true, bannerText: banner ? banner.innerText.trim() : null };
        }
        return { clicked: false };
      })()`);
      console.log("Active barberia click blocked notice:", activeClickResult.bannerText);

      // 3. Click eligible barberia delete button (Barberia prueba 5)
      const eligibleClickResult = await cdp.eval(`(() => {
        const btn = Array.from(document.querySelectorAll('.ba-barberia-delete-btn')).find(b => b.getAttribute('data-name') === 'Barberia prueba 5');
        if (btn) {
          btn.click();
          const modal = document.querySelector('.ba-delete-modal-dialog');
          const title = modal?.querySelector('.ba-delete-modal-title')?.innerText;
          const confirmBtnDisabled = modal?.querySelector('#baDeleteModalConfirm')?.disabled;
          return { clicked: true, modalFound: !!modal, title, confirmBtnDisabled };
        }
        return { clicked: false };
      })()`);
      console.log("Eligible delete modal opened:", eligibleClickResult);

      await sleep(300);
      await cdp.screenshot(`modal_viewport_${vp.key}.png`);

      // 4. Test exact name matching
      const matchResult = await cdp.eval(`(() => {
        const input = document.querySelector('#baConfirmNameInput');
        const confirmBtn = document.querySelector('#baDeleteModalConfirm');
        
        input.value = "Mismatch name";
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const disabledOnMismatch = confirmBtn.disabled;
        
        input.value = "Barberia prueba 5";
        input.dispatchEvent(new Event('input', { bubbles: true }));
        const enabledOnExactMatch = !confirmBtn.disabled;

        // Close modal
        document.querySelector('#baDeleteModalCancel').click();
        const closed = !document.querySelector('.ba-delete-modal-dialog');

        return { disabledOnMismatch, enabledOnExactMatch, closed };
      })()`);
      console.log("Modal confirmation typing test:", matchResult);

      if (deleteAudit.deleteBtnCount === 4 && !deleteAudit.overflow && matchResult.disabledOnMismatch && matchResult.enabledOnExactMatch && matchResult.closed) {
        results[vp.key] = "PASS";
      } else {
        results[vp.key] = "FAIL";
      }
    }

    console.log("\n==================================================");
    console.log("FINAL VIEWPORT TEST MATRIX:");
    console.log(JSON.stringify(results, null, 2));
    console.log("==================================================");

  } finally {
    chrome.kill();
    server.close();
    try { fs.rmSync(tempUserDataDir, { recursive: true, force: true }); } catch {}
  }
})();
