// Dataset curado a mano (sin depender de TMDB) para poder levantar la app
// sin ninguna API key. Cubre géneros, décadas y países variados, priorizando
// títulos muy vistos/conocidos (mayor probabilidad de que el usuario los
// haya visto) primero -> onboardingRank se asigna por orden de aparición.
//
// Al correr `npm run import:tmdb` con una TMDB_API_KEY real, este dataset
// se reemplaza por datos reales de TMDB (pósters, elenco completo, etc).

export type FallbackTitleType = "MOVIE" | "SERIES";

export interface FallbackTitle {
  name: string;
  year: number;
  type: FallbackTitleType;
  genres: string[];
  country: string; // ISO 3166-1 alpha-2
  director: string; // director (movie) or lead creator (series)
  cast: string[];
}

export const FALLBACK_GENRES = [
  { id: 28, name: "Acción" },
  { id: 12, name: "Aventura" },
  { id: 16, name: "Animación" },
  { id: 35, name: "Comedia" },
  { id: 80, name: "Crimen" },
  { id: 99, name: "Documental" },
  { id: 18, name: "Drama" },
  { id: 10751, name: "Familiar" },
  { id: 14, name: "Fantasía" },
  { id: 36, name: "Historia" },
  { id: 27, name: "Terror" },
  { id: 10402, name: "Música" },
  { id: 9648, name: "Misterio" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Ciencia ficción" },
  { id: 53, name: "Suspense" },
  { id: 10752, name: "Bélica" },
  { id: 37, name: "Western" },
];

const GENRE_NAME_TO_ID = new Map(FALLBACK_GENRES.map((g) => [g.name, g.id]));

export function fallbackGenreIds(names: string[]): number[] {
  return names.map((n) => {
    const id = GENRE_NAME_TO_ID.get(n);
    if (!id) throw new Error(`Género desconocido en fallback dataset: ${n}`);
    return id;
  });
}

export const FALLBACK_TITLES: FallbackTitle[] = [
  { name: "El padrino", year: 1972, type: "MOVIE", genres: ["Crimen", "Drama"], country: "US", director: "Francis Ford Coppola", cast: ["Marlon Brando", "Al Pacino", "James Caan", "Diane Keaton"] },
  { name: "Forrest Gump", year: 1994, type: "MOVIE", genres: ["Drama", "Romance"], country: "US", director: "Robert Zemeckis", cast: ["Tom Hanks", "Robin Wright", "Gary Sinise"] },
  { name: "Titanic", year: 1997, type: "MOVIE", genres: ["Drama", "Romance"], country: "US", director: "James Cameron", cast: ["Leonardo DiCaprio", "Kate Winslet", "Billy Zane"] },
  { name: "El señor de los anillos: La comunidad del anillo", year: 2001, type: "MOVIE", genres: ["Aventura", "Fantasía"], country: "NZ", director: "Peter Jackson", cast: ["Elijah Wood", "Ian McKellen", "Viggo Mortensen", "Orlando Bloom"] },
  { name: "El señor de los anillos: El retorno del rey", year: 2003, type: "MOVIE", genres: ["Aventura", "Fantasía"], country: "NZ", director: "Peter Jackson", cast: ["Elijah Wood", "Ian McKellen", "Viggo Mortensen", "Sean Astin"] },
  { name: "Pulp Fiction", year: 1994, type: "MOVIE", genres: ["Crimen", "Drama"], country: "US", director: "Quentin Tarantino", cast: ["John Travolta", "Samuel L. Jackson", "Uma Thurman", "Bruce Willis"] },
  { name: "El caballero oscuro", year: 2008, type: "MOVIE", genres: ["Acción", "Crimen", "Drama"], country: "US", director: "Christopher Nolan", cast: ["Christian Bale", "Heath Ledger", "Aaron Eckhart"] },
  { name: "Origen", year: 2010, type: "MOVIE", genres: ["Ciencia ficción", "Suspense"], country: "US", director: "Christopher Nolan", cast: ["Leonardo DiCaprio", "Joseph Gordon-Levitt", "Ellen Page"] },
  { name: "Interestelar", year: 2014, type: "MOVIE", genres: ["Ciencia ficción", "Drama"], country: "US", director: "Christopher Nolan", cast: ["Matthew McConaughey", "Anne Hathaway", "Jessica Chastain"] },
  { name: "Matrix", year: 1999, type: "MOVIE", genres: ["Ciencia ficción", "Acción"], country: "US", director: "Lana Wachowski", cast: ["Keanu Reeves", "Laurence Fishburne", "Carrie-Anne Moss"] },
  { name: "Fight Club", year: 1999, type: "MOVIE", genres: ["Drama"], country: "US", director: "David Fincher", cast: ["Brad Pitt", "Edward Norton", "Helena Bonham Carter"] },
  { name: "Se7en", year: 1995, type: "MOVIE", genres: ["Crimen", "Misterio", "Suspense"], country: "US", director: "David Fincher", cast: ["Brad Pitt", "Morgan Freeman", "Gwyneth Paltrow"] },
  { name: "Goodfellas", year: 1990, type: "MOVIE", genres: ["Crimen", "Drama"], country: "US", director: "Martin Scorsese", cast: ["Robert De Niro", "Ray Liotta", "Joe Pesci"] },
  { name: "El lobo de Wall Street", year: 2013, type: "MOVIE", genres: ["Comedia", "Crimen", "Drama"], country: "US", director: "Martin Scorsese", cast: ["Leonardo DiCaprio", "Jonah Hill", "Margot Robbie"] },
  { name: "Gladiator", year: 2000, type: "MOVIE", genres: ["Acción", "Drama", "Historia"], country: "US", director: "Ridley Scott", cast: ["Russell Crowe", "Joaquin Phoenix", "Connie Nielsen"] },
  { name: "Salvar al soldado Ryan", year: 1998, type: "MOVIE", genres: ["Bélica", "Drama"], country: "US", director: "Steven Spielberg", cast: ["Tom Hanks", "Matt Damon", "Tom Sizemore"] },
  { name: "La lista de Schindler", year: 1993, type: "MOVIE", genres: ["Bélica", "Drama", "Historia"], country: "US", director: "Steven Spielberg", cast: ["Liam Neeson", "Ben Kingsley", "Ralph Fiennes"] },
  { name: "Jurassic Park", year: 1993, type: "MOVIE", genres: ["Aventura", "Ciencia ficción"], country: "US", director: "Steven Spielberg", cast: ["Sam Neill", "Laura Dern", "Jeff Goldblum"] },
  { name: "Volver al futuro", year: 1985, type: "MOVIE", genres: ["Aventura", "Comedia", "Ciencia ficción"], country: "US", director: "Robert Zemeckis", cast: ["Michael J. Fox", "Christopher Lloyd"] },
  { name: "Star Wars: Episodio IV - Una nueva esperanza", year: 1977, type: "MOVIE", genres: ["Aventura", "Ciencia ficción"], country: "US", director: "George Lucas", cast: ["Mark Hamill", "Harrison Ford", "Carrie Fisher"] },
  { name: "El imperio contraataca", year: 1980, type: "MOVIE", genres: ["Aventura", "Ciencia ficción"], country: "US", director: "Irvin Kershner", cast: ["Mark Hamill", "Harrison Ford", "Carrie Fisher"] },
  { name: "Los infiltrados", year: 2006, type: "MOVIE", genres: ["Crimen", "Drama", "Suspense"], country: "US", director: "Martin Scorsese", cast: ["Leonardo DiCaprio", "Matt Damon", "Jack Nicholson"] },
  { name: "Sospechosos habituales", year: 1995, type: "MOVIE", genres: ["Crimen", "Misterio", "Suspense"], country: "US", director: "Bryan Singer", cast: ["Kevin Spacey", "Gabriel Byrne", "Benicio del Toro"] },
  { name: "El silencio de los corderos", year: 1991, type: "MOVIE", genres: ["Crimen", "Terror", "Suspense"], country: "US", director: "Jonathan Demme", cast: ["Jodie Foster", "Anthony Hopkins"] },
  { name: "American History X", year: 1998, type: "MOVIE", genres: ["Drama"], country: "US", director: "Tony Kaye", cast: ["Edward Norton", "Edward Furlong"] },
  { name: "El club de la lucha", year: 1999, type: "MOVIE", genres: ["Drama"], country: "US", director: "David Fincher", cast: ["Brad Pitt", "Edward Norton"] },
  { name: "Cadena perpetua", year: 1994, type: "MOVIE", genres: ["Drama"], country: "US", director: "Frank Darabont", cast: ["Tim Robbins", "Morgan Freeman"] },
  { name: "Whiplash", year: 2014, type: "MOVIE", genres: ["Drama", "Música"], country: "US", director: "Damien Chazelle", cast: ["Miles Teller", "J.K. Simmons"] },
  { name: "La La Land", year: 2016, type: "MOVIE", genres: ["Comedia", "Drama", "Música", "Romance"], country: "US", director: "Damien Chazelle", cast: ["Ryan Gosling", "Emma Stone"] },
  { name: "Parásitos", year: 2019, type: "MOVIE", genres: ["Comedia", "Drama", "Suspense"], country: "KR", director: "Bong Joon-ho", cast: ["Song Kang-ho", "Lee Sun-kyun", "Cho Yeo-jeong"] },
  { name: "El viaje de Chihiro", year: 2001, type: "MOVIE", genres: ["Animación", "Aventura", "Fantasía"], country: "JP", director: "Hayao Miyazaki", cast: ["Rumi Hiiragi", "Miyu Irino"] },
  { name: "Your Name", year: 2016, type: "MOVIE", genres: ["Animación", "Drama", "Fantasía", "Romance"], country: "JP", director: "Makoto Shinkai", cast: ["Ryunosuke Kamiki", "Mone Kamishiraishi"] },
  { name: "Coco", year: 2017, type: "MOVIE", genres: ["Animación", "Familiar", "Fantasía", "Música"], country: "US", director: "Lee Unkrich", cast: ["Anthony Gonzalez", "Gael García Bernal"] },
  { name: "Up", year: 2009, type: "MOVIE", genres: ["Animación", "Aventura", "Comedia", "Familiar"], country: "US", director: "Pete Docter", cast: ["Edward Asner", "Jordan Nagai"] },
  { name: "Toy Story", year: 1995, type: "MOVIE", genres: ["Animación", "Aventura", "Comedia", "Familiar"], country: "US", director: "John Lasseter", cast: ["Tom Hanks", "Tim Allen"] },
  { name: "El rey león", year: 1994, type: "MOVIE", genres: ["Animación", "Aventura", "Drama", "Familiar"], country: "US", director: "Roger Allers", cast: ["Matthew Broderick", "James Earl Jones"] },
  { name: "Spirited: Amor a segunda vista", year: 2022, type: "MOVIE", genres: ["Comedia", "Música", "Fantasía"], country: "US", director: "Sean Anders", cast: ["Will Ferrell", "Ryan Reynolds"] },
  { name: "Amelie", year: 2001, type: "MOVIE", genres: ["Comedia", "Romance"], country: "FR", director: "Jean-Pierre Jeunet", cast: ["Audrey Tautou", "Mathieu Kassovitz"] },
  { name: "La vida es bella", year: 1997, type: "MOVIE", genres: ["Comedia", "Drama", "Bélica"], country: "IT", director: "Roberto Benigni", cast: ["Roberto Benigni", "Nicoletta Braschi"] },
  { name: "Cinema Paradiso", year: 1988, type: "MOVIE", genres: ["Drama", "Romance"], country: "IT", director: "Giuseppe Tornatore", cast: ["Philippe Noiret", "Salvatore Cascio"] },
  { name: "Ciudad de Dios", year: 2002, type: "MOVIE", genres: ["Crimen", "Drama"], country: "BR", director: "Fernando Meirelles", cast: ["Alexandre Rodrigues", "Leandro Firmino"] },
  { name: "El laberinto del fauno", year: 2006, type: "MOVIE", genres: ["Drama", "Fantasía", "Bélica"], country: "MX", director: "Guillermo del Toro", cast: ["Ivana Baquero", "Sergi López"] },
  { name: "Roma", year: 2018, type: "MOVIE", genres: ["Drama"], country: "MX", director: "Alfonso Cuarón", cast: ["Yalitza Aparicio", "Marina de Tavira"] },
  { name: "Amores perros", year: 2000, type: "MOVIE", genres: ["Drama"], country: "MX", director: "Alejandro González Iñárritu", cast: ["Gael García Bernal", "Emilio Echevarría"] },
  { name: "El secreto de sus ojos", year: 2009, type: "MOVIE", genres: ["Drama", "Misterio", "Romance"], country: "AR", director: "Juan José Campanella", cast: ["Ricardo Darín", "Soledad Villamil"] },
  { name: "Relatos salvajes", year: 2014, type: "MOVIE", genres: ["Comedia", "Drama", "Crimen"], country: "AR", director: "Damián Szifron", cast: ["Ricardo Darín", "Leonardo Sbaraglia"] },
  { name: "Mar adentro", year: 2004, type: "MOVIE", genres: ["Drama"], country: "ES", director: "Alejandro Amenábar", cast: ["Javier Bardem", "Belén Rueda"] },
  { name: "Volver", year: 2006, type: "MOVIE", genres: ["Comedia", "Drama"], country: "ES", director: "Pedro Almodóvar", cast: ["Penélope Cruz", "Carmen Maura"] },
  { name: "Todo sobre mi madre", year: 1999, type: "MOVIE", genres: ["Drama"], country: "ES", director: "Pedro Almodóvar", cast: ["Cecilia Roth", "Penélope Cruz"] },
  { name: "REC", year: 2007, type: "MOVIE", genres: ["Terror", "Suspense"], country: "ES", director: "Jaume Balagueró", cast: ["Manuela Velasco"] },
  { name: "El hoyo", year: 2019, type: "MOVIE", genres: ["Ciencia ficción", "Terror", "Drama"], country: "ES", director: "Galder Gaztelu-Urrutia", cast: ["Iván Massagué", "Zorion Eguileor"] },
  { name: "Amadeus", year: 1984, type: "MOVIE", genres: ["Drama", "Historia", "Música"], country: "US", director: "Milos Forman", cast: ["F. Murray Abraham", "Tom Hulce"] },
  { name: "Casablanca", year: 1942, type: "MOVIE", genres: ["Drama", "Romance", "Bélica"], country: "US", director: "Michael Curtiz", cast: ["Humphrey Bogart", "Ingrid Bergman"] },
  { name: "Psicosis", year: 1960, type: "MOVIE", genres: ["Terror", "Misterio", "Suspense"], country: "US", director: "Alfred Hitchcock", cast: ["Anthony Perkins", "Janet Leigh"] },
  { name: "2001: Una odisea del espacio", year: 1968, type: "MOVIE", genres: ["Ciencia ficción", "Aventura"], country: "US", director: "Stanley Kubrick", cast: ["Keir Dullea", "Gary Lockwood"] },
  { name: "La naranja mecánica", year: 1971, type: "MOVIE", genres: ["Crimen", "Drama", "Ciencia ficción"], country: "GB", director: "Stanley Kubrick", cast: ["Malcolm McDowell"] },
  { name: "Blade Runner 2049", year: 2017, type: "MOVIE", genres: ["Ciencia ficción", "Drama"], country: "US", director: "Denis Villeneuve", cast: ["Ryan Gosling", "Harrison Ford", "Ana de Armas"] },
  { name: "Dune", year: 2021, type: "MOVIE", genres: ["Ciencia ficción", "Aventura"], country: "US", director: "Denis Villeneuve", cast: ["Timothée Chalamet", "Zendaya", "Rebecca Ferguson"] },
  { name: "Mad Max: Furia en la carretera", year: 2015, type: "MOVIE", genres: ["Acción", "Aventura", "Ciencia ficción"], country: "AU", director: "George Miller", cast: ["Tom Hardy", "Charlize Theron"] },
  { name: "John Wick", year: 2014, type: "MOVIE", genres: ["Acción", "Suspense", "Crimen"], country: "US", director: "Chad Stahelski", cast: ["Keanu Reeves", "Michael Nyqvist"] },
  { name: "Misión imposible: Sentencia mortal", year: 2023, type: "MOVIE", genres: ["Acción", "Aventura", "Suspense"], country: "US", director: "Christopher McQuarrie", cast: ["Tom Cruise", "Hayley Atwell"] },
  { name: "Vengadores: Endgame", year: 2019, type: "MOVIE", genres: ["Acción", "Aventura", "Ciencia ficción"], country: "US", director: "Anthony Russo", cast: ["Robert Downey Jr.", "Chris Evans", "Scarlett Johansson"] },
  { name: "Vengadores: Infinity War", year: 2018, type: "MOVIE", genres: ["Acción", "Aventura", "Ciencia ficción"], country: "US", director: "Anthony Russo", cast: ["Robert Downey Jr.", "Chris Hemsworth", "Chris Evans"] },
  { name: "Spider-Man: Un nuevo universo", year: 2018, type: "MOVIE", genres: ["Animación", "Acción", "Aventura"], country: "US", director: "Bob Persichetti", cast: ["Shameik Moore", "Jake Johnson"] },
  { name: "Joker", year: 2019, type: "MOVIE", genres: ["Crimen", "Drama", "Suspense"], country: "US", director: "Todd Phillips", cast: ["Joaquin Phoenix", "Robert De Niro"] },
  { name: "Érase una vez en Hollywood", year: 2019, type: "MOVIE", genres: ["Comedia", "Drama"], country: "US", director: "Quentin Tarantino", cast: ["Leonardo DiCaprio", "Brad Pitt", "Margot Robbie"] },
  { name: "Kill Bill: Volumen 1", year: 2003, type: "MOVIE", genres: ["Acción", "Crimen"], country: "US", director: "Quentin Tarantino", cast: ["Uma Thurman", "Lucy Liu"] },
  { name: "Django desencadenado", year: 2012, type: "MOVIE", genres: ["Drama", "Western"], country: "US", director: "Quentin Tarantino", cast: ["Jamie Foxx", "Christoph Waltz", "Leonardo DiCaprio"] },
  { name: "Malditos bastardos", year: 2009, type: "MOVIE", genres: ["Aventura", "Drama", "Bélica"], country: "US", director: "Quentin Tarantino", cast: ["Brad Pitt", "Christoph Waltz"] },
  { name: "Uno de los nuestros", year: 1990, type: "MOVIE", genres: ["Crimen", "Drama"], country: "US", director: "Martin Scorsese", cast: ["Robert De Niro", "Ray Liotta"] },
  { name: "Taxi Driver", year: 1976, type: "MOVIE", genres: ["Crimen", "Drama"], country: "US", director: "Martin Scorsese", cast: ["Robert De Niro", "Jodie Foster"] },
  { name: "Her", year: 2013, type: "MOVIE", genres: ["Drama", "Romance", "Ciencia ficción"], country: "US", director: "Spike Jonze", cast: ["Joaquin Phoenix", "Scarlett Johansson"] },
  { name: "Eterno resplandor de una mente sin recuerdos", year: 2004, type: "MOVIE", genres: ["Drama", "Romance", "Ciencia ficción"], country: "US", director: "Michel Gondry", cast: ["Jim Carrey", "Kate Winslet"] },
  { name: "La red social", year: 2010, type: "MOVIE", genres: ["Drama"], country: "US", director: "David Fincher", cast: ["Jesse Eisenberg", "Andrew Garfield"] },
  { name: "Perdida", year: 2014, type: "MOVIE", genres: ["Drama", "Misterio", "Suspense"], country: "US", director: "David Fincher", cast: ["Ben Affleck", "Rosamund Pike"] },
  { name: "No es país para viejos", year: 2007, type: "MOVIE", genres: ["Crimen", "Drama", "Suspense"], country: "US", director: "Ethan Coen", cast: ["Tommy Lee Jones", "Javier Bardem", "Josh Brolin"] },
  { name: "El gran Lebowski", year: 1998, type: "MOVIE", genres: ["Comedia", "Crimen"], country: "US", director: "Joel Coen", cast: ["Jeff Bridges", "John Goodman"] },

  { name: "Breaking Bad", year: 2008, type: "SERIES", genres: ["Crimen", "Drama", "Suspense"], country: "US", director: "Vince Gilligan", cast: ["Bryan Cranston", "Aaron Paul", "Anna Gunn"] },
  { name: "Better Call Saul", year: 2015, type: "SERIES", genres: ["Crimen", "Drama"], country: "US", director: "Vince Gilligan", cast: ["Bob Odenkirk", "Rhea Seehorn", "Jonathan Banks"] },
  { name: "Juego de tronos", year: 2011, type: "SERIES", genres: ["Aventura", "Drama", "Fantasía"], country: "US", director: "David Benioff", cast: ["Emilia Clarke", "Kit Harington", "Peter Dinklage"] },
  { name: "The Wire", year: 2002, type: "SERIES", genres: ["Crimen", "Drama"], country: "US", director: "David Simon", cast: ["Dominic West", "Idris Elba"] },
  { name: "Los Soprano", year: 1999, type: "SERIES", genres: ["Crimen", "Drama"], country: "US", director: "David Chase", cast: ["James Gandolfini", "Edie Falco"] },
  { name: "Stranger Things", year: 2016, type: "SERIES", genres: ["Drama", "Fantasía", "Terror"], country: "US", director: "Matt Duffer", cast: ["Millie Bobby Brown", "Finn Wolfhard", "Winona Ryder"] },
  { name: "The Office", year: 2005, type: "SERIES", genres: ["Comedia"], country: "US", director: "Greg Daniels", cast: ["Steve Carell", "John Krasinski", "Jenna Fischer"] },
  { name: "Friends", year: 1994, type: "SERIES", genres: ["Comedia", "Romance"], country: "US", director: "David Crane", cast: ["Jennifer Aniston", "Courteney Cox", "Matthew Perry"] },
  { name: "The Big Bang Theory", year: 2007, type: "SERIES", genres: ["Comedia"], country: "US", director: "Chuck Lorre", cast: ["Jim Parsons", "Kaley Cuoco", "Johnny Galecki"] },
  { name: "Dark", year: 2017, type: "SERIES", genres: ["Drama", "Misterio", "Ciencia ficción"], country: "DE", director: "Baran bo Odar", cast: ["Louis Hofmann", "Karoline Eichhorn"] },
  { name: "La casa de papel", year: 2017, type: "SERIES", genres: ["Crimen", "Drama", "Suspense"], country: "ES", director: "Álex Pina", cast: ["Úrsula Corberó", "Álvaro Morte", "Itziar Ituño"] },
  { name: "Élite", year: 2018, type: "SERIES", genres: ["Crimen", "Drama"], country: "ES", director: "Carlos Montero", cast: ["Miguel Bernardeau", "Itzan Escamilla"] },
  { name: "Chernobyl", year: 2019, type: "SERIES", genres: ["Drama", "Historia"], country: "US", director: "Craig Mazin", cast: ["Jared Harris", "Stellan Skarsgård"] },
  { name: "True Detective", year: 2014, type: "SERIES", genres: ["Crimen", "Drama", "Misterio"], country: "US", director: "Nic Pizzolatto", cast: ["Matthew McConaughey", "Woody Harrelson"] },
  { name: "Black Mirror", year: 2011, type: "SERIES", genres: ["Ciencia ficción", "Drama", "Suspense"], country: "GB", director: "Charlie Brooker", cast: ["Various"] },
  { name: "Sherlock", year: 2010, type: "SERIES", genres: ["Crimen", "Drama", "Misterio"], country: "GB", director: "Steven Moffat", cast: ["Benedict Cumberbatch", "Martin Freeman"] },
  { name: "The Crown", year: 2016, type: "SERIES", genres: ["Drama", "Historia"], country: "GB", director: "Peter Morgan", cast: ["Claire Foy", "Olivia Colman"] },
  { name: "Fleabag", year: 2016, type: "SERIES", genres: ["Comedia", "Drama"], country: "GB", director: "Phoebe Waller-Bridge", cast: ["Phoebe Waller-Bridge"] },
  { name: "Peaky Blinders", year: 2013, type: "SERIES", genres: ["Crimen", "Drama"], country: "GB", director: "Steven Knight", cast: ["Cillian Murphy", "Helen McCrory"] },
  { name: "The Mandalorian", year: 2019, type: "SERIES", genres: ["Aventura", "Ciencia ficción"], country: "US", director: "Jon Favreau", cast: ["Pedro Pascal"] },
  { name: "Succession", year: 2018, type: "SERIES", genres: ["Drama"], country: "US", director: "Jesse Armstrong", cast: ["Brian Cox", "Jeremy Strong", "Sarah Snook"] },
];
