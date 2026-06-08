import { IsInt, IsUUID, Min } from 'class-validator';

export class UpsertProgressDto {
  @IsInt()
  @Min(0)
  positionSeconds!: number;

  @IsUUID()
  titleId!: string;
}
