const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { getSessionToken } = require("./test_panel_session_me");

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
        if (msg.error) {
          reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          resolve(msg.result);
        }
      } else if (msg.method) {
        for (const listener of this.eventListeners) {
          listener(msg.method, msg.params);
        }
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
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }

  async screenshot(filepath) {
    const res = await this.send("Page.captureScreenshot", { format: "png" });
    const buffer = Buffer.from(res.data, "base64");
    fs.writeFileSync(filepath, buffer);
    console.log(`[Screenshot saved]: ${filepath}`);
  }
}

(async () => {
  console.log("=== LIVE PRODUCTION WORDPRESS HEADER POST 4737 VERIFICATION ===");
  console.log("Generating valid session token for User 7...");
  const token7 = await getSessionToken(7, "pildorasdeautomatizacion@gmail.com");
  console.log("Token obtained:", token7.substring(0, 15) + "...");

  const tempUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "chrome-live-prod-header-"));
  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--remote-debugging-port=9225",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    `--user-data-dir=${tempUserDataDir}`
  ]);

  await sleep(2500);

  const resultsByViewport = {};
  const artifactDir = "C:\\Users\\calvi\\.gemini\\antigravity-cli\\brain\\c34b9161-9eb7-4718-b3d6-997bfd44ad3d\\qa\\screenshots_delete_ui";
  if (!fs.existsSync(artifactDir)) fs.mkdirSync(artifactDir, { recursive: true });

  try {
    const pageRes = await fetch("http://127.0.0.1:9225/json/new?about:blank", { method: "PUT" });
    const pageJson = await pageRes.json();
    const ws = new WebSocket(pageJson.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.addEventListener("open", res);
      ws.addEventListener("error", rej);
    });

    const cdp = new CDPClient(ws);
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");

    // Set cookie on domain
    await cdp.send("Network.setCookie", {
      name: "ba_session",
      value: token7,
      domain: ".gymh5g.easypanel.host",
      path: "/",
      httpOnly: false,
      secure: true
    });

    const viewports = [
      { name: "320", width: 320, height: 700, mobile: true },
      { name: "360", width: 360, height: 800, mobile: true },
      { name: "390", width: 390, height: 844, mobile: true },
      { name: "430", width: 430, height: 932, mobile: true },
      { name: "1440", width: 1440, height: 900, mobile: false }
    ];

    for (const vp of viewports) {
      console.log(`\n--------------------------------------------------`);
      console.log(`TESTING VIEWPORT: ${vp.name} (${vp.width}x${vp.height}, mobile=${vp.mobile})`);
      console.log(`--------------------------------------------------`);

      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: vp.mobile
      });

      if (vp.mobile) {
        await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true });
      } else {
        await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
      }

      await cdp.send("Page.navigate", { url: "https://barberagency-barberagency.gymh5g.easypanel.host/" });
      
      // Wait for session sync and header button to render
      await cdp.eval(`new Promise((resolve) => {
        let tries = 0;
        const t = setInterval(() => {
          const btn = document.querySelector("#baHeaderMenuRoot .ba5-user-btn-menu");
          if (btn || ++tries > 40) {
            clearInterval(t);
            resolve(!!btn);
          }
        }, 250);
      })`);
      await sleep(1000);

      // Open user menu
      const openResult = await cdp.eval(`(() => {
        const root = document.getElementById("baHeaderMenuRoot");
        if (!root) return { hasRoot: false };
        const btn = root.querySelector(".ba5-user-btn-menu");
        if (!btn) return { hasRoot: true, hasBtn: false, innerText: root.innerText };
        btn.click();
        const menu = root.querySelector(".ba5-user-menu");
        const isOpen = menu && menu.classList.contains("is-open");
        return { hasRoot: true, hasBtn: true, isOpen };
      })()`);

      console.log(`Menu open result:`, openResult);
      await sleep(1000);

      // Inspect barberia cards and delete buttons
      const menuAudit = await cdp.eval(`(() => {
        const cards = Array.from(document.querySelectorAll("#baHeaderMenuRoot .ba5-barberia-card"));
        const deleteBtns = Array.from(document.querySelectorAll("#baHeaderMenuRoot .ba-barberia-delete-btn"));

        const items = cards.map(c => {
          const name = c.querySelector(".ba-barberia-name")?.innerText || "";
          const status = c.querySelector(".ba-barberia-status")?.innerText || "";
          const delBtn = c.querySelector(".ba-barberia-delete-btn");
          const hasDel = !!delBtn;
          const isActive = delBtn?.getAttribute("data-active") === "true";
          const isEligible = delBtn?.classList.contains("is-eligible");
          const isBlocked = delBtn?.classList.contains("is-active-blocked");
          return { name, status, hasDel, isActive, isEligible, isBlocked };
        });

        // Check horizontal overflow
        const hasOverflow = document.documentElement.scrollWidth > window.innerWidth;

        return {
          cardCount: cards.length,
          deleteBtnCount: deleteBtns.length,
          hasOverflow,
          items
        };
      })()`);

      console.log(`Menu audit:`, {
        cardCount: menuAudit.cardCount,
        deleteBtnCount: menuAudit.deleteBtnCount,
        hasOverflow: menuAudit.hasOverflow,
        sampleItems: menuAudit.items.slice(0, 4)
      });

      // Save menu screenshot
      const menuScreenshotPath = path.join(artifactDir, `live_menu_${vp.name}.png`);
      await cdp.screenshot(menuScreenshotPath);
      // Also copy to pruebas
      fs.copyFileSync(menuScreenshotPath, path.resolve(__dirname, `live_menu_${vp.name}.png`));

      // Test active plan block notice
      const activeItem = menuAudit.items.find(i => i.isActive);
      let blockedNoticeOk = false;
      if (activeItem) {
        console.log(`Testing active plan delete click on: "${activeItem.name}"...`);
        const blockClickResult = await cdp.eval(`(() => {
          const delBtn = Array.from(document.querySelectorAll("#baHeaderMenuRoot .ba-barberia-delete-btn"))
            .find(b => b.getAttribute("data-active") === "true");
          if (!delBtn) return { found: false };
          delBtn.click();
          const notice = document.querySelector("#baHeaderMenuRoot .ba-blocked-notice-banner");
          const text = notice ? notice.innerText : null;
          return { found: true, noticeShown: !!notice, text };
        })()`);
        console.log(`Active block click result:`, blockClickResult);
        blockedNoticeOk = blockClickResult.noticeShown && blockClickResult.text.includes("No puedes eliminar");
      }

      // Test eligible plan delete modal
      const eligibleItem = menuAudit.items.find(i => !i.isActive);
      let modalPass = false;
      let exactNameMatchPass = false;
      if (eligibleItem) {
        console.log(`Testing eligible delete click on: "${eligibleItem.name}"...`);
        const eligibleClickResult = await cdp.eval(`(() => {
          const delBtn = Array.from(document.querySelectorAll("#baHeaderMenuRoot .ba-barberia-delete-btn"))
            .find(b => b.getAttribute("data-active") === "false");
          if (!delBtn) return { found: false };
          delBtn.click();
          const modal = document.querySelector(".ba-delete-modal-overlay");
          const title = modal ? modal.querySelector("h3")?.innerText : null;
          const confirmBtn = modal ? modal.querySelector("#baDeleteModalConfirm") : null;
          return {
            found: true,
            modalOpen: !!modal,
            title,
            confirmBtnDisabled: confirmBtn ? confirmBtn.disabled : null
          };
        })()`);

        console.log(`Eligible click result:`, eligibleClickResult);

        // Save modal screenshot
        const modalScreenshotPath = path.join(artifactDir, `live_modal_${vp.name}.png`);
        await cdp.screenshot(modalScreenshotPath);
        fs.copyFileSync(modalScreenshotPath, path.resolve(__dirname, `live_modal_${vp.name}.png`));

        // Test typing mismatch vs exact match
        const typingTest = await cdp.eval(`(() => {
          const input = document.querySelector("#baConfirmNameInput");
          const confirmBtn = document.querySelector("#baDeleteModalConfirm");
          const cancelBtn = document.querySelector("#baDeleteModalCancel");
          if (!input || !confirmBtn) return { tested: false };

          // Type partial
          input.value = "Barberia";
          input.dispatchEvent(new Event("input", { bubbles: true }));
          const disabledOnPartial = confirmBtn.disabled;

          // Type exact target name
          const targetName = "${eligibleItem.name}";
          input.value = targetName;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          const enabledOnExact = !confirmBtn.disabled;

          // Cancel to avoid accidental deletion
          if (cancelBtn) cancelBtn.click();
          const modalClosed = !document.querySelector(".ba-delete-modal-overlay");

          return {
            tested: true,
            disabledOnPartial,
            enabledOnExact,
            modalClosed
          };
        })()`);

        console.log(`Typing test result:`, typingTest);
        modalPass = eligibleClickResult.modalOpen && eligibleClickResult.confirmBtnDisabled === true;
        exactNameMatchPass = typingTest.disabledOnPartial === true && typingTest.enabledOnExact === true && typingTest.modalClosed === true;
      }

      // Check categorical visibility
      const cancelledVisible = menuAudit.items.some(i => i.status.toLowerCase().includes("cancel") && i.hasDel);
      const trialExpiredVisible = menuAudit.items.some(i => i.status.toLowerCase().includes("vencid") || i.status.toLowerCase().includes("expir") || (!i.isActive && i.hasDel));
      const activeMonthlyVisible = menuAudit.items.some(i => i.isActive && i.hasDel && (i.status.toLowerCase().includes("mensual") || i.status.toLowerCase().includes("activo")));
      const activeAnnualVisible = menuAudit.items.some(i => i.isActive && i.hasDel && (i.status.toLowerCase().includes("anual") || i.status.toLowerCase().includes("activo")));

      const vpPass = openResult.isOpen &&
        menuAudit.deleteBtnCount > 0 &&
        blockedNoticeOk &&
        modalPass &&
        exactNameMatchPass &&
        !menuAudit.hasOverflow;

      resultsByViewport[vp.name] = {
        pass: vpPass,
        deleteBtnCount: menuAudit.deleteBtnCount,
        cancelledVisible,
        trialExpiredVisible,
        activeMonthlyVisible,
        activeAnnualVisible,
        blockedNoticeOk,
        modalPass,
        exactNameMatchPass,
        noOverflow: !menuAudit.hasOverflow
      };

      console.log(`Viewport ${vp.name} RESULT: ${vpPass ? "PASS" : "FAIL"}`);
    }

    console.log("\n==================================================");
    console.log("FINAL LIVE PRODUCTION AUDIT SUMMARY:");
    console.log(JSON.stringify(resultsByViewport, null, 2));
    console.log("==================================================");

  } finally {
    chrome.kill();
    try { fs.rmSync(tempUserDataDir, { recursive: true, force: true }); } catch {}
  }
})();
