'use client';

import { useState, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Radar, Globe, Shield, FileText, Radio,
  ChevronDown, ChevronUp, Loader2, AlertTriangle, Server,
  Wifi, Lock, MapPin, Bug, Code, Layers, Network, Fingerprint,
  CheckCircle, XCircle, Clock, ExternalLink, Crosshair,
  Maximize2, Minimize2, Gavel, Bitcoin, Phone, Terminal, ShieldAlert,
  Skull,
} from 'lucide-react';
import { ipToNumber, numberToIp, calculateSubnetStart, classifyDevice, assessRisk, batchFetch, ShodanInternetDBResponse, SweepDevice } from '@/lib/osint-utils';

const TABS = [
  { id: 'scanner', label: 'PORT SCAN', icon: Radar, placeholder: 'IP or hostname', color: '#00E5FF' },
  { id: 'vuln', label: 'VULN SWEEP', icon: Bug, placeholder: 'IP or hostname', color: '#FF3D3D' },

  { id: 'dns', label: 'DNS', icon: Server, placeholder: 'Domain name', color: '#448AFF' },
  { id: 'whois', label: 'WHOIS', icon: FileText, placeholder: 'Domain name', color: '#FFD700' },
  { id: 'certs', label: 'CERTS', icon: Lock, placeholder: 'Domain name', color: '#E040FB' },
  { id: 'threats', label: 'THREATS', icon: AlertTriangle, placeholder: 'IP, domain, or hash', color: '#FF9500' },
  { id: 'headers', label: 'HEADERS', icon: Code, placeholder: 'URL to inspect', color: '#87CEEB' },
  { id: 'ssl', label: 'SSL/TLS', icon: Shield, placeholder: 'Domain name', color: '#76FF03' },
  { id: 'subdomains', label: 'SUBDOMAINS', icon: Layers, placeholder: 'Domain to enumerate', color: '#00BCD4' },
  { id: 'tech', label: 'TECH DETECT', icon: Code, placeholder: 'URL to fingerprint', color: '#9C27B0' },
  { id: 'shodan', label: 'SHODAN IOT', icon: Network, placeholder: 'IP address', color: '#FF3D3D' },
  { id: 'shodan-search', label: 'SHODAN SEARCH', icon: Network, placeholder: 'Shodan query (e.g. port:8080 country:DE)', color: '#FF3D3D' },
  { id: 'bgp', label: 'BGP ROUTE', icon: Globe, placeholder: 'IP or ASN', color: '#00E5FF' },
  { id: 'mac', label: 'MAC ADDR', icon: Fingerprint, placeholder: 'MAC address', color: '#FFD700' },
  { id: 'phone', label: 'PHONE INTEL', icon: Phone, placeholder: 'Phone number (e.g. +1...)', color: '#FF9500' },
  { id: 'leaks', label: 'DATA LEAKS', icon: ShieldAlert, placeholder: 'Email address', color: '#E040FB' },
  { id: 'github', label: 'GITHUB RECON', icon: Terminal, placeholder: 'GitHub username', color: '#87CEEB' },
  // ── Cyber threat feeds ──
  { id: 'threatfox', label: 'THREATFOX', icon: AlertTriangle, placeholder: 'IP, domain, URL, or hash', color: '#FF1744' },
  { id: 'urlhaus', label: 'URLHAUS', icon: Wifi, placeholder: 'URL or hostname', color: '#FF6B00' },
  { id: 'c2check', label: 'C2 CHECK', icon: Server, placeholder: 'IP address', color: '#FF3D3D' },
  { id: 'spycheck', label: 'SPYWARE DB', icon: Bug, placeholder: 'Domain or IP', color: '#E040FB' },
  { id: 'darkweb', label: 'DARK WEB', icon: Skull, placeholder: 'Search term', color: '#9C27B0' },
  // ── Network intel ──
  { id: 'greynoise', label: 'GREYNOISE', icon: Radio, placeholder: 'IP address', color: '#FF9500' },
  { id: 'urlscan', label: 'URL SCAN', icon: Globe, placeholder: 'domain:example.com', color: '#448AFF' },
  { id: 'wayback', label: 'WAYBACK', icon: Clock, placeholder: 'URL or domain', color: '#87CEEB' },
  { id: 'tor', label: 'TOR CHECK', icon: Shield, placeholder: 'IP address', color: '#9C27B0' },
  { id: 'pdns', label: 'PASSIVE DNS', icon: Server, placeholder: 'Domain or IP', color: '#00BCD4' },
  { id: 'reverseip', label: 'REVERSE IP', icon: MapPin, placeholder: 'IP address', color: '#FF3D3D' },
  { id: 'asn', label: 'ASN LOOKUP', icon: Network, placeholder: 'AS12345 or 1.2.3.0/24', color: '#D4AF37' },
  { id: 'otx', label: 'OTX INTEL', icon: ShieldAlert, placeholder: 'IP, domain, URL, or hash', color: '#FF6B00' },
  { id: 'virustotal', label: 'VIRUSTOTAL', icon: Bug, placeholder: 'IP, domain, URL, or hash', color: '#2196F3' },
  { id: 'sweep', label: 'IP SWEEP', icon: Crosshair, placeholder: 'Enter IP address (e.g. 8.8.8.8)', color: '#FF3D3D' },
];

interface OsintPanelProps { isOpen?: boolean; onClose?: () => void; isMobile?: boolean; onSweepVisualize?: (data: any) => void; onScanGeolocate?: (target: string, data: any) => void; }

