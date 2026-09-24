import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { UsernamesController } from './usernames.controller';
import { UsernamesService } from './usernames.service';
import {
  UsernameConflictError,
  UsernameLimitExceededError,
} from './errors';
import { createInMemorySeedStore } from '../testing/in-memory-seed.store';
import { createTestIsolation } from '../testing/test-isolation.util';
import {
  type FeaturedProfileResult,
  type SearchProfileResult,
  type TrendingCreatorResult,
  type UsernameRow,
} from './usernames.repository';

describe('UsernamesController', () => {
  let controller: UsernamesController;
  let usernamesService: jest.Mocked<UsernamesService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let isolation: ReturnType<typeof createTestIsolation>;
  let seed: ReturnType<typeof createInMemorySeedStore>['rows'];
  let validPublicKey: string;

  beforeEach(async () => {
    const store = createInMemorySeedStore();
    isolation = createTestIsolation(store.client);
    await isolation.seed();

    seed = store.rows;
    validPublicKey = seed('users')[0].public_key as string;

    const mockCreate = jest.fn().mockResolvedValue({ ok: true });
    const mockListByPublicKey = jest.fn().mockResolvedValue([]);
    const mockGetTrendingCreators = jest.fn().mockResolvedValue({ data: [], next_cursor: null, has_more: false });
    const mockGetRecentlyActiveUsers = jest.fn().mockResolvedValue({ data: [], next_cursor: null, has_more: false });
    const mockGetFeaturedCreators = jest.fn().mockResolvedValue({ data: [], next_cursor: null, has_more: false });
    const mockEmit = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsernamesController],
      providers: [
        {
          provide: UsernamesService,
          useValue: {
            create: mockCreate,
            listByPublicKey: mockListByPublicKey,
            getTrendingCreators: mockGetTrendingCreators,
            getRecentlyActiveUsers: mockGetRecentlyActiveUsers,
            getFeaturedCreators: mockGetFeaturedCreators,
          },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: mockEmit },
        },
      ],
    }).compile();

    controller = module.get<UsernamesController>(UsernamesController);
    usernamesService = module.get(UsernamesService) as jest.Mocked<UsernamesService>;
    eventEmitter = module.get(EventEmitter2) as jest.Mocked<EventEmitter2>;
  });

  afterEach(async () => {
    await isolation.cleanup();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createUsername', () => {
    it('returns 201 and ok: true on success', async () => {
      const body = { username: 'alice_123', publicKey: validPublicKey };
      const result = await controller.createUsername(body);
      expect(result).toEqual({ ok: true });
      expect(usernamesService.create).toHaveBeenCalledWith('alice_123', validPublicKey);
      // The `username.claimed` event is now staged in the transactional outbox
      // by the service and dispatched asynchronously, so the controller must no
      // longer emit it directly.
      expect(eventEmitter.emit).not.toHaveBeenCalledWith(
        'username.claimed',
        expect.anything(),
      );
    });

    it('throws ConflictException when username is already taken', async () => {
      usernamesService.create.mockRejectedValueOnce(
        new UsernameConflictError('taken'),
      );
      const body = { username: 'taken', publicKey: validPublicKey };
      const err = await controller.createUsername(body).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.response).toMatchObject({
        code: 'USERNAME_CONFLICT',
        message: expect.stringContaining('taken'),
      });
    });

    it('throws ForbiddenException when wallet limit exceeded', async () => {
      usernamesService.create.mockRejectedValueOnce(
        new UsernameLimitExceededError(validPublicKey, 2),
      );
      const body = { username: 'newuser', publicKey: validPublicKey };
      const err = await controller.createUsername(body).catch((e) => e);
      expect(err).toBeInstanceOf(ForbiddenException);
      expect(err.response).toMatchObject({ code: 'USERNAME_LIMIT_EXCEEDED' });
    });
  });

  describe('listUsernames', () => {
    it('returns usernames for wallet from the seeded dataset', async () => {
      const rows = seed('usernames').filter(
        (u) => u.public_key === validPublicKey,
      ) as unknown as UsernameRow[];
      usernamesService.listByPublicKey.mockResolvedValueOnce(rows);
      const result = await controller.listUsernames({ publicKey: validPublicKey });
      expect(result).toEqual({ usernames: rows });
      expect(usernamesService.listByPublicKey).toHaveBeenCalledWith(validPublicKey);
    });
  });

  describe('getTrendingCreators', () => {
    it('maps ranked creators to the response shape and forwards pagination info', async () => {
      const creators = seed('usernames').filter(
        (u) => u.is_public === true,
      ) as unknown as TrendingCreatorResult[];
      usernamesService.getTrendingCreators.mockResolvedValueOnce({
        data: creators,
        next_cursor: 'next-page-cursor',
        has_more: true,
      });

      const result = await controller.getTrendingCreators({ timeWindowHours: 24, limit: 10 });

      expect(usernamesService.getTrendingCreators).toHaveBeenCalledWith(24, 10, undefined);
      expect(result.creators).toEqual(
        creators.map((u) => ({
          id: u.id,
          username: u.username,
          publicKey: u.public_key,
          lastActiveAt: u.last_active_at || u.created_at,
          createdAt: u.created_at,
          transactionVolume: u.transaction_volume,
          transactionCount: u.transaction_count,
        })),
      );
      expect(result.timeWindowHours).toBe(24);
      expect(result.next_cursor).toBe('next-page-cursor');
      expect(result.has_more).toBe(true);
    });
  });

  describe('getRecentlyActive', () => {
    it('maps recently active users to the response shape and forwards pagination info', async () => {
      const users = seed('usernames') as unknown as SearchProfileResult[];
      usernamesService.getRecentlyActiveUsers.mockResolvedValueOnce({
        data: users,
        next_cursor: null,
        has_more: false,
      });

      const result = await controller.getRecentlyActive({ timeWindowHours: 24, limit: 10 });

      expect(usernamesService.getRecentlyActiveUsers).toHaveBeenCalledWith(24, 10, undefined);
      expect(result.users).toEqual(
        users.map((u) => ({
          id: u.id,
          username: u.username,
          publicKey: u.public_key,
          lastActiveAt: u.last_active_at || u.created_at,
          createdAt: u.created_at,
        })),
      );
      expect(result.has_more).toBe(false);
      expect(result.next_cursor).toBeNull();
    });
  });

  describe('getFeaturedCreators', () => {
    it('maps featured creators to the response shape and forwards pagination info', async () => {
      const creators = seed('usernames').filter(
        (u) => u.featured_rank !== null,
      ) as unknown as FeaturedProfileResult[];
      usernamesService.getFeaturedCreators.mockResolvedValueOnce({
        data: creators,
        next_cursor: null,
        has_more: false,
      });

      const result = await controller.getFeaturedCreators({ limit: 10 });

      expect(usernamesService.getFeaturedCreators).toHaveBeenCalledWith(10, undefined);
      expect(result.profiles).toEqual(
        creators.map((u) => ({
          id: u.id,
          username: u.username,
          publicKey: u.public_key,
          lastActiveAt: u.last_active_at || u.created_at,
          createdAt: u.created_at,
          featuredRank: u.featured_rank,
        })),
      );
      expect(result.has_more).toBe(false);
    });
  });
});