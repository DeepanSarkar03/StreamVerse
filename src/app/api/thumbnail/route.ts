import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Using multiple APIs for better coverage
const ITUNES_SEARCH_URL = 'https://itunes.apple.com/search';
const OMDB_API_KEY = process.env.OMDB_API_KEY; // Free API key from omdbapi.com

// Clean up movie title for better search results
function cleanTitle(title: string): { cleanedTitle: string; year: string | null } {
  let cleaned = title
    // Remove file extensions
    .replace(/\.(mp4|mkv|avi|mov|webm|m4v)$/i, '')
    // Remove common scene tags
    .replace(/\b(720p|1080p|2160p|4K|UHD|HDR|HDR10|DV|WEB-DL|BluRay|BRRip|DVDRip|HDTV|WEBRip|x264|x265|HEVC|AAC|DTS|AC3|REMUX|PROPER|REPACK|EXTENDED|UNRATED|DIRECTORS\.CUT|THEATRICAL)\b/gi, '')
    // Remove codec info
    .replace(/\b(H\.?264|H\.?265|AVC|XVID|DIVX|10bit|8bit)\b/gi, '')
    // Remove audio info
    .replace(/\b(5\.1|7\.1|2\.0|ATMOS|TrueHD|DTS-HD|FLAC|MP3|AAC)\b/gi, '')
    // Remove language tags in brackets
    .replace(/\[(Hin|Hindi|Eng|English|Tam|Tamil|Tel|Telugu|Kor|Korean|Jpn|Japanese|Chi|Chinese|Spa|Spanish|Fre|French|Ger|German|Ita|Italian|Por|Portuguese|Rus|Russian|Ara|Arabic|Tur|Turkish|Pol|Polish|Dut|Dutch|Swe|Swedish|Nor|Norwegian|Dan|Danish|Fin|Finnish|Hun|Hungarian|Cze|Czech|Gre|Greek|Heb|Hebrew|Tha|Thai|Vie|Vietnamese|Ind|Indonesian|Mal|Malay|Ben|Bengali|Mar|Marathi|Guj|Gujarati|Kan|Kannada|Pun|Punjabi|Ori|Oriya|Asm|Assamese|Nep|Nepali|Sin|Sinhala|Multi|Dual|Audio)[^\]]*\]/gi, '')
    // Remove quality/source tags in brackets/parentheses
    .replace(/\[.*?\]/g, ' ')
    .replace(/\{.*?\}/g, ' ')
    // Remove dots and underscores used as separators
    .replace(/[._]/g, ' ')
    // Remove site names (common patterns)
    .replace(/^(Movies4u\.Bid|YTS|YIFY|RARBG|1337x|PSA|Ganool|Pahe|ETRG|EVO|SPARKS|GECKOS|FGT|FLAME|AMIABLE|TGx|GalaxyRG|MkvCage|MkvHub|Mkvcage|AMZN|NF|DSNP|HMAX|PCOK|ATVP|AppleTV)\s*[-–—]?\s*/i, '')
    // Remove trailing tags like -SPARKS, -YTS etc
    .replace(/\s*[-–—]\s*(SPARKS|YTS|YIFY|RARBG|FGT|FLAME|AMIABLE|TGx|GalaxyRG|EVO|ETRG)\s*$/i, '')
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Extract year - look for (2020) or just 2020
  let year: string | null = null;
  const yearInParens = cleaned.match(/\(?((?:19|20)\d{2})\)?/);
  if (yearInParens) {
    year = yearInParens[1];
    // Remove the year from the title for cleaner search
    cleaned = cleaned.replace(/\s*\(?((?:19|20)\d{2})\)?\s*/, ' ').trim();
  }

  return { cleanedTitle: cleaned, year };
}

interface iTunesResult {
  trackName?: string;
  collectionName?: string;
  artworkUrl100?: string;
  artworkUrl60?: string;
  releaseDate?: string;
  primaryGenreName?: string;
}

interface OMDBResult {
  Title: string;
  Year: string;
  Poster: string;
  Response: string;
}