function OsintPanelInner({ isMobile, onSweepVisualize, onScanGeolocate }: OsintPanelProps) {
  const [activeTab, setActiveTab] = useState('scanner');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scanType, setScanType] = useState('quick');
  const [expanded, setExpanded] = useState(true);
  const [history, setHistory] = useState<{tab:string;query:string;time:string}[]>([]);
  const [sweepResult, setSweepResult] = useState<any>(null);
  const [sweepProgress, setSweepProgress] = useState<{ current: number; total: number } | null>(null);
  const [sweepCidr, setSweepCidr] = useState(24);
  const [cveCache, setCveCache] = useState<Record<string, any>>({});
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);

  // Fetch CVE details when a device is expanded in full-screen mode
  const fetchCveDetails = useCallback(async (cveIds: string[]) => {
    const missing = cveIds.filter(id => !cveCache[id]);
    if (missing.length === 0) return;
    // Mark as loading
    setCveCache(prev => {
      const next = { ...prev };
      for (const id of missing) next[id] = { loading: true };
      return next;
    });
    // Fetch in parallel
    const results = await Promise.allSettled(
      missing.map(id => fetch(`/api/osint/cve?cve=${encodeURIComponent(id)}`).then(r => r.json()).then(data => ({ id, data })))
    );
    setCveCache(prev => {
      const next = { ...prev };
      for (const r of results) {
        if (r.status === 'fulfilled') {
          next[r.value.id] = r.value.data;
        }
      }
      return next;
    });
  }, [cveCache]);

  const runLookup = useCallback(async () => {
    if (!query.trim() || loading) return;
    setLoading(true); setError(''); setResults(null);

    // IP Sweep / Vuln Scan — separate flow
    if (activeTab === 'sweep' || activeTab === 'vuln') {
      setSweepResult(null);
      const cidr = sweepCidr;
      const totalHosts = Math.pow(2, 32 - cidr);
      setSweepProgress({ current: 0, total: totalHosts });
      try {
        const t0 = Date.now();
        const res = await fetch(`/api/osint/sweep?ip=${encodeURIComponent(query)}&cidr=${cidr}`);
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Sweep failed (${res.status})`); }
        const initData = await res.json();

        const ipParts = initData.target_ip.split('.').map(Number) as [number, number, number, number];
        const ipNum = ipToNumber(ipParts);
        const subnetStart = calculateSubnetStart(ipNum, cidr);
        const subnet = numberToIp(subnetStart);

        const urls: string[] = [];
        for (let i = 0; i < totalHosts; i++) {
          urls.push(`https://internetdb.shodan.io/${numberToIp((subnetStart + i) >>> 0)}`);
        }

        const shodanResults = await batchFetch<ShodanInternetDBResponse>(urls, 15, async (u) => {
          try {
            const r = await fetch(u, { cache: 'no-store' });
            if (r.status === 404) return null;
            if (!r.ok) return null;
            return await r.json();
          } catch {
            return null;
          }
        }, (done) => setSweepProgress({ current: done, total: totalHosts }));

        const devices: SweepDevice[] = [];
        const deviceBreakdown: Record<string, number> = {};
        for (const sr of shodanResults) {
          if (!sr) continue;
          const classification = classifyDevice(sr.ports, sr.cpes, sr.tags);
          const risk = assessRisk({ ports: sr.ports, vulns: sr.vulns });
          devices.push({
            ip: sr.ip, ports: sr.ports, hostnames: sr.hostnames,
            cpes: sr.cpes, vulns: sr.vulns, tags: sr.tags,
            device_type: classification.device_type,
            device_icon: classification.device_icon,
            device_color: classification.device_color,
            risk_level: risk
          });
          deviceBreakdown[classification.device_type] = (deviceBreakdown[classification.device_type] || 0) + 1;
        }

        setSweepResult({
          center: initData.center,
          subnet: `${subnet}/${cidr}`,
          cidr,
          target_ip: initData.target_ip,
          devices,
          summary: { total_hosts: totalHosts, total_responsive: devices.length, device_breakdown: deviceBreakdown },
          sweep_time_ms: Date.now() - t0
        });
        setSweepProgress(null);
        setHistory(prev => [{ tab: activeTab, query, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
      } catch (err: any) {
        setError(err.message);
        setSweepProgress(null);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      let url = '';
      switch (activeTab) {

        case 'dns': url = `/api/osint/dns?domain=${encodeURIComponent(query)}`; break;
        case 'certs': url = `/api/osint/certs?domain=${encodeURIComponent(query)}`; break;
        case 'whois': url = `/api/osint/whois?domain=${encodeURIComponent(query)}`; break;
        case 'threats': url = `/api/osint/threats?query=${encodeURIComponent(query)}`; break;
        case 'bgp': url = `/api/osint/bgp?query=${encodeURIComponent(query)}`; break;
        case 'mac': url = `/api/osint/mac?mac=${encodeURIComponent(query)}`; break;
        case 'phone': url = `/api/osint/phone?number=${encodeURIComponent(query)}`; break;
        case 'leaks': url = `/api/osint/leaks?email=${encodeURIComponent(query)}`; break;
        case 'crypto': url = `/api/osint/crypto?address=${encodeURIComponent(query)}`; break;
        case 'github': url = `/api/osint/github?user=${encodeURIComponent(query)}`; break;
        case 'scanner': url = `/api/scanner?target=${encodeURIComponent(query)}&type=${scanType}`; break;
        case 'headers': url = `/api/scanner?target=${encodeURIComponent(query)}&type=headers`; break;
        case 'ssl': url = `/api/scanner?target=${encodeURIComponent(query)}&type=ssl`; break;
        case 'subdomains': url = `/api/scanner?target=${encodeURIComponent(query)}&type=subdomains`; break;
        case 'tech': url = `/api/scanner?target=${encodeURIComponent(query)}&type=tech`; break;
        case 'shodan': url = `https://internetdb.shodan.io/${encodeURIComponent(query)}`; break;
        case 'shodan-search': url = `/api/shodan/search?q=${encodeURIComponent(query)}`; break;
        case 'threatfox': url = `/api/osint/threatfox?ioc=${encodeURIComponent(query)}`; break;
        case 'urlhaus': url = `/api/osint/urlhaus?url=${encodeURIComponent(query)}`; break;
        case 'c2check': url = `/api/osint/c2?ip=${encodeURIComponent(query)}`; break;
        case 'spycheck': url = `/api/osint/spyware-check?target=${encodeURIComponent(query)}`; break;
        case 'darkweb': url = `/api/osint/darkweb?query=${encodeURIComponent(query)}`; break;
        case 'greynoise': url = `/api/osint/greynoise?ip=${encodeURIComponent(query)}`; break;
        case 'urlscan': url = `/api/osint/urlscan?q=${encodeURIComponent(query)}`; break;
        case 'wayback': url = `/api/osint/wayback?url=${encodeURIComponent(query)}`; break;
        case 'tor': url = `/api/osint/tor?ip=${encodeURIComponent(query)}`; break;
        case 'pdns': url = `/api/osint/pdns?query=${encodeURIComponent(query)}`; break;
        case 'reverseip': url = `/api/osint/reverse-ip?ip=${encodeURIComponent(query)}`; break;
        case 'asn': url = `/api/osint/asn?resource=${encodeURIComponent(query)}`; break;
        case 'otx': url = `/api/osint/otx?ioc=${encodeURIComponent(query)}&type=ip`; break;
        case 'virustotal': url = `/api/osint/virustotal?resource=${encodeURIComponent(query)}&type=ip`; break;
      }
      const res = await fetch(url, activeTab === 'shodan' ? { cache: 'no-store' } : undefined);
      if (activeTab === 'shodan' && res.status === 404) {
        setResults({ ip: query, status: 'No Shodan InternetDB records found', ports: [], cpes: [], hostnames: [], tags: [], vulns: [] });
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setResults(data);
        setHistory(prev => [{ tab: activeTab, query, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 9)]);
        
        // Geolocate the target in the background
        if (activeTab === 'phone') {
          if (data.lat && data.lng && onScanGeolocate) {
             onScanGeolocate(query, { lat: data.lat, lng: data.lng, type: 'phone', region: data.region });
          }
        } else if (activeTab !== 'sweep' && activeTab !== 'vuln' && activeTab !== 'crypto' && activeTab !== 'mac' && activeTab !== 'bgp' && activeTab !== 'github' && activeTab !== 'leaks' && activeTab !== 'phone' && activeTab !== 'greynoise' && activeTab !== 'urlscan' && activeTab !== 'wayback' && activeTab !== 'tor' && activeTab !== 'pdns' && activeTab !== 'reverseip' && activeTab !== 'asn' && activeTab !== 'otx' && activeTab !== 'virustotal' && activeTab !== 'threatfox' && activeTab !== 'urlhaus' && activeTab !== 'c2check' && activeTab !== 'spycheck' && activeTab !== 'darkweb') {
          fetch(`/api/osint/ip?ip=${encodeURIComponent(query)}`)
            .then(r => r.json())
            .then(locData => {
              if (locData && locData.geo && locData.geo.lat && locData.geo.lon && onScanGeolocate) {
                // ip-api returns lat/lon, we pass it up
                onScanGeolocate(query, { lat: locData.geo.lat, lng: locData.geo.lon, ...locData, type: activeTab });
              }
            })
            .catch(() => {});
        }
      } else {
        setError(data.error || 'Lookup failed');
      }
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }, [query, activeTab, scanType, loading, sweepCidr]);

  const currentTab = TABS.find(t => t.id === activeTab);

  // ── Shodan-style structured result renderers ──

  const ResultRow = ({ label, value, color, mono = true }: { label: string; value: any; color?: string; mono?: boolean }) => {
    if (value === undefined || value === null || value === '') return null;
    return (
      <div className="flex items-start gap-3 py-1.5 border-b border-[var(--border-secondary)]/20 last:border-0">
        <span className="text-[9px] font-mono text-[var(--text-muted)] uppercase tracking-wider w-[90px] flex-shrink-0 pt-0.5">{label}</span>
        <span className={`text-[10px] ${mono ? 'font-mono' : ''} break-all flex-1`} style={{ color: color || 'var(--text-primary)' }}>
          {String(value)}
        </span>
      </div>
    );
  };

  const StatusBadge = ({ ok, label }: { ok: boolean; label: string }) => (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono font-bold ${ok ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
      {ok ? <CheckCircle className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
      {label}
    </span>
  );

  // Surfaces an inline OFAC-SDN hit (used by the WHOIS and IP-intel routes
  // when their cross-check finds a sanctioned registrant / ASN owner).
  const SanctionsBadge = ({ match }: { match: any }) => {
    if (!match || !Array.isArray(match.hits) || match.hits.length === 0) return null;
    return (
      <div className="mb-2 px-2 py-2 rounded border border-red-500/40 bg-red-500/15">
        <div className="flex items-center gap-2 mb-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          <span className="text-[10px] font-mono font-bold text-red-400 tracking-wider">
            SANCTIONED — {match.source || 'OFAC SDN'}
          </span>
        </div>
        {match.hits.slice(0, 5).map((h: any, i: number) => (
          <div key={i} className="text-[9px] font-mono text-red-200 break-all leading-tight">
            <span className="text-[var(--text-muted)]">↳ {h.matched_value}:</span>{' '}
            {(h.entries || []).slice(0, 2).map((e: any) => e.name).join('; ')}
          </div>
        ))}
      </div>
    );
  };

  const SectionHeader = ({ title, icon: Icon, color }: { title: string; icon: any; color: string }) => (
    <div className="flex items-center gap-2 mt-3 mb-1.5 first:mt-0">
      <Icon className="w-3.5 h-3.5" style={{ color }} />
      <span className="text-[10px] font-mono font-bold tracking-widest" style={{ color }}>{title}</span>
      <div className="flex-1 h-px" style={{ background: `${color}30` }} />
    </div>
  );

  const PortRow = ({ port, state, service, version }: { port: number; state: string; service?: string; version?: string }) => (
    <div className="flex items-center gap-2 py-1 px-2 rounded hover:bg-[var(--hover-accent)] transition-colors">
      <span className="text-[11px] font-mono font-bold text-[var(--cyan-primary)] w-[60px]">{port}</span>
      <StatusBadge ok={state === 'open'} label={state.toUpperCase()} />
      <span className="text-[10px] font-mono text-[var(--text-secondary)] flex-1">{service || 'unknown'}</span>
      {version && <span className="text-[9px] font-mono text-[var(--text-muted)]">{version}</span>}
    </div>
  );

  const renderStructuredResults = () => {
    if (!results) return null;
    const r = results;

    // ── PORT SCAN ──
    if (activeTab === 'scanner') {
      const ports = r.ports || r.open_ports || r.results || [];
      const host = r.host || r.target || query;
      return (
        <div>
          <SectionHeader title="HOST INFO" icon={Server} color="#00E5FF" />
          <ResultRow label="Target" value={host} color="#00E5FF" />
          <ResultRow label="Scan Type" value={r.scan_type || scanType} />
          <ResultRow label="Duration" value={r.duration || r.scan_time} />
          {Array.isArray(ports) && ports.length > 0 && (
            <>
              <SectionHeader title={`OPEN PORTS (${ports.length})`} icon={Wifi} color="#00E676" />
              <div className="space-y-0.5">
                {ports.map((p: any, i: number) => (
                  <PortRow key={i} port={p.port || p} state={p.state || 'open'} service={p.service || p.name} version={p.version} />
                ))}
              </div>
            </>
          )}
          {(!Array.isArray(ports) || ports.length === 0) && renderFallback()}
        </div>
      );
    }

    // ── VULN SCAN ──
    if (activeTab === 'vuln') {
      const vulns = r.vulnerabilities || r.vulns || r.cves || [];
      const exploits = vulns.filter((v: any) => v.is_exploit);
      const regularVulns = vulns.filter((v: any) => !v.is_exploit);
      
      return (
        <div>
          <SectionHeader title="VULNERABILITY ASSESSMENT" icon={Bug} color="#FF3D3D" />
          <ResultRow label="Target" value={r.target || query} color="#FF3D3D" />
          <ResultRow label="Total CVEs" value={Array.isArray(vulns) ? vulns.length : 0} color={Array.isArray(vulns) && vulns.length > 0 ? '#FF3D3D' : '#00E676'} />
          <ResultRow label="Risk Level" value={r.risk_level || r.severity} />
          {Array.isArray(regularVulns) && regularVulns.length > 0 && (
            <div className="mt-2 space-y-1">
              {regularVulns.slice(0, 20).map((v: any, i: number) => (
                <div key={i} className="p-2 rounded-lg border border-red-500/20 bg-red-500/5 flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-red-400">{v.id || v.cve || v.name}</span>
                    {v.severity && <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${v.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400' : v.severity === 'HIGH' ? 'bg-orange-500/20 text-orange-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{v.severity}</span>}
                  </div>
                  {v.cvss && <div className="text-[9px] font-mono text-[var(--text-muted)] mt-1">CVSS: {v.cvss} ({v.type || 'cve'})</div>}
                  {v.description && <p className="text-[9px] font-mono text-[var(--text-muted)] mt-1 line-clamp-2">{v.description}</p>}
                </div>
              ))}
            </div>
          )}
          
          {exploits.length > 0 && (
            <div className="mt-4">
              <SectionHeader title={`POSSIBLE EXPLOITS (${exploits.length})`} icon={AlertTriangle} color="#FF9500" />
              <div className="mt-2 space-y-1">
                {exploits.slice(0, 10).map((e: any, i: number) => (
                  <div key={i} className="p-2 rounded-lg border border-orange-500/30 bg-orange-500/10 flex flex-col">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-orange-400">{e.id}</span>
                      <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">EXPLOIT</span>
                    </div>
                    <div className="text-[9px] font-mono text-[var(--text-muted)] mt-1 flex justify-between">
                      <span>Source: {e.type?.toUpperCase() || 'UNKNOWN'}</span>
                      {e.cvss && <span>CVSS: {e.cvss}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {(!Array.isArray(vulns) || vulns.length === 0) && renderFallback()}
        </div>
      );
    }



    // ── DNS ──
    if (activeTab === 'dns') {
      return (
        <div>
          <SectionHeader title="DNS RECORDS" icon={Server} color="#448AFF" />
          <ResultRow label="Domain" value={r.domain || query} color="#448AFF" />
          {r.A && <ResultRow label="A Records" value={Array.isArray(r.A) ? r.A.join(', ') : r.A} />}
          {r.AAAA && <ResultRow label="AAAA" value={Array.isArray(r.AAAA) ? r.AAAA.join(', ') : r.AAAA} />}
          {r.MX && <ResultRow label="MX" value={Array.isArray(r.MX) ? r.MX.map((m:any) => m.exchange || m).join(', ') : r.MX} />}
          {r.NS && <ResultRow label="NS" value={Array.isArray(r.NS) ? r.NS.join(', ') : r.NS} />}
          {r.TXT && <ResultRow label="TXT" value={Array.isArray(r.TXT) ? r.TXT.join(' | ') : r.TXT} />}
          {r.CNAME && <ResultRow label="CNAME" value={Array.isArray(r.CNAME) ? r.CNAME.join(', ') : r.CNAME} />}
          {r.SOA && <ResultRow label="SOA" value={typeof r.SOA === 'object' ? `${r.SOA.nsname} (${r.SOA.hostmaster})` : r.SOA} />}
          {renderFallbackExcluding(['domain','A','AAAA','MX','NS','TXT','CNAME','SOA','timestamp','cached'])}
        </div>
      );
    }

    // ── WHOIS ──
    if (activeTab === 'whois') {
      return (
        <div>
          <SectionHeader title="WHOIS INTELLIGENCE" icon={FileText} color="#FFD700" />
          <SanctionsBadge match={r.sanctions_match} />
          <ResultRow label="Domain" value={r.domain_name || r.domainName || query} color="#FFD700" />
          <ResultRow label="Registrar" value={r.registrar} />
          <ResultRow label="Created" value={r.creation_date || r.createdDate} />
          <ResultRow label="Expires" value={r.expiration_date || r.expiresDate} />
          <ResultRow label="Updated" value={r.updated_date || r.updatedDate} />
          <ResultRow label="Status" value={Array.isArray(r.status) ? r.status.join(', ') : r.status} />
          <ResultRow label="Nameservers" value={Array.isArray(r.name_servers || r.nameServers) ? (r.name_servers || r.nameServers).join(', ') : r.name_servers} />
          {renderFallbackExcluding(['domain_name','domainName','registrar','creation_date','createdDate','expiration_date','expiresDate','updated_date','updatedDate','status','name_servers','nameServers','timestamp','cached','raw','sanctions_match'])}
        </div>
      );
    }

    // ── SHODAN ──
    if (activeTab === 'shodan') {
      return (
        <div>
          <SectionHeader title="SHODAN IOT INTELLIGENCE" icon={Network} color="#FF3D3D" />
          <ResultRow label="Target IP" value={r.ip || query} color="#FF3D3D" />
          {r.hostnames?.length > 0 && <ResultRow label="Hostnames" value={r.hostnames.join(', ')} />}
          {r.ports?.length > 0 && <ResultRow label="Open Ports" value={r.ports.join(', ')} color="#00E5FF" />}
          {r.tags?.length > 0 && <ResultRow label="Tags" value={r.tags.join(', ')} color="#FF9500" />}
          {r.vulns?.length > 0 && (
            <div className="mt-2 p-2 border border-red-500/30 bg-red-500/10 rounded">
              <span className="text-[10px] font-mono text-red-400 font-bold mb-1 block">VULNERABILITIES ({r.vulns.length})</span>
              <div className="flex flex-wrap gap-1">
                {r.vulns.slice(0, 10).map((v: string) => (
                  <a key={v} href={`https://nvd.nist.gov/vuln/detail/${v}`} target="_blank" rel="noreferrer" className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1A1A18] text-[#8A8880] hover:text-[#FF3D3D]">{v}</a>
                ))}
                {r.vulns.length > 10 && <span className="text-[9px] font-mono text-[#8A8880]">+{r.vulns.length - 10} more</span>}
              </div>
            </div>
          )}
          {renderFallbackExcluding(['ip','hostnames','ports','tags','vulns','cpes'])}
        </div>
      );
    }

    // ── BGP ──
    if (activeTab === 'bgp') {
      return (
        <div>
          <SectionHeader title="BGP ROUTING INTELLIGENCE" icon={Globe} color="#00E5FF" />
          <ResultRow label="Query" value={r.query} color="#00E5FF" />
          {r.type === 'ip' && r.ip && (
            <>
              {r.ip.prefixes?.map((p: any, i: number) => (
                <div key={i} className="mt-2 p-2 border border-[#00E5FF]/20 bg-[#00E5FF]/5 rounded">
                  <ResultRow label="ASN" value={`AS${p.asn.asn} - ${p.asn.name}`} color="#00E5FF" />
                  <ResultRow label="Prefix" value={p.prefix} />
                  <ResultRow label="Country" value={p.asn.country_code} />
                  <ResultRow label="Description" value={p.asn.description} />
                </div>
              ))}
            </>
          )}
          {r.type === 'asn' && r.asn && (
            <div className="mt-2 p-2 border border-[#00E5FF]/20 bg-[#00E5FF]/5 rounded">
              <ResultRow label="ASN" value={`AS${r.asn.asn}`} color="#00E5FF" />
              <ResultRow label="Name" value={r.asn.name} />
              <ResultRow label="Description" value={r.asn.description} />
              <ResultRow label="Country" value={r.asn.country_code} />
              {r.prefixes && <ResultRow label="Prefixes" value={`IPv4: ${r.prefixes.total_v4} | IPv6: ${r.prefixes.total_v6}`} />}
              {r.peers && <ResultRow label="Peers" value={r.peers.total} />}
            </div>
          )}
          {renderFallbackExcluding(['query', 'type', 'ip', 'asn', 'prefixes', 'peers', 'timestamp'])}
        </div>
      );
    }

    // ── MAC ──
    if (activeTab === 'mac') {
      return (
        <div>
          <SectionHeader title="MAC VENDOR LOOKUP" icon={Fingerprint} color="#FFD700" />
          <ResultRow label="MAC Address" value={r.mac} color="#FFD700" />
          <ResultRow label="Vendor" value={r.vendor} color={r.vendor === 'Not Found' ? '#FF3D3D' : '#00E676'} />
        </div>
      );
    }

    // ── PHONE ──
    if (activeTab === 'phone') {
      return (
        <div>
          <SectionHeader title="PHONE INTELLIGENCE" icon={Phone} color="#FF9500" />
          <ResultRow label="Query" value={r.query} color="#FF9500" />
          <ResultRow label="Valid" value={r.valid ? 'YES' : 'NO'} color={r.valid ? '#00E676' : '#FF3D3D'} />
          {r.valid && (
            <>
              <ResultRow label="E.164 Format" value={r.number} />
              <ResultRow label="Intl Format" value={r.international} />
              <ResultRow label="Nat Format" value={r.national} />
              <ResultRow label="Country" value={`${r.region} (${r.country_code})`} />
              <ResultRow label="Line Type" value={r.line_type} color={r.line_type === 'MOBILE' ? '#00E5FF' : r.line_type === 'VOIP' ? '#FF9500' : undefined} />
            </>
          )}
        </div>
      );
    }

    // ── GITHUB ──
    if (activeTab === 'github') {
      return (
        <div>
          <SectionHeader title="GITHUB RECON" icon={Terminal} color="#87CEEB" />
          <div className="flex items-center gap-3 mb-2">
            {r.avatar_url && <img src={r.avatar_url} alt="avatar" className="w-10 h-10 rounded-full border border-[#87CEEB]/30" />}
            <div>
              <div className="text-[12px] font-mono font-bold text-[#87CEEB]">{r.name || r.username}</div>
              <div className="text-[9px] font-mono text-[var(--text-muted)]">@{r.username} • {r.followers} followers</div>
            </div>
          </div>
          <ResultRow label="Company" value={r.company} />
          <ResultRow label="Location" value={r.location} />
          <ResultRow label="Email" value={r.email} color="#00E676" />
          <ResultRow label="Twitter" value={r.twitter} color="#448AFF" />
          <ResultRow label="Website" value={r.blog} />
          <ResultRow label="Bio" value={r.bio} />
          {r.recent_repos?.length > 0 && (
            <div className="mt-2 p-2 border border-[#87CEEB]/20 bg-[#87CEEB]/5 rounded">
              <span className="text-[9px] font-mono text-[#87CEEB] block mb-1">RECENT REPOS</span>
              {r.recent_repos.map((repo: any, i: number) => (
                <div key={i} className="flex justify-between text-[9px] font-mono mb-0.5">
                  <span className="text-[#E8E6E0]">{repo.name}</span>
                  <span className="text-[var(--text-muted)]">{repo.language || 'Unknown'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // ── LEAKS ──
    if (activeTab === 'leaks') {
      return (
        <div>
          <SectionHeader title="DATA LEAK SWEEP" icon={ShieldAlert} color="#E040FB" />
          <ResultRow label="Email Target" value={r.email} color="#E040FB" />
          <ResultRow label="Status" value={r.breached ? 'COMPROMISED' : 'SECURE'} color={r.breached ? '#FF1744' : '#00E676'} />
          
          {r.breached && r.data_exposed?.length > 0 && (
            <div className="mt-2 p-2 border border-[#E040FB]/30 bg-[#E040FB]/10 rounded">
              <span className="text-[10px] font-mono text-[#E040FB] font-bold mb-1 block">EXPOSED DATA POINTS</span>
              <div className="flex flex-wrap gap-1">
                {r.data_exposed.map((dc: string) => (
                  <span key={dc} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#1A1A18] text-[#E8E6E0] border border-[#E040FB]/20">{dc}</span>
                ))}
              </div>
            </div>
          )}

          {r.breached && r.breaches?.length > 0 && (
            <div className="mt-2 p-2 border border-red-500/30 bg-red-500/10 rounded">
              <span className="text-[10px] font-mono text-red-400 font-bold mb-1 block">KNOWN BREACHES ({r.breaches.length})</span>
              <div className="flex flex-col gap-1">
                {r.breaches.map((b: string) => (
                  <a key={b} href={`https://haveibeenpwned.com/PwnedWebsites#${b}`} target="_blank" rel="noreferrer" className="text-[9px] font-mono px-2 py-1 rounded bg-[#1A1A18] text-red-300 hover:text-white hover:bg-red-500/30 flex items-center justify-between transition-colors">
                    <span>{b}</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    // ── CERTS ──
    if (activeTab === 'certs') {
      const certs = r.certificates || r.certs || (Array.isArray(r) ? r : []);
      return (
        <div>
          <SectionHeader title="CERTIFICATE TRANSPARENCY" icon={Lock} color="#E040FB" />
          <ResultRow label="Domain" value={query} color="#E040FB" />
          <ResultRow label="Certificates" value={Array.isArray(certs) ? certs.length : 0} />
          {Array.isArray(certs) && certs.slice(0, 15).map((c: any, i: number) => (
            <div key={i} className="mt-1.5 p-2 rounded border border-[var(--border-secondary)]/30 bg-[var(--bg-tertiary)]/30">
              <ResultRow label="Issuer" value={c.issuer_name || c.issuer} />
              <ResultRow label="Common Name" value={c.common_name || c.name_value} />
              <ResultRow label="Not Before" value={c.not_before} />
              <ResultRow label="Not After" value={c.not_after} />
            </div>
          ))}
          {(!Array.isArray(certs) || certs.length === 0) && renderFallback()}
        </div>
      );
    }

    // ── THREATS ──
    if (activeTab === 'threats') {
      return (
        <div>
          <SectionHeader title="THREAT INTELLIGENCE" icon={AlertTriangle} color="#FF9500" />
          <ResultRow label="Query" value={query} color="#FF9500" />
          <ResultRow label="Risk Score" value={r.risk_score || r.score} color={
            (r.risk_score || r.score || 0) > 70 ? '#FF3D3D' : (r.risk_score || r.score || 0) > 40 ? '#FF9500' : '#00E676'
          } />
          <ResultRow label="Malicious" value={r.malicious !== undefined ? (r.malicious ? 'YES' : 'NO') : undefined} color={r.malicious ? '#FF3D3D' : '#00E676'} />
          <ResultRow label="Category" value={r.category || r.type} />
          <ResultRow label="Reports" value={r.total_reports || r.reports} />
          <ResultRow label="Last Seen" value={r.last_seen || r.last_analysis} />
          {r.tags && <ResultRow label="Tags" value={Array.isArray(r.tags) ? r.tags.join(', ') : r.tags} />}
          {renderFallbackExcluding(['risk_score','score','malicious','category','type','total_reports','reports','last_seen','last_analysis','tags','timestamp','cached','query'])}
        </div>
      );
    }

    // ── SSL ──
    if (activeTab === 'ssl') {
      return (
        <div>
          <SectionHeader title="SSL/TLS ANALYSIS" icon={Shield} color="#76FF03" />
          <ResultRow label="Target" value={query} color="#76FF03" />
          <ResultRow label="Protocol" value={r.protocol || r.tls_version} />
          <ResultRow label="Cipher" value={r.cipher || r.cipher_suite} />
          <ResultRow label="Valid" value={r.valid !== undefined ? (r.valid ? 'YES' : 'NO') : undefined} color={r.valid ? '#00E676' : '#FF3D3D'} />
          <ResultRow label="Issuer" value={r.issuer} />
          <ResultRow label="Subject" value={r.subject} />
          <ResultRow label="Expires" value={r.expires || r.not_after} />
          <ResultRow label="SANs" value={Array.isArray(r.sans) ? r.sans.join(', ') : r.sans} />
          {renderFallback()}
        </div>
      );
    }



    // ── THREATFOX ──
    if (activeTab === 'threatfox') {
      const iocs = r.data || [];
      return (
        <div>
          <SectionHeader title="THREATFOX IOC INTEL" icon={AlertTriangle} color="#FF1744" />
          <ResultRow label="IOC" value={r.ioc || query} color="#FF1744" />
          <ResultRow label="Matches" value={iocs.length} color={iocs.length > 0 ? '#FF1744' : '#00E676'} />
          {iocs.length === 0 && <div className="mt-2 text-[10px] font-mono text-[#00E676]">No known IOC matches — target appears clean.</div>}
          {iocs.slice(0, 10).map((item: any, i: number) => (
            <div key={i} className="mt-1.5 p-2 rounded border border-[#FF1744]/25 bg-[#FF1744]/5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-mono font-bold text-[#FF1744]">{item.malware_printable || item.malware}</span>
                <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-[#FF1744]/20 text-[#FF1744]">{item.confidence_level}% conf</span>
              </div>
              <ResultRow label="Type" value={item.ioc_type} />
              <ResultRow label="Threat" value={item.threat_type} color="#FF9500" />
              <ResultRow label="First Seen" value={item.first_seen?.slice(0, 10)} />
              <ResultRow label="Tags" value={Array.isArray(item.tags) ? item.tags.join(', ') : item.tags} />
              {item.reference && <a href={item.reference} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-[9px] font-mono text-[#FF1744] hover:underline"><ExternalLink className="w-2.5 h-2.5" /> Reference</a>}
            </div>
          ))}
        </div>
      );
    }

    // ── URLHAUS ──
    if (activeTab === 'urlhaus') {
      const isMalicious = r.query_status === 'is_host' || r.threat || r.url_status === 'online';
      return (
        <div>
          <SectionHeader title="URLHAUS MALWARE CHECK" icon={Wifi} color="#FF6B00" />
          <ResultRow label="Target" value={r.url || r.host || query} color="#FF6B00" />
          <div className="my-2">
            <StatusBadge ok={!isMalicious} label={isMalicious ? `⚠ ${r.threat || 'MALICIOUS'}` : r.query_status === 'no_results' ? 'CLEAN / NOT FOUND' : 'CLEAN'} />
          </div>
          {r.url_status && <ResultRow label="URL Status" value={r.url_status} color={r.url_status === 'online' ? '#FF1744' : '#00E676'} />}
          {r.date_added && <ResultRow label="Reported" value={r.date_added?.slice(0, 10)} />}
          {r.tags?.length > 0 && <ResultRow label="Tags" value={r.tags.join(', ')} color="#FF9500" />}
          {r.payloads?.length > 0 && (
            <div className="mt-2 p-2 rounded border border-[#FF6B00]/25 bg-[#FF6B00]/5">
              <span className="text-[9px] font-mono text-[#FF6B00] block mb-1">PAYLOADS ({r.payloads.length})</span>
              {r.payloads.slice(0, 5).map((p: any, i: number) => (
                <div key={i} className="text-[9px] font-mono text-[var(--text-secondary)] py-0.5">{p.file_type} — {p.signature || 'Unknown'}</div>
              ))}
            </div>
          )}
          {r.blacklists && (
            <div className="mt-2 flex gap-2">
              <StatusBadge ok={r.blacklists.gsb !== 'listed'} label={`GSB: ${r.blacklists.gsb || 'clean'}`} />
              <StatusBadge ok={r.blacklists.surbl !== 'listed'} label={`SURBL: ${r.blacklists.surbl || 'clean'}`} />
            </div>
          )}
        </div>
      );
    }

    // ── C2 CHECK ──
    if (activeTab === 'c2check') {
      const isC2 = r.is_c2;
      return (
        <div>
          <SectionHeader title="BOTNET C2 CHECK" icon={Server} color="#FF3D3D" />
          <ResultRow label="IP" value={r.ip || query} color="#FF3D3D" />
          <div className="my-2">
            <StatusBadge ok={!isC2} label={isC2 ? '⚠ KNOWN C2 SERVER' : 'NOT IN C2 BLOCKLIST'} />
          </div>
          {r.feodo_entry && (
            <div className="mt-2 p-2 rounded border border-[#FF3D3D]/25 bg-[#FF3D3D]/5">
              <span className="text-[9px] font-mono text-[#FF3D3D] block mb-1">FEODO TRACKER HIT</span>
              <ResultRow label="Malware" value={r.feodo_entry.malware || 'Unknown'} color="#FF1744" />
              <ResultRow label="Port" value={r.feodo_entry.port} />
              <ResultRow label="Status" value={r.feodo_entry.status} color={r.feodo_entry.status === 'online' ? '#FF1744' : '#FFD700'} />
              <ResultRow label="Country" value={r.feodo_entry.country} />
              <ResultRow label="AS Name" value={r.feodo_entry.as_name} />
              <ResultRow label="First Seen" value={r.feodo_entry.first_seen_utc?.slice(0, 10)} />
            </div>
          )}
          {r.ssl_entry && (
            <div className="mt-2 p-2 rounded border border-[#FF9500]/25 bg-[#FF9500]/5">
              <span className="text-[9px] font-mono text-[#FF9500] block mb-1">SSL BLACKLIST HIT</span>
              <ResultRow label="Subject" value={r.ssl_entry.subject} color="#FF9500" />
            </div>
          )}
          <ResultRow label="Last Updated" value={r.last_updated} />
        </div>
      );
    }

    // ── SPYWARE DB ──
    if (activeTab === 'spycheck') {
      const matched = r.matched;
      return (
        <div>
          <SectionHeader title="SPYWARE INFRASTRUCTURE DB" icon={Bug} color="#E040FB" />
          <ResultRow label="Target" value={r.target || query} color="#E040FB" />
          <div className="my-2">
            <StatusBadge ok={!matched} label={matched ? `⚠ SPYWARE MATCH: ${r.spyware_name}` : 'NOT IN SPYWARE DB'} />
          </div>
          {matched && (
            <div className="mt-2 p-2 rounded border border-[#E040FB]/30 bg-[#E040FB]/10">
              <ResultRow label="Spyware" value={r.spyware_name} color="#E040FB" />
              <ResultRow label="Operator" value={r.operator} color="#FF9500" />
              <ResultRow label="Confidence" value={r.confidence} />
              <ResultRow label="Exposed By" value={r.source} />
              <ResultRow label="Notes" value={r.notes} mono={false} />
            </div>
          )}
          {!matched && r.confidence === 'low' && (
            <div className="mt-2 text-[9px] font-mono text-[var(--text-muted)]">Target not found in Citizen Lab / Amnesty Tech published indicators. This does not guarantee the target is clean.</div>
          )}
        </div>
      );
    }

    // ── DARK WEB ──
    if (activeTab === 'darkweb') {
      const results_list = r.results || [];
      const ransomware = r.ransomware_hits || [];
      return (
        <div>
          <SectionHeader title="DARK WEB INTELLIGENCE" icon={Skull} color="#9C27B0" />
          <ResultRow label="Query" value={r.query || query} color="#9C27B0" />
          <div className="my-1 p-2 rounded border border-amber-500/30 bg-amber-500/5 text-[9px] font-mono text-amber-300/80">
            ⚠ Results are aggregated from clearnet dark web indices. No Tor connection required or used.
          </div>
          {ransomware.length > 0 && (
            <>
              <SectionHeader title={`RANSOMWARE GROUP POSTS (${ransomware.length})`} icon={Skull} color="#FF1744" />
              {ransomware.slice(0, 5).map((h: any, i: number) => (
                <div key={i} className="mt-1 p-2 rounded border border-[#FF1744]/20 bg-[#FF1744]/5">
                  <div className="text-[9px] font-mono font-bold text-[#FF1744]">{h.group_name}</div>
                  <div className="text-[9px] font-mono text-[var(--text-primary)] mt-0.5">{h.post_title || h.victim}</div>
                  <div className="text-[8px] font-mono text-[var(--text-muted)]">{h.published?.slice(0, 10)}</div>
                </div>
              ))}
            </>
          )}
          {results_list.length > 0 && (
            <>
              <SectionHeader title={`SEARCH RESULTS (${results_list.length})`} icon={Globe} color="#9C27B0" />
              {results_list.slice(0, 8).map((r: any, i: number) => (
                <div key={i} className="mt-1 p-2 rounded border border-[#9C27B0]/20 bg-[#9C27B0]/5">
                  <div className="text-[9px] font-mono font-bold text-[#9C27B0] break-all">{r.title || r.link}</div>
                  {r.description && <div className="text-[8px] font-mono text-[var(--text-muted)] mt-0.5 line-clamp-2">{r.description}</div>}
                </div>
              ))}
            </>
          )}
          {results_list.length === 0 && ransomware.length === 0 && renderFallback()}
        </div>
      );
    }

    // ── GREYNOISE ──
    if (activeTab === 'greynoise') {
      const isNoise = r.noise;
      const isRiot = r.riot;
      const cls = r.classification;
      const clsColor = cls === 'malicious' ? '#FF3D3D' : cls === 'benign' ? '#00E676' : '#FF9500';
      return (
        <div>
          <SectionHeader title="GREYNOISE INTEL" icon={Radio} color="#FF9500" />
          <ResultRow label="IP" value={r.ip || query} color="#FF9500" />
          <div className="flex gap-2 my-2 flex-wrap">
            <StatusBadge ok={!isNoise} label={isNoise ? 'INTERNET NOISE' : 'NOT NOISY'} />
            <StatusBadge ok={!!isRiot} label={isRiot ? 'KNOWN BENIGN' : 'UNKNOWN SOURCE'} />
          </div>
          <ResultRow label="Classification" value={cls?.toUpperCase()} color={clsColor} />
          <ResultRow label="Name / Actor" value={r.name} />
          <ResultRow label="Last Seen" value={r.last_seen} />
          <ResultRow label="Message" value={r.message} />
          {r.link && <a href={r.link} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-1.5 text-[10px] font-mono text-[#FF9500] hover:underline"><ExternalLink className="w-3 h-3" /> View on GreyNoise</a>}
        </div>
      );
    }

    // ── URLSCAN ──
    if (activeTab === 'urlscan') {
      const list = r.results || [];
      return (
        <div>
          <SectionHeader title="URLSCAN RESULTS" icon={Globe} color="#448AFF" />
          <ResultRow label="Query" value={r.query || query} color="#448AFF" />
          <ResultRow label="Total Found" value={r.total || list.length} />
          {list.slice(0, 8).map((item: any, i: number) => (
            <div key={i} className="mt-1.5 p-2 rounded border border-[#448AFF]/20 bg-[#448AFF]/5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-mono font-bold text-[#448AFF] truncate flex-1">{item.page?.domain || item.task?.url}</span>
                <span className="text-[8px] font-mono text-[var(--text-muted)] ml-2 flex-shrink-0">{item.page?.country}</span>
              </div>
              <ResultRow label="URL" value={item.task?.url} />
              <ResultRow label="IP" value={item.page?.ip} />
              <ResultRow label="Server" value={item.page?.server} />
              <ResultRow label="Date" value={item.task?.time?.slice(0, 10)} />
              {item.screenshotURL && <a href={item.screenshotURL} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-[9px] font-mono text-[#448AFF] hover:underline"><ExternalLink className="w-2.5 h-2.5" /> Screenshot</a>}
            </div>
          ))}
          {list.length === 0 && renderFallback()}
        </div>
      );
    }

    // ── WAYBACK ──
    if (activeTab === 'wayback') {
      return (
        <div>
          <SectionHeader title="WAYBACK MACHINE" icon={Clock} color="#87CEEB" />
          <ResultRow label="URL" value={query} color="#87CEEB" />
          <div className="my-2"><StatusBadge ok={!!r.available} label={r.available ? 'ARCHIVED' : 'NOT FOUND'} /></div>
          {r.closest && (
            <div className="p-2 rounded border border-[#87CEEB]/20 bg-[#87CEEB]/5">
              <ResultRow label="Snapshot" value={r.closest.timestamp} color="#87CEEB" />
              <ResultRow label="Status" value={r.closest.status} color={r.closest.status === '200' ? '#00E676' : '#FF9500'} />
              {r.closest.url && <a href={r.closest.url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1 text-[9px] font-mono text-[#87CEEB] hover:underline"><ExternalLink className="w-2.5 h-2.5" /> View Snapshot</a>}
            </div>
          )}
          {r.snapshots?.length > 0 && (
            <>
              <SectionHeader title={`RECENT SNAPSHOTS (${r.snapshots.length})`} icon={Clock} color="#87CEEB" />
              <div className="space-y-px mt-1">
                {r.snapshots.slice(0, 8).map((s: any, i: number) => (
                  <div key={i} className="flex items-center justify-between py-0.5 px-1 rounded hover:bg-[var(--hover-accent)] text-[9px] font-mono">
                    <span className="text-[#87CEEB]">{s.timestamp?.slice(0, 12)}</span>
                    <span className={s.statuscode === '200' ? 'text-[#00E676]' : 'text-[#FF9500]'}>{s.statuscode}</span>
                    <span className="text-[var(--text-muted)]">{s.mimetype?.split('/')[1]}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      );
    }

    // ── TOR CHECK ──
    if (activeTab === 'tor') {
      const isTor = r.is_tor_exit;
      return (
        <div>
          <SectionHeader title="TOR EXIT NODE CHECK" icon={Shield} color="#9C27B0" />
          <ResultRow label="IP" value={r.ip || query} color="#9C27B0" />
          <div className="my-2"><StatusBadge ok={!isTor} label={isTor ? '⚠ TOR EXIT NODE' : 'NOT TOR'} /></div>
          {r.relay_details && (
            <div className="p-2 rounded border border-[#9C27B0]/20 bg-[#9C27B0]/5 mt-2">
              <ResultRow label="Nickname" value={r.relay_details.nickname} />
              <ResultRow label="Fingerprint" value={r.relay_details.fingerprint} />
              <ResultRow label="Country" value={r.relay_details.country} />
              <ResultRow label="Running" value={r.relay_details.running ? 'YES' : 'NO'} color={r.relay_details.running ? '#FF3D3D' : '#00E676'} />
              <ResultRow label="Bandwidth" value={r.relay_details.bandwidth ? `${r.relay_details.bandwidth} KB/s` : undefined} />
            </div>
          )}
          <ResultRow label="Last Updated" value={r.last_updated} />
        </div>
      );
    }

    // ── PASSIVE DNS ──
    if (activeTab === 'pdns') {
      const recs = r.records || [];
      return (
        <div>
          <SectionHeader title="PASSIVE DNS" icon={Server} color="#00BCD4" />
          <ResultRow label="Query" value={r.query || query} color="#00BCD4" />
          <ResultRow label="Records" value={recs.length} />
          <div className="mt-2 space-y-px max-h-[260px] overflow-y-auto styled-scrollbar">
            {recs.slice(0, 30).map((rec: any, i: number) => (
              <div key={i} className="flex items-start gap-2 py-1 border-b border-[var(--border-secondary)]/10 last:border-0">
                <span className="text-[8px] font-mono text-[#00BCD4] w-8 flex-shrink-0 pt-0.5">{rec.rrtype || rec.type}</span>
                <span className="text-[9px] font-mono text-[var(--text-primary)] flex-1 break-all">{rec.rdata || rec.rrvalue || rec.value}</span>
                {rec.count && <span className="text-[8px] font-mono text-[var(--text-muted)] flex-shrink-0">×{rec.count}</span>}
              </div>
            ))}
          </div>
          {recs.length === 0 && renderFallback()}
        </div>
      );
    }

    // ── REVERSE IP ──
    if (activeTab === 'reverseip') {
      const domains = r.domains || [];
      return (
        <div>
          <SectionHeader title="REVERSE IP LOOKUP" icon={MapPin} color="#FF3D3D" />
          <ResultRow label="IP" value={r.ip || query} color="#FF3D3D" />
          <ResultRow label="Domains Found" value={r.total || domains.length} color={domains.length > 0 ? '#FF9500' : '#00E676'} />
          <ResultRow label="Sources" value={Array.isArray(r.sources) ? r.sources.join(', ') : r.sources} />
          {domains.length > 0 && (
            <div className="mt-2 p-2 border border-[#FF3D3D]/20 bg-[#FF3D3D]/5 rounded max-h-[200px] overflow-y-auto styled-scrollbar">
              {domains.slice(0, 60).map((d: string, i: number) => (
                <div key={i} className="text-[9px] font-mono text-[var(--text-primary)] py-0.5 border-b border-[var(--border-secondary)]/10 last:border-0">{d}</div>
              ))}
              {domains.length > 60 && <div className="text-[8px] font-mono text-[var(--text-muted)] mt-1">+{domains.length - 60} more</div>}
            </div>
          )}
        </div>
      );
    }

    // ── ASN LOOKUP ──
    if (activeTab === 'asn') {
      return (
        <div>
          <SectionHeader title="ASN / BGP INTELLIGENCE" icon={Network} color="#D4AF37" />
          <ResultRow label="Resource" value={r.asn ? `AS${r.asn}` : r.resource || query} color="#D4AF37" />
          <ResultRow label="Name" value={r.name} />
          <ResultRow label="Description" value={r.description} />
          <ResultRow label="Country" value={r.country} />
          {r.prefixes && (
            <div className="mt-1.5 p-2 rounded border border-[#D4AF37]/20 bg-[#D4AF37]/5">
              <span className="text-[8px] font-mono text-[#D4AF37] block mb-1">IPv4 PREFIXES ({r.prefixes.ipv4_count || (r.prefixes.ipv4 || []).length})</span>
              {(r.prefixes.ipv4 || []).slice(0, 5).map((p: any, i: number) => (
                <div key={i} className="text-[9px] font-mono text-[var(--text-secondary)]">{p.prefix} — {p.name || ''}</div>
              ))}
            </div>
          )}
          {r.upstreams?.length > 0 && (
            <div className="mt-1.5 p-2 rounded border border-[#D4AF37]/20 bg-[#D4AF37]/5">
              <span className="text-[8px] font-mono text-[#D4AF37] block mb-1">UPSTREAM PROVIDERS</span>
              {r.upstreams.slice(0, 5).map((u: any, i: number) => (
                <div key={i} className="text-[9px] font-mono text-[var(--text-secondary)]">AS{u.asn} — {u.name}</div>
              ))}
            </div>
          )}
          {r.routing_stats && <ResultRow label="Route Visibility" value={r.routing_stats.visibility ? `${r.routing_stats.visibility}%` : undefined} />}
        </div>
      );
    }

    // ── OTX INTEL ──
    if (activeTab === 'otx') {
      if (r.code === 'NO_API_KEY') return (
        <div className="p-3 rounded border border-amber-500/30 bg-amber-500/10">
          <div className="text-[10px] font-mono text-amber-400 font-bold mb-1">OTX_API_KEY NOT CONFIGURED</div>
          <div className="text-[9px] font-mono text-amber-300/70">Set OTX_API_KEY in your .env file. Get a free key at otx.alienvault.com</div>
        </div>
      );
      return (
        <div>
          <SectionHeader title="ALIENVAULT OTX" icon={ShieldAlert} color="#FF6B00" />
          <ResultRow label="Indicator" value={r.indicator || query} color="#FF6B00" />
          <ResultRow label="Pulse Count" value={r.pulse_count} color={(r.pulse_count || 0) > 0 ? '#FF3D3D' : '#00E676'} />
          <ResultRow label="Reputation" value={r.reputation} color={(r.reputation || 0) < 0 ? '#FF3D3D' : '#00E676'} />
          <ResultRow label="Type" value={r.type} />
          {r.tags?.length > 0 && <ResultRow label="Tags" value={r.tags.join(', ')} color="#FF9500" />}
          {r.malware_families?.length > 0 && (
            <div className="mt-1.5 p-2 rounded border border-[#FF6B00]/30 bg-[#FF6B00]/10">
              <span className="text-[8px] font-mono text-[#FF6B00] block mb-1">MALWARE FAMILIES</span>
              {r.malware_families.slice(0, 5).map((f: string, i: number) => (
                <div key={i} className="text-[9px] font-mono text-[var(--text-primary)]">{f}</div>
              ))}
            </div>
          )}
          {renderFallbackExcluding(['indicator','pulse_count','reputation','type','tags','malware_families','code'])}
        </div>
      );
    }

    // ── VIRUSTOTAL ──
    if (activeTab === 'virustotal') {
      if (r.code === 'NO_API_KEY') return (
        <div className="p-3 rounded border border-amber-500/30 bg-amber-500/10">
          <div className="text-[10px] font-mono text-amber-400 font-bold mb-1">VIRUSTOTAL_API_KEY NOT CONFIGURED</div>
          <div className="text-[9px] font-mono text-amber-300/70">Set VIRUSTOTAL_API_KEY in your .env file. Free tier: 4 req/min at virustotal.com</div>
        </div>
      );
      const stats = r.last_analysis_stats || {};
      const malicious = stats.malicious || 0;
      const total = Object.values(stats).reduce((a: any, b: any) => a + (b as number), 0) as number;
      return (
        <div>
          <SectionHeader title="VIRUSTOTAL ANALYSIS" icon={Bug} color="#2196F3" />
          <ResultRow label="Resource" value={r.id || query} color="#2196F3" />
          <div className="my-2"><StatusBadge ok={malicious === 0} label={malicious > 0 ? `${malicious}/${total} MALICIOUS` : 'CLEAN'} /></div>
          <ResultRow label="Reputation" value={r.reputation} color={(r.reputation || 0) < 0 ? '#FF3D3D' : '#00E676'} />
          {r.categories && Object.keys(r.categories).length > 0 && <ResultRow label="Categories" value={Object.values(r.categories).join(', ')} />}
          {total > 0 && (
            <div className="mt-1.5 p-2 rounded border border-[#2196F3]/20 bg-[#2196F3]/5 text-[9px] font-mono">
              <div className="flex justify-between">
                <span className="text-red-400">Malicious: {stats.malicious || 0}</span>
                <span className="text-amber-400">Suspicious: {stats.suspicious || 0}</span>
                <span className="text-green-400">Clean: {stats.undetected || 0}</span>
              </div>
            </div>
          )}
          {renderFallbackExcluding(['id','reputation','categories','last_analysis_stats','code'])}
        </div>
      );
    }

    // Fallback for other tools
    return renderFallback();
  };

  const renderFallback = () => {
    if (!results) return null;
    return (
      <div className="space-y-1">
        {Object.entries(results).filter(([k]) => !['timestamp','cached'].includes(k)).map(([key, value]) => (
          <ResultRow key={key} label={key.replace(/_/g, ' ')} value={typeof value === 'object' ? JSON.stringify(value, null, 1) : String(value)} />
        ))}
      </div>
    );
  };

  const renderFallbackExcluding = (exclude: string[]) => {
    if (!results) return null;
    const extra = Object.entries(results).filter(([k]) => !exclude.includes(k));
    if (extra.length === 0) return null;
    return (
      <div className="mt-2 space-y-1">
        {extra.map(([key, value]) => (
          <ResultRow key={key} label={key.replace(/_/g, ' ')} value={typeof value === 'object' ? JSON.stringify(value, null, 1) : String(value)} />
        ))}
      </div>
    );
  };

  const renderContent = () => (
    <div className="flex flex-col gap-2.5">
      {/* Tool Grid */}
      <div className="flex flex-col gap-1">
        {/* Sweep - Main Action */}
        {TABS.filter(t => t.id === 'sweep').map(tab => (
          <button key={tab.id} onClick={() => { setActiveTab(tab.id); setQuery(''); setResults(null); setError(''); }}
            className={`flex items-center justify-center gap-2 px-3 py-3 rounded-lg text-[12px] font-mono tracking-widest font-bold transition-all border ${activeTab === tab.id ? 'border-opacity-60 bg-opacity-20' : 'border-[var(--border-secondary)] hover:bg-[var(--hover-accent)]'}`}
            style={{ 
              borderColor: activeTab === tab.id ? tab.color : 'rgba(255,61,61,0.3)', 
              backgroundColor: activeTab === tab.id ? `${tab.color}20` : 'rgba(255,61,61,0.05)', 
              color: activeTab === tab.id ? tab.color : tab.color,
              boxShadow: activeTab === tab.id ? `0 0 15px ${tab.color}30` : 'none'
            }}>
            <tab.icon className="w-5 h-5" />
            <span>GLOBAL {tab.label}</span>
          </button>
        ))}
        {/* Other Tools */}
        <div className="grid grid-cols-5 gap-1 mt-1">
          {TABS.filter(t => t.id !== 'sweep').map(tab => (
            <button key={tab.id} onClick={() => { setActiveTab(tab.id); setQuery(''); setResults(null); setError(''); }}
              className={`flex flex-col items-center gap-1 px-1 py-2 rounded-lg text-[8px] font-mono tracking-wider transition-all border ${activeTab === tab.id ? 'border-opacity-40 bg-opacity-15' : 'border-transparent hover:bg-[var(--hover-accent)]'}`}
              style={{ borderColor: activeTab === tab.id ? tab.color : 'transparent', backgroundColor: activeTab === tab.id ? `${tab.color}15` : undefined, color: activeTab === tab.id ? tab.color : 'var(--text-muted)' }}>
              <tab.icon className="w-3.5 h-3.5" />
              <span className="leading-none text-center truncate w-full">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Input Area */}
      <div className="flex flex-col gap-1.5">
        <div className="flex gap-1.5">
          <div className="flex-1 relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && runLookup()}
              placeholder={currentTab?.placeholder}
              className="w-full bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded-lg pl-8 pr-3 py-2.5 text-[11px] font-mono text-[var(--text-primary)] placeholder:text-[var(--text-muted)]/40 focus:outline-none transition-colors"
              style={{ borderColor: query ? `${currentTab?.color}40` : undefined }} />
          </div>
          <button onClick={runLookup} disabled={loading || !query.trim()}
            className="px-4 py-2 rounded-lg text-[10px] font-mono font-bold tracking-wider disabled:opacity-30 transition-all flex items-center justify-center min-w-[70px]"
            style={{ backgroundColor: `${currentTab?.color}20`, border: `1px solid ${currentTab?.color}40`, color: currentTab?.color }}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'SCAN'}
          </button>
        </div>
        
        {/* Secondary Controls */}
        {activeTab === 'scanner' && (
          <select value={scanType} onChange={e => setScanType(e.target.value)}
            className="bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded-lg px-2 py-1.5 text-[10px] font-mono text-[var(--text-muted)] outline-none w-full">
            <option value="quick">QUICK SCAN</option><option value="deep">DEEP SCAN</option><option value="ports">TOP 1000 PORTS</option>
          </select>
        )}
        {(activeTab === 'sweep' || activeTab === 'vuln') && (
          <div className="flex items-center justify-between bg-[var(--bg-primary)]/60 border border-[var(--border-primary)] rounded-lg p-1">
            <span className="text-[9px] font-mono text-[var(--text-muted)] pl-2">SUBNET MASK:</span>
            <div className="flex items-center gap-0.5">
              {[24, 25, 26, 27, 28].map(c => (
                <button key={c} onClick={() => setSweepCidr(c)}
                  className={`px-2 py-1 text-[10px] font-mono rounded transition-all ${
                    sweepCidr === c ? 'bg-[#FF3D3D]/20 text-[#FF3D3D]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]'
                  }`}
                >/{c}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-2.5 rounded-lg border border-red-500/30 bg-red-500/10 text-[11px] font-mono text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />{error}
        </div>
      )}

      {/* Sweep Progress */}
      {sweepProgress && loading && (
        <div className="p-3 rounded-lg border border-[#FF3D3D]/30 bg-[#FF3D3D]/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono tracking-wider text-[#FF3D3D]">SWEEPING SUBNET...</span>
            <span className="text-[10px] font-mono text-[#E8E6E0]">{sweepProgress.total} hosts</span>
          </div>
          <div className="w-full h-1.5 bg-[#1A1A18] rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: '100%', background: 'linear-gradient(90deg, #FF3D3D, #FF6B00, #FFD700)', animation: 'sweep-pulse 1.5s ease-in-out infinite' }} />
          </div>
        </div>
      )}

      {/* Sweep Results */}
      {sweepResult && !loading && (
        <div className="bg-[var(--bg-primary)]/40 border border-[var(--border-primary)] rounded-lg overflow-hidden max-h-[55vh] overflow-y-auto styled-scrollbar">
          {/* Summary */}
          <div className="p-3 border-b border-[#2A2A28]">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[11px] font-mono tracking-wider text-[#E8E6E0]">{sweepResult.subnet}</div>
                <div className="text-[9px] font-mono text-[#5C5A54]">{sweepResult.center.city}, {sweepResult.center.country} · {sweepResult.center.isp}</div>
              </div>
              <div className="text-right">
                <div className="text-[18px] font-mono font-bold text-[#FF3D3D]">{sweepResult.summary.total_responsive}</div>
                <div className="text-[8px] font-mono text-[#5C5A54] tracking-wider">DEVICES FOUND</div>
              </div>
            </div>
            {/* Breakdown Bar */}
            <div className="flex h-2 rounded-full overflow-hidden bg-[#1A1A18] mb-2">
              {Object.entries(sweepResult.summary.device_breakdown).map(([type, count]: [string, any]) => {
                const device = sweepResult.devices.find((d: any) => d.device_type === type);
                return <div key={type} style={{ width: `${(count / sweepResult.summary.total_responsive) * 100}%`, backgroundColor: device?.device_color || '#666' }} title={`${type}: ${count}`} />;
              })}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {Object.entries(sweepResult.summary.device_breakdown).map(([type, count]: [string, any]) => {
                const device = sweepResult.devices.find((d: any) => d.device_type === type);
                return (
                  <div key={type} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: device?.device_color || '#666' }} />
                    <span className="text-[9px] font-mono text-[#8A8880]">{type}</span>
                    <span className="text-[9px] font-mono text-[#E8E6E0] font-bold">{String(count)}</span>
                  </div>
                );
              })}
            </div>
          </div>
          {/* Visualize Button */}
          <div className="p-3 border-b border-[#2A2A28]">
            <button onClick={() => onSweepVisualize?.(sweepResult)}
              className="w-full py-2.5 rounded-lg font-mono text-[11px] tracking-wider font-bold transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, rgba(255,61,61,0.2), rgba(255,107,0,0.2))', border: '1px solid rgba(255,61,61,0.5)', color: '#FF3D3D', textShadow: '0 0 10px rgba(255,61,61,0.5)' }}
            >
              <Globe className="w-4 h-4" /> VISUALIZE ON GLOBE
            </button>
          </div>
          {/* Device List */}
          <div className={isFullScreen ? "flex flex-col gap-3 p-4" : "divide-y divide-[#2A2A28]"}>
            {sweepResult.devices.map((device: any) => {
              const isExpanded = expandedDevice === device.ip;
              return (
              <div key={device.ip} className={isFullScreen
                ? "bg-[#0D0D0C] border border-[#2A2A28] rounded-lg overflow-hidden hover:border-[#3A3A38] transition-colors"
                : "px-3 py-2.5 hover:bg-[rgba(255,255,255,0.02)] transition-colors"
              }>
                {/* Device Header */}
                <div
                  className={isFullScreen
                    ? "flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#151514] transition-colors"
                    : "flex items-center justify-between mb-1"
                  }
                  onClick={() => {
                    if (!isFullScreen) return;
                    const next = isExpanded ? null : device.ip;
                    setExpandedDevice(next);
                    if (next && device.vulns.length > 0) fetchCveDetails(device.vulns);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: device.device_color }} />
                    <span className={isFullScreen ? "text-[14px] font-mono font-bold text-[#E8E6E0]" : "text-[11px] font-mono text-[#E8E6E0]"}>{device.ip}</span>
                    {device.hostnames.length > 0 && (
                      <span className={`${isFullScreen ? "text-[11px]" : "text-[9px]"} font-mono text-[#5C5A54]`}>{device.hostnames[0]}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {device.vulns.length > 0 && (
                      <span className={`${isFullScreen ? "text-[10px]" : "text-[8px]"} font-mono px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/30`}>
                        {device.vulns.length} CVEs
                      </span>
                    )}
                    <span className={`${isFullScreen ? "text-[10px]" : "text-[8px]"} font-mono px-1.5 py-0.5 rounded`} style={{ backgroundColor: device.device_color + '20', color: device.device_color, border: `1px solid ${device.device_color}40` }}>{device.device_type}</span>
                    {isFullScreen && (
                      <ChevronDown className={`w-4 h-4 text-[#5C5A54] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    )}
                  </div>
                </div>

                {/* Compact info (sidebar mode) */}
                {!isFullScreen && (
                  <>
                    <div className="flex items-center gap-2 text-[9px] font-mono text-[#5C5A54]">
                      <span>Ports: {device.ports.slice(0, 8).join(', ')}{device.ports.length > 8 ? ` +${device.ports.length - 8}` : ''}</span>
                      {device.vulns.length > 0 && (
                        <div className="group relative flex items-center gap-1 cursor-help">
                          <span className="text-[#FF3D3D] flex items-center gap-1">
                            <AlertTriangle className="w-2.5 h-2.5" /> {device.vulns.length} CVEs
                          </span>
                          <div className="absolute bottom-full left-0 mb-1 hidden group-hover:block z-50 p-2 bg-[#1A1A18] border border-[#FF3D3D50] rounded-md shadow-xl min-w-[140px] max-w-[220px] max-h-[150px] overflow-y-auto styled-scrollbar">
                            <div className="text-[8px] font-mono text-[#FF3D3D] mb-1 tracking-wider uppercase border-b border-[#FF3D3D30] pb-1">Identified Vulnerabilities</div>
                            <div className="flex flex-col gap-0.5">
                              {device.vulns.map((cve: string) => (
                                <a key={cve} href={`https://nvd.nist.gov/vuln/detail/${cve}`} target="_blank" rel="noreferrer" className="text-[9px] font-mono text-[#E8E6E0] hover:text-[#FF3D3D] transition-colors truncate">
                                  {cve}
                                </a>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {device.hostnames.length > 0 && <div className="text-[9px] font-mono text-[#8A8880] mt-0.5 truncate">{device.hostnames[0]}</div>}
                  </>
                )}

                {/* Full-Screen Expanded Detail */}
                {isFullScreen && isExpanded && (
                  <div className="border-t border-[#2A2A28]">
                    {/* Ports + Hostnames Row */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#2A2A28]">
                      <div className="bg-[#0D0D0C] p-4">
                        <div className="text-[10px] font-mono text-[#5C5A54] tracking-widest uppercase mb-2">Open Ports</div>
                        <div className="flex flex-wrap gap-1.5">
                          {device.ports.map((port: number) => (
                            <span key={port} className="px-2 py-1 bg-[#1A1A18] border border-[#2A2A28] rounded text-[11px] font-mono text-[var(--cyan-primary)]">{port}</span>
                          ))}
                        </div>
                      </div>
                      <div className="bg-[#0D0D0C] p-4">
                        <div className="text-[10px] font-mono text-[#5C5A54] tracking-widest uppercase mb-2">Hostnames</div>
                        {device.hostnames.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {device.hostnames.map((h: string) => (
                              <span key={h} className="text-[11px] font-mono text-[#E8E6E0]">{h}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] font-mono text-[#3A3A38]">No reverse DNS</span>
                        )}
                      </div>
                    </div>

                    {/* CVE Intelligence */}
                    {device.vulns.length > 0 && (
                      <div className="p-4 border-t border-[#2A2A28]">
                        <div className="text-[10px] font-mono text-[#5C5A54] tracking-widest uppercase mb-3">Vulnerabilities ({device.vulns.length})</div>
                        <div className="flex flex-col gap-2">
                          {device.vulns.map((cveId: string) => {
                            const info = cveCache[cveId];
                            const isLoading = !info || info.loading;
                            const severityColor = !info?.severity ? '#5C5A54'
                              : info.severity === 'CRITICAL' ? '#FF3D3D'
                              : info.severity === 'HIGH' ? '#FF6B00'
                              : info.severity === 'MEDIUM' ? '#FFD700'
                              : '#76FF03';
                            return (
                              <div key={cveId} className="bg-[#111] border border-[#2A2A28] rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[12px] font-mono font-bold text-[#E8E6E0]">{cveId}</span>
                                    {info?.cvss != null && (
                                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: severityColor + '15', color: severityColor, border: `1px solid ${severityColor}40` }}>CVSS {info.cvss}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {info?.severity && (
                                      <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: severityColor + '15', color: severityColor, border: `1px solid ${severityColor}40` }}>{info.severity}</span>
                                    )}
                                    <a href={`https://nvd.nist.gov/vuln/detail/${cveId}`} target="_blank" rel="noreferrer" className="text-[#5C5A54] hover:text-[#E8E6E0] transition-colors">
                                      <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                  </div>
                                </div>
                                {isLoading ? (
                                  <div className="flex items-center gap-2 py-1">
                                    <Loader2 className="w-3 h-3 animate-spin text-[#5C5A54]" />
                                    <span className="text-[10px] font-mono text-[#5C5A54]">Fetching vulnerability intelligence...</span>
                                  </div>
                                ) : (
                                  <>
                                    <p className="text-[11px] font-mono text-[#8A8880] leading-relaxed">{info.description}</p>
                                    {info.cwe && <div className="text-[10px] font-mono text-[#5C5A54] mt-2">Weakness: {info.cwe}</div>}
                                    {info.affected && info.affected.length > 0 && (
                                      <div className="mt-2 flex flex-wrap gap-1.5">
                                        {info.affected.map((a: any, i: number) => (
                                          <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 bg-[#1A1A18] border border-[#2A2A28] rounded text-[#8A8880]">
                                            {a.vendor}/{a.product}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
            })}
          </div>
          <div className="px-3 py-2 border-t border-[#2A2A28]">
            <div className="text-[8px] font-mono text-[#5C5A54] tracking-wider">SWEPT {sweepResult.summary.total_hosts} HOSTS IN {(sweepResult.sweep_time_ms / 1000).toFixed(1)}s · ASN {sweepResult.center.asn}</div>
          </div>
        </div>
      )}

      {results && !(sweepResult && !loading) && (
        <div className="bg-[var(--bg-primary)]/40 border border-[var(--border-primary)] rounded-lg p-3 max-h-[50vh] overflow-y-auto styled-scrollbar">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-mono tracking-widest" style={{ color: currentTab?.color }}>{currentTab?.label} RESULTS</span>
            <span className="text-[8px] font-mono text-[var(--text-muted)] flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{new Date().toLocaleTimeString()}</span>
          </div>
          {renderStructuredResults()}
        </div>
      )}

      {history.length > 0 && !results && (
        <div className="space-y-1">
          <span className="text-[9px] font-mono tracking-widest text-[var(--text-muted)]">RECENT SCANS</span>
          {history.slice(0, 5).map((h, i) => (
            <button key={i} onClick={() => { setActiveTab(h.tab); setQuery(h.query); }}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-[var(--hover-accent)] transition-colors text-left">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono" style={{ color: TABS.find(t => t.id === h.tab)?.color }}>{TABS.find(t => t.id === h.tab)?.label}</span>
                <span className="text-[10px] font-mono text-[var(--text-secondary)]">{h.query}</span>
              </div>
              <span className="text-[8px] font-mono text-[var(--text-muted)]">{h.time}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (isMobile) return renderContent();

  if (isFullScreen) {
    return (
      <div className="fixed inset-4 z-[999] glass-panel bg-[#0a0a09]/95 backdrop-blur-2xl border border-[var(--cyan-primary)]/40 rounded-xl flex flex-col overflow-hidden shadow-2xl shadow-[var(--cyan-primary)]/20">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-secondary)] bg-[#111]">
          <div className="flex items-center gap-3">
            <Radar className="w-5 h-5 text-[var(--cyan-primary)]" />
            <span className="hud-text text-[16px] text-[var(--text-primary)]">OSIRIS RECON TOOLKIT</span>
            <span className="gotham-tag gotham-tag--info" style={{ fontSize: '9px' }}>FULL SCREEN</span>
            <span className="gotham-tag gotham-tag--classified" style={{ fontSize: '8px' }}>{TABS.length} MODULES</span>
          </div>
          <button onClick={() => setIsFullScreen(false)} className="p-2 hover:bg-white/5 rounded transition-colors text-[var(--text-muted)] hover:text-white">
            <Minimize2 className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 styled-scrollbar">
          {/* We wrap renderContent in a container that forces wider layouts if we want to target it with CSS */}
          <div className="max-w-[1400px] mx-auto w-full full-screen-mode-content">
             {renderContent()}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.6 }} className="glass-panel flex flex-col overflow-hidden pointer-events-auto shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-transparent hover:bg-[var(--hover-accent)] transition-colors">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 flex-1">
          <Radar className="w-3.5 h-3.5 text-[var(--cyan-primary)]" />
          <span className="hud-text text-[12px] text-[var(--text-primary)]">RECON TOOLKIT</span>
          <span className="gotham-tag gotham-tag--info" style={{ fontSize: '7px', padding: '1px 5px' }}>{TABS.length} TOOLS</span>
        </button>
        <div className="flex items-center gap-3">
          <button onClick={() => setIsFullScreen(true)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors" title="Full Screen">
             <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--cyan-primary)] animate-osiris-pulse" />
          <button onClick={() => setExpanded(!expanded)}>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden px-3 pb-3">
            {renderContent()}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

const OsintPanel = memo(OsintPanelInner);
export default OsintPanel;
