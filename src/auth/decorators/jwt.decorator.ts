import { SetMetadata } from '@nestjs/common';

export const JwtRequired = () => SetMetadata('jwtRequired', true);
