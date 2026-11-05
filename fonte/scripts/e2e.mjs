// Parcours complet au format téléphone, avec Edge sans fenêtre.
// Usage : node scripts/e2e.mjs <url> <dossier des captures>
import { mkdirSync } from "node:fs";
import puppeteer from "puppeteer-core";

const [url = "http://localhost:5240/", shots = "e2e-captures"] = process.argv.slice(2);
mkdirSync(shots, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  headless: true,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });

const problems = [];
page.on("pageerror", (e) => problems.push(`page: ${e.message}`));
page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
page.on("dialog", (d) => d.accept());

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (name) => page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });

async function click(text, selector = "button, a, label.btn") {
  const done = await page.evaluate(
    (text, selector) => {
      const el = [...document.querySelectorAll(selector)].find((e) => e.textContent.trim().includes(text));
      el?.click();
      return !!el;
    },
    text,
    selector,
  );
  if (!done) throw new Error(`Introuvable : ${text}`);
  await wait(150);
}
const body = () => page.evaluate(() => document.body.innerText);
function expect(condition, label) {
  console.log(`${condition ? "OK  " : "ÉCHEC"} ${label}`);
  if (!condition) problems.push(label);
}

async function pick(name) {
  await click("+ Ajouter un exercice");
  await page.type("input.search", name);
  await wait(100);
  await click(name, ".sheet .row");
}

async function fillSet(exercise, setIndex, weight, reps) {
  const handles = await page.$$(".exercise");
  for (const h of handles) {
    const title = await h.$eval("h2", (e) => e.textContent);
    if (title !== exercise) continue;
    const row = (await h.$$(".set:not(.set-title)"))[setIndex];
    const [w, r] = await row.$$("input");
    await w.tap();
    await w.type(weight);
    await r.tap();
    await r.type(reps);
    await (await row.$(".check")).click();
    await wait(100);
    return;
  }
  throw new Error(`Exercice absent : ${exercise}`);
}

await page.goto(url);
await page.waitForSelector(".btn.big");
await shot("01-accueil-vide");
expect((await body()).includes("Fonte"), "l'accueil s'affiche");

// Modèle
await click("+ Nouveau");
await page.type('input[placeholder^="Push"]', "Haut du corps");
await pick("Développé couché");
await pick("Tractions");
await shot("02-modele");
await click("Enregistrer");
await wait(200);
expect((await body()).includes("Haut du corps"), "le modèle est enregistré");

// Première séance
await click("Démarrer", ".card .btn");
await wait(300);
expect((await page.$$(".exercise")).length === 2, "la séance reprend les exercices du modèle");
await fillSet("Développé couché", 0, "80", "10");
expect((await body()).includes("Passer"), "le minuteur de repos démarre après une série");
await fillSet("Développé couché", 1, "82,5", "8");
await fillSet("Tractions", 0, "0", "10");
await shot("03-seance");
await click("Passer");
expect(!(await body()).includes("Passer"), "le repos peut être passé");

// La séance survit à un redémarrage
await page.goto(`${url}#/`);
await page.reload();
await page.waitForSelector(".btn.big");
expect((await body()).includes("Reprendre"), "la séance en cours survit à la fermeture");
await click("Reprendre");
await wait(300);
const kept = await page.$eval(".exercise .set:not(.set-title) input", (e) => e.value);
expect(kept === "80", `la charge saisie est conservée (${kept})`);
const second = await page.$$eval(".exercise .set:not(.set-title) input", (l) => l[3].value);
expect(second === "82,5", `la virgule est conservée (${second})`);

await click("Terminer", ".session-head button");
await wait(400);
const firstBody = await body();
expect(firstBody.includes("Développé couché"), "le bilan affiche la séance");
expect(!firstBody.includes("Nouveaux records"), "pas de record sur une première fois");
expect((firstBody.match(/kg ×/g) ?? []).length === 3, "seules les 3 séries validées sont gardées");
expect(firstBody.includes("80 kg × 10"), "toucher un champ rempli remplace sa valeur");

