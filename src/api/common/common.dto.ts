import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";


export class FieldsQueryDto {

  @ApiPropertyOptional({
    name: 'fields',
    description: 'Fields you want in response'
  })
  @IsOptional()
  @IsString()
  fields?: string;
}
