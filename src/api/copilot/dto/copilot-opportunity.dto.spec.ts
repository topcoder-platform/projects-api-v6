import {
  CopilotApplicationStatus,
  CopilotOpportunityStatus,
  CopilotOpportunityType,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListOpportunitiesQueryDto } from './copilot-opportunity.dto';

describe('ListOpportunitiesQueryDto', () => {
  it('normalizes modern and legacy list-filter forms', async () => {
    const dto = plainToInstance(ListOpportunitiesQueryDto, {
      page: '2',
      perPage: '12',
      status: { $in: ['active,completed'] },
      projectType: 'dev,ai',
      skill: ['Node.js', 'React'],
      myApplications: 'true',
      applicationStatus: 'pending,invited',
    });

    await expect(validate(dto)).resolves.toEqual([]);
    expect(dto).toMatchObject({
      page: 2,
      perPage: 12,
      status: [
        CopilotOpportunityStatus.active,
        CopilotOpportunityStatus.completed,
      ],
      projectType: [CopilotOpportunityType.dev, CopilotOpportunityType.ai],
      skill: ['Node.js', 'React'],
      myApplications: true,
      applicationStatus: [
        CopilotApplicationStatus.pending,
        CopilotApplicationStatus.invited,
      ],
    });
  });

  it('rejects unsupported statuses and oversized pages', async () => {
    const dto = plainToInstance(ListOpportunitiesQueryDto, {
      pageSize: '201',
      status: 'unknown',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['pageSize', 'status']),
    );
  });
});
