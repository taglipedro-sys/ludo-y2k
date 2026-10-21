export default function CrtFrame({ shake = false, children }) {
  return (
    <div className={`crt-bezel ${shake ? 'shake' : ''}`}>
      <div className="crt-screen">
        {children}
        <div className="crt-scanlines" />
      </div>
    </div>
  );
}
