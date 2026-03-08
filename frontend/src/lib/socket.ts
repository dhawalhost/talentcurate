import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

export const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/collab';

// A singleton-like manager for the Yjs Document and WebSocket connection per session
export class CollabService {
    public doc: Y.Doc;
    public provider: WebsocketProvider;

    constructor(sessionId: string, _token: string = 'guest') {
        this.doc = new Y.Doc();

        // Connect to our Golang WebSocket Hub
        // Using y-websocket, but customizing it if needed since our backend mixes CRDT Binary and JSON Text frames
        this.provider = new WebsocketProvider(
            WS_BASE_URL,
            sessionId,
            this.doc,
            { connect: true }
        );

        // Listen for custom executions broadcasts from the backend 
        // We hook into the raw websocket to intercept our custom JSON messages
        const handleWsMessage = (event: MessageEvent) => {
            if (event.data instanceof ArrayBuffer || event.data instanceof Blob) {
                const reader = new FileReader();
                reader.onload = () => {
                    const text = reader.result as string;
                    if (text.startsWith('{')) {
                        try {
                            const parsed = JSON.parse(text);
                            if (parsed.type === 'EXEC_COMPLETED') {
                                window.dispatchEvent(new CustomEvent('EXEC_COMPLETED', { detail: parsed.payload }));
                            }
                        } catch (e) { /* ignore */ }
                    }
                };

                if (event.data instanceof Blob) {
                    reader.readAsText(event.data);
                } else {
                    const text = new TextDecoder().decode(event.data);
                    if (text.startsWith('{')) {
                        try {
                            const parsed = JSON.parse(text);
                            if (parsed.type === 'EXEC_COMPLETED') {
                                window.dispatchEvent(new CustomEvent('EXEC_COMPLETED', { detail: parsed.payload }));
                            }
                        } catch (e) { /* ignore */ }
                    }
                }
            }
        };

        const setupWsListener = () => {
            if (this.provider.ws) {
                // Ensure we don't duplicate listeners on reconnect
                this.provider.ws.removeEventListener('message', handleWsMessage);
                this.provider.ws.addEventListener('message', handleWsMessage);
            }
        };

        this.provider.on('status', (event: any) => {
            if (event.status === 'connected') {
                setupWsListener();
            }
        });
    }

    public destroy() {
        this.provider.destroy();
        this.doc.destroy();
    }
}