// Deuxième séance : charges pré-remplies, record battu
await page.goto(`${url}#/`);
await wait(300);
await click("Démarrer", ".card .btn");
await wait(300);
const prefill = await page.$eval(".exercise .set:not(.set-title) input", (e) => e.value);
expect(prefill === "80", `la charge de la dernière fois est pré-remplie (${prefill})`);
await fillSet("Développé couché", 0, "90", "8");
await click("Terminer", ".session-head button");
await wait(400);
await shot("04-bilan-record");
expect((await body()).includes("Nouveaux records"), "le record est détecté");

// Statistiques
await page.goto(`${url}#/progres`);
await wait(400);
await shot("05-progres");
const progress = await body();
expect(progress.includes("Volume par semaine"), "le volume hebdomadaire s'affiche");
expect(progress.includes("Pectoraux"), "les séries par muscle s'affichent");
expect((await page.$$(".chart svg path.mark")).length >= 1, "le graphique contient une barre");

await click("Développé couché", ".row");
await wait(300);
await shot("06-exercice");
expect((await page.$$(".chart svg path.line")).length === 1, "la courbe du 1RM s'affiche après 2 séances");

// Corps
await page.goto(`${url}#/corps`);
await wait(300);
const fields = await page.$$(".form-grid input");
await fields[0].type("78,4");
await click("Enregistrer", ".btn.primary");
await wait(200);
await (await page.$$(".form-grid input"))[0].type("77,9");
await click("Enregistrer", ".btn.primary");
await wait(300);
await shot("07-corps");
expect((await page.$$(".chart svg path.line")).length === 1, "la courbe du poids s'affiche");
expect((await body()).includes("77,9"), "la mesure est enregistrée");

// Historique et réglages
await page.goto(`${url}#/historique`);
await wait(300);
await shot("08-historique");
expect((await page.$$(".cards .card")).length === 2, "l'historique liste les 2 séances");
await page.goto(`${url}#/reglages`);
await wait(300);
await shot("09-reglages");

// Sauvegarde puis restauration à l'identique, et refus d'un mauvais fichier
const backup = await page.evaluate(async () => {
  const open = indexedDB.open("fonte");
  await new Promise((r) => (open.onsuccess = r));
  const tx = open.result.transaction(["exercises", "templates", "sessions", "measurements"]);
  const all = (n) => new Promise((r) => { const q = tx.objectStore(n).getAll(); q.onsuccess = () => r(q.result); });
  const data = { exercises: await all("exercises"), templates: await all("templates"), sessions: await all("sessions"), measurements: await all("measurements") };
  open.result.close();
  return JSON.stringify({ app: "fonte", version: 1, exportedAt: Date.now(), ...data });
});
const { writeFileSync } = await import("node:fs");
writeFileSync(`${shots}/mauvais.json`, '{"app":"autre"}');
writeFileSync(`${shots}/bon.json`, backup);
const input = await page.$('input[type="file"]');
await input.uploadFile(`${shots}/mauvais.json`);
await wait(300);
expect((await body()).includes("pas une sauvegarde Fonte"), "un mauvais fichier est refusé");
await input.uploadFile(`${shots}/bon.json`);
await wait(500);
expect((await body()).includes("Sauvegarde restaurée"), "la sauvegarde est restaurée");
await page.goto(`${url}#/historique`);
await wait(300);
expect((await page.$$(".cards .card")).length === 2, "les 2 séances sont toujours là après restauration");

// Débordement horizontal au format téléphone
for (const route of ["#/", "#/historique", "#/progres", "#/corps", "#/reglages", "#/exercices"]) {
  await page.goto(url + route);
  await wait(200);
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(over <= 0, `pas de débordement sur ${route} (${over}px)`);
}

await browser.close();
if (problems.length) {
  console.log("\nPROBLÈMES :\n" + problems.join("\n"));
  process.exit(1);
}
console.log("\nTout est bon.");
