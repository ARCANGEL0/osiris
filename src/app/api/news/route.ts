import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * OSIRIS — Military-Grade Intelligence API
 * Fetches Telegram OSINT feeds directly, with a failsafe fallback 
 * to traditional intelligence sources if Telegram blocks the IP.
 */

// ── Telegram OSINT channels (public, no login required) ──
// Covers: Ukraine war, Middle East, cyber warfare, hacktivists, global conflicts
const TELEGRAM_CHANNELS = [
  // War/conflict monitors
  'OSINTtechnical',    // OSINT Technical
  'Faytuks',           // Faytuk's War Monitor
  'Liveuamap',         // Live UA Map
  'RALee85',           // Rob Lee (defense analyst)
  'TheDeepStateCom',   // Deep State Map Ukraine
  'wartranslated',     // War Translated
  'Gerashchenko_en',   // Anton Gerashchenko
  'nexta_tv',          // NEXTA (Belarus/Eastern Europe)
  'conflictnews',      // Conflict News
  'militaryosint',     // Military OSINT
  'intelslava',        // Intel Slava Z
  // Cyber/hacktivism
  'CyberKnow',         // Cyber threat intel
  'GhostSecOfficial',  // GhostSec hacktivist group
  'YourAnonNews',      // Anonymous news
  'AnonymousTV501',    // Anonymous TV
  'cyberknow20',       // Cyber threat researcher
  // Middle East / Global
  'MEE_conflicts',     // Middle East Eye conflicts
  'IsraelWarRoom',     // Israel-Palestine conflict OSINT
  'IntelSlava',        // Conflict intel
  'eIntelligence',     // Electronic intelligence
  // Intelligence/OSINT
  'OSINT_team',        // OSINT Team
  'osint_defenders',   // OSINT Defenders
  'Bellingcat',        // Bellingcat investigations
  'IntelligenceAlerts', // Intelligence alerts
];

// ── Comprehensive RSS feeds — 25+ sources across regions ──
const RSS_FEEDS: Record<string, string> = {
  // Global wire services
  'Reuters World':     'https://feeds.reuters.com/reuters/worldNews',
  'AP News':           'https://rsshub.app/apnews/topics/apf-intlnews',
  'AFP':               'https://rsshub.app/afp/en/world',
  'BBC World':         'https://feeds.bbci.co.uk/news/world/rss.xml',
  // Defense & security
  'Defense News':      'https://www.defensenews.com/arc/outboundfeeds/rss/category/global/?outputType=xml',
  'War on the Rocks':  'https://warontherocks.com/feed/',
  'Bellingcat':        'https://www.bellingcat.com/feed/',
  'RUSI':              'https://www.rusi.org/rss.xml',
  'USNI News':         'https://news.usni.org/feed',
  'Breaking Defense':  'https://breakingdefense.com/feed/',
  'Task & Purpose':    'https://taskandpurpose.com/feed/',
  'The Drive':         'https://www.thedrive.com/feeds/all.rss',
  'Lawfare':           'https://www.lawfaremedia.org/feed',
  // Middle East
  'Al Jazeera':        'https://www.aljazeera.com/xml/rss/all.xml',
  'Middle East Eye':   'https://www.middleeasteye.net/rss',
  'Jerusalem Post':    'https://www.jpost.com/rss/rssfeedsfrontpage.aspx',
  'Haaretz':           'https://www.haaretz.com/cmlink/1.628752',
  // Russia / Ukraine
  'Kyiv Independent': 'https://kyivindependent.com/rss/',
  'Meduza EN':         'https://meduza.io/rss/en/all',
  'UA Pravda EN':      'https://www.pravda.com.ua/eng/rss/',
  // Asia / Pacific
  'South China Morning Post': 'https://www.scmp.com/rss/91/feed',
  'Nikkei Asia':       'https://asia.nikkei.com/rss/feed/nar',
  'The Diplomat':      'https://thediplomat.com/feed/',
  'NK News':           'https://www.nknews.org/feed/',
  // Cyber / OSINT
  'Krebs on Security': 'https://krebsonsecurity.com/feed/',
  'The Hacker News':   'https://feeds.feedburner.com/TheHackersNews',
  'BleepingComputer':  'https://www.bleepingcomputer.com/feed/',
  'Dark Reading':      'https://www.darkreading.com/rss.xml',
  // Humanitarian
  'ReliefWeb':         'https://reliefweb.int/updates/rss.xml?source=unhcr',
  'GDACS':             'https://www.gdacs.org/xml/rss.xml',
};

const RISK_KEYWORDS = ['war','missile','strike','attack','crisis','tension','military','conflict','defense','clash','nuclear','invasion','bomb','drone','weapon','sanctions','ceasefire','escalation', 'killed', 'destroyed', 'operation', 'casualty', 'frontline', 'threat'];

