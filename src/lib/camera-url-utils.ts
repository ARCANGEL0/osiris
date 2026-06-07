/**
 * IP Camera URL Discovery Utilities
 * Tries multiple common paths to find working camera feeds
 */

// Common snapshot/feed URL patterns for different camera vendors
const VENDOR_PATHS: Record<string, string[]> = {
  hikvision: [
    '/Streaming/channels/1/picture',
    '/ISAPI/Streaming/channels/101/picture',
    '/cgi-bin/snapshot.cgi',
    '/image/jpeg.cgi',
  ],
  dahua: [
    '/cgi-bin/snapshot.cgi',
    '/snap.jpg',
    '/cgi-bin/mjpg/video.cgi',
    '/mjpg/video.mjpg',
  ],
  axis: [
    '/axis-cgi/jpg/image.cgi',
    '/jpg/image.cgi',
    '/axis-cgi/mjpg/video.cgi',
    '/mjpg/video.mjpg',
  ],
  foscam: [
    '/cgi-bin/CGIProxy.fcgi?cmd=snapPicture2',
    '/snap.jpg',
    '/videoMain',
  ],
  dlink: [
    '/image/jpeg.cgi',
    '/mjpg/video.mjpg',
    '/snapshot.jpg',
    '/video.cgi',
    '/cgi-bin/video.jpg',
  ],
  tplink: [
    '/jpg/image.jpg',
    '/snapshot.jpg',
    '/stream/video.mjpg',
  ],
  generic: [
    '/snapshot.jpg',
    '/image.jpg',
    '/snap.jpg',
    '/cam.jpg',
    '/live.jpg',
    '/video.jpg',
    '/cgi-bin/snapshot.cgi',
    '/cgi-bin/image.cgi',
    '/mjpg/video.mjpg',
    '/video.cgi',
    '/stream',
    '/live',
    '/onvif/snapshot',
    '/api/snapshot',
    '/picture',
    '/image',
  ],
};

// Detect camera vendor from title, org, or HTML content
function detectVendor(title: string, org: string, html?: string): string {
  const text = `${title} ${org} ${html || ''}`.toLowerCase();
  
  if (text.includes('hikvision')) return 'hikvision';
  if (text.includes('dahua')) return 'dahua';
  if (text.includes('axis')) return 'axis';
  if (text.includes('foscam')) return 'foscam';
  if (text.includes('d-link') || text.includes('dlink')) return 'dlink';
  if (text.includes('tp-link') || text.includes('tplink')) return 'tplink';
  
  return 'generic';
}

export interface CameraUrlSet {
  primary: string;
  alternatives: string[];
  vendor: string;
  streamType: 'jpg' | 'mjpeg' | 'hls' | 'iframe';
}

/**
 * Generate all possible camera feed URLs for a given IP camera
 */
export function generateCameraUrls(
  ip: string,
  port: string | number,
  title?: string,
  org?: string,
  streamType?: string
): CameraUrlSet {
  const baseUrl = `http://${ip}:${port}`;
  const vendor = detectVendor(title || '', org || '');
  const paths = VENDOR_PATHS[vendor] || VENDOR_PATHS.generic;
  
  const alternatives = paths.map(path => `${baseUrl}${path}`);
  
  // Determine best stream type
  let detectedStreamType: CameraUrlSet['streamType'] = 'jpg';
  if (streamType === 'hls' || title?.toLowerCase().includes('hls')) {
    detectedStreamType = 'hls';
  } else if (vendor === 'axis' || title?.toLowerCase().includes('mjpeg')) {
    detectedStreamType = 'mjpeg';
  }
  
  return {
    primary: baseUrl,
    alternatives,
    vendor,
    streamType: detectedStreamType,
  };
}

/**
 * Get the best feed URL to try first based on camera info
 */
export function getBestFeedUrl(
  ip: string,
  port: string | number,
  title?: string,
  org?: string
): { url: string; streamType: CameraUrlSet['streamType'] } {
  const urls = generateCameraUrls(ip, port, title, org);
  
  // For known vendors, try the first vendor-specific path
  if (urls.vendor !== 'generic' && urls.alternatives.length > 0) {
    return { url: urls.alternatives[0], streamType: urls.streamType };
  }
  
  // For generic, try the base URL first
  return { url: urls.primary, streamType: urls.streamType };
}
