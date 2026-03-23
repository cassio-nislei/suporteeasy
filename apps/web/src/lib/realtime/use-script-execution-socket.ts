'use client';

import { useEffect } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getSocketBaseUrl, type ScriptExecutionStatusEvent } from '@/lib/api/operations';
import { getAccessToken } from '@/lib/auth/storage';

export function useScriptExecutionSocket(
  tenantId: string | null | undefined,
  onExecutionUpdate: (event: ScriptExecutionStatusEvent) => void
) {
  useEffect(() => {
    const accessToken = getAccessToken();

    if (!tenantId || !accessToken) {
      return;
    }

    let socket: Socket;

    try {
      socket = io(`${getSocketBaseUrl()}/ws/scripts`, {
        auth: {
          token: accessToken
        },
        transports: ['websocket']
      });
    } catch (error) {
      console.error('Failed to initialize script execution socket', error);
      return;
    }

    socket.on('connect', () => {
      socket.emit('subscribe', { tenantId, token: accessToken });
    });

    socket.on('connect_error', (error) => {
      console.warn('Script execution socket connection failed', error.message);
    });

    socket.on('script.execution.updated', (event: ScriptExecutionStatusEvent) => {
      onExecutionUpdate(event);
    });

    return () => {
      socket.disconnect();
    };
  }, [tenantId, onExecutionUpdate]);
}
