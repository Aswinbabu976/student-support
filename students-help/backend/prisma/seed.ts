import { PrismaClient } from '@prisma/client';
import { ensureSkillCatalog } from '../src/modules/skills/skill-catalog.js';

const prisma = new PrismaClient();

await ensureSkillCatalog(prisma);
await prisma.$disconnect();
