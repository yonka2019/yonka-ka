import React, { useEffect, useState } from "react";
import "./App.css";

const API_URL = "";

interface CpuData {
  brand: string;
  cores: number;
  physicalCores: number;
  speed: number;
  loadPercent: number | null;
  tempC: number | null;
}
interface MemData {
  total: number;
  used: number;
  free: number;
  usedPercent: number;
}
interface OsData {
  platform: string;
  distro: string;
  release: string;
  arch: string;
  hostname: string;
  uptimeSeconds: number;
}
interface GpuData { model: string; vramMB: number; }
interface DiskData { fs: string; size: number; used: number; usePercent: number; }
interface NetIface { iface: string; ip4: string; mac: string; }
interface NetStat { iface: string; rxSec: number; txSec: number; }
interface NetworkData { interfaces: NetIface[]; stats: NetStat[]; }
interface BatteryData { hasBattery: boolean; percent: number | null; isCharging: boolean | null; }
interface ProcessData { all: number; running: number; blocked: number; sleeping: number; }

interface StatusData {
  online: boolean;
  ready: boolean;
  cpu: CpuData;
  memory: MemData;
  os: OsData;
  gpu: GpuData[];
  disks: DiskData[];
  network: NetworkData;
  battery: BatteryData;
  processes: ProcessData;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatNetSpeed(bps: number): string {
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} MB/s`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} KB/s`;
  return `${bps} B/s`;
}

function gaugeColor(pct: number): string {
  return pct > 85 ? "#ef4444" : pct > 65 ? "#f59e0b" : "#22c55e";
}

function pctClass(pct: number): string {
  return pct > 85 ? "danger" : pct > 65 ? "warn" : "ok";
}

function GaugeBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="gauge-bar">
      <div className="gauge-fill" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
    </div>
  );
}

function SystemCard({ os }: { os: OsData }) {
  return (
    <div className="card">
      <h2>System</h2>
      <div className="info-row"><span className="label">Host</span><span className="value">{os.hostname}</span></div>
      <div className="info-row"><span className="label">OS</span><span className="value small">{os.distro} {os.release}</span></div>
      <div className="info-row"><span className="label">Platform</span><span className="value">{os.platform} / {os.arch}</span></div>
      <div className="info-row"><span className="label">Uptime</span><span className="value uptime">{formatUptime(os.uptimeSeconds)}</span></div>
    </div>
  );
}

function CpuCard({ cpu }: { cpu: CpuData }) {
  return (
    <div className="card">
      <h2>CPU</h2>
      <div className="info-row"><span className="label">Model</span><span className="value small">{cpu.brand}</span></div>
      <div className="info-row">
        <span className="label">Cores</span>
        <span className="value">{cpu.physicalCores}P / {cpu.cores}L</span>
      </div>
      <div className="info-row"><span className="label">Speed</span><span className="value">{cpu.speed} GHz</span></div>
      <div className="info-row">
        <span className="label">Load</span>
        <span className={`value ${cpu.loadPercent != null ? pctClass(cpu.loadPercent) : ""}`}>
          {cpu.loadPercent != null ? `${cpu.loadPercent}%` : "--"}
        </span>
      </div>
      {cpu.tempC != null && (
        <div className="info-row"><span className="label">Temp</span><span className="value">{cpu.tempC}°C</span></div>
      )}
      {cpu.loadPercent != null && (
        <GaugeBar value={cpu.loadPercent} color={gaugeColor(cpu.loadPercent)} />
      )}
    </div>
  );
}

function MemCard({ memory }: { memory: MemData }) {
  return (
    <div className="card">
      <h2>Memory</h2>
      <div className="info-row"><span className="label">Total</span><span className="value">{formatBytes(memory.total)}</span></div>
      <div className="info-row">
        <span className="label">Used</span>
        <span className={`value ${pctClass(memory.usedPercent)}`}>
          {formatBytes(memory.used)} ({memory.usedPercent}%)
        </span>
      </div>
      <div className="info-row"><span className="label">Free</span><span className="value">{formatBytes(memory.free)}</span></div>
      <GaugeBar value={memory.usedPercent} color={gaugeColor(memory.usedPercent)} />
    </div>
  );
}

