import React, { useState, useEffect } from 'react';

interface WebcamDevice {
  deviceId: string;
  label: string;
}

interface WebcamSelectorProps {
  selectedDeviceId: string | null;
  onDeviceSelect: (deviceId: string) => void;
  disabled?: boolean;
}

export const WebcamSelector: React.FC<WebcamSelectorProps> = ({
  selectedDeviceId,
  onDeviceSelect,
  disabled = false,
}) => {
  const [devices, setDevices] = useState<WebcamDevice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = deviceList
          .filter(device => device.kind === 'videoinput')
          .map(device => ({
            deviceId: device.deviceId,
            label: device.label || `Camera ${device.deviceId.slice(0, 8)}...`,
          }));
        setDevices(videoDevices);
      } catch (error) {
        console.error('Error enumerating devices:', error);
      } finally {
        setLoading(false);
      }
    };

    getDevices();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center space-x-2 text-gray-400">
        <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
        <span>Loading cameras...</span>
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="text-gray-400 text-sm">
        No cameras found
      </div>
    );
  }

  if (devices.length === 1) {
    return (
      <div className="text-gray-400 text-sm">
        Using: {devices[0].label}
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-2">
      <label htmlFor="webcam-select" className="text-sm text-gray-300">
        Select Camera:
      </label>
      <select
        id="webcam-select"
        value={selectedDeviceId || ''}
        onChange={(e) => onDeviceSelect(e.target.value)}
        disabled={disabled}
        className="bg-gray-700 border border-gray-600 text-gray-100 text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block w-full p-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">Default Camera</option>
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>
    </div>
  );
};