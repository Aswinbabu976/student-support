import { apiRequest } from '../../../services/api/client';
import type {
  CreateStudentSkillInput,
  SkillCatalogResponse,
  StudentSkillResponse,
  StudentSkillsResponse,
  UpdateStudentSkillInput,
} from '../types';

export function listSkillCatalog(): Promise<SkillCatalogResponse> {
  return apiRequest<SkillCatalogResponse>('/skills');
}

export function listStudentSkills(): Promise<StudentSkillsResponse> {
  return apiRequest<StudentSkillsResponse>('/students/me/skills');
}

export function createStudentSkill(input: CreateStudentSkillInput): Promise<StudentSkillResponse> {
  return apiRequest<StudentSkillResponse>('/students/me/skills', {
    method: 'POST',
    body: JSON.stringify({
      skillId: input.skillId,
      experienceLevel: input.experienceLevel,
      description: input.description,
      certificationReference: input.certificationReference,
    }),
  });
}

export function updateStudentSkill(
  studentSkillId: string,
  input: UpdateStudentSkillInput,
): Promise<StudentSkillResponse> {
  return apiRequest<StudentSkillResponse>(`/students/me/skills/${studentSkillId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      experienceLevel: input.experienceLevel,
      description: input.description,
      certificationReference: input.certificationReference,
    }),
  });
}

export function deleteStudentSkill(studentSkillId: string): Promise<void> {
  return apiRequest<void>(`/students/me/skills/${studentSkillId}`, {
    method: 'DELETE',
  });
}
