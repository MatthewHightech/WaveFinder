"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, { Marker } from "react-map-gl";
import type { MapRef, ViewState } from "react-map-gl";
import Supercluster from "supercluster";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

export type Pin = {
  id: string;
  lat: number;
  lon: number;
  score: number;
};

type WaveMapProps = {
  pins: Pin[];
  onBoundsChange?: (bounds: {
    west: number;
    south: number;
    east: number;
    north: number;
  }) => void;
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  children?: React.ReactNode;
};

type ClusterProps = {
  cluster: boolean;
  point_count: number;
  max_score: number;
};

export function WaveMap({
  pins,
  onBoundsChange,
  initialViewState = { longitude: -122.4, latitude: 37.8, zoom: 8 },
  children,
}: WaveMapProps) {
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState<ViewState>({
    ...initialViewState,
    bearing: 0,
    pitch: 0,
    padding: { top: 0, bottom: 0, left: 0, right: 0 },
  });
  const [zoom, setZoom] = useState(initialViewState.zoom);

  const emitBounds = useCallback(() => {
    const map = mapRef.current?.getMap();
    if (!map || !onBoundsChange) return;
    const b = map.getBounds();
    if (!b) return;
    onBoundsChange({
      west: b.getWest(),
      south: b.getSouth(),
      east: b.getEast(),
      north: b.getNorth(),
    });
  }, [onBoundsChange]);

  useEffect(() => {
    emitBounds();
  }, [emitBounds]);

  const points = useMemo(
    () =>
      pins.map((p) => ({
        type: "Feature" as const,
        properties: {
          id: p.id,
          score: p.score,
          cluster: false,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [p.lon, p.lat],
        },
      })),
    [pins],
  );

  const index = useMemo(() => {
    const sc = new Supercluster<{ id: string; score: number }, ClusterProps>({
      radius: 60,
      maxZoom: 14,
    });
    sc.load(points);
    return sc;
  }, [points]);

  const bounds = mapRef.current?.getMap()?.getBounds();
  const clusters =
    bounds && zoom < 12
      ? index.getClusters(
          [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
          Math.floor(zoom),
        )
      : points;

  if (!MAPBOX_TOKEN) {
    return (
      <div className="flex h-[70vh] items-center justify-center rounded-lg border border-amber-800/50 bg-slate-900 p-8 text-center text-amber-200">
        Set <code className="text-teal-400">NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN</code> in{" "}
        <code className="text-teal-400">apps/web/.env.local</code>
      </div>
    );
  }

  return (
    <div className="relative h-[calc(100vh-56px)] w-full">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        {...viewState}
        onMove={(evt) => {
          setViewState(evt.viewState);
          setZoom(evt.viewState.zoom);
        }}
        onMoveEnd={emitBounds}
        style={{ width: "100%", height: "100%" }}
        attributionControl
      >
        {zoom >= 12
          ? pins.map((p) => (
              <Marker key={p.id} longitude={p.lon} latitude={p.lat} anchor="center">
                <div
                  className="rounded-full border-2 border-white bg-teal-500 px-1.5 py-0.5 text-[10px] font-bold text-slate-900 shadow-lg"
                  title={`Score: ${p.score.toFixed(3)}`}
                >
                  {(p.score * 100).toFixed(0)}
                </div>
              </Marker>
            ))
          : clusters.map((feat, i) => {
              const [lon, lat] = feat.geometry.coordinates;
              const isCluster = "cluster" in feat.properties && feat.properties.cluster;
              if (isCluster) {
                const props = feat.properties as ClusterProps & { cluster_id: number };
                return (
                  <Marker key={`c-${props.cluster_id ?? i}`} longitude={lon} latitude={lat}>
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-600/90 text-xs font-bold text-white ring-2 ring-white">
                      {props.point_count}
                    </div>
                  </Marker>
                );
              }
              const score = (feat.properties as { score: number }).score;
              return (
                <Marker key={(feat.properties as { id: string }).id} longitude={lon} latitude={lat}>
                  <div className="h-3 w-3 rounded-full bg-teal-400 ring-2 ring-white" title={`${score}`} />
                </Marker>
              );
            })}
        {children}
      </Map>
    </div>
  );
}
