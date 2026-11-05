import { useEffect, useState } from "react";
import { useData } from "./ui";
import { ScreenBody } from "./ScreenBody";
import { ScreenExercise, ScreenExercises } from "./ScreenExercises";
import { ScreenHistory, ScreenSessionDetail } from "./ScreenHistory";
import { ScreenHome } from "./ScreenHome";
import { ScreenProgress } from "./ScreenProgress";
import { ScreenSession } from "./ScreenSession";
import { ScreenSettings } from "./ScreenSettings";
import { ScreenTemplate } from "./ScreenTemplate";

function useRoute(): string[] {
  const read = () => window.location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

const TABS = [
  { href: "#/", label: "Séance", match: "" },
  { href: "#/historique", label: "Historique", match: "historique" },
  { href: "#/progres", label: "Progrès", match: "progres" },
  { href: "#/corps", label: "Corps", match: "corps" },
];

export function App() {
  const [page, id] = useRoute();
  const data = useData();
  if (!data) return null;

  const screen = (() => {
    switch (page) {
      case "seance":
        return <ScreenSession data={data} />;
      case "modele":
        return <ScreenTemplate data={data} id={id} />;
      case "exercices":
        return <ScreenExercises data={data} />;
      case "exercice":
        return <ScreenExercise data={data} id={id} />;
      case "historique":
        return id ? <ScreenSessionDetail data={data} id={id} /> : <ScreenHistory data={data} />;
      case "progres":
        return <ScreenProgress data={data} />;
      case "corps":
        return <ScreenBody />;
      case "reglages":
        return <ScreenSettings />;
      default:
        return <ScreenHome data={data} />;
    }
  })();

  return (
    <>
      <main className="page">{screen}</main>
      {page !== "seance" && (
        <nav className="tabs" aria-label="Navigation principale">
          {TABS.map((t) => (
            <a
              key={t.href}
              href={t.href}
              className={(page ?? "") === t.match ? "tab active" : "tab"}
            >
              {t.label}
            </a>
          ))}
        </nav>
      )}
    </>
  );
}
