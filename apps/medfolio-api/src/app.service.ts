import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  getHealth(): { status: 'ok'; service: string } {
    return { status: 'ok', service: 'medfolio-api' };
  }
}
