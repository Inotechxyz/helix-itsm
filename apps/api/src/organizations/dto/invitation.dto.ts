import { IsString, IsEmail, IsOptional, IsEnum, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum OrganizationRoleEnum {
  ORGADMIN = 'orgadmin',
  MANAGER = 'manager',
  AGENT = 'agent',
  REQUESTER = 'requester',
}

export class InviteUserDto {
  @ApiProperty({ description: 'Email address of the user to invite', type: String })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: OrganizationRoleEnum, description: 'Organization role to assign' })
  @IsEnum(OrganizationRoleEnum)
  orgRole!: OrganizationRoleEnum;

  @ApiPropertyOptional({ description: 'Optional message to include in the invitation' })
  @IsString()
  @IsOptional()
  message?: string;
}

export class BulkInviteUserDto {
  @ApiProperty({ description: 'List of invitations to send', type: [InviteUserDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InviteUserDto)
  invitations!: InviteUserDto[];
}

export class AcceptInvitationDto {
  @ApiProperty({ description: 'Invitation token' })
  @IsString()
  token!: string;

  @ApiProperty({ description: 'User ID (for existing users accepting invitation)' })
  @IsString()
  userId!: string;
}

export class ResendInvitationDto {
  @ApiProperty({ description: 'Invitation ID' })
  @IsString()
  invitationId!: string;
}
