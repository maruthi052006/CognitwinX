import React from 'react';
import { WMSTileLayer, TileLayer } from 'react-leaflet';

export default function BhuvanTileLayer({ 
  mode = 'bhuvan_satellite', // 'bhuvan_satellite', 'bhuvan_thematic', 'carto_dark'
  opacity = 0.85 
}) {
  if (mode === 'bhuvan_satellite') {
    return (
      <WMSTileLayer
        url="https://bhuvan-vec2.nrsc.gov.in/bhuvan/wms"
        layers="india3"
        format="image/png"
        transparent={false}
        attribution="&copy; <a href='https://bhuvan.nrsc.gov.in'>ISRO Bhuvan</a> | NRSC"
        opacity={opacity}
        maxZoom={19}
      />
    );
  }

  if (mode === 'bhuvan_thematic') {
    return (
      <WMSTileLayer
        url="https://bhuvan-thematic.nrsc.gov.in/bhuvan/wms"
        layers="LULC50K_1516"
        format="image/png"
        transparent={true}
        attribution="&copy; <a href='https://bhuvan-thematic.nrsc.gov.in'>ISRO Bhuvan Thematic</a> | Disaster Management Support"
        opacity={opacity}
        maxZoom={19}
      />
    );
  }

  // Fallback dark high-contrast basemap
  return (
    <TileLayer
      url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      attribution="&copy; <a href='https://carto.com/'>CARTO</a>"
      opacity={opacity}
    />
  );
}
