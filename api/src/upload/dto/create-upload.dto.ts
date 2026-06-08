import { IsInt, IsNotEmpty, IsString, Max, Min } from 'class-validator';

export class CreateUploadDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsString()
  @IsNotEmpty()
  synopsis!: string;

  @IsInt()
  @Min(1888)
  @Max(2100)
  year!: number;

  /**
   * Original filename, used to derive the file extension for the storage key.
   * E.g. "big_buck_bunny.mp4" → extension "mp4".
   */
  @IsString()
  @IsNotEmpty()
  filename!: string;

  /**
   * MIME type of the upload (e.g. "video/mp4").
   * Passed to the pre-signed URL so MinIO enforces Content-Type on the PUT.
   */
  @IsString()
  @IsNotEmpty()
  contentType!: string;
}
