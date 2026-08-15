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

  if (result.mode === "tmdb") {
    console.log(
      `TMDB: +${result.titles} títulos este lote (${result.moviesTotal} películas / ${result.seriesTotal} series en total), ${result.people} personas nuevas.`,
    );
    console.log(result.done ? "Catálogo completo, no quedan más páginas." : "Corré de nuevo para seguir sumando más.");
    return;
  }

  console.log(`Dataset local: ${result.titles} títulos y ${result.people} personas cargadas.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
