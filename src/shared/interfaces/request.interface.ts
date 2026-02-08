import { Request } from 'express';
import { JwtUser } from '../modules/global/jwt.service';
import { ProjectContext } from './permission.interface';

export type AuthenticatedRequest = Request & {
  user?: JwtUser;
  projectContext?: ProjectContext;
};
