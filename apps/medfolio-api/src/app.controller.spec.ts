import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DRIZZLE } from './database/drizzle.constants';

describe('AppController', () => {
  let appController: AppController;
  const execute = jest.fn();

  beforeEach(async () => {
    execute.mockReset();
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: DRIZZLE, useValue: { execute } }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('checks the database before reporting healthy', async () => {
      execute.mockResolvedValueOnce([]);

      await expect(appController.getHealth()).resolves.toEqual({
        status: 'ok',
        service: 'medfolio-api',
      });
      expect(execute).toHaveBeenCalledTimes(1);
    });

    it('does not report healthy when the database is unavailable', async () => {
      execute.mockRejectedValueOnce(new Error('connection refused'));

      await expect(appController.getHealth()).rejects.toMatchObject({
        status: 503,
      });
    });
  });
});
