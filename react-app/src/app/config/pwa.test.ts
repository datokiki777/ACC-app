import { ACC_PWA_MANIFEST, VITE_BASE_PATH } from './pwa';

describe('PWA configuration', () => {
  it('uses the GitHub Pages repository base and installable ACC identity', () => {
    expect(VITE_BASE_PATH).toBe('/acc/');
    expect(ACC_PWA_MANIFEST).toMatchObject({
      name: 'ACC',
      short_name: 'ACC',
      start_url: '/acc/',
      scope: '/acc/',
      display: 'standalone',
      orientation: 'portrait',
      background_color: '#071633',
      theme_color: '#071633',
    });
  });

  it('retains regular and maskable icons', () => {
    expect(ACC_PWA_MANIFEST.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
        expect.objectContaining({ sizes: '192x192', purpose: 'maskable' }),
        expect.objectContaining({ sizes: '512x512', purpose: 'any' }),
        expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
      ]),
    );
  });
});
