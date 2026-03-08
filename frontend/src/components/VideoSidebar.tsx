import {
    LiveKitRoom,
    GridLayout,
    ParticipantTile,
    RoomAudioRenderer,
    ControlBar,
    useTracks,
    LayoutContextProvider
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';

interface VideoSidebarProps {
    token: string | null;
    serverUrl: string | null;
    identity?: string;
    videoEnabled?: boolean;
    audioEnabled?: boolean;
}

export default function VideoSidebar({ token, serverUrl, identity, videoEnabled = true, audioEnabled = true }: VideoSidebarProps) {
    if (!token || !serverUrl) {
        return (
            <div className="w-full h-full bg-transparent flex items-center justify-center p-6 text-center text-sm text-gray-500">
                <div className="animate-pulse flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-2 border-black border-t-transparent animate-spin"></div>
                    <p className="tracking-widest uppercase font-bold text-xs text-gray-600">Awaiting WebRTC Signal...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col relative font-space overflow-hidden">
            <div className="h-10 px-5 flex items-center justify-between border-b border-black/5 bg-black/5 backdrop-blur-md z-10 shrink-0">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Live Video Feed</span>
            </div>
            <LiveKitRoom
                video={videoEnabled}
                audio={audioEnabled}
                token={token}
                serverUrl={serverUrl}
                data-lk-theme="default"
                className="flex-1 w-full bg-transparent flex flex-col min-h-0"
            >
                <LayoutContextProvider>
                    <div className="flex-1 relative min-h-0 custom-lk-theme">
                        <MyVideoLayout identity={identity} />
                    </div>
                    <RoomAudioRenderer />
                </LayoutContextProvider>
            </LiveKitRoom>
        </div>
    );
}

function MyVideoLayout(props: { identity?: string }) {
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: true }
    ).filter(t => !t.participant.identity.startsWith('obs_'));

    const isObserver = props.identity?.startsWith('obs_');

    return (
        <div className="absolute inset-0 flex flex-col bg-black/10">
            <div className="flex-1 min-h-0 w-full relative">
                <GridLayout tracks={tracks}>
                    <ParticipantTile />
                </GridLayout>
            </div>
            <div className="h-16 shrink-0 flex items-center justify-center border-t border-white/10 bg-black/60 backdrop-blur-xl z-20">
                <ControlBar
                    variation="minimal"
                    controls={{
                        microphone: !isObserver,
                        camera: !isObserver,
                        chat: false,
                        screenShare: !isObserver,
                        leave: false,
                        settings: true
                    }}
                />
            </div>
        </div>
    );
}
