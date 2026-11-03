import { Body, Controller, Get, Header, Injectable, Logger, Module, Post, ServiceUnavailableException, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import { IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';
import axios from 'axios';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

class AddressQueryDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @Length(3, 200) input: string;
}

@Injectable()
export class AddressRateGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return req.user.id;
  }
}

@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);
  constructor(private config: ConfigService) {}
  async businessProfile() {
    const key = this.config.get<string>('GOOGLE_PLACES_API_KEY');
    if (!key) throw new ServiceUnavailableException('Google reviews are temporarily unavailable.');
    const placeId = this.config.get<string>('GOOGLE_BUSINESS_PLACE_ID') || 'ChIJ9fXJyhDJ5zsRgFqUG6sXEzw';
    try {
      const { data } = await axios.get(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,googleMapsUri,googleMapsLinks,reviews' },
        params: { languageCode: 'en' }, timeout: 5000,
      });
      const value = {
        placeId, name: data.displayName?.text || 'VfixurPC', rating: data.rating,
        reviewCount: data.userRatingCount,
        writeReviewUrl: data.googleMapsLinks?.writeAReviewUri || `https://search.google.com/local/writereview?placeid=${placeId}`,
        mapsUrl: data.googleMapsLinks?.reviewsUri || data.googleMapsUri || `https://www.google.com/maps/place/?q=place_id:${placeId}`,
        fetchedAt: new Date().toISOString(),
        reviewsNotice: 'Reviews are selected by Google and ordered by relevance.',
        reviews: (data.reviews ?? []).slice(0, 5).map((review: any) => ({
          author: review.authorAttribution?.displayName || 'Google reviewer',
          rating: review.rating, text: review.text?.text || '', relativeTime: review.relativePublishTimeDescription || '',
          authorPhoto: review.authorAttribution?.photoUri,
          authorUrl: review.authorAttribution?.uri,
          reviewUrl: review.googleMapsUri,
        })).filter((review: any) => review.text),
      };
      return value;
    } catch (error) {
      this.logger.warn('Business profile request failed with status ' + (error.response?.status ?? 'network-error'));
      throw new ServiceUnavailableException('Google reviews are temporarily unavailable.');
    }
  }
  async suggest(input: string) {
    const key = this.config.get<string>('GOOGLE_PLACES_API_KEY');
    if (!key) throw new ServiceUnavailableException('Address suggestions are unavailable. Enter your address manually.');
    try {
      const { data } = await axios.post('https://places.googleapis.com/v1/places:autocomplete', {
        input: input.trim(), includedRegionCodes: ['in'], languageCode: 'en',
        locationBias: { circle: { center: { latitude: 19.076, longitude: 72.8777 }, radius: 50000 } },
      }, {
        headers: {
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask': 'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat',
        }, timeout: 5000,
      });
      return { suggestions: (data.suggestions ?? []).flatMap((entry: any) => {
        const place = entry.placePrediction;
        if (!place?.placeId || !place.text?.text) return [];
        return [{ id: place.placeId, address: place.text.text,
          title: place.structuredFormat?.mainText?.text || place.text.text,
          subtitle: place.structuredFormat?.secondaryText?.text || '' }];
      }).slice(0, 5) };
    } catch (error) {
      // Never log the request configuration: it contains a key and the user's search text.
      this.logger.warn('Places request failed with status ' + (error.response?.status ?? 'network-error'));
      throw new ServiceUnavailableException('Address suggestions are unavailable. Enter your address manually.');
    }
  }
}

@Controller('places')
@UseGuards(JwtAuthGuard, AddressRateGuard)
export class PlacesController {
  constructor(private places: PlacesService) {}
  @Post('autocomplete')
  @Header('Cache-Control', 'private, no-store')
  suggest(@Body() dto: AddressQueryDto) { return this.places.suggest(dto.input); }
  @Get('business-profile')
  @Header('Cache-Control', 'private, no-store')
  profile() { return this.places.businessProfile(); }
}

@Module({
  controllers: [PlacesController], providers: [PlacesService, AddressRateGuard],
})
export class PlacesModule {}
