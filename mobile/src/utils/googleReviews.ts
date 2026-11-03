import * as WebBrowser from 'expo-web-browser';

export const VFIXURPC_PLACE_ID = 'ChIJ9fXJyhDJ5zsRgFqUG6sXEzw';
export const GOOGLE_REVIEWS_URL = `https://www.google.com/maps/place/?q=place_id:${VFIXURPC_PLACE_ID}`;
export const GOOGLE_WRITE_REVIEW_URL = `https://search.google.com/local/writereview?placeid=${VFIXURPC_PLACE_ID}`;

function trustedGoogleUrl(candidate: string | undefined, fallback: string) {
  if (!candidate) return fallback;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' || !(url.hostname === 'google.com' || url.hostname.endsWith('.google.com'))) return fallback;
    return url.toString();
  } catch {
    return fallback;
  }
}

export function openGoogleReviewComposer(url = GOOGLE_WRITE_REVIEW_URL) {
  return WebBrowser.openBrowserAsync(trustedGoogleUrl(url, GOOGLE_WRITE_REVIEW_URL), {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    controlsColor: '#0B4FCC',
    toolbarColor: '#FFFFFF',
  });
}

export function openGoogleReviews(url = GOOGLE_REVIEWS_URL) {
  return WebBrowser.openBrowserAsync(trustedGoogleUrl(url, GOOGLE_REVIEWS_URL), {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    controlsColor: '#0B4FCC',
    toolbarColor: '#FFFFFF',
  });
}
