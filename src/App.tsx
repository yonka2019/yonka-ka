import React, { useEffect, useState } from 'react';
import './App.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface StatusData {
  timestamp: string;
  online: boolean;
  cpu: {
    manufacturer: string;
    brand: string;
    cores: number;
    physicalCores: number;
    speed: number;
    load: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usedPercent: number;
  };
  os: {
    platform: string;
    distro: string;
    release: string;
    arch: string;
    hostname: string;
  };
  uptime: number;
  network: { iface: string; rx_sec: number; tx_sec: number }[];
  disk: { name: string; type: string; size: number }[];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(' ');
}

function GaugeBar({ value, color }: { value: number; color: string }) {
  const pct = Math.min(value, 100);
  return (
    <div className="gauge-bar">
      <div className="gauge-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function App() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setStatus(data);
      setLastUpdate(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isOnline = !error && !!status?.online;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className={`status-dot ${isOnline ? 'online' : 'offline'}`} />
          <h1>PC Status</h1>
        </div>
        <div className="header-right">
          <span className={`badge ${isOnline ? 'badge-online' : 'badge-offline'}`}>
            {isOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
          {lastUpdate && (
            <span className="last-update">
              Updated {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

      {error && (
        <div className="error-banner">
          Cannot reach status API: {error}
        </div>
      )}

      {status && (
        <main className="grid">
          <div className="card">
            <h2>System</h2>
            <div className="info-row">
              <span className="label">Host</span>
              <span className="value">{status.os.hostname}</span>
            </div>
            <div className="info-row">
              <span className="label">OS</span>
              <span className="value">{status.os.distro} {status.os.release}</span>
            </div>
            <div className="info-row">
              <span className="label">Platform</span>
              <span className="value">{status.os.platform} / {status.os.arch}</span>
            </div>
            <div className="info-row">
              <span className="label">Uptime</span>
              <span className="value uptime">{formatUptime(status.uptime)}</span>
            </div>
          </div>

          <div className="card">
            <h2>CPU</h2>
            <div className="info-row">
              <span className="label">Model</span>
              <span className="value small">{status.cpu.brand}</span>
            </div>
            <div className="info-row">
              <span className="label">Cores</span>
              <span className="value">{status.cpu.physicalCores}P / {status.cpu.cores}L</span>
            </div>
            <div className="info-row">
              <span className="label">Speed</span>
              <span className="value">{status.cpu.speed} GHz</span>
            </div>
            <div className="info-row">
              <span className="label">Load</span>
              <span className={`value ${status.cpu.load > 80 ? 'danger' : status.cpu.load > 50 ? 'warn' : 'ok'}`}>
                {status.cpu.load}%
              </span>
            </div>
            <GaugeBar
              value={status.cpu.load}
              color={status.cpu.load > 80 ? '#ef4444' : status.cpu.load > 50 ? '#f59e0b' : '#22c55e'}
            />
          </div>

          <div className="card">
            <h2>Memory</h2>
            <div className="info-row">
              <span className="label">Total</span>
              <span className="value">{formatBytes(status.memory.total)}</span>
            </div>
            <div className="info-row">
              <span className="label">Used</span>
              <span className={`value ${status.memory.usedPercent > 85 ? 'danger' : status.memory.usedPercent > 65 ? 'warn' : 'ok'}`}>
                {formatBytes(status.memory.used)} ({status.memory.usedPercent}%)
              </span>
            </div>
            <div className="info-row">
              <span className="label">Free</span>
              <span className="value">{formatBytes(status.memory.free)}</span>
            </div>
            <GaugeBar
              value={status.memory.usedPercent}
              color={status.memory.usedPercent > 85 ? '#ef4444' : status.memory.usedPercent > 65 ? '#f59e0b' : '#22c55e'}
            />
          </div>

          <div className="card">
            <h2>Network</h2>
            {status.network.length === 0 ? (
              <p className="dim">No active interfaces</p>
            ) : (
              status.network.slice(0, 4).map(n => (
                <div key={n.iface} className="net-row">
                  <span className="iface">{n.iface}</span>
                  <span className="net-stat">
                    <span className="net-dir">↓</span> {formatBytes(n.rx_sec)}/s
                  </span>
                  <span className="net-stat">
                    <span className="net-dir">↑</span> {formatBytes(n.tx_sec)}/s
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="card">
            <h2>Disks</h2>
            {status.disk.length === 0 ? (
              <p className="dim">No disks found</p>
            ) : (
              status.disk.map((d, i) => (
                <div key={i} className="info-row">
                  <span className="label">{d.name || `Disk ${i + 1}`}</span>
                  <span className="value">{d.type} &mdash; {formatBytes(d.size)}</span>
                </div>
              ))
            )}
          </div>
        </main>
      )}

      {!status && !error && (
        <div className="loading">Loading status...</div>
      )}
    </div>
  );
}
