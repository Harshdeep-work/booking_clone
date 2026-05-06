'use client';
/**
 * StadiumMap — Core Mapbox GL JS 3D Map Component
 * - fill-extrusion layers for 3D sections
 * - feature-state: hover, selected, locked, sold
 * - Seat circle layer (WebGL, no JSX, Fix 4)
 * - Price markers as custom HTML overlays
 * - LOD: sections at zoom<17, seats at zoom≥17
 * - Tile-based section loading on moveend (Fix 7)
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useSocket } from '@/context/SocketContext';
import { useCart } from '@/context/CartContext';
import SectionTooltip from './SectionTooltip';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';
const METLIFE_CENTER: [number, number] = [-74.0742, 40.8135];
const DEFAULT_ZOOM = 14;
const SECTION_ZOOM = 16.5;
const SEAT_ZOOM = 17.5;

const CATEGORY_COLORS: Record<string, string> = {
  FIELD:    '#FF6B35',
  PLATINUM: '#A855F7',
  GOLD:     '#F59E0B',
  SILVER:   '#94A3B8',
  BRONZE:   '#D97706',
  GENERAL:  '#3B82F6',
};

interface SectionInfo {
  section_id: string;
  label: string;
  category: string;
  color: string;
  availableCount: number;
  price: number;
  badge?: string | null;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  section: SectionInfo | null;
}

export interface StadiumMapProps {
  layoutId: string;
  userId: string;
  onSectionClick?: (sectionId: string) => void;
}

export default function StadiumMap({ layoutId, userId, onSectionClick }: StadiumMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const hoveredSectionId = useRef<string | null>(null);
  const selectedSectionId = useRef<string | null>(null);

  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, section: null });
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
  const [mapReady, setMapReady] = useState(false);

  const { status, onSeatLocked, onSeatUnlocked, onSeatSold, onBulkSeatUpdate } = useSocket();
  const { isInCart, addSeat, removeSeat } = useCart();

  // Fetch sections GeoJSON from API
  const loadSectionLayer = useCallback(async () => {
    if (!map.current) return;
    try {
      const bounds = map.current.getBounds();
      if (!bounds) return;
      const bbox = `${bounds.getWest()},${bounds.getSouth()},${bounds.getEast()},${bounds.getNorth()}`;
      const res = await fetch(`/api/geojson/${layoutId}?bbox=${bbox}`);
      const geojson = await res.json();

      const source = map.current.getSource('sections') as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData(geojson);
      } else {
        map.current.addSource('sections', { type: 'geojson', data: geojson, generateId: true });
        addSectionLayers();
      }

      // Add price markers
      updatePriceMarkers(geojson.features || []);
    } catch (e) {
      console.warn('[Map] Failed to load sections, using fallback geometry');
      loadFallbackGeometry();
    }
  }, [layoutId]);

  // Fetch seat GeoJSON for a section
  const loadSeatLayer = useCallback(async (sectionId: string) => {
    if (!map.current) return;
    try {
      const res = await fetch(`/api/seats/geojson?section_id=${sectionId}`);
      const geojson = await res.json();

      const source = map.current.getSource('seats') as mapboxgl.GeoJSONSource;
      if (source) {
        source.setData(geojson);
      } else {
        map.current.addSource('seats', { type: 'geojson', data: geojson, generateId: true });
        addSeatLayer();
      }
    } catch (e) {
      console.warn('[Map] Failed to load seat layer');
    }
  }, []);

  function addSectionLayers() {
    if (!map.current) return;

    const cBronze = ['case', ['==', ['get', 'category'], 'BRONZE'], '#FB923C', '#60A5FA'];
    const cSilver = ['case', ['==', ['get', 'category'], 'SILVER'], '#CBD5E1', cBronze];
    const cGold = ['case', ['==', ['get', 'category'], 'GOLD'], '#FCD34D', cSilver];
    const cPlatinum = ['case', ['==', ['get', 'category'], 'PLATINUM'], '#C084FC', cGold];
    const hoveredColor = ['case', ['==', ['get', 'category'], 'FIELD'], '#FF8C5A', cPlatinum];
    const defaultColor = ['get', 'color'];
    const isSelected = ['boolean', ['feature-state', 'selected'], false];
    const isHovered = ['boolean', ['feature-state', 'hover'], false];
    const extrusionColor = ['case', isSelected, '#10B981', isHovered, hoveredColor, defaultColor];

    // 3D extruded section fill
    map.current.addLayer({
      id: 'sections-extrusion',
      type: 'fill-extrusion',
      source: 'sections',
      paint: {
        'fill-extrusion-color': extrusionColor as any,
        'fill-extrusion-height': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          ['*', ['get', 'height'], 1.6],
          ['boolean', ['feature-state', 'selected'], false],
          ['*', ['get', 'height'], 2],
          ['get', 'height'],
        ],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], 0.95,
          ['boolean', ['feature-state', 'hover'], false], 0.88,
          0.72,
        ],
      },
    });

    // Flat outline
    map.current.addLayer({
      id: 'sections-outline',
      type: 'line',
      source: 'sections',
      paint: {
        'line-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], '#10B981',
          ['boolean', ['feature-state', 'hover'], false], '#FFFFFF',
          'rgba(255,255,255,0.15)',
        ],
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], 2.5,
          ['boolean', ['feature-state', 'hover'], false], 1.5,
          0.7,
        ],
        'line-opacity': 0.8,
      },
    });

    // Hover interactions
    map.current.on('mousemove', 'sections-extrusion', (e) => {
      if (!e.features?.length || !map.current) return;
      map.current.getCanvas().style.cursor = 'pointer';
      const feature = e.features[0];
      const fid = feature.id as number;

      if (hoveredSectionId.current !== null && hoveredSectionId.current !== String(fid)) {
        map.current.setFeatureState(
          { source: 'sections', id: hoveredSectionId.current },
          { hover: false }
        );
      }
      hoveredSectionId.current = String(fid);
      map.current.setFeatureState({ source: 'sections', id: fid }, { hover: true });

      const props = feature.properties as any;
      setTooltip({
        visible: true,
        x: e.point.x,
        y: e.point.y,
        section: {
          section_id: props.section_id,
          label: props.label,
          category: props.category,
          color: props.color || CATEGORY_COLORS[props.category] || '#3B82F6',
          availableCount: props.availableCount,
          price: props.price || props.basePrice || 100,
          badge: props.badge,
        },
      });
    });

    map.current.on('mouseleave', 'sections-extrusion', () => {
      if (!map.current) return;
      map.current.getCanvas().style.cursor = '';
      if (hoveredSectionId.current !== null) {
        map.current.setFeatureState(
          { source: 'sections', id: hoveredSectionId.current },
          { hover: false }
        );
        hoveredSectionId.current = null;
      }
      setTooltip((t) => ({ ...t, visible: false }));
    });

    // Click → zoom into section
    map.current.on('click', 'sections-extrusion', (e) => {
      if (!e.features?.length || !map.current) return;
      const feature = e.features[0];
      const props = feature.properties as any;
      const fid = feature.id as number;
      const sectionId = props.section_id;

      // Deselect previous
      if (selectedSectionId.current && selectedSectionId.current !== String(fid)) {
        map.current.setFeatureState(
          { source: 'sections', id: selectedSectionId.current },
          { selected: false }
        );
      }
      selectedSectionId.current = String(fid);
      map.current.setFeatureState({ source: 'sections', id: fid }, { selected: true });

      // Fly to section center
      map.current.flyTo({
        center: [props.centerLng, props.centerLat],
        zoom: SEAT_ZOOM,
        pitch: 35,
        bearing: 0,
        duration: 1200,
        essential: true,
      });

      loadSeatLayer(sectionId);
      onSectionClick?.(sectionId);
    });
  }

  // Seat layer — WebGL circle, no JSX (Fix 4)
  function addSeatLayer() {
    if (!map.current) return;

    map.current.addLayer({
      id: 'seats-circles',
      type: 'circle',
      source: 'seats',
      minzoom: 17,
      paint: {
        'circle-radius': [
          'interpolate', ['linear'], ['zoom'],
          17, 3,
          18, 5,
          19, 7,
          20, 10,
        ],
        'circle-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], '#10B981',
          ['boolean', ['feature-state', 'locked'],   false], '#F97316',
          ['boolean', ['feature-state', 'sold'],     false], '#374151',
          '#22D3EE',  // available
        ],
        'circle-stroke-width': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], 2,
          1,
        ],
        'circle-stroke-color': [
          'case',
          ['boolean', ['feature-state', 'selected'], false], '#FFFFFF',
          'rgba(255,255,255,0.3)',
        ],
        'circle-opacity': [
          'case',
          ['boolean', ['feature-state', 'sold'], false], 0.3,
          0.9,
        ],
      },
    });

    // Seat hover cursor
    map.current.on('mouseenter', 'seats-circles', () => {
      if (map.current) map.current.getCanvas().style.cursor = 'pointer';
    });
    map.current.on('mouseleave', 'seats-circles', () => {
      if (map.current) map.current.getCanvas().style.cursor = '';
    });

    // Seat click → lock + cart
    map.current.on('click', 'seats-circles', async (e) => {
      if (!e.features?.length || !map.current) return;
      const feature = e.features[0];
      const props = feature.properties as any;
      const seatId = props.seat_id;

      if (props.status === 'SOLD') return; // Not clickable

      if (isInCart(seatId)) {
        // Deselect
        map.current.setFeatureState({ source: 'seats', id: feature.id! }, { selected: false });
        removeSeat(seatId);

        // Unlock via API
        await fetch('/api/unlock-seat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seat_id: seatId, user_id: userId }),
        });
      } else if (props.status !== 'LOCKED') {
        // Optimistic: set selected immediately
        map.current.setFeatureState({ source: 'seats', id: feature.id! }, { selected: true });

        const res = await fetch('/api/lock-seat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seat_id: seatId, user_id: userId }),
        });

        if (res.ok) {
          addSeat({
            seat_id: seatId,
            section_id: props.section_id || selectedSectionId.current || '',
            row: props.row,
            number: props.number,
            price: props.price,
            label: `Row ${props.row} - Seat ${props.number}`,
            category: props.category || 'GENERAL',
            color: '#22D3EE',
          });
        } else {
          // Rollback optimistic update
          map.current.setFeatureState({ source: 'seats', id: feature.id! }, { selected: false });
        }
      }
    });
  }

  function updatePriceMarkers(features: any[]) {
    if (!map.current) return;
    // Remove old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    features.forEach((feature: any) => {
      const props = feature.properties;
      if (!props.centerLng || !props.centerLat) return;
      if (props.availableCount === 0) return;

      const el = document.createElement('div');
      el.className = `price-marker ${props.badge === 'Amazing Deal' ? 'amazing' : props.badge === 'Great Value' ? 'great' : ''}`;
      el.innerHTML = `$${Math.round(props.price || props.basePrice || 100)}`;
      el.style.setProperty('--marker-color', props.color || '#3B82F6');

      const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([props.centerLng, props.centerLat])
        .addTo(map.current!);

      markersRef.current.push(marker);
    });
  }

  function loadFallbackGeometry() {
    // Inline minimal stadium geometry for when API is unavailable
    const fallback = {
      type: 'FeatureCollection',
      features: Array.from({ length: 8 }, (_, i) => {
        const angle1 = (i / 8) * 2 * Math.PI - Math.PI / 2;
        const angle2 = ((i + 1) / 8) * 2 * Math.PI - Math.PI / 2;
        const r1 = 0.005, r2 = 0.012;
        const coords = [[
          [METLIFE_CENTER[0] + r2 * Math.cos(angle1), METLIFE_CENTER[1] + r2 * Math.sin(angle1)],
          [METLIFE_CENTER[0] + r2 * Math.cos(angle2), METLIFE_CENTER[1] + r2 * Math.sin(angle2)],
          [METLIFE_CENTER[0] + r1 * Math.cos(angle2), METLIFE_CENTER[1] + r1 * Math.sin(angle2)],
          [METLIFE_CENTER[0] + r1 * Math.cos(angle1), METLIFE_CENTER[1] + r1 * Math.sin(angle1)],
          [METLIFE_CENTER[0] + r2 * Math.cos(angle1), METLIFE_CENTER[1] + r2 * Math.sin(angle1)],
        ]];
        const categories = ['FIELD','PLATINUM','GOLD','SILVER','BRONZE','GENERAL'];
        const cat = categories[i % categories.length];
        return {
          type: 'Feature', id: i,
          geometry: { type: 'Polygon', coordinates: coords },
          properties: {
            section_id: `S${i + 1}`,
            label: `Section ${i + 1}`,
            category: cat,
            color: CATEGORY_COLORS[cat],
            height: 20 - i * 2,
            availableCount: Math.floor(Math.random() * 50 + 10),
            centerLng: METLIFE_CENTER[0] + 0.007 * Math.cos((angle1 + angle2) / 2),
            centerLat: METLIFE_CENTER[1] + 0.007 * Math.sin((angle1 + angle2) / 2),
            basePrice: [800, 500, 350, 220, 150, 80][i % 6],
          },
        };
      }),
    };

    if (!map.current!.getSource('sections')) {
      map.current!.addSource('sections', { type: 'geojson', data: fallback as any, generateId: true });
      addSectionLayers();
    } else {
      (map.current!.getSource('sections') as mapboxgl.GeoJSONSource).setData(fallback as any);
    }
    updatePriceMarkers(fallback.features);
  }

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: METLIFE_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: 55,
      bearing: -20,
      antialias: true,
      attributionControl: false,
      logoPosition: 'bottom-left',
    });

    map.current.on('load', () => {
      setMapReady(true);
      loadSectionLayer();

      // Remove background layers for cleaner look
      ['water', 'waterway'].forEach((layer) => {
        if (map.current?.getLayer(layer)) {
          map.current.setPaintProperty(layer, 'fill-color', '#0A0E1A');
        }
      });
    });

    map.current.on('zoom', () => {
      setCurrentZoom(map.current?.getZoom() || DEFAULT_ZOOM);
    });

    // Tile-based reload on move (Fix 7)
    map.current.on('moveend', () => {
      if ((map.current?.getZoom() || 0) >= 15) {
        loadSectionLayer();
      }
    });

    return () => {
      markersRef.current.forEach((m) => m.remove());
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // WebSocket: update feature-state on seat events (Fix 4 — no React re-render)
  useEffect(() => {
    if (!mapReady) return;

    const unsubs = [
      onSeatLocked((e) => {
        const source = map.current?.getSource('seats');
        if (source) {
          map.current?.setFeatureState({ source: 'seats', id: e.seat_id }, { locked: true });
        }
      }),
      onSeatUnlocked((e) => {
        const source = map.current?.getSource('seats');
        if (source) {
          map.current?.setFeatureState({ source: 'seats', id: e.seat_id }, { locked: false });
        }
      }),
      onSeatSold((e) => {
        const source = map.current?.getSource('seats');
        if (source) {
          map.current?.setFeatureState({ source: 'seats', id: e.seat_id }, { sold: true });
        }
      }),
      onBulkSeatUpdate((e) => {
        const source = map.current?.getSource('seats');
        if (!source) return;
        e.seats.forEach((s) => {
          map.current?.setFeatureState(
            { source: 'seats', id: s.seat_id },
            { sold: s.status === 'SOLD', locked: s.status === 'LOCKED' }
          );
        });
      }),
    ];

    return () => unsubs.forEach((fn) => fn());
  }, [mapReady, onSeatLocked, onSeatUnlocked, onSeatSold, onBulkSeatUpdate]);

  // Map control helpers
  const zoomIn = () => map.current?.zoomIn({ duration: 400 });
  const zoomOut = () => map.current?.zoomOut({ duration: 400 });
  const resetView = () => {
    map.current?.flyTo({
      center: METLIFE_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: 55,
      bearing: -20,
      duration: 1200,
    });
    // Clear selection
    if (selectedSectionId.current) {
      map.current?.setFeatureState(
        { source: 'sections', id: selectedSectionId.current },
        { selected: false }
      );
      selectedSectionId.current = null;
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapContainer} id="stadium-map" />

      {/* Map controls */}
      <div className="map-controls">
        <button className="map-control-btn" onClick={zoomIn} title="Zoom in">+</button>
        <button className="map-control-btn" onClick={zoomOut} title="Zoom out">−</button>
        <button className="map-control-btn" onClick={resetView} title="Reset view" style={{ fontSize: 14 }}>⌂</button>
      </div>

      {/* Animated tooltip */}
      {tooltip.visible && tooltip.section && (
        <div
          className="map-tooltip"
          style={{ left: tooltip.x + 16, top: tooltip.y - 20, opacity: tooltip.visible ? 1 : 0 }}
        >
          <SectionTooltip section={tooltip.section} />
        </div>
      )}

      {/* Seat legend */}
      {currentZoom >= 17 && (
        <div className="legend animate-fade-in">
          <div className="legend-title">Seat Status</div>
          <div className="legend-items">
            {[
              { label: 'Available', color: '#22D3EE' },
              { label: 'Selected', color: '#10B981' },
              { label: 'Locked', color: '#F97316' },
              { label: 'Sold', color: '#374151' },
            ].map((item) => (
              <div key={item.label} className="legend-item">
                <div className="legend-dot" style={{ background: item.color }} />
                {item.label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category legend at overview */}
      {currentZoom < 17 && (
        <div className="legend animate-fade-in">
          <div className="legend-title">Categories</div>
          <div className="legend-items">
            {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
              <div key={cat} className="legend-item">
                <div className="legend-dot" style={{ background: color }} />
                {cat.charAt(0) + cat.slice(1).toLowerCase()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
