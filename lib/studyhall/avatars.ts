export type Avatar = {
  id: string;
  label: string;
  src: string;
};

export const avatars: Avatar[] = [
  { id: "wizard", label: "Wizard", src: "/avatars/wizard.jpeg" },
  { id: "knight", label: "Knight", src: "/avatars/knight.jpeg" },
  { id: "archer", label: "Archer", src: "/avatars/archer.jpeg" },
  { id: "rogue", label: "Rogue", src: "/avatars/rogue.jpeg" },
  { id: "squire", label: "Squire", src: "/avatars/squire.jpeg" },
  { id: "paladin", label: "Paladin", src: "/avatars/paladin.jpeg" },
];

export const DEFAULT_AVATAR_ID = avatars[0]?.id ?? "wizard";

const avatarMap = new Map(avatars.map((avatar) => [avatar.id, avatar] as const));

export function getAvatarById(id?: string | null) {
  if (!id) return null;
  return avatarMap.get(id) ?? null;
}

export function resolveAvatarId(id?: string | null) {
  if (id && avatarMap.has(id)) return id;
  return DEFAULT_AVATAR_ID;
}
