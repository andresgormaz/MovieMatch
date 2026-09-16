export const COUNTRY_NAMES: Record<string, string> = {
  US: "Estados Unidos", GB: "Reino Unido", FR: "Francia", ES: "España", MX: "México",
  AR: "Argentina", BR: "Brasil", JP: "Japón", KR: "Corea del Sur", DE: "Alemania",
  IT: "Italia", NZ: "Nueva Zelanda", AU: "Australia", CA: "Canadá", IN: "India",
  CN: "China", SE: "Suecia", DK: "Dinamarca", RU: "Rusia", CL: "Chile", CO: "Colombia",
  PE: "Perú", UY: "Uruguay", VE: "Venezuela", CU: "Cuba", PT: "Portugal", BE: "Bélgica",
  NL: "Países Bajos", IE: "Irlanda", ZA: "Sudáfrica", EG: "Egipto", TH: "Tailandia",
  PH: "Filipinas", ID: "Indonesia", MY: "Malasia", SG: "Singapur", TR: "Turquía",
  PL: "Polonia", CZ: "República Checa", HU: "Hungría", AT: "Austria", CH: "Suiza",
  NO: "Noruega", FI: "Finlandia", IS: "Islandia", GR: "Grecia", IL: "Israel",
  SA: "Arabia Saudita", AE: "Emiratos Árabes Unidos", NG: "Nigeria", KE: "Kenia",
  HK: "Hong Kong", TW: "Taiwán", VN: "Vietnam", PK: "Pakistán", BD: "Bangladés",
  RO: "Rumania", UA: "Ucrania", RS: "Serbia", HR: "Croacia", IR: "Irán", LB: "Líbano",
  EC: "Ecuador", BO: "Bolivia", PY: "Paraguay", DO: "República Dominicana",
  GT: "Guatemala", CR: "Costa Rica", PA: "Panamá", HN: "Honduras", SV: "El Salvador",
  NI: "Nicaragua", PR: "Puerto Rico",
};

export function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}

// Countries we fetch/store streaming-availability data for (TMDB returns
// every region in one response; we only keep these to bound storage).
// Covers the Spanish-speaking Americas + Brazil, Spain and the US.
export const STREAMING_REGIONS = [
  "CL", "MX", "AR", "CO", "PE", "BR", "UY", "VE", "EC", "BO", "PY",
  "DO", "GT", "CR", "PA", "HN", "SV", "NI", "PR", "US", "ES",
];