function StorageCard({ disks }: { disks: DiskData[] }) {
  return (
    <div className="card">
      <h2>Storage</h2>
      {disks.length === 0 ? (
        <p className="dim">No disks found</p>
      ) : (
        disks.map((d, i) => (
          <div key={i} style={{ marginBottom: i < disks.length - 1 ? 12 : 0 }}>
            <div className="info-row">
              <span className="label">{d.fs}</span>
              <span className={`value ${pctClass(d.usePercent)}`}>
                {formatBytes(d.used)} / {formatBytes(d.size)} ({d.usePercent}%)
              </span>
            </div>
            <GaugeBar value={d.usePercent} color={gaugeColor(d.usePercent)} />
          </div>
        ))
      )}
    </div>
  );
}

function GpuCard({ gpu }: { gpu: GpuData[] }) {
  return (
    <div className="card">
      <h2>GPU</h2>
      {gpu.length === 0 ? (
        <p className="dim">No dedicated GPU detected</p>
      ) : (
        gpu.map((g, i) => (
          <div key={i} style={{ marginBottom: i < gpu.length - 1 ? 12 : 0 }}>
            <div className="info-row"><span className="label">Model</span><span className="value small">{g.model}</span></div>
            <div className="info-row"><span className="label">VRAM</span><span className="value">{formatBytes(g.vramMB * 1024 * 1024)}</span></div>
          </div>
        ))
      )}
    </div>
  );
}

function NetworkCard({ network }: { network: NetworkData }) {
  const statsMap = new Map(network.stats.map((s) => [s.iface, s]));
  return (
    <div className="card">
      <h2>Network</h2>
      {network.interfaces.length === 0 ? (
        <p className="dim">No active interfaces</p>
      ) : (
        network.interfaces.map((n) => {
          const stat = statsMap.get(n.iface);
          return (
            <div key={n.iface} className="net-row">
              <span className="iface">{n.iface}</span>
              <span className="net-stat"><span className="net-dir">↓</span> {stat ? formatNetSpeed(stat.rxSec) : "--"}</span>
              <span className="net-stat"><span className="net-dir">↑</span> {stat ? formatNetSpeed(stat.txSec) : "--"}</span>
              <span className="net-stat" style={{ color: "#475569", flexBasis: "100%" }}>{n.ip4}</span>
            </div>
          );
        })
      )}
    </div>
  );
}

function ProcessCard({ processes, battery }: { processes: ProcessData; battery: BatteryData }) {
  return (
    <div className="card">
      <h2>Processes</h2>
      <div className="info-row"><span className="label">Total</span><span className="value">{processes.all}</span></div>
      <div className="info-row"><span className="label">Running</span><span className="value ok">{processes.running}</span></div>
      <div className="info-row"><span className="label">Sleeping</span><span className="value">{processes.sleeping}</span></div>
      <div className="info-row">
        <span className="label">Blocked</span>
        <span className={`value ${processes.blocked > 0 ? "danger" : "ok"}`}>{processes.blocked}</span>
      </div>
      {battery.hasBattery && (
        <>
          <h2 style={{ marginTop: 16 }}>Battery</h2>
          <div className="info-row"><span className="label">Charge</span><span className={`value ${pctClass(battery.percent!)}`}>{battery.percent}%</span></div>
          <div className="info-row"><span className="label">Status</span><span className="value">{battery.isCharging ? "Charging" : "Discharging"}</span></div>
          <GaugeBar value={battery.percent!} color={gaugeColor(battery.percent!)} />
        </>
      )}
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
          <div className={`status-dot ${isOnline ? "online" : "offline"}`} />
          <h1>PC Status</h1>
        </div>
        <div className="header-right">
          <span className={`badge ${isOnline ? "badge-online" : "badge-offline"}`}>
            {isOnline ? "ONLINE" : "OFFLINE"}
          </span>
          {lastUpdate && (
            <span className="last-update">Updated {lastUpdate.toLocaleTimeString()}</span>
          )}
        </div>
      </header>

      {error && <div className="error-banner">Cannot reach status API: {error}</div>}

      {status && !status.ready && <div className="loading">Initializing...</div>}

      {status?.ready && (
        <main className="grid">
          <SystemCard os={status.os} />
          <CpuCard cpu={status.cpu} />
          <MemCard memory={status.memory} />
          <StorageCard disks={status.disks} />
          <GpuCard gpu={status.gpu} />
          <NetworkCard network={status.network} />
          <ProcessCard processes={status.processes} battery={status.battery} />
        </main>
      )}

      {!status && !error && <div className="loading">Loading status...</div>}
    </div>
  );
}
