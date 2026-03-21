const express = require("express");
const cors = require("cors");
const si = require("systeminformation");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Static data — fetched once at startup
let staticCache = null;
(async () => {
  try {
    const [cpu, osInfo, graphics, ifaces] = await Promise.all([
      si.cpu(),
      si.osInfo(),
      si.graphics(),
      si.networkInterfaces(),
    ]);
    staticCache = { cpu, osInfo, graphics, ifaces };
  } catch (_) {}
})();

// Background sampler for data that needs ~1s measurement window
let loadCache = null;
let netStatsCache = [];
(async function sample() {
  try {
    const [load, nets] = await Promise.all([
      si.currentLoad(),
      si.networkStats("*"),
    ]);
    loadCache = load;
    netStatsCache = nets;
  } catch (_) {}
  setTimeout(sample, 1100);
})();

app.get("/api/status", async (_req, res) => {
  if (!staticCache) {
    return res.json({ online: true, ready: false });
  }

  try {
    const [mem, fsSize, battery, procs, cpuTemp, time] = await Promise.all([
      si.mem(),
      si.fsSize(),
      si.battery(),
      si.processes(),
      si.cpuTemperature(),
      si.time(),
    ]);

    const { cpu, osInfo, graphics, ifaces } = staticCache;

    const ifaceList = (Array.isArray(ifaces) ? ifaces : Object.values(ifaces))
      .filter((n) => !n.internal && n.ip4);

    const ifaceNames = new Set(ifaceList.map((n) => n.iface));

    res.json({
      online: true,
      ready: true,
      cpu: {
        brand: cpu.brand,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        speed: cpu.speed,
        loadPercent: loadCache
          ? Math.round(loadCache.currentLoad * 10) / 10
          : null,
        tempC:
          cpuTemp.main == null || cpuTemp.main === -1 ? null : cpuTemp.main,
      },
      memory: {
        total: mem.total,
        used: mem.used,
        free: mem.free,
        usedPercent: Math.round((mem.used / mem.total) * 100 * 10) / 10,
      },
      os: {
        platform: osInfo.platform,
        distro: osInfo.distro,
        release: osInfo.release,
        arch: osInfo.arch,
        hostname: osInfo.hostname,
        uptimeSeconds: time.uptime,
      },
      gpu: graphics.controllers
        .filter((c) => c.vram > 0)
        .map((c) => ({ model: c.model, vramMB: c.vram })),
      disks: fsSize
        .filter((d) => d.size > 0)
        .map((d) => ({
          fs: d.fs,
          size: d.size,
          used: d.used,
          usePercent: Math.round(d.use * 10) / 10,
        })),
      network: {
        interfaces: ifaceList.map((n) => ({
          iface: n.iface,
          ip4: n.ip4,
          mac: n.mac,
        })),
        stats: netStatsCache
          .filter((n) => ifaceNames.has(n.iface))
          .map((n) => ({
            iface: n.iface,
            rxSec: Math.round(n.rx_sec),
            txSec: Math.round(n.tx_sec),
          })),
      },
      battery: {
        hasBattery: battery.hasBattery,
        percent: battery.hasBattery ? battery.percent : null,
        isCharging: battery.hasBattery ? battery.isCharging : null,
      },
      processes: {
        all: procs.all,
        running: procs.running,
        blocked: procs.blocked,
        sleeping: procs.sleeping,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve React build in production
app.use(express.static(path.join(__dirname, "build")));
app.get("/{*path}", (_req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

app.listen(PORT, () => {
  console.log(`Status API running on port ${PORT}`);
});
