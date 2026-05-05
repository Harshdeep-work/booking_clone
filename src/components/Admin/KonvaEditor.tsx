'use client';
/**
 * KonvaEditor — 2D Precision Editor (Fix 5)
 * Separate from Mapbox 3D preview.
 * Handles: polygon draw, seat placement, drag/resize/rotate,
 * multi-select, seat ID assignment.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Konva from 'konva';
import { Stage, Layer, Line, Circle, Transformer, Text, Rect } from 'react-konva';
import type { Section, Seat, ValidationError } from '@/app/admin/page';
import type { Tool } from '@/app/admin/page';

const CANVAS_W = 1200;
const CANVAS_H = 800;
const GRID_SIZE = 20;
const STATUS_COLORS = { available: '#22D3EE', locked: '#F97316', sold: '#374151' };
const CATEGORY_COLORS: Record<string, string> = {
  FIELD:'#FF6B35', PLATINUM:'#A855F7', GOLD:'#F59E0B',
  SILVER:'#94A3B8', BRONZE:'#D97706', GENERAL:'#3B82F6',
};

interface KonvaEditorProps {
  activeTool: Tool;
  sections: Section[];
  seats: Seat[];
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  onAddSection: (section: Section) => void;
  onAddSeat: (seat: Seat) => void;
  onUpdateSeat: (id: string, updates: Partial<Seat>) => void;
  validationErrors: ValidationError[];
}

export default function KonvaEditor({
  activeTool, sections, seats, selectedId,
  onSelectId, onAddSection, onAddSeat, onUpdateSeat, validationErrors,
}: KonvaEditorProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const [polygonPoints, setPolygonPoints] = useState<number[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [stageScale, setStageScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const seatCounter = useRef(0);
  const sectionCounter = useRef(0);

  // Attach transformer to selected node
  useEffect(() => {
    if (!transformerRef.current || !stageRef.current) return;
    const node = stageRef.current.findOne(`#${selectedId}`);
    if (node && activeTool === 'select') {
      transformerRef.current.nodes([node]);
      transformerRef.current.getLayer()?.batchDraw();
    } else {
      transformerRef.current.nodes([]);
    }
  }, [selectedId, activeTool]);

  // Snap to grid
  const snap = (v: number) => Math.round(v / GRID_SIZE) * GRID_SIZE;

  const getRelativePos = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return { x: 0, y: 0 };
    const pos = stage.getPointerPosition();
    if (!pos) return { x: 0, y: 0 };
    return {
      x: snap((pos.x - stagePos.x) / stageScale),
      y: snap((pos.y - stagePos.y) / stageScale),
    };
  }, [stagePos, stageScale]);

  const handleStageMouseMove = useCallback(() => {
    setMousePos(getRelativePos());
  }, [getRelativePos]);

  const handleStageClick = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    const pos = getRelativePos();

    // Click on empty area → deselect
    if (e.target === e.target.getStage()) {
      onSelectId(null);
    }

    if (activeTool === 'section') {
      // Double-click to finalize polygon
      if (e.evt.detail === 2 && polygonPoints.length >= 6) {
        const section: Section = {
          id: `sec_${++sectionCounter.current}`,
          section_id: `S${sectionCounter.current}`,
          label: `Section ${sectionCounter.current}`,
          category: 'GENERAL',
          color: CATEGORY_COLORS.GENERAL,
          points: polygonPoints,
        };
        onAddSection(section);
        setPolygonPoints([]);
        return;
      }
      setPolygonPoints((prev) => [...prev, pos.x, pos.y]);
    }

    if (activeTool === 'seat') {
      const count = ++seatCounter.current;
      const seat: Seat = {
        id: `seat_${count}`,
        seat_id: `S1-R1-${count}`,
        sectionId: sections[sections.length - 1]?.id || '',
        row: 'A',
        number: count,
        x: pos.x,
        y: pos.y,
        price: 100,
        status: 'available',
        category: 'GENERAL',
      };
      onAddSeat(seat);
    }
  }, [activeTool, polygonPoints, getRelativePos, sections, onAddSection, onAddSeat, onSelectId]);

  const handleWheel = useCallback((e: Konva.KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const oldScale = stageScale;
    const pointer = stage.getPointerPosition()!;
    const scaleChange = e.evt.deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(Math.max(oldScale * scaleChange, 0.3), 5);

    const mousePointTo = {
      x: (pointer.x - stagePos.x) / oldScale,
      y: (pointer.y - stagePos.y) / oldScale,
    };

    setStageScale(newScale);
    setStagePos({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  }, [stageScale, stagePos]);

  const errSeatIds = new Set(validationErrors.map((e) => e.seatId).filter(Boolean));

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* Seat tool hint */}
      {activeTool === 'seat' && (
        <div style={{
          position: 'absolute', top: 56, left: 12, zIndex: 10,
          padding: '6px 12px', borderRadius: 'var(--radius-sm)',
          background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)',
          fontSize: 12, color: 'var(--accent)',
        }}>
          🪑 Click canvas to place a seat
        </div>
      )}
      {activeTool === 'section' && (
        <div style={{
          position: 'absolute', top: 56, left: 12, zIndex: 10,
          padding: '6px 12px', borderRadius: 'var(--radius-sm)',
          background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.3)',
          fontSize: 12, color: '#A855F7',
        }}>
          ⬡ Click to add polygon points · Double-click to finish section
        </div>
      )}

      <Stage
        ref={stageRef}
        width={window.innerWidth - 336}
        height={window.innerHeight - 60}
        scaleX={stageScale}
        scaleY={stageScale}
        x={stagePos.x}
        y={stagePos.y}
        draggable={activeTool === 'pan' || activeTool === 'select'}
        onDragEnd={(e) => setStagePos({ x: e.target.x(), y: e.target.y() })}
        onMouseMove={handleStageMouseMove}
        onClick={handleStageClick}
        onWheel={handleWheel}
        style={{ cursor: activeTool === 'pan' ? 'grab' : activeTool === 'seat' ? 'crosshair' : 'default' }}
      >
        {/* Grid Layer */}
        <Layer listening={false}>
          {Array.from({ length: Math.ceil(CANVAS_W / GRID_SIZE) }, (_, i) => (
            <Line key={`vg${i}`} points={[i * GRID_SIZE, 0, i * GRID_SIZE, CANVAS_H]}
              stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          ))}
          {Array.from({ length: Math.ceil(CANVAS_H / GRID_SIZE) }, (_, i) => (
            <Line key={`hg${i}`} points={[0, i * GRID_SIZE, CANVAS_W, i * GRID_SIZE]}
              stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
          ))}
        </Layer>

        {/* Sections Layer */}
        <Layer>
          {sections.map((sec) => (
            <React.Fragment key={sec.id}>
              <Line
                id={sec.id}
                points={sec.points}
                closed
                fill={`${sec.color}33`}
                stroke={selectedId === sec.id ? '#FFFFFF' : sec.color}
                strokeWidth={selectedId === sec.id ? 2.5 : 1.5}
                opacity={0.85}
                draggable={activeTool === 'select'}
                onClick={() => onSelectId(sec.id)}
              />
              {/* Section label at centroid */}
              {sec.points.length >= 4 && (
                <Text
                  x={sec.points.reduce((a, v, i) => i % 2 === 0 ? a + v : a, 0) / (sec.points.length / 2) - 20}
                  y={sec.points.reduce((a, v, i) => i % 2 !== 0 ? a + v : a, 0) / (sec.points.length / 2) - 8}
                  text={sec.label}
                  fontSize={11}
                  fill={sec.color}
                  fontStyle="bold"
                  listening={false}
                />
              )}
            </React.Fragment>
          ))}

          {/* In-progress polygon */}
          {polygonPoints.length >= 2 && (
            <Line
              points={[...polygonPoints, ...(mousePos ? [mousePos.x, mousePos.y] : [])]}
              stroke="rgba(168,85,247,0.8)"
              strokeWidth={2}
              dash={[6, 4]}
            />
          )}
          {polygonPoints.length >= 2 && polygonPoints.reduce((pts, p, i) =>
            i % 2 === 0 ? [...pts, { x: p, y: polygonPoints[i + 1] }] : pts, [] as {x:number,y:number}[]).map((pt, i) => (
            <Circle key={i} x={pt.x} y={pt.y} radius={4} fill="#A855F7" />
          ))}
        </Layer>

        {/* Seats Layer */}
        <Layer>
          {seats.map((seat) => {
            const isSelected = selectedId === seat.id;
            const hasError = errSeatIds.has(seat.seat_id);
            return (
              <React.Fragment key={seat.id}>
                <Circle
                  id={seat.id}
                  x={seat.x}
                  y={seat.y}
                  radius={isSelected ? 9 : 7}
                  fill={hasError ? '#EF4444' : STATUS_COLORS[seat.status]}
                  stroke={isSelected ? '#FFFFFF' : hasError ? '#FCA5A5' : 'rgba(255,255,255,0.3)'}
                  strokeWidth={isSelected ? 2 : 1}
                  draggable={activeTool === 'select'}
                  onClick={() => onSelectId(seat.id)}
                  onDragEnd={(e) => {
                    onUpdateSeat(seat.id, {
                      x: snap(e.target.x()),
                      y: snap(e.target.y()),
                    });
                  }}
                />
                {isSelected && (
                  <Text
                    x={seat.x + 10}
                    y={seat.y - 14}
                    text={seat.seat_id}
                    fontSize={9}
                    fill="#FFFFFF"
                    listening={false}
                  />
                )}
              </React.Fragment>
            );
          })}

          {/* Transformer for selected */}
          <Transformer ref={transformerRef} enabledAnchors={['middle-left','middle-right','top-center','bottom-center']} />
        </Layer>
      </Stage>

      {/* Mouse coordinates debug */}
      {mousePos && activeTool !== 'select' && (
        <div style={{
          position: 'absolute', bottom: 12, left: 12, fontSize: 10,
          color: 'var(--text-muted)', pointerEvents: 'none',
        }}>
          x:{mousePos.x} y:{mousePos.y}
        </div>
      )}
    </div>
  );
}
