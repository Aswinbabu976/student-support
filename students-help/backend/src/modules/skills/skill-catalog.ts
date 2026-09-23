export const SKILL_CATALOG = [
  { name: 'Driving', slug: 'driving', category: 'Transport' },
  { name: 'Painting', slug: 'painting', category: 'Household' },
  { name: 'Cleaning', slug: 'cleaning', category: 'Household' },
  { name: 'Gardening', slug: 'gardening', category: 'Household' },
  { name: 'Furniture Assembly', slug: 'furniture-assembly', category: 'Household' },
  { name: 'Childcare', slug: 'childcare', category: 'Care' },
  { name: 'IT Support', slug: 'it-support', category: 'Digital' },
  { name: 'Programming', slug: 'programming', category: 'Digital' },
  { name: 'Graphic Design', slug: 'graphic-design', category: 'Digital' },
  { name: 'Photography', slug: 'photography', category: 'Digital' },
] as const;

export async function ensureSkillCatalog(prisma: {
  skill: {
    upsert: (args: {
      where: { slug: string };
      create: { name: string; slug: string; category: string; isActive: boolean };
      update: { name: string; category: string; isActive: boolean };
    }) => Promise<unknown>;
  };
}): Promise<void> {
  for (const skill of SKILL_CATALOG) {
    await prisma.skill.upsert({
      where: { slug: skill.slug },
      create: { ...skill, isActive: true },
      update: { name: skill.name, category: skill.category, isActive: true },
    });
  }
}
