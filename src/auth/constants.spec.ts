import { PERMISSION } from './constants';
import { COPILOT_REQUEST_MANAGER_ROLES, USER_ROLE } from '../shared/constants';

describe('copilot request manager permissions', () => {
  const copilotPermissions = [
    PERMISSION.MANAGE_COPILOT_REQUEST,
    PERMISSION.ASSIGN_COPILOT_OPPORTUNITY,
    PERMISSION.CANCEL_COPILOT_OPPORTUNITY,
  ];

  it('includes talent managers on copilot request management rules', () => {
    copilotPermissions.forEach((permission) => {
      expect(permission.topcoderRoles).toEqual(COPILOT_REQUEST_MANAGER_ROLES);
      expect(permission.topcoderRoles).toEqual(
        expect.arrayContaining([
          USER_ROLE.TALENT_MANAGER,
          USER_ROLE.TOPCODER_TALENT_MANAGER,
        ]),
      );
    });
  });
});
