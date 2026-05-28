'use client';
import React, { useEffect, useState } from 'react';

interface LayoutVersion {
  id: string;
  version: number;
  name: string;
  isActive: boolean;
  createdAt: string;
}

const MOCK_VERSIONS: LayoutVersion[] = [
  { id: '1', version: 3, name: 'MetLife v3 — Final', isActive: true, createdAt: new Date().toISOString() },
  { id: '2', version: 2, name: 'MetLife v2 — Added upper deck', isActive: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: '3', version: 1, name: 'MetLife v1 — Initial', isActive: false, createdAt: new Date(Date.now() - 86400000).toISOString() },
];

export default function VersionHistory({ onClose }: { onClose: () => void }) {
  const [versions, setVersions] = useState<LayoutVersion[]>(MOCK_VERSIONS);
  const [loading, setLoading] = useState(false);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  useEffect(() => {
    // If we had a real API, we would fetch here.
    // Since it's mock, we've initialized it in state.
  }, []);

  const handleRollback = async (layoutId: string, version: number) => {
    setRollingBack(layoutId);
    try {
      await fetch(`/api/layout/${layoutId}/rollback/${version}`, { method: 'POST' });
      setVersions((prev) => prev.map((v) => ({ ...v, isActive: v.id === layoutId })));
    } finally {
      setRollingBack(null);
    }
  };

  return (
    <div>
      <div className="property-group" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>🕐 Version History</div>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>✕</button>
      </div>

      <div style={{ padding: '0 12px 12px' }}>
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: 20, textAlign: 'center' }}>
            Loading versions...
          </div>
        ) : (
          versions.map((version) => (
            <div key={version.id} className={`version-item ${version.isActive ? 'active' : ''}`}>
              <div>
                <div className="version-number">
                  {version.isActive && (
                    <span style={{
                      fontSize: 9, fontWeight: 800, background: 'var(--accent)',
                      color: '#fff', padding: '1px 5px', borderRadius: 99, marginRight: 6,
                    }}>ACTIVE</span>
                  )}
                  v{version.version} — {version.name}
                </div>
                <div className="version-date">
                  {new Date(version.createdAt).toLocaleString()}
                </div>
              </div>
              {!version.isActive && (
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 11, padding: '4px 10px' }}
                  disabled={rollingBack === version.id}
                  onClick={() => handleRollback(version.id, version.version)}
                >
                  {rollingBack === version.id ? '⟳' : 'Restore'}
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
