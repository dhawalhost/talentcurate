import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Loader2, ShieldCheck } from 'lucide-react';

export default function SSOCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    useEffect(() => {
        const token = searchParams.get('token');
        const userStr = searchParams.get('user');

        if (token && userStr) {
            try {
                // Parse user from query param
                const user = JSON.parse(decodeURIComponent(userStr));

                // Persist the session
                localStorage.setItem('talentcurate_token', token);
                localStorage.setItem('talentcurate_user', JSON.stringify(user));

                // Short delay so the user sees the Secure connection animation
                setTimeout(() => {
                    navigate('/dashboard');
                }, 1200);
            } catch (err) {
                console.error("Failed to parse SSO callback parameters", err);
                navigate('/');
            }
        } else {
            // Invalid callback parameters
            navigate('/');
        }
    }, [searchParams, navigate]);

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-transparent p-8 relative overflow-hidden font-space">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-sm w-full glass-panel-elevated py-12 px-10 border-t border-black/10 rounded-2xl relative z-10 text-center flex flex-col items-center gap-6"
            >
                <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center border border-green-200 shadow-[0_4px_20px_rgba(34,197,94,0.2)]"
                >
                    <ShieldCheck size={40} className="text-green-500" />
                </motion.div>

                <div>
                    <h2 className="text-xl font-bold text-gray-900 tracking-wider mb-2">Authenticating</h2>
                    <p className="text-sm font-medium text-gray-500">Securing your SSO session...</p>
                </div>

                <Loader2 size={24} className="text-primary animate-spin" />
            </motion.div>
        </div>
    );
}