const KEYWORD_COORDS: Record<string, [number, number]> = {
  'ukraine': [49.487, 31.272], 'kyiv': [50.450, 30.523], 'russia': [61.524, 105.318],
  'moscow': [55.755, 37.617], 'israel': [31.046, 34.851], 'gaza': [31.416, 34.333],
  'iran': [32.427, 53.688], 'lebanon': [33.854, 35.862], 'syria': [34.802, 38.996],
  'yemen': [15.552, 48.516], 'china': [35.861, 104.195], 'taiwan': [23.697, 120.960],
  'united states': [38.907, -77.036], 'europe': [48.800, 2.300], 'middle east': [31.500, 34.800]
};

function scoreRisk(text: string): number {
  const lower = text.toLowerCase();
  let score = 1;
  for (const kw of RISK_KEYWORDS) {
    if (lower.includes(kw)) score += 2;
  }
  return Math.min(10, score);
}

function findCoords(text: string): [number, number] | null {
  const lower = text.toLowerCase();
  for (const [keyword, coords] of Object.entries(KEYWORD_COORDS)) {
    if (lower.includes(keyword)) return coords;
  }
  return null;
}

function parseTelegramHTML(html: string, channel: string): any[] {
  const items: any[] = [];
  const messageBlockRegex = /<div class="tgme_widget_message_wrap js-widget_message_wrap"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
  let blockMatch;

  while ((blockMatch = messageBlockRegex.exec(html)) !== null) {
    const blockHtml = blockMatch[0];
    const textRegex = /<div class="tgme_widget_message_text[^>]*>([\s\S]*?)<\/div>/i;
    const textMatch = blockHtml.match(textRegex);
    if (!textMatch) continue;
    
    let text = textMatch[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
    if (!text || text.length < 10) continue;

    const dateRegex = /<a class="tgme_widget_message_date" href="(https:\/\/t\.me\/[^"]+)".*?<time datetime="([^"]+)"/i;
    const dateMatch = blockHtml.match(dateRegex);
    const link = dateMatch ? dateMatch[1] : `https://t.me/${channel}`;
    const pubDate = dateMatch ? dateMatch[2] : new Date().toISOString();

    const title = text.split('\n')[0].substring(0, 100);

    items.push({ title, description: text, link, pubDate, source: `t.me/${channel}` });
  }
  return items;
}

function parseRSSItems(xml: string, sourceName: string): any[] {
  const items: any[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const getTag = (tag: string) => {
      const m = itemXml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return (m?.[1] || m?.[2] || '').trim();
    };

    let title = getTag('title').replace(/<[^>]+>/g, '');
    let desc = getTag('description').replace(/<[^>]+>/g, '').replace(/&quot;/g, '"');
    
    items.push({
      title: title.length > 100 ? title.substring(0, 100) + '...' : title,
      description: desc,
      link: getTag('link'),
      pubDate: getTag('pubDate') || new Date().toISOString(),
      source: sourceName
    });
  }
  return items;
}

export async function GET() {
  try {
    const feedPromises = TELEGRAM_CHANNELS.map(async (channel) => {
      try {
        const res = await fetch(`https://t.me/s/${channel}`, { 
          signal: AbortSignal.timeout(8000), 
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } 
        });
        if (!res.ok) return [];
        const html = await res.text();
        return parseTelegramHTML(html, channel).slice(-8);
      } catch { return []; }
    });

    const feedResults = await Promise.allSettled(feedPromises);
    const allArticles: any[] = [];

    for (const result of feedResults) {
      if (result.status === 'fulfilled') allArticles.push(...result.value);
    }

    // Always fetch RSS feeds in parallel with Telegram (not just as fallback)
    const rssPromises = Object.entries(RSS_FEEDS).map(async ([source, url]) => {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(6000),
          headers: { 'Accept': 'application/rss+xml, text/xml, application/xml', 'User-Agent': 'Mozilla/5.0 OSIRIS/4.2' },
        });
        if (!res.ok) return [];
        const xml = await res.text();
        return parseRSSItems(xml, source).slice(0, 6);
      } catch { return []; }
    });
    const rssResults = await Promise.allSettled(rssPromises);
    for (const result of rssResults) {
      if (result.status === 'fulfilled') allArticles.push(...result.value);
    }

    const newsItems = allArticles.map(article => {
      const riskScore = scoreRisk(article.description || article.title);
      const coords = findCoords(article.description || article.title);

      return {
        id: crypto.createHash('md5').update((article.link || '') + (article.pubDate || '')).digest('hex'),
        title: article.title,
        description: article.description,
        link: article.link,
        published: article.pubDate,
        source: article.source,
        risk_score: riskScore,
        coords: coords ? [coords[0], coords[1]] : null,
        coords_default: !coords,
        machine_assessment: riskScore >= 8 ? "AI Analysis indicates elevated tactical priority based on OSINT stream patterns." : null,
      };
    });

    newsItems.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

    return NextResponse.json({
      news: newsItems,
      total: newsItems.length,
      timestamp: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (error) {
    return NextResponse.json({ news: [], error: 'Failed to fetch intel' }, { status: 500 });
  }
}
