import { Battery, BatteryLow, Zap, Wifi, Bluetooth, Signal } from 'lucide-react';
import { GPSLocation } from '@/types/gps';

interface DeviceCardProps {
  location: GPSLocation;
  isOnline: boolean;
}

function getBatteryColor(pct: number): string {
  if (pct > 50) return 'text-green-500';
  if (pct > 20) return 'text-yellow-500';
  return 'text-red-500';
}

function getBatteryBarColor(pct: number): string {
  if (pct > 50) return 'bg-green-500';
  if (pct > 20) return 'bg-yellow-500';
  return 'bg-red-500';
}

function getNetworkBadge(src: string): { label: string; icon: React.ReactNode; color: string } {
  switch (src) {
    case 'GPS':  return { label: 'WiFi', icon: <Wifi      className="w-3 h-3" />, color: 'text-blue-400' };
    case 'PEER': return { label: 'BLE',  icon: <Bluetooth className="w-3 h-3" />, color: 'text-purple-400' };
    default:     return { label: 'GSM',  icon: <Signal    className="w-3 h-3" />, color: 'text-orange-400' };
  }
}

export const DeviceCard = ({ location, isOnline }: DeviceCardProps) => {
  const battery = location.battery ?? 0;
  const impact  = location.impact  ?? false;
  const net     = getNetworkBadge(location.locationSource || 'GPS');

  return (
    <div className={`
      relative rounded-xl border p-4 space-y-3 transition-all duration-300
      ${isOnline  ? 'border-gray-700 bg-gray-900'  : 'border-gray-800 bg-gray-950 opacity-50'}
      ${impact    ? 'border-red-500 ring-2 ring-red-500 animate-pulse' : ''}
    `}>

      {/* Impact Banner */}
      {impact && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap
                        bg-red-600 text-white text-xs font-bold px-3 py-1
                        rounded-full flex items-center gap-1 z-10 shadow-lg">
          <Zap className="w-3 h-3" />
          IMPACT DETECTED
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-2 h-2 rounded-full flex-shrink-0
            ${isOnline ? 'bg-green-500 animate-pulse' : 'bg-gray-600'}`}
          />
          <span className="text-sm font-semibold text-white truncate">
            {location.device_id}
          </span>
        </div>
        {/* Network badge */}
        <div className={`flex items-center gap-1 text-xs bg-gray-800
                         px-2 py-0.5 rounded-full flex-shrink-0 ${net.color}`}>
          {net.icon}
          {net.label}
        </div>
      </div>

      {/* Battery */}
      <div className="space-y-1">
        <div className={`flex items-center justify-between text-xs font-medium ${getBatteryColor(battery)}`}>
          <div className="flex items-center gap-1">
            {battery <= 20
              ? <BatteryLow className="w-4 h-4" />
              : <Battery    className="w-4 h-4" />
            }
            <span>{battery}%</span>
            {battery <= 20 && (
              <span className="text-red-400 font-bold uppercase tracking-wide ml-1">
                Low
              </span>
            )}
          </div>
          <span className="text-gray-500">Battery</span>
        </div>
        {/* Bar */}
        <div className="w-full bg-gray-800 rounded-full h-1.5 overflow-hidden">
          <div
            className={`h-1.5 rounded-full transition-all duration-700 ${getBatteryBarColor(battery)}`}
            style={{ width: `${battery}%` }}
          />
        </div>
      </div>

      {/* Coordinates */}
      <div className="text-xs text-gray-500 space-y-0.5 font-mono">
        <div className="flex justify-between">
          <span className="text-gray-600">Lat</span>
          <span>{location.latitude?.toFixed(5) ?? '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600">Lon</span>
          <span>{location.longitude?.toFixed(5) ?? '—'}</span>
        </div>
        <div className="flex justify-between pt-1 border-t border-gray-800">
          <span className="text-gray-600">Updated</span>
          <span>{location.timestamp ? new Date(location.timestamp).toLocaleTimeString() : '—'}</span>
        </div>
      </div>
    </div>
  );
};
