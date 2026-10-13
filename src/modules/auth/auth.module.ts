import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SysUserEntity } from './entities/sys-user.entity';
import { WorkspaceMemberEntity } from './entities/workspace-member.entity';
import { JwtStrategy } from './strategy/jwt.strategy';
import { WorkspacePermissionService } from './workspace-permission.service';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') ?? 'dev-secret-change-me',
        signOptions: { expiresIn: '7d' }
      })
    }),
    TypeOrmModule.forFeature([SysUserEntity, WorkspaceMemberEntity])
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, WorkspacePermissionService],
  exports: [AuthService, WorkspacePermissionService]
})
export class AuthModule {}

