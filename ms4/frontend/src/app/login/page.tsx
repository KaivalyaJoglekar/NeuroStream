'use client';

import { useState } from 'react';
import { Eye, EyeOff, ArrowRight, Video, Search, Activity, Layers, Terminal } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/use-auth';
import { useToast } from '../../hooks/use-toast';
import { GridBackground } from '../../components/ui/grid-background';
import { motion } from 'framer-motion';

const defaultFadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const { loginAction } = useAuth();
  const { pushToast } = useToast();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (errors[name as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [name]: undefined, form: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: typeof errors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 5) {
      newErrors.password = 'Password must be at least 5 characters long';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    const result = await loginAction({ email: formData.email, password: formData.password });
    setLoading(false);

    if (!result.ok) {
      setErrors({ form: result.error || 'Authentication failed' });
      return;
    }

    pushToast({ title: 'System Access Granted', type: 'success' });
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen w-full bg-black text-white relative overflow-hidden flex items-center justify-center p-4 sm:p-8">
      <GridBackground />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[60vh] bg-brand/10 blur-[130px] rounded-full pointer-events-none" />

      <div className="w-full max-w-5xl lg:scale-95 origin-center z-10 grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-7 lg:gap-7 relative my-auto">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="flex flex-col justify-between hidden lg:flex glass-panel rounded-3xl p-7 xl:p-8 border border-white/5 relative overflow-hidden group shadow-glass"
        >
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-brand/5 blur-[100px] rounded-full transform translate-x-1/2 -translate-y-1/2 transition-opacity duration-700 opacity-50 group-hover:opacity-100 pointer-events-none" />

          <motion.div variants={defaultFadeIn} className="relative z-10">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-brand flex items-center justify-center shadow-glow">
                <Terminal className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-fantomen drop-shadow-sm text-white">Neuro<span className="text-brand">Stream</span></span>
            </div>

            <h1 className="text-2xl xl:text-3xl font-display font-medium leading-[1.1] tracking-tight mb-6 mt-4">
              AI-Powered <br/>
              <span className="text-gradient-brand font-bold">Video Workflow</span> <br/>
              Intelligence.
            </h1>
            <p className="text-slate-400 text-base max-w-[90%] leading-relaxed">
              The command center for your entire multimedia pipeline. Process, search, and manage video libraries with neural intelligence.
            </p>
          </motion.div>

          <motion.div variants={staggerContainer} className="relative z-10 space-y-5 mt-6 mb-6">
            {[
              { icon: Activity, title: 'Upload Tracking', desc: 'Real-time visibility into ingestion metrics.' },
              { icon: Layers, title: 'Processing Pipeline', desc: 'Multi-stage AI inference and metadata extraction.' },
              { icon: Search, title: 'Searchable Intelligence', desc: 'Vector-based queries across your video library.' },
              { icon: Video, title: 'Smart Video Library', desc: 'Organized, tagged, and ready for deployment.' },
            ].map((feature, i) => (
              <motion.div key={i} variants={defaultFadeIn} className="flex items-start space-x-5 group/feature">
                <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover/feature:border-brand/40 group-hover/feature:bg-brand/5 transition-all duration-300 shadow-sm">
                  <feature.icon className="w-5 h-5 text-slate-400 group-hover/feature:text-brand transition-colors duration-300" />
                </div>
                <div className="pt-0.5">
                  <h3 className="font-semibold text-white mb-1 group-hover/feature:text-brand-light transition-colors duration-300">{feature.title}</h3>
                  <p className="text-sm text-slate-500 leading-snug">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <motion.div variants={defaultFadeIn} className="relative z-10 pt-8 border-t border-white/10 flex items-center space-x-3">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand"></span>
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">All systems operational</span>
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="glass-panel p-7 sm:p-8 rounded-[2rem] border border-white/10 flex flex-col justify-center relative shadow-panel"
        >
          <div className="lg:hidden mb-10 flex flex-col items-center text-center">
            <div className="w-10 h-10 rounded-2xl bg-gradient-brand flex items-center justify-center shadow-glow mb-4">
              <Terminal className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-3xl font-fantomen text-white">Neuro<span className="text-brand">Stream</span></h2>
            <p className="text-slate-400 text-sm mt-2 font-medium">AI-Powered Video Workflow Intelligence</p>
          </div>

          <div className="mb-6 text-center lg:text-left">
            <h2 className="text-2xl font-display font-semibold mb-2">Welcome back</h2>
            <p className="text-slate-400 font-medium text-sm sm:text-base">Enter your credentials to access the terminal.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {errors.form && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-2xl flex items-center space-x-3 font-medium">
                <Activity className="w-4 h-4 flex-shrink-0" />
                <span>{errors.form}</span>
              </motion.div>
            )}

            <div className="space-y-4">
              <div className="group">
                <label className="block text-xs font-bold text-slate-400 mb-2.5 uppercase tracking-widest group-focus-within:text-brand transition-colors">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    placeholder="commander@neurostream.io"
                    className={`w-full px-4 py-2.5 border ${errors.email ? 'border-red-500/50 focus:border-red-500 hover:border-red-500/80' : 'border-white/10 focus:border-brand/60 hover:border-white/20'} bg-black/40 rounded-2xl focus:ring-1 focus:ring-brand/50 outline-none text-white placeholder-slate-600 transition-all font-medium backdrop-blur-md`}
                    required
                  />
                  {errors.email && <span className="absolute -bottom-5 left-0 text-[11px] font-semibold text-red-500">{errors.email}</span>}
                </div>
              </div>

              <div className="group pt-1">
                <div className="flex justify-between items-center mb-2.5">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest group-focus-within:text-brand transition-colors">
                    Password
                  </label>
                  <button type="button" className="text-xs font-bold text-slate-500 hover:text-brand transition-colors uppercase tracking-wider">Forgot?</button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    placeholder="••••••••"
                    className={`w-full px-4 py-2.5 pr-12 border ${errors.password ? 'border-red-500/50 focus:border-red-500 hover:border-red-500/80' : 'border-white/10 focus:border-brand/60 hover:border-white/20'} bg-black/40 rounded-2xl focus:ring-1 focus:ring-brand/50 outline-none text-white placeholder-slate-600 transition-all font-medium backdrop-blur-md`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-white/10"
                  >
                    {showPassword ? <Eye className="w-5 h-5 cursor-pointer" /> : <EyeOff className="w-5 h-5 cursor-pointer" />}
                  </button>
                  {errors.password && <span className="absolute -bottom-5 left-0 text-[11px] font-semibold text-red-500">{errors.password}</span>}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-3">
              <label className="flex items-center space-x-3 text-sm text-slate-400 cursor-pointer group select-none">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={formData.rememberMe}
                  onChange={handleInputChange}
                  className="custom-checkbox h-4 w-4 bg-black/50 border-white/20 rounded focus:ring-brand text-brand cursor-pointer transition-all"
                />
                <span className="group-hover:text-white transition-colors font-medium">Remember me</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full relative group mt-7"
            >
              <div className="absolute -inset-0.5 bg-gradient-to-r from-brand to-brand-light rounded-2xl blur opacity-40 group-hover:opacity-75 transition duration-300"></div>
              <div className="relative w-full bg-brand text-white py-2.5 px-6 rounded-2xl font-bold tracking-widest uppercase flex items-center justify-center space-x-2 border border-brand-light/30 shadow-lg group-hover:bg-brand-light transition-all disabled:opacity-50">
                <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
                {!loading && <ArrowRight className="w-4 h-4 ml-1.5 group-hover:translate-x-1.5 transition-transform" />}
              </div>
            </button>

            <p className="text-center text-sm font-medium text-slate-500 mt-7">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={() => router.push('/register')}
                className="text-white hover:text-brand transition-colors pb-0.5"
              >
                Sign Up
              </button>
            </p>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
