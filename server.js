const express = require('express');
const cors = require('cors');
const si = require('systeminformation');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/status', async (req, res) => {
  try {
    const [cpu, mem, osInfo, currentLoad, time, networkStats, diskLayout] = await Promise.all([
      si.cpu(),
      si.mem(),
      si.osInfo(),
      si.currentLoad(),
      si.time(),
      si.networkStats(),
      si.diskLayout(),
    ]);

    res.json({
      timestamp: new Date().toISOString(),
      online: true,
      cpu: {
        manufacturer: cpu.manufacturer,
        brand: cpu.brand,
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        speed: cpu.speed,
        load: Math.round(currentLoad.currentLoad * 10) / 10,
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
      },
      uptime: time.uptime,
      network: networkStats.map(n => ({
        iface: n.iface,
        rx_sec: Math.round(n.rx_sec),
        tx_sec: Math.round(n.tx_sec),
      })).filter(n => n.iface && n.rx_sec >= 0),
      disk: diskLayout.map(d => ({
        name: d.name,
        type: d.type,
        size: d.size,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Serve React build in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Status API running on port ${PORT}`);
});
