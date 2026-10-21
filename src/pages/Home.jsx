import { Link } from 'react-router-dom';
import { Smartphone, Tv } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-full grid place-items-center p-6 text-center" style={{ background: 'radial-gradient(circle at 50% 20%, #2a1060, #05020d 70%)' }}>
      <div className="flex flex-col items-center gap-8 max-w-md">
        <div>
          <div className="font-pixel text-4xl text-neon-purple glow">LUDO</div>
          <div className="font-pixel text-5xl text-neon-yellow glow mt-2">Y2K</div>
          <div className="text-xs opacity-70 mt-4">party game · TV + celulares</div>
        </div>
        <Link to="/host" className="pixel-btn w-full flex items-center justify-center gap-3" style={{ '--c': '#2ab7ff' }}>
          <Tv size={18} /> ABRIR NA TV
        </Link>
        <Link to="/play" className="pixel-btn w-full flex items-center justify-center gap-3" style={{ '--c': '#39ff6a' }}>
          <Smartphone size={18} /> ENTRAR COM O CELULAR
        </Link>
      </div>
    </div>
  );
}
