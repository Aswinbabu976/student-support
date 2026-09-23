import type { Request, Response } from 'express';
import type { SkillsService } from './skills.service.js';
import { parseCreateStudentSkill, parseUpdateStudentSkill } from './skills.validation.js';

export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  listCatalog = async (_req: Request, res: Response): Promise<void> => {
    const skills = await this.skillsService.listCatalog();
    res.status(200).json({ skills });
  };

  listMine = async (req: Request, res: Response): Promise<void> => {
    const skills = await this.skillsService.listMine(req.auth!.id);
    res.status(200).json({ skills });
  };

  addMine = async (req: Request, res: Response): Promise<void> => {
    const input = parseCreateStudentSkill(req.body);
    const skill = await this.skillsService.addMine(req.auth!.id, input);
    res.status(201).json({ skill });
  };

  updateMine = async (req: Request, res: Response): Promise<void> => {
    const input = parseUpdateStudentSkill(req.body);
    const skill = await this.skillsService.updateMine(
      req.auth!.id,
      String(req.params.studentSkillId),
      input,
    );
    res.status(200).json({ skill });
  };

  removeMine = async (req: Request, res: Response): Promise<void> => {
    await this.skillsService.removeMine(req.auth!.id, String(req.params.studentSkillId));
    res.status(204).send();
  };
}
