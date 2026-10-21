export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: { pixel: ['"Press Start 2P"', 'monospace'], arcade: ['Silkscreen', 'monospace'] },
      colors: {
        neon: {
          red: '#ff2a55', blue: '#2ab7ff', green: '#39ff6a',
          yellow: '#ffe62a', purple: '#b44dff', orange: '#ff8a1f',
        },
      },
    },
  },
  plugins: [],
};
