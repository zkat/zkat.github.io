// Campaign
export interface ICampaign {
  id: string;
  name: string;
  // TODO
  //sharedAssets: ISGAsset[];
  characters: ICharacter[];
  // TODO
  // progressTracks: IProgressTrack[];
  journal: IJournalEntry[];
  lore: ILoreEntry[];
  // TODO
  //truths: ITruths;
  // TODO
  // sectors: ISector[];
  // TODO
  // factions: IFaction[];
}

//----- Character -----

// Character
export interface ICharacter {
  name: string;
  pronouns?: string;
  callsign?: string;
  characteristics?: string;
  // TODO
  // location: string;
  stats?: IStats;
  tracks?: ITracks;
  impacts?: IImpacts;
  legacies?: {
    quests: ILegacyTrack;
    bonds: ILegacyTrack;
    discoveries: ILegacyTrack;
  };
  vows?: IProgressTrack[];
  clocks?: IClock[];
  gear?: string;
  assets?: ISGAsset[];
}

// Stats and Tracks
export interface IStats {
  edge: number;
  heart: number;
  iron: number;
  shadow: number;
  wits: number;
}

export interface IMomentum extends ITrack {
  reset: number;
}

export interface ITrack {
  value: number;
  max: number;
  min: number;
}

export interface ITracks {
  health: ITrack;
  spirit: ITrack;
  supply: ITrack;
  momentum: IMomentum;
}

// Conditions and debilities
export interface IImpact {
  name: string;
  marked: boolean;
}

export interface IImpacts {
  [index: string]: IImpact[];
}

// Progress Tracks
export interface IDiff {
  label: string;
  mark: number;
  harm: number;
}

export interface IProgressTrack {
  name: string;
  difficulty: number;
  boxes: number[];
  clocks: string[];
  notes?: string;
}

export interface ILegacyBox {
  ticks: number;
  xp: boolean[];
}

export interface ILegacyTrack {
  plus10: boolean;
  boxes: ILegacyBox[];
}

export interface IClock {
  id: string;
  name: string;
  segments: number;
  filled: number;
  advance: EAtO;
  roll: number;
  complete?: boolean;
}

export enum EAtO {
  AlmostCertain = "Almost Certain",
  Likely = "Likely",
  FiftyFifty = "Fifty-fifty",
  Unlikely = "Unlikely",
  SmallChance = "Small Chance",
  NoRoll = "No Roll",
}

// Assets
export interface ISGAssetInput {
  label: string;
  text: string;
}

export interface ISGAssetItem {
  text: string;
  marked: boolean;
  input?: ISGAssetInput;
}

export interface ISGAsset {
  id?: string;
  icon?: string;
  title: string;
  subtitle?: string;
  input?: ISGAssetInput;
  type: string;
  items: ISGAssetItem[];
  track?: ITrack;
  cursed?: boolean;
  battered?: boolean;
}

// ----- Story ------

// Journal
export interface IJournalEntry {
  title: string;
  content: string;
  pinned?: boolean;
  image?: IImage;
}

// Lore
export interface ILoreEntry {
  title: string;
  tags: string[];
  image?: IImage;
  content: string;
  notes?: string;
}

export interface IImage {
  src: string;
  alt?: string;
  attribution?: string;
}
// ----- World -----

// Stars
export interface IStar {
  name: string;
  description: string;
}

// Truths
export interface ITruths {
  [index: string]: string;
}

// Factions
export interface IFaction {
  id: string;
  name: string;
  type: string;
  influence: string;
  leadership?: string;
  sphere: string;
  projects: string;
  relationships: string;
  quirks: string;
  rumors: string;
  notes: string;
  colour: string;
}
