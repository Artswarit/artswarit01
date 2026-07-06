import { defineMcp } from "@lovable.dev/mcp-js";
import searchArtists from "./tools/search-artists";
import getArtist from "./tools/get-artist";
import listArtworks from "./tools/list-artworks";
import getArtwork from "./tools/get-artwork";

export default defineMcp({
  name: "artswarit-mcp",
  title: "Artswarit MCP",
  version: "0.1.0",
  instructions:
    "Public read-only tools for Artswarit — a marketplace connecting freelance artists and clients. Use `search_artists` to discover artists, `get_artist` for a full profile, `list_artworks` to browse artworks (optionally filtered by artist/category/query), and `get_artwork` for one artwork's details.",
  tools: [searchArtists, getArtist, listArtworks, getArtwork],
});
