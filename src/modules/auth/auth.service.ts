import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { SysUserEntity } from './entities/sys-user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(SysUserEntity)
    private readonly userRepo: Repository<SysUserEntity>,
    private readonly jwtService: JwtService
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.userRepo.findOne({ where: { email: dto.email } });
    if (exists) throw new ConflictException('email already exists');

    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS ?? '10', 10);
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.userRepo.save(
      this.userRepo.create({
        email: dto.email,
        passwordHash,
        displayName: dto.displayName
      })
    );

    // First user of the system creates the initial admin role via workspace membership later.
    return { userId: user.id, email: user.email };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepo.findOne({ where: { email: dto.email, status: 1 } });
    if (!user) throw new UnauthorizedException('invalid credentials');

    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('invalid credentials');

    const jwtSecret = process.env.JWT_SECRET ?? 'dev-secret-change-me';
    const token = YOUR_SECRET this.jwtService.signAsync({ sub: user.id, email: user.email }, { secret: jwtSecret });

    return { accessToken: YOUR_SECRET, tokenType: 'Bearer', user: { userId: user.id, email: user.email } };
  }
}

