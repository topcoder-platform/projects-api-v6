import { ProjectMemberRole } from '@prisma/client';
import { UserRole } from 'src/shared/enums/userRole.enum';
import { validateUserHasProjectRole } from './member.utils';

describe('validateUserHasProjectRole', () => {
  [UserRole.TALENT_MANAGER, UserRole.TOPCODER_TALENT_MANAGER].forEach(
    (topcoderRole) => {
      it(`accepts ${topcoderRole} for manager project role validation`, () => {
        expect(
          validateUserHasProjectRole(ProjectMemberRole.manager, [topcoderRole]),
        ).toBe(true);
      });
    },
  );
});
