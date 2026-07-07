const BASE = "https://api.artic.edu/api/v1";
const FIELDS = "id,title,artist_display,date_display,medium_display,dimensions,description,image_id,is_public_domain";

export const tools = [
  {
    functionDeclarations: [
      {
        name: "search_artworks",
        description: "Search the Art Institute of Chicago collection by keyword, artist name, style, period, or subject.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: { type: "STRING", description: "Search term, e.g. 'Monet', 'impressionism', 'portraits of women'" },
            limit: { type: "NUMBER", description: "Number of results to return (default 5, max 10)" }
          },
          required: ["query"]
        }
      },
      {
        name: "get_artwork",
        description: "Fetch full details about a specific artwork by its AIC ID.",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "NUMBER", description: "The AIC artwork ID (from search results)" }
          },
          required: ["id"]
        }
      },
      {
        name: "search_exhibitions",
        description: "Search for current, upcoming, or past exhibitions at the museum.",
        parameters: {
          type: "OBJECT",
          properties: {
            query: { type: "STRING", description: "Search term for the exhibition, e.g. 'Impressionism', 'Picasso', 'Modern Art'" },
            limit: { type: "NUMBER", description: "Number of results to return (default 5, max 10)" }
          },
          required: ["query"]
        }
      },
      {
        name: "get_exhibition",
        description: "Fetch full details about a specific exhibition by its AIC ID.",
        parameters: {
          type: "OBJECT",
          properties: {
            id: { type: "NUMBER", description: "The AIC exhibition ID (from search results)" }
          },
          required: ["id"]
        }
      }
    ]
  }
];

function buildImageUrl(image_id) {
  if (!image_id) return null;
  return `https://www.artic.edu/iiif/2/${image_id}/full/843,/0/default.jpg`;
}

function stripHtml(str) {
  if (!str) return null;
  return str.replace(/<[^>]*>/g, '').trim();
}

export async function runTool(name, args) {
  try {
    if (name === "search_artworks") {
      const limit = args.limit ?? 5;
      const url = `${BASE}/artworks/search?q=${encodeURIComponent(args.query)}&limit=${limit}&fields=${FIELDS}`;
      const res = await fetch(url);
      if (!res.ok) return { error: `API error: ${res.status}` };
      const json = await res.json();
      if (!json.data) return { error: 'No data returned' };
      return json.data.map(art => ({
        id: art.id,
        title: art.title,
        artist: art.artist_display,
        date: art.date_display,
        image_url: buildImageUrl(art.image_id)
      }));
    }

    if (name === "get_artwork") {
      const url = `${BASE}/artworks/${args.id}?fields=${FIELDS}`;
      const res = await fetch(url);
      if (!res.ok) return { error: `API error: ${res.status}` };
      const json = await res.json();
      const art = json.data;
      if (!art) return { error: 'Artwork not found' };
      return {
        title: art.title,
        artist: art.artist_display,
        date: art.date_display,
        medium: art.medium_display,
        dimensions: art.dimensions,
        description: stripHtml(art.description),
        public_domain: art.is_public_domain,
        image_url: buildImageUrl(art.image_id)
      };
    }

    if (name === "search_exhibitions") {
      const limit = args.limit ?? 5;
      const fields = "id,title,short_description,gallery_title,status,aic_start_at,aic_end_at";
      const url = `${BASE}/exhibitions/search?q=${encodeURIComponent(args.query)}&limit=${limit}&fields=${fields}`;
      const res = await fetch(url);
      if (!res.ok) return { error: `API error: ${res.status}` };
      const json = await res.json();
      if (!json.data) return { error: 'No data returned' };
      return json.data.map(ex => ({
        id: ex.id,
        title: ex.title,
        description: stripHtml(ex.short_description),
        location: ex.gallery_title,
        status: ex.status,
        dates: `${ex.aic_start_at?.split('T')[0] ?? 'N/A'} to ${ex.aic_end_at?.split('T')[0] ?? 'N/A'}`
      }));
    }

    if (name === "get_exhibition") {
      const fields = "id,title,short_description,image_url,gallery_title,status,aic_start_at,aic_end_at,description";
      const url = `${BASE}/exhibitions/${args.id}?fields=${fields}`;
      const res = await fetch(url);
      if (!res.ok) return { error: `API error: ${res.status}` };
      const json = await res.json();
      const ex = json.data;
      if (!ex) return { error: 'Exhibition not found' };
      return {
        id: ex.id,
        title: ex.title,
        short_description: stripHtml(ex.short_description),
        description: stripHtml(ex.description),
        location: ex.gallery_title,
        status: ex.status,
        image_url: ex.image_url,
        dates: `${ex.aic_start_at?.split('T')[0] ?? 'N/A'} to ${ex.aic_end_at?.split('T')[0] ?? 'N/A'}`
      };
    }

    return { error: 'Unknown tool' };
  } catch (err) {
    return { error: `Tool execution failed: ${err.message}` };
  }
}
