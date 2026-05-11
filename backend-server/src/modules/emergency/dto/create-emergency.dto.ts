import { IsString, IsNotEmpty, IsNumber, IsOptional, IsObject } from 'class-validator';

export class CreateEmergencyDto {
  @IsString()
  @IsNotEmpty()
  citizenName: string;

  @IsString()
  @IsOptional()
  citizenId?: string;

  @IsString()
  @IsNotEmpty()
  emergencyType: string;

  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @IsNumber()
  @IsNotEmpty()
  longitude: number;

  @IsObject()
  @IsOptional()
  location?: {
    lat: number;
    lng: number;
  };

  @IsNumber()
  @IsOptional()
  timestamp?: number;
}
