// TVPI source of truth. Stream resolver and public metadata share these channels.
export interface Channel {
  id: string;
  slug: string;
  name: string;
  logo: string;
  group: string;
}

const TVP_LOGO = "https://s.tvp.pl/files/tvp.pl/images/vod-logo-header.png";

export const CHANNELS: readonly Channel[] = [
  { id: "399697",  slug: "tvp1",        name: "TVP 1 HD",              logo: TVP_LOGO, group: "Polska" },
  { id: "399698",  slug: "tvp2",        name: "TVP 2 HD",              logo: TVP_LOGO, group: "Polska" },
  { id: "399699",  slug: "tvpinfo",     name: "TVP Info",              logo: TVP_LOGO, group: "Polska" },
  { id: "399702",  slug: "tvpsport",    name: "TVP Sport",             logo: TVP_LOGO, group: "Polska" },
  { id: "399721",  slug: "tvpdokument", name: "TVP Dokument",          logo: TVP_LOGO, group: "Polska" },
  { id: "399722",  slug: "tvpnauka",    name: "TVP Nauka",             logo: TVP_LOGO, group: "Polska" },
  { id: "399724",  slug: "tvprozrywka", name: "TVP Rozrywka",          logo: TVP_LOGO, group: "Polska" },
  { id: "399703",  slug: "tvphistoria", name: "TVP Historia",          logo: TVP_LOGO, group: "Polska" },
  { id: "2999109", slug: "tvpmuzyka",   name: "TVP Muzyka i Koncerty", logo: TVP_LOGO, group: "Polska" },
] as const;


export function publicChannels(origin: string) {
  return CHANNELS.map((ch, index) => ({
    id: ch.id, number: String(101 + index), slug: ch.slug,
    name: ch.name, group: ch.group, logo: ch.logo,
    streamUrl: `${origin}/${ch.slug}.m3u8`,
  }));
}

export function buildStablePlaylist(origin: string): string {
  const lines = ["#EXTM3U"];
  for (const ch of CHANNELS) {
    lines.push(
      `#EXTINF:-1 tvg-id="${ch.id}" tvg-name="${ch.name}" tvg-logo="${ch.logo}" group-title="${ch.group}",${ch.name}`,
      `${origin}/${ch.slug}.m3u8`,
    );
  }
  return lines.join("\n") + "\n";
}
