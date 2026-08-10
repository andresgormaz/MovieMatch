import "dotenv/config";
import { seedCatalog } from "../src/lib/seedCatalog";
import { prisma } from "../src/lib/prisma";

async function main() {
  const forced = process.argv.includes("--force");
  const result = await seedCatalog({ force: forced });

  if (result.skipped) {
    console.log(`Ya hay ${result.titles} títulos cargados -> nada que hacer (usá --force para forzar).`);
    return;
  }

  const source =
    result.mode === "tmdb"
      ? "TMDB (catálogo real)"
      : "dataset local curado (sin TMDB_API_KEY configurada)";
  console.log(`${source}: ${result.titles} títulos y ${result.people} personas cargadas.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
