import L from "leaflet";

const baseIconOptions = {
  iconSize: [32, 32] as L.PointExpression,
  iconAnchor: [16, 32] as L.PointExpression,
  popupAnchor: [0, -32] as L.PointExpression,
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  shadowSize: [41, 41] as L.PointExpression,
};

const createDisasterIcon = (bgColor: string, svgPath: string) => {
  return L.divIcon({
    html: `<div style="background-color: ${bgColor}; width: 32px; height: 32px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center;">
      ${svgPath}
    </div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  });
};

const buildingSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
</svg>`;

export const evacuationSiteAvailable = createDisasterIcon("#22c55e", buildingSvg);
export const evacuationSiteFull = createDisasterIcon("#ef4444", buildingSvg);

export const disasterIcons = {
  fire: createDisasterIcon(
    "#ef4444",
    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>
    </svg>`
  ),
  accident: createDisasterIcon(
    "#f97316",
    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8c-.2.4-.1.9.2 1.2l.9.9c.3.3.8.4 1.2.2L5 12"/>
      <path d="M7 17h10"/>
      <circle cx="8" cy="17" r="2"/>
      <circle cx="16" cy="17" r="2"/>
    </svg>`
  ),
  flood: createDisasterIcon(
    "#3b82f6",
    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
      <path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
    </svg>`
  ),
  hazard: createDisasterIcon(
    "#eab308",
    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2L2 7l10 5 10-5-10-5z"/>
      <path d="M12 12v8"/>
      <path d="M9 17l3-2 3 2"/>
    </svg>`
  ),
  resolved: createDisasterIcon(
    "#22c55e",
    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>`
  ),
  default: createDisasterIcon(
    "#6b7280",
    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
      <circle cx="12" cy="12" r="10"/>
    </svg>`
  ),
};

export const incidentIcons = disasterIcons;