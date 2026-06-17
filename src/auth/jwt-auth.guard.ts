import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// Permet de bloquer l'accès au route si il n'y a pas de JWT valide
// https://docs.nestjs.com/guards
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers?.authorization as string;

    let token: string;

    if (authHeader) {
      const parts = authHeader.split(' ');
      if (parts.length !== 2 || parts[0] !== 'Bearer') {
        throw new UnauthorizedException('Invalid authorization header');
      }
      token = parts[1];
    } else {
      token = request.cookies?.accessToken as string;
      if (!token) {
        throw new UnauthorizedException('Missing authorization token');
      }
    }

    try {
      const payload = this.jwtService.verify(token);

      request.user = {
        id: payload.sub ?? payload.id,
        ...payload,
      };

      return true;
    } catch (err) {
      console.error('JWT verification failed:', err);
      throw new UnauthorizedException('Invalid token');
    }
  }
}
