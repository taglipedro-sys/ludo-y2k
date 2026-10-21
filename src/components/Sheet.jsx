// Painel que sobe de baixo no celular.
export function Sheet({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end" style={{ background: 'rgba(0,0,0,.7)' }} onClick={onClose}>
      <div className="slide-up w-full max-h-[88vh] overflow-y-auto bg-[#0b0620] border-t-4 border-neon-blue p-4 pb-8 rounded-t-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div className="font-pixel text-[11px] text-neon-blue">{title}</div>
          <button className="font-pixel text-lg px-2" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Chip({ active, onClick, children, color = '#2ab7ff' }) {
  return (
    <button onClick={onClick} className="px-3 py-2 text-[11px] border-2 rounded"
      style={{ borderColor: color, background: active ? color : 'transparent', color: active ? '#000' : color }}>
      {children}
    </button>
  );
}
