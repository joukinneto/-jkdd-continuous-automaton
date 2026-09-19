export interface JKDDProject {
  key: string;
  name: string;
  path: string;
}

const projects: JKDDProject[] = [
  {
    key: "jogos-daniel",
    name: "Jogos Daniel",
    path: "C:\\jogos-daniel",
  },
];

export function findProject(task: string): JKDDProject | null {
  const t = task.toLowerCase();

  return (
    projects.find(
      (p) =>
        t.includes(p.key.toLowerCase()) ||
        t.includes(p.name.toLowerCase())
    ) ?? null
  );
}

export function listProjects(): JKDDProject[] {
  return projects;
}