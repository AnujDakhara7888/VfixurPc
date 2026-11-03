import { ServiceUnavailableException } from '@nestjs/common';
import axios from 'axios';
import { PlacesService } from './places.module';
jest.mock('axios', () => ({ __esModule: true, default: { post: jest.fn(), get: jest.fn() } }));
describe('Pickup address suggestions', () => {
  const config: any = { get: jest.fn((name: string) => name === 'GOOGLE_PLACES_API_KEY' ? 'server-only-key' : undefined) };
  beforeEach(() => jest.clearAllMocks());
  it('uses India filtering and Mumbai bias with a server-side key', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { suggestions: [{ placePrediction: { placeId: 'place', text: { text: 'Vile Parle, Mumbai, India' }, structuredFormat: { mainText: { text: 'Vile Parle' }, secondaryText: { text: 'Mumbai, India' } } } }] } });
    const result = await new PlacesService(config).suggest('  Vile Parle  ');
    expect(axios.post).toHaveBeenCalledWith('https://places.googleapis.com/v1/places:autocomplete', expect.objectContaining({ input: 'Vile Parle', includedRegionCodes: ['in'], locationBias: expect.any(Object) }), expect.objectContaining({ headers: expect.objectContaining({ 'X-Goog-Api-Key': 'server-only-key' }), timeout: 5000 }));
    expect(result).toEqual({ suggestions: [{ id: 'place', address: 'Vile Parle, Mumbai, India', title: 'Vile Parle', subtitle: 'Mumbai, India' }] });
    expect(JSON.stringify(result)).not.toContain('server-only-key');
  });
  it('ignores malformed and query-only predictions', async () => {
    (axios.post as jest.Mock).mockResolvedValue({ data: { suggestions: [{}, { queryPrediction: {} }] } });
    expect(await new PlacesService(config).suggest('Mumbai')).toEqual({ suggestions: [] });
  });
  it('keeps manual entry available when Google rejects a request', async () => {
    (axios.post as jest.Mock).mockRejectedValue({ response: { status: 403 }, message: 'private provider error' });
    await expect(new PlacesService(config).suggest('Mumbai')).rejects.toThrow('Enter your address manually');
  });
  it('does not call Google without configuration', async () => {
    const service = new PlacesService({ get: () => undefined } as any);
    await expect(service.suggest('Mumbai')).rejects.toThrow(ServiceUnavailableException);
    expect(axios.post).not.toHaveBeenCalled();
  });
  it('returns the verified business profile with direct review links without storing review content', async () => {
    (axios.get as jest.Mock).mockResolvedValue({ data: { displayName: { text: 'Vfixurpc' }, rating: 4.9, userRatingCount: 302, googleMapsLinks: { reviewsUri: 'https://www.google.com/maps/reviews', writeAReviewUri: 'https://www.google.com/maps/write-review' }, reviews: [{ rating: 5, text: { text: 'Helpful service' }, authorAttribution: { displayName: 'Customer' }, relativePublishTimeDescription: 'a week ago' }] } });
    const service = new PlacesService(config);
    const first: any = await service.businessProfile();
    expect(first).toEqual(expect.objectContaining({ placeId: 'ChIJ9fXJyhDJ5zsRgFqUG6sXEzw', rating: 4.9, reviewCount: 302 }));
    expect(first.writeReviewUrl).toBe('https://www.google.com/maps/write-review');
    expect(first.mapsUrl).toBe('https://www.google.com/maps/reviews');
    expect(first.reviews[0]).toEqual(expect.objectContaining({ author: 'Customer', text: 'Helpful service' }));
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/places/ChIJ9fXJyhDJ5zsRgFqUG6sXEzw'), expect.objectContaining({
      headers: expect.objectContaining({ 'X-Goog-FieldMask': expect.stringContaining('googleMapsLinks') }),
      params: { languageCode: 'en' },
    }));
  });
});
