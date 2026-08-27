import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Refined brand ramp: soft sky-blue → deep navy. 600/700 stay
        // readable with white text; 800/900 are premium near-black navy
        // for dark surfaces — matches the VfixurPC logo mark.
        brand: {
          50:  '#EFF6FE',
          100: '#DCEBFC',
          200: '#B2D7F8',
          300: '#7FBBF2',
          400: '#4A9BE8',
          500: '#1E88E5',
          600: '#166DBC',
          700: '#115394',
          800: '#0F1F35',
          900: '#0A1626',
        },
        // Azure-blue signature — highlights, glows, focus accents.
        accent: {
          DEFAULT: '#1E88E5',
          soft:    '#E5F1FD',
          ink:     '#0F62B0',
        },
        ink: {
          DEFAULT: '#0F1620',
          soft:    '#4E5A6D',
          faint:   '#7C8798',
        },
      },
      boxShadow: {
        card: '0 1px 2px rgba(10,22,38,0.04), 0 8px 24px rgba(10,22,38,0.05)',
        cardHover: '0 2px 4px rgba(10,22,38,0.06), 0 16px 40px rgba(10,22,38,0.10)',
        glow: '0 10px 30px rgba(30,136,229,0.28)',
      },
      backgroundImage: {
        'ink-grad': 'linear-gradient(135deg, #16283F 0%, #0A1626 60%, #050B14 100%)',
        'accent-grad': 'linear-gradient(135deg, #4FB3FF 0%, #1E88E5 50%, #0F62B0 100%)',
      },
    },
  },
  plugins: [],
};
export default config;
