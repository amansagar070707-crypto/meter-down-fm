export type Track = {
  id: string;
  title: string;
  artist: string;
  audioUrl: string;
  plays: number;
  palette: [string, string, string];
};

export const tracks: Track[] = [
  {
    id: "raat-ki-sawari",
    title: "रात की सवारी",
    artist: "Chai Stand Orchestra",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    plays: 1284,
    palette: ["#f0a93e", "#ac3025", "#172e24"],
  },
  {
    id: "ring-road-dil",
    title: "रिंग रोड वाला दिल",
    artist: "Meter Down Band",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    plays: 972,
    palette: ["#d6532d", "#23263d", "#e2b85c"],
  },
  {
    id: "teen-sawari",
    title: "तीन सवारी, एक कहानी",
    artist: "Pili Hari Sessions",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
    plays: 816,
    palette: ["#657b2f", "#ecba3a", "#351a16"],
  },
  {
    id: "aakhri-metro",
    title: "आख़िरी मेट्रो के बाद",
    artist: "Dilli After Dark",
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    plays: 1506,
    palette: ["#253655", "#e2592e", "#d99e42"],
  },
];

export const shayari = [
  "Horn OK Please",
  "बुरी नज़र वाले तेरा मुँह काला",
  "पशुओं को पानी पिलाएं",
  "यूज़ डिपर एट नाइट",
  "जय भोले",
  "धीरे चलें, घर पर कोई इंतज़ार कर रहा है",
];
