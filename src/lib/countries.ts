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
};

export function countryName(code: string): string {
  return COUNTRY_NAMES[code] ?? code;
}
