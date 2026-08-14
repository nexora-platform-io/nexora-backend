import { ApiProperty } from '@nestjs/swagger';

export class AuthUserResponse {
  @ApiProperty({ example: '01JQ3V5Z6K7M8N9P0Q1R2S3T4U' })
  id!: string;

  @ApiProperty({ example: 'qwerty@example.com', format: 'email' })
  email!: string;

  @ApiProperty({ example: 'qwerty' })
  username!: string;
}

export class AuthSessionResponse {
  @ApiProperty({ type: AuthUserResponse })
  user!: AuthUserResponse;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;
}

export class AccessTokenResponse {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;
}

export class AuthSessionEnvelope {
  @ApiProperty({ type: AuthSessionResponse })
  data!: AuthSessionResponse;
}

export class AccessTokenEnvelope {
  @ApiProperty({ type: AccessTokenResponse })
  data!: AccessTokenResponse;
}

export class AuthUserEnvelopeResponse {
  @ApiProperty({ type: AuthUserResponse })
  data!: AuthUserResponse;
}

export class MessageResponse {
  @ApiProperty({ example: 'Logged out successfully' })
  message!: string;
}