// Search OMDB (more accurate for movies)
async function searchOMDB(query: string, year?: string | null): Promise<string | null> {
  if (!OMDB_API_KEY) return null;

  try {
    let url = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(query)}&type=movie`;
    if (year) {
      url += `&y=${year}`;
    }

    const response = await fetch(url);
    if (!response.ok) return null;

    const data: OMDBResult = await response.json();
    if (data.Response === 'True' && data.Poster && data.Poster !== 'N/A') {
      return data.Poster;
    }

    // Try without year
    if (year) {
      const retryUrl = `https://www.omdbapi.com/?apikey=${OMDB_API_KEY}&t=${encodeURIComponent(query)}&type=movie`;
      const retryResponse = await fetch(retryUrl);
      if (retryResponse.ok) {
        const retryData: OMDBResult = await retryResponse.json();
        if (retryData.Response === 'True' && retryData.Poster && retryData.Poster !== 'N/A') {
          return retryData.Poster;
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}

// Search iTunes
async function searchiTunes(query: string, year?: string | null): Promise<{ poster: string; title: string } | null> {
  try {
    // Add year to query for better results
    const searchQuery = year ? `${query} ${year}` : query;
    const url = `${ITUNES_SEARCH_URL}?term=${encodeURIComponent(searchQuery)}&media=movie&entity=movie&limit=5`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.results || data.results.length === 0) return null;

    // Find best match by comparing titles
    const queryLower = query.toLowerCase();
    const results = data.results as iTunesResult[];
    
    // First try exact match
    const exactMatch = results.find(r => 
      r.trackName?.toLowerCase() === queryLower
    );
    
    if (exactMatch?.artworkUrl100) {
      return {
        poster: exactMatch.artworkUrl100.replace(/100x100/, '600x600'),
        title: exactMatch.trackName || query
      };
    }

    // Then try partial match
    const partialMatch = results.find(r =>
      r.trackName?.toLowerCase().includes(queryLower) ||
      queryLower.includes(r.trackName?.toLowerCase() || '')
    );

    if (partialMatch?.artworkUrl100) {
      return {
        poster: partialMatch.artworkUrl100.replace(/100x100/, '600x600'),
        title: partialMatch.trackName || query
      };
    }

    // Fall back to first result
    if (results[0]?.artworkUrl100) {
      return {
        poster: results[0].artworkUrl100.replace(/100x100/, '600x600'),
        title: results[0].trackName || query
      };
    }

    return null;
  } catch {
    return null;
  }
}

// Generate a themed placeholder based on genre/title keywords
function getThemedPlaceholder(title: string): string {
  const titleLower = title.toLowerCase();
  
  // Action/thriller keywords
  if (/extraction|mission|impossible|fast|furious|john wick|die hard|terminator|predator|rambo|expendables|taken|equalizer|commando|hitman|assassin|war|battle|fight|kill|gun|shooter/i.test(titleLower)) {
    return 'https://images.unsplash.com/photo-1509347528160-9a9e33742cdb?w=400&h=600&fit=crop'; // Action
  }
  
  // Horror keywords
  if (/horror|scary|ghost|demon|evil|conjuring|annabelle|insidious|paranormal|haunted|witch|zombie|vampire|freddy|jason|halloween|saw|scream/i.test(titleLower)) {
    return 'https://images.unsplash.com/photo-1509248961895-b4ed4ca5d58e?w=400&h=600&fit=crop'; // Dark/horror
  }
  
  // Sci-fi keywords
  if (/star wars|star trek|matrix|alien|avatar|interstellar|inception|blade runner|terminator|transformers|jurassic|godzilla|pacific rim|sci-fi|space|galaxy|planet|robot/i.test(titleLower)) {
    return 'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?w=400&h=600&fit=crop'; // Space/sci-fi
  }
  
  // Romance/drama
  if (/love|romance|wedding|notebook|titanic|pretty woman|proposal|bride|kiss|heart/i.test(titleLower)) {
    return 'https://images.unsplash.com/photo-1518199266791-5375a83190b7?w=400&h=600&fit=crop'; // Romance
  }
  
  // Comedy
  if (/comedy|funny|hangover|superbad|bridesmaids|21 jump|grown ups|step brothers|anchorman/i.test(titleLower)) {
    return 'https://images.unsplash.com/photo-1527224538127-2104bb71c51b?w=400&h=600&fit=crop'; // Comedy/fun
  }
  
  // Default movie placeholder
  return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&h=600&fit=crop'; // Cinema
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const title = searchParams.get('title');

  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  }

  const { cleanedTitle, year } = cleanTitle(title);

  // Try OMDB first (most accurate)
  const omdbPoster = await searchOMDB(cleanedTitle, year);
  if (omdbPoster) {
    return NextResponse.json({
      poster: omdbPoster,
      backdrop: omdbPoster,
      title: cleanedTitle,
      year,
      source: 'omdb'
    });
  }

  // Try iTunes
  const itunesResult = await searchiTunes(cleanedTitle, year);
  if (itunesResult) {
    return NextResponse.json({
      poster: itunesResult.poster,
      backdrop: itunesResult.poster,
      title: itunesResult.title,
      year,
      source: 'itunes'
    });
  }

  // Themed placeholder based on title keywords
  const placeholder = getThemedPlaceholder(cleanedTitle);
  return NextResponse.json({
    poster: placeholder,
    backdrop: placeholder,
    title: cleanedTitle,
    source: 'placeholder'
  });
}
