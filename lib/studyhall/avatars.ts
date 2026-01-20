export type Avatar = {
  id: string;
  label: string;
  src: string;
};

export const avatars: Avatar[] = [
  { id: "wizard", label: "Merlin, the Water Mage", src: "/avatars/wizard.png" },
  { id: "knight", label: "Michael, of the Iron Night", src: "/avatars/knight.png" },
  { id: "archer", label: "Circe, the Elven Assassin", src: "/avatars/archer.jpeg" },
  { id: "rogue", label: "Russell, the Feline Rogue", src: "/avatars/rogue.jpeg" },
  { id: "pepe", label: "Cinder, the Koala Mage", src: "/avatars/pepe.png" },
  { id: "rider", label: "Daniel, the Great Spartan", src: "/avatars/rider.png" },
  { id: "paladin", label: "Bartholomew, the Sun Crusader", src: "/avatars/paladin.png" },
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
