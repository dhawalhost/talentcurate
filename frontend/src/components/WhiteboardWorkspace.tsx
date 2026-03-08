import { useEffect, useState } from 'react';
import { Tldraw, createTLStore, defaultShapeUtils } from 'tldraw';
import 'tldraw/tldraw.css';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

interface WhiteboardWorkspaceProps {
    yDoc: Y.Doc | null;
    provider: WebsocketProvider | null;
}

export default function WhiteboardWorkspace({ yDoc, provider }: WhiteboardWorkspaceProps) {
    const [store] = useState(() => createTLStore({ shapeUtils: defaultShapeUtils }));

    useEffect(() => {
        if (!yDoc || !store || !provider) return;

        // Simplified sync logic (assuming basic shared state for MVP)
        // A production tldraw+yjs app should ideally use the official @tldraw/yjs package.

        let isInternalUpdate = false;
        const yMap = yDoc.getMap('tldraw');

        // 1. Sync from Yjs to Tldraw
        const observeYjs = (event: Y.YMapEvent<any>) => {
            if (isInternalUpdate) return;
            const changes: any[] = [];
            event.keysChanged.forEach(key => {
                const val = yMap.get(key);
                if (val) changes.push(val);
            });
            if (changes.length > 0) {
                isInternalUpdate = true;
                store.mergeRemoteChanges(() => {
                    store.put(changes);
                });
                isInternalUpdate = false;
            }
        };
        yMap.observe(observeYjs);

        // 2. Sync from Tldraw to Yjs
        const unlisten = store.listen((entry) => {
            if (isInternalUpdate) return;
            isInternalUpdate = true;
            yDoc.transact(() => {
                Object.values(entry.changes.added).forEach((record: any) => {
                    yMap.set(record.id, record);
                });
                Object.values(entry.changes.updated).forEach(([_, record]: any) => {
                    yMap.set(record.id, record);
                });
                Object.values(entry.changes.removed).forEach((record: any) => {
                    yMap.delete(record.id);
                });
            });
            isInternalUpdate = false;
        }, { source: 'user', scope: 'document' });

        return () => {
            unlisten();
            yMap.unobserve(observeYjs);
        };
    }, [yDoc, store, provider]);

    if (!yDoc || !provider) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-transparent">
                <span className="text-gray-500 font-bold font-space tracking-wider text-sm animate-pulse">Connecting to whiteboard service...</span>
            </div>
        );
    }

    return (
        <div className="w-full h-full rounded-b-2xl overflow-hidden relative" style={{ isolation: 'isolate' }}>
            <Tldraw store={store} />
        </div>
    );
}
