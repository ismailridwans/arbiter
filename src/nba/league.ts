/**
 * NBA league reference data: teams → conference, plus the Gamma event/tag seeds
 * used to assemble the live market universe. This module is the ONLY NBA-specific
 * surface in the engine — swapping it (e.g. for soccer or elections) is how
 * Coherence generalizes to other domains.
 */

export type Conference = 'East' | 'West';

export const NBA_TEAMS: Record<string, Conference> = {
  'Atlanta Hawks': 'East',
  'Boston Celtics': 'East',
  'Brooklyn Nets': 'East',
  'Charlotte Hornets': 'East',
  'Chicago Bulls': 'East',
  'Cleveland Cavaliers': 'East',
  'Detroit Pistons': 'East',
  'Indiana Pacers': 'East',
  'Miami Heat': 'East',
  'Milwaukee Bucks': 'East',
  'New York Knicks': 'East',
  'Orlando Magic': 'East',
  'Philadelphia 76ers': 'East',
  'Toronto Raptors': 'East',
  'Washington Wizards': 'East',
  'Dallas Mavericks': 'West',
  'Denver Nuggets': 'West',
  'Golden State Warriors': 'West',
  'Houston Rockets': 'West',
  'Los Angeles Clippers': 'West',
  'Los Angeles Lakers': 'West',
  'Memphis Grizzlies': 'West',
  'Minnesota Timberwolves': 'West',
  'New Orleans Pelicans': 'West',
  'Oklahoma City Thunder': 'West',
  'Phoenix Suns': 'West',
  'Portland Trail Blazers': 'West',
  'Sacramento Kings': 'West',
  'San Antonio Spurs': 'West',
  'Utah Jazz': 'West',
};

/** Verified live Gamma event slugs that seed the universe. */
export const SEED_EVENT_SLUGS = [
  '2026-nba-champion',
  'nba-playoffs-eastern-conference-champion',
  'nba-playoffs-western-conference-champion',
];

/** NBA (745) + 2026 NBA Playoffs (104587): tag-based discovery for series/finals. */
export const NBA_TAG_IDS = ['745', '104587'];

const ALIASES: Record<string, string> = {
  'la clippers': 'Los Angeles Clippers',
  'la lakers': 'Los Angeles Lakers',
  'okc thunder': 'Oklahoma City Thunder',
  'gs warriors': 'Golden State Warriors',
};

/** Resolve a free-text team mention to a canonical NBA team name, if possible. */
export function canonicalTeam(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const raw = text.trim();
  if (NBA_TEAMS[raw]) return raw;
  const lower = raw.toLowerCase();
  if (ALIASES[lower]) return ALIASES[lower];
  for (const name of Object.keys(NBA_TEAMS)) {
    if (lower === name.toLowerCase()) return name;
  }
  // Full-name containment (e.g. a question that embeds the team name).
  for (const name of Object.keys(NBA_TEAMS)) {
    if (lower.includes(name.toLowerCase())) return name;
  }
  // Nickname match on the last token (e.g. "thunder", "76ers").
  for (const name of Object.keys(NBA_TEAMS)) {
    const nickname = name.split(' ').at(-1)!.toLowerCase();
    if (new RegExp(`\\b${nickname}\\b`).test(lower)) return name;
  }
  return undefined;
}

export function conferenceOf(team: string): Conference | undefined {
  return NBA_TEAMS[team];
}

/** Kalshi ticker abbreviation (KXNBA-26-XXX) → canonical NBA team name. */
export const KALSHI_TEAM_ABBR: Record<string, string> = {
  ATL: 'Atlanta Hawks',
  BOS: 'Boston Celtics',
  BKN: 'Brooklyn Nets',
  BRK: 'Brooklyn Nets',
  CHA: 'Charlotte Hornets',
  CHI: 'Chicago Bulls',
  CLE: 'Cleveland Cavaliers',
  DAL: 'Dallas Mavericks',
  DEN: 'Denver Nuggets',
  DET: 'Detroit Pistons',
  GSW: 'Golden State Warriors',
  GS: 'Golden State Warriors',
  HOU: 'Houston Rockets',
  IND: 'Indiana Pacers',
  LAC: 'Los Angeles Clippers',
  LAL: 'Los Angeles Lakers',
  MEM: 'Memphis Grizzlies',
  MIA: 'Miami Heat',
  MIL: 'Milwaukee Bucks',
  MIN: 'Minnesota Timberwolves',
  NOP: 'New Orleans Pelicans',
  NO: 'New Orleans Pelicans',
  NYK: 'New York Knicks',
  OKC: 'Oklahoma City Thunder',
  ORL: 'Orlando Magic',
  PHI: 'Philadelphia 76ers',
  PHX: 'Phoenix Suns',
  PHO: 'Phoenix Suns',
  POR: 'Portland Trail Blazers',
  SAC: 'Sacramento Kings',
  SAS: 'San Antonio Spurs',
  TOR: 'Toronto Raptors',
  UTA: 'Utah Jazz',
  WAS: 'Washington Wizards',
};
