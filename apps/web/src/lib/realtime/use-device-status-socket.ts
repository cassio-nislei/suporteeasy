'use client';

import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getSocketBaseUrl, type DeviceStatusEvent } from '@/lib/api/operations';
import { getAccessToken } from '@/lib/auth/storage';

export function useDeviceStatusSocket(
  tenantId: string | null | undefined,
  onStatusUpdate: (event: DeviceStatusEvent) => void
) {
  useEffect(() => {
    const accessToken = getAccessToken();

    if (!tenantId || !accessToken) {
      return;
    }

    let socket: Socket;

    try {
      socket = io(`${getSocketBaseUrl()}/ws/devices`, {
        auth: {
          token: accessToken
        },
        transports: ['websocket']
      });
    } catch (error) {
      console.error('Failed to initialize device status socket', error);
      return;
    }

    socket.on('connect', () => {
      socket.emit('subscribe', { tenantId, token: accessToken });
    });

    socket.on('connect_error', (error) => {
      console.warn('Device status socket connection failed', error.message);
    });

    socket.on('device.status.updated', (event: DeviceStatusEvent) => {
      onStatusUpdate(event);
    });

    return () => {
      socket.disconnect();
    };
  }, [tenantId, onStatusUpdate]);
}
