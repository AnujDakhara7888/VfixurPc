import { assertInServiceArea, findServiceAreaLocality, isInServiceArea } from './service-area';

describe('service area', () => {
  it.each([
    ['Flat 4, Vile Parle West, Mumbai 400056', 'Vile Parle West'],
    ['Bandra Kurla Complex, Mumbai', 'BKC'],
    ['Sakinaka, Andheri, Mumbai', 'Saki Naka'],
    ['Lower Parel, Mumbai, Maharashtra', 'Lower Parel'],
    ['Borivali East, Mumbai', 'Borivali East'],
  ])('accepts %s', (address, locality) => {
    expect(findServiceAreaLocality(address)).toBe(locality);
    expect(isInServiceArea(address)).toBe(true);
  });

  it.each(['Thane West', 'Navi Mumbai', 'Pune', 'Mumbai'])('rejects %s', address => {
    expect(isInServiceArea(address)).toBe(false);
    expect(() => assertInServiceArea(address)).toThrow('workshop drop-off');
  });
});
